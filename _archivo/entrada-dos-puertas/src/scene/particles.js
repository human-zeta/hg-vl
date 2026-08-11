// Sistema de particulas GPGPU.
//
// La posicion de cada particula vive en un texel de una textura de punto
// flotante. Un pase fullscreen integra todas las posiciones a la vez en el
// fragment shader, y el vertex shader del dibujado lee esa textura con
// texelFetch. La CPU no toca ni una particula: en todo el frame no hay un solo
// bucle sobre 65.536 elementos en JavaScript.
//
// Es la misma estructura que Active Theory llama "Antimatter" en su bundle
// (AntimatterPosition.vs / AntimatterPass.vs / AntimatterCopy.fs).
// Ver dossier §8.

import { Program, RenderTarget, PingPong, drawFullscreen } from '../core/gl.js';

export class Particles {
    constructor(gl, lib, grid) {
        this.gl = gl;
        this.grid = grid;
        this.count = grid * grid;

        // RGBA32F: xyz posicion, w vida. Con half float (16 bits) las
        // posiciones se cuantizan de forma visible cuando la particula se
        // aleja del origen — aparece un temblor en escalones.
        const fmt = {
            internalFormat: gl.RGBA32F,
            format: gl.RGBA,
            type: gl.FLOAT,
            filter: gl.NEAREST   // nunca interpolamos entre particulas vecinas
        };

        // Una sola semilla para los tres targets: tInit tiene que contener
        // exactamente las posiciones de arranque, porque es adonde vuelve cada
        // particula al renacer. Generarla dos veces daria dos nubes distintas.
        this.seed = this._seed();

        this.state = new PingPong(gl, grid, grid, fmt);
        this.initial = new RenderTarget(gl, grid, grid, { ...fmt, data: this.seed });

        this.simProgram  = lib.program(gl, Program, 'Fullscreen.vs', 'SimPosition.fs', 'SimPosition');
        this.drawProgram = lib.program(gl, Program, 'Particles.vs', 'Particles.fs', 'Particles');

        this._prime();
    }

    // Distribucion inicial: disco horizontal con densidad mayor al centro y
    // algo de espesor. sqrt(random) da area uniforme; sin el, las particulas
    // se amontonan en el centro.
    _seed() {
        const data = new Float32Array(this.count * 4);
        for (let i = 0; i < this.count; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * 2.6;
            data[i * 4 + 0] = Math.cos(a) * r;
            // El rango vertical excede el desvanecido de vEdge (|y| = 1.5→2.6)
            // por los dos lados. Si coincidieran, la nube terminaria en un
            // canto recto justo donde arranca la distribucion.
            data[i * 4 + 1] = -2.9 + Math.random() * 4.8;
            data[i * 4 + 2] = Math.sin(a) * r;
            // Vidas escalonadas: si todas arrancan en 1.0 mueren juntas y la
            // nube parpadea entera cada 18 segundos.
            data[i * 4 + 3] = Math.random();
        }
        return data;
    }

    // Copia el estado inicial a los dos targets del ping-pong antes del primer
    // frame. Sin esto el primer paso de simulacion lee memoria sin inicializar.
    _prime() {
        const gl = this.gl;
        for (const rt of [this.state.a, this.state.b]) {
            gl.bindTexture(gl.TEXTURE_2D, rt.texture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.grid, this.grid,
                             gl.RGBA, gl.FLOAT, this.seed);
        }
    }

    simulate(time, delta, { attract = [0, 0, 0], pull = 0 } = {}) {
        const gl = this.gl;
        const target = this.state.write;

        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        target.bind(true);   // se pisa entero: no cargar el contenido anterior

        this.simProgram.use({
            tPos: this.state.read.texture,
            tInit: this.initial.texture,
            uTime: time,
            // El delta de simulacion se acota aparte del delta del loop: un
            // frame largo puede aceptarse para el resto de la escena pero no
            // para una integracion, donde se traduce en particulas que
            // atraviesan el volumen de un salto.
            uDelta: Math.min(delta, 1 / 30),
            uAttract: attract,
            uPull: pull
        });
        drawFullscreen(gl);

        this.state.swap();
    }

    draw(projection, view, resolution, size, door) {
        const gl = this.gl;

        // Aditivo con color premultiplicado (ONE/ONE), no SRC_ALPHA/ONE: el
        // fragment ya entrega col*energy, asi que el aporte es lineal en la
        // energia. Con SRC_ALPHA se multiplicaria una segunda vez.
        // Sin escritura de profundidad, porque la suma es conmutativa y
        // ordenar 65.536 puntos por distancia costaria mas que dibujarlos.
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.depthMask(false);

        this.drawProgram.use({
            tPos: this.state.read.texture,
            uProjection: projection,
            uView: view,
            uResolution: resolution,
            uSize: size,
            uGrid: this.grid,
            uDoor: door,
            // El acido de marca tiene luminancia muy alta (~0.89): sobre el
            // umbral de bloom casi cualquier particula acida florece. Se
            // compensa bajando su energia en vez de subiendo el umbral, que
            // conserva mejor el contraste. Ver docs/particulas.md §8.
            // 1.15 y no 1.7 como en la landing de referencia: alla la nube
            // estaba corrida a la derecha con el texto sobre fondo limpio;
            // aca el texto ocupa las dos mitades y la nube pasa por debajo de
            // todo. Un fondo que compite con lo que hay que leer es un fondo
            // mal calibrado, por lindo que sea.
            uEnergy: 1.15 - 0.30 * Math.max(-door, 0)
        });

        gl.drawArrays(gl.POINTS, 0, this.count);

        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }
}
