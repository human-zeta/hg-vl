// Escena del tunel.
//
// El parametro que manda es QUE TAN ADENTRO: un solo numero, `descent`, de 0
// (afuera del sistema, VISUAL LAB) a 1 (frente al sol, HUMAN GLITCHE). De el
// salen la camara, el campo de vision, el tinte, la etapa del sistema solar y
// la entrada del render ASCII.
//
// Un valor amortiguado en vez de seis animaciones sueltas: no se pueden
// desincronizar entre si.
//
// No hay escalera. La version anterior la tenia como estructura literal del
// descenso; el efecto que valia era el tunel, y la escalera lo unico que hacia
// era tapar la mitad del encuadre con geometria.

import { createContext, Program, RenderTarget, drawFullscreen, perspective, lookAt } from '../core/gl.js';
import { ShaderLibrary } from '../core/shaders.js';
import { profile } from '../core/device.js';
import { Render, Phase } from '../core/render.js';
import { Scroll } from '../core/scroll.js';
import { damp, clamp, smoothstep } from '../core/tween.js';
import { Particles } from './particles.js';
import { Post } from './post.js';
import { SolarSystem } from './solar.js';
import { Corona } from './corona.js';
import { pathAt, lookAt as lookTarget, rollAt } from './path.js';

// Radio del sol al llegar: escala base de la tabla BODIES por su crecimiento
// de etapa. La corona lo necesita para dimensionar su cascara, y tomarlo de
// aca en vez de repetir el numero evita que se desincronicen.
const SUN_BASE = 0.52;

const MAX_PIXELS = 2_600_000;

export class Scene {
    constructor(canvas) {
        this.canvas = canvas;
        const { gl } = createContext(canvas);
        this.gl = gl;

        this.device = profile(gl);
        this.quality = this.device.quality;

        this.width = 0;
        this.height = 0;
        this.dpr = 1;

        this.projection = new Float32Array(16);
        this.view = new Float32Array(16);

        // Base de la camara, para que el raymarch de la corona construya sus
        // rayos sin tener que invertir la matriz de vista-proyeccion.
        this.cam = {
            eye: [0, 0, 0], forward: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0],
            tanHalfFov: 1, aspect: 1
        };

        this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
        this.pointerSpeed = 0;
        this._prevTx = 0;
        this._prevTy = 0;

        this.descent = 0;   // 0 superficie · 1 nucleo
        this.stage = 0;     // etapa del sistema solar
        this.glitch = 0;
        this.warp = 0;      // velocidad de scroll normalizada, amortiguada

