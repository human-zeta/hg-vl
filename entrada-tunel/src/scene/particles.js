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
            // Cilindro CENTRADO EN LA CAMARA, no un tubo fijo ni una esfera.
            //
            // La esfera en el origen se veia desde afuera: un objeto lejano, no
            // un viaje. El tubo fijo de 24 unidades resolvia el tunel pero
            // repartia las mismas 65.536 particulas en ocho veces el volumen de
            // la nube original, y el campo quedaba ralo. Este volumen es chico
            // y acompaña al espectador, asi que la densidad que se ve es
            // siempre la de la primera landing.
            const r = Math.sqrt(Math.random()) * 2.4;
            data[i * 4 + 0] = Math.cos(a) * r;
            data[i * 4 + 1] = Math.sin(a) * r;
            // Z RELATIVO al centro que viaja con la camara, no absoluto.
            //
            // El rango coincide con la media longitud de la envoltura toroidal
            // (HALF_Z = 4 en SimPosition.fs). Al renacer, la particula vuelve a
            // `uCenterZ + init.z`, o sea a su lugar dentro del volumen movil.
            data[i * 4 + 2] = -4.0 + Math.random() * 8.0;
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

    simulate(time, delta, { attract = [0, 0, 0], pull = 0, centerZ = 0, rush = 0 } = {}) {
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
            uPull: pull,
            uCenterZ: centerZ,
            uRush: rush
        });
        drawFullscreen(gl);

        this.state.swap();
    }

    draw(projection, view, resolution, size, door, centerZ = 0, energyScale = 1) {
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
            uCenterZ: centerZ,
            uDoor: door,
            // 1.75, de vuelta al valor de la landing original.
            //
            // Con 1.15 la escena medía MÁS oscura de media (0,023 contra
            // 0,0306) pero su pico caía de 1,55 a 1,08: no le faltaba
            // oscuridad, le faltaban los brillos que la atraviesan. Una imagen
            // pareja y apagada se lee como plana; lo que se percibe como
            // contraste es negro profundo CON puntos que lo perforan.
            uEnergy: 1.75 * energyScale
        });

        gl.drawArrays(gl.POINTS, 0, this.count);

        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }
}