        this._onPointer = this._onPointer.bind(this);
        this._onResize = this._onResize.bind(this);
    }

    async load(shaderURL, onProgress) {
        onProgress?.(0.1);
        this.lib = await ShaderLibrary.load(shaderURL);
        onProgress?.(0.4);

        const gl = this.gl;
        this.field = this.lib.program(gl, Program, 'Fullscreen.vs', 'Field.fs', 'Field');
        onProgress?.(0.55);

        if (this.quality.grid > 0) {
            this.particles = new Particles(gl, this.lib, this.quality.grid);
        }
        onProgress?.(0.70);

        if (this.quality.mesh > 0) {
            this.solar = new SolarSystem(gl, this.lib, this.quality.mesh);
        }
        onProgress?.(0.88);

        this._onResize();
        this.post = new Post(gl, this.lib, Math.max(1, this.width), Math.max(1, this.height), this.quality);

        this.fieldRT = new RenderTarget(gl, Math.max(1, this.width >> 1), Math.max(1, this.height >> 1), {
            internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT, filter: gl.LINEAR
        });

        // Corona solo en el nivel alto.
        //
        // Es el pase mas caro de la escena y movil sigue sin probarse: hasta
        // medir en un telefono real, el nivel medio viaja sin erupciones antes
        // que arriesgar el frame entero. El sol con su fuego queda igual en
        // todos los niveles con malla.
        if (this.quality.mesh >= 2) {
            this.corona = new Corona(gl, this.lib, this.width, this.height);
        }

        // Frame de calentamiento fuera de pantalla: la primera vez que se usa
        // un programa el driver termina de compilarlo, y ese costo caeria
        // sobre el primer frame visible.
        this.frame(0, 0);
        gl.finish();
        onProgress?.(1);

        // ResizeObserver y no el evento resize: en el arranque el layout puede
        // no estar resuelto y innerWidth devuelve 0. Como el viewport nunca
        // cambia despues, no llega ningun evento que lo corrija.
        this._observer = new ResizeObserver(this._onResize);
        this._observer.observe(document.documentElement);
        window.addEventListener('resize', this._onResize);   // cambios de DPR
        window.addEventListener('pointermove', this._onPointer, { passive: true });

        Render.on(Phase.RENDER, (dt, time) => this.frame(dt, time));
        return this;
    }

    pulse(amount = 1) {
        this.glitch = Math.min(1, this.glitch + amount);
    }

    // Estrobo de transicion. Corto y espaciado a proposito —solo se dispara
    // al cruzar de nivel, cuatro veces en todo el viaje— y nunca con
    // prefers-reduced-motion: un flash es exactamente lo que esa preferencia
    // pide evitar.
    flash(amount = 0.5) {
        if (this.device.reducedMotion) return;
        if (this.post) this.post.flash = Math.min(0.85, this.post.flash + amount);
    }

    _onPointer(e) {
        this.pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        this.pointer.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
    }

    _onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        let dpr = Math.min(window.devicePixelRatio || 1, this.quality.maxDPR);
        const pixels = w * h * dpr * dpr;
        if (pixels > MAX_PIXELS) dpr *= Math.sqrt(MAX_PIXELS / pixels);

        this.dpr = dpr;
        this.width = Math.round(w * dpr);
        this.height = Math.round(h * dpr);

        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';

        this.post?.resize(this.width, this.height);
        this.fieldRT?.resize(Math.max(1, this.width >> 1), Math.max(1, this.height >> 1));
        this.corona?.resize(this.width, this.height);
        Scroll.measure();
    }

    _updatePointer(dt) {
        // Velocidad medida sobre el objetivo crudo: el amortiguado ya perdio
        // el pico del gesto, que es lo que se quiere capturar. Ataque rapido,
        // caida lenta.
        const moved = Math.hypot(this.pointer.tx - this._prevTx,
                                 this.pointer.ty - this._prevTy) / Math.max(dt, 1e-4);
        this._prevTx = this.pointer.tx;
        this._prevTy = this.pointer.ty;

        const target = Math.min(moved * 0.10, 1);
        this.pointerSpeed = damp(this.pointerSpeed, target,
                                 target > this.pointerSpeed ? 14 : 3.5, dt);

        this.pointer.x = damp(this.pointer.x, this.pointer.tx, 3.5, dt);
        this.pointer.y = damp(this.pointer.y, this.pointer.ty, 3.5, dt);
    }

    // La camara vuela hacia el sol.
    //
    // Entra al sistema desde afuera y avanza en diagonal suave, cruzando los
    // planos orbitales. La deriva lateral es lo que hace que se pase CERCA de
    // los planetas: un acercamiento recto sobre el eje deja todo el sistema
    // quieto en el centro del encuadre durante todo el trayecto, y entonces no
    // hay viaje, hay un zoom.
    _updateCamera(dt) {
        const p = pathAt(this.descent);
        const l = lookTarget(this.descent);

        const eye = [
            p.x + this.pointer.x * 0.30,
            p.y + this.pointer.y * 0.24,
            p.z
        ];

        // El campo de vision se cierra al llegar. Comprime la perspectiva y
        // hace que el sol llene el cuadro sin tener que acercarse tanto que la
        // camara le atraviese la superficie.
        // El campo se abre ademas con el warp: correr el scroll se siente
        // como correr.
        const fov = 62 - 15 * this.stage + 9 * this.warp;
        const aspect = this.width / this.height;

        perspective(this.projection, (fov * Math.PI) / 180, aspect, 0.05, 90);

        // Giro de barrena: la vuelta del transito rota el vector 'arriba'
        // alrededor del eje de vista. El DOM no gira — el mundo si, y ese
        // contraste es lo que lo hace legible ademas de epico.
        const roll = this.device.reducedMotion ? 0 : rollAt(this.descent);
        const fx0 = l.x - eye[0], fy0 = l.y - eye[1], fz0 = l.z - eye[2];
        const fl0 = Math.hypot(fx0, fy0, fz0) || 1;
        const f = [fx0 / fl0, fy0 / fl0, fz0 / fl0];
        let rx = -f[2], ry = 0, rz = f[0];
        const rl = Math.hypot(rx, ry, rz) || 1;
        rx /= rl; ry /= rl; rz /= rl;
        const ux = ry * f[2] - rz * f[1];
        const uy = rz * f[0] - rx * f[2];
        const uz = rx * f[1] - ry * f[0];
        const cr = Math.cos(roll), sr = Math.sin(roll);
        const upR = [ux * cr + rx * sr, uy * cr + ry * sr, uz * cr + rz * sr];
        const rR  = [rx * cr - ux * sr, ry * cr - uy * sr, rz * cr - uz * sr];

        lookAt(this.view, eye, [l.x, l.y, l.z], upR);

        // La misma base, ya con el roll, alimenta el raymarch de la corona:
        // si no giraran juntos, las erupciones quedarian derechas mientras
        // el mundo rota.
        const c = this.cam;
        c.eye = eye;
        c.forward = f;
        c.right = rR;
        c.up = upR;
        c.tanHalfFov = Math.tan((fov * Math.PI) / 360);
        c.aspect = aspect;
    }

    frame(dt, time) {
        const gl = this.gl;
        if (!this.post || this.width < 2 || this.height < 2) return;

        // Dos amortiguaciones sobre el scroll: la de Scroll saca el escalon de
        // la rueda, esta saca el que queda al arrastrar la barra de golpe.
        this.descent = damp(this.descent, Scroll.progress, 3.4, dt);
        this.stage = smoothstep(0.34, 1.0, this.descent);
        this.glitch = damp(this.glitch, 0, 4.5, dt);
        this.post.flash = damp(this.post.flash, 0, 12, dt);

        // Warp por velocidad de scroll: abre el campo, estira las estelas y
        // precipita el polvo. Con reduced-motion queda a un cuarto.
        const rushT = clamp(Math.abs(Scroll.velocity) / (Math.max(1, window.innerHeight) * 2.2), 0, 1);
        this.warp = damp(this.warp, this.device.reducedMotion ? rushT * 0.25 : rushT, 5, dt);

        this._updatePointer(dt);
        this._updateCamera(dt);

        // Tinte global: cyan de VISUAL LAB en la superficie, acido de HUMAN
        // GLITCHE en el nucleo. Es el mismo eje que antes recorrian las dos
        // puertas, ahora recorrido por profundidad.
        const tint = 1 - 2 * clamp(this.descent, 0, 1);
        const res = [this.width, this.height];

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);

        // 1. Campo a media resolucion.
        this.fieldRT.bind(true);
        this.field.use({
            uTime: time,
            uDoor: tint,
            uSeam: 0,
            uResolution: res,
            uPointer: [this.pointer.x * 0.35, this.pointer.y * 0.35],
            // 0,62: el campo tiene que dejar NEGRO entre las particulas. A 0,80 no
            // quedaba un solo pixel por debajo de 0,002 de luminancia, y el
            // negro absoluto es la mitad del contraste de una escena asi.
            uIntensity: (this.particles ? 0.62 : 2.40) * (1 - 0.55 * this.stage)
        });
        drawFullscreen(gl);

        // 2. Subirlo al target de escena.
        this.post.scene.bind();
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this.post.blit.use({ tDiffuse: this.fieldRT.texture });
        drawFullscreen(gl);

        // 3. Geometria, toda en aditivo y sin escritura de profundidad: son
        //    cascaras emisivas, no solidos, y la suma es conmutativa.
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.depthMask(false);

        const common = {
            uProjection: this.projection,
            uView: this.view,
            uTime: time
        };

        if (this.solar) {
            // El sistema vive en el origen y la camara viene hacia el. No se
            // mueve ni escala con el viaje: la sensacion de acercarse la da la
            // camara, y mover las dos cosas a la vez confunde la escala.
            this.solar.setTransform(time, 1.0, [0, 0, 0]);
            this.solar.draw({
                ...common,
                uDoor: tint,
                uStage: this.stage,
                // El sol se enciende al llegar: es el destino del viaje.
                uOpacity: 0.70 + 0.22 * this.stage
            });
        }

        gl.depthMask(true);
        gl.disable(gl.BLEND);

        // 3b. Corona y erupciones: raymarch a cuarto de resolucion, sumado
        //     encima. Solo cuando el sol ya esta cerca — lejos ocupa cuatro
        //     pixeles y el pase seria trabajo tirado.
        if (this.corona) {
            // Arranca tarde y el umbral de salto es alto: el raymarch es el
            // pase mas caro de la escena y no tiene sentido pagarlo mientras
            // el sol ocupa unos pocos pixeles. Con el umbral en 0,002 corria
            // durante todo el viaje aportando algo invisible.
            // Respiro irregular: dos senos inconmensurables, el brillo de
            // las erupciones nunca repite ciclo exacto.
            this.corona.strength = smoothstep(0.55, 0.88, this.descent)
                * (0.86 + 0.10 * Math.sin(time * 2.1) + 0.04 * Math.sin(time * 5.3));
            if (this.corona.strength > 0.03) {
                const sunR = SUN_BASE * (1 + this.stage * 0.55);
                this.corona.render(this.cam, time, sunR);

                this.post.scene.bind();
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE);
                this.post.blit.use({ tDiffuse: this.corona.target.texture });
                drawFullscreen(gl);
                gl.disable(gl.BLEND);
            }
        }

        // 4. Particulas a resolucion nativa. Son el tunel: la camara las
        //    atraviesa y el paralaje entre las cercanas y las lejanas es lo
        //    que produce la sensacion de velocidad.
        if (this.particles) {
            // El volumen de polvo viaja con la camara: se le pasa su Z como
            // centro de la envoltura toroidal.
            const centerZ = this.cam.eye[2];
            this.particles.simulate(time, dt, {
                attract: [0, 0, 0], pull: this.stage * 0.7, centerZ, rush: this.warp
            });
            this.post.scene.bind();
            this.particles.draw(this.projection, this.view, res,
                                this.quality.particleSize, tint, centerZ,
                                1 - 0.45 * this.stage);
        }

        this.post.abCenter[0] = (this.pointer.x + 1) * 0.5;
        this.post.abCenter[1] = (this.pointer.y + 1) * 0.5;
        this.post.abBoost = Math.max(this.pointerSpeed, this.warp * 0.8);
        this.post.glitch = this.glitch;

        // El ASCII entra sobre el final. Antes de 0,72 la imagen es limpia; en
        // el ultimo cuarto se disuelve en caracteres, y el momento de maxima
        // cercania al sol es tambien el de maxima abstraccion.
        this.post.ascii.mix = smoothstep(0.72, 0.97, this.descent);

        // Al llegar, la optica se calma.
        //
        // El bloom y la estela son lo que da atmosfera durante el viaje, pero
        // sobre el sol difuminan el limbo hasta convertirlo en un degradado que
        // cubre medio cuadro. El ASCII promedia ese degradado y las erupciones
        // desaparecen dentro de el. Bajandolos, el borde vuelve a cortar contra
        // el negro y los filamentos tienen sobre que leerse.
        this.post.bloomAmount = 0.55 * (1 - 0.82 * this.stage);
        this.post.streakAmount = 0.30 * (1 - 0.80 * this.stage) * (1 + 1.5 * this.warp);

        this.post.render(this.width, this.height, time);
    }

    dispose() {
        this._observer?.disconnect();
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('pointermove', this._onPointer);
    }
}
