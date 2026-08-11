// Escena de la entrada HG·VL.
//
// Diferencia con la landing de referencia: aca no hay scroll. La pagina es un
// portal de dos puertas que entra en una pantalla, y el parametro que manda la
// escena no es el avance vertical sino CUAL PUERTA esta activa.
//
// El estado de puerta se llama `door` y va de -1 a +1:
//   -1  HUMAN GLITCHE  (izquierda, acido)
//    0  ninguna        (neutro)
//   +1  VISUAL LAB     (derecha, cyan)
//
// Todo lo demas —color de las particulas, atractor, haz de la juntura, deriva
// de camara— se deriva de ese unico numero. Un solo valor amortiguado en vez
// de cuatro animaciones sueltas: no pueden desincronizarse entre si.

import { createContext, Program, RenderTarget, drawFullscreen, perspective, lookAt } from '../core/gl.js';
import { ShaderLibrary } from '../core/shaders.js';
import { profile } from '../core/device.js';
import { Render, Phase } from '../core/render.js';
import { damp } from '../core/tween.js';
import { Particles } from './particles.js';
import { Post } from './post.js';
import { SolarSystem } from './solar.js';

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

        this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };

        // Velocidad del puntero, normalizada y amortiguada. Alimenta el
        // refuerzo de la aberracion cromatica y la inclinacion de los textos.
        this.pointerSpeed = 0;
        this._prevTx = 0;
        this._prevTy = 0;

        // Objetivos y valores amortiguados. El objetivo lo mueve el DOM; el
        // valor lo persigue el render loop.
        this.doorTarget = 0;
        this.door = 0;
        this.pullTarget = 0;
        this.pull = 0;
        this.glitch = 0;

        this._onPointer = this._onPointer.bind(this);
        this._onResize = this._onResize.bind(this);
    }

    async load(shaderURL, onProgress) {
        onProgress?.(0.1);
        this.lib = await ShaderLibrary.load(shaderURL);
        onProgress?.(0.45);

        const gl = this.gl;
        this.field = this.lib.program(gl, Program, 'Fullscreen.vs', 'Field.fs', 'Field');
        onProgress?.(0.6);

        if (this.quality.grid > 0) {
            this.particles = new Particles(gl, this.lib, this.quality.grid);
        }
        onProgress?.(0.72);

        // Sistema solar detras de la juntura.
        //
        // Hace el mismo trabajo que hacia la icosfera suelta que estaba antes
        // —dar ESCALA a una nube que por si sola no tiene tamaño de
        // referencia— pero suma jerarquia y tiempo: hay un centro, hay cuerpos
        // que lo recorren, y el conjunto cambia mientras alguien mira. Una
        // esfera girando es un objeto; esto es un lugar.
        if (this.quality.mesh > 0) {
            this.solar = new SolarSystem(gl, this.lib, this.quality.mesh);
        }
        onProgress?.(0.85);

        this._onResize();
        this.post = new Post(gl, this.lib, Math.max(1, this.width), Math.max(1, this.height), this.quality);

        // El campo se dibuja a MITAD de resolucion: son dos fbm de cinco
        // octavas por pixel y lo que producen es un degradado de frecuencia
        // baja, sin un detalle que sobreviva a mirarlo de cerca. Las
        // particulas si van a resolucion nativa, ahi el pixel importa.
        this.fieldRT = new RenderTarget(gl, Math.max(1, this.width >> 1), Math.max(1, this.height >> 1), {
            internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT, filter: gl.LINEAR
        });

        // Frame de calentamiento fuera de pantalla: la primera vez que se usa
        // un programa el driver termina de compilarlo, y ese costo caeria
        // justo sobre el primer frame visible.
        this.frame(0, 0);
        gl.finish();
        onProgress?.(1);

        // ResizeObserver y no el evento resize: en el arranque el layout puede
        // no estar resuelto y innerWidth devuelve 0. Como el viewport nunca
        // cambia despues, no llega ningun evento que lo corrija y la escena
        // queda en 0×0. El observer entrega el tamaño actual apenas observa.
        this._observer = new ResizeObserver(this._onResize);
        this._observer.observe(document.documentElement);
        window.addEventListener('resize', this._onResize);   // cambios de DPR
        window.addEventListener('pointermove', this._onPointer, { passive: true });

        Render.on(Phase.RENDER, (dt, time) => this.frame(dt, time));
        return this;
    }

    // -- API para el DOM -------------------------------------------------

    // which: 'hg' | 'vl' | null
    setDoor(which) {
        this.doorTarget = which === 'hg' ? -1 : which === 'vl' ? 1 : 0;
        this.pullTarget = which ? 1 : 0;
    }

    // Pulso de glitch. Decae solo en el render loop.
    pulse(amount = 1) {
        this.glitch = Math.min(1, this.glitch + amount);
    }

    // -- Interno ---------------------------------------------------------

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
    }

    _updatePointer(dt) {
        // Velocidad medida sobre el objetivo CRUDO, no sobre el amortiguado:
        // el amortiguado ya perdio el pico del gesto, que es justamente lo que
        // se quiere capturar. El suavizado se aplica despues, sobre el
        // resultado, con una constante mas lenta al bajar que al subir — asi
        // el efecto engancha rapido y se va con calma.
        const moved = Math.hypot(this.pointer.tx - this._prevTx,
                                 this.pointer.ty - this._prevTy) / Math.max(dt, 1e-4);
        this._prevTx = this.pointer.tx;
        this._prevTy = this.pointer.ty;

        const target = Math.min(moved * 0.10, 1);
        this.pointerSpeed = damp(this.pointerSpeed, target,
                                 target > this.pointerSpeed ? 14 : 3.5, dt);

        // El puntero se amortigua fuerte: el movimiento va un poco atras del
        // cursor. Si lo sigue exacto se siente rigido, como pegado al vidrio.
        this.pointer.x = damp(this.pointer.x, this.pointer.tx, 3.5, dt);
        this.pointer.y = damp(this.pointer.y, this.pointer.ty, 3.5, dt);
    }

    _updateCamera(dt) {

        // La camara se corre HACIA la puerta activa y se acerca apenas. Es el
        // mismo gesto de inclinarse sobre algo que se esta por elegir.
        const eye = [
            this.pointer.x * 0.55 + this.door * 0.55,
            0.30 + this.pointer.y * 0.35,
            5.30 - this.pull * 0.45
        ];
        const target = [this.door * 0.30, 0, 0];

        perspective(this.projection, (55 * Math.PI) / 180,
                    this.width / this.height, 0.1, 60);
        lookAt(this.view, eye, target, [0, 1, 0]);
    }

    frame(dt, time) {
        const gl = this.gl;
        // Sin superficie no hay nada que dibujar, y aspect = 0/0 daria NaN en
        // la matriz de proyeccion.
        if (!this.post || this.width < 2 || this.height < 2) return;

        this.door = damp(this.door, this.doorTarget, 5.0, dt);
        this.pull = damp(this.pull, this.pullTarget, 4.0, dt);
        // Decaimiento exponencial del glitch: sube de golpe, baja solo.
        this.glitch = damp(this.glitch, 0, 4.5, dt);

        this._updatePointer(dt);
        this._updateCamera(dt);

        // El centro optico de la aberracion sigue al puntero amortiguado.
        // Se usa el amortiguado y no el crudo: con el crudo el centro salta
        // pixel a pixel y toda la pantalla titila alrededor del cursor.
        this.post.abCenter[0] = (this.pointer.x + 1) * 0.5;
        this.post.abCenter[1] = (this.pointer.y + 1) * 0.5;
        this.post.abBoost = this.pointerSpeed;

        const res = [this.width, this.height];

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);

        // 1. Campo a media resolucion.
        this.fieldRT.bind(true);
        this.field.use({
            uTime: time,
            uDoor: this.door,
            uSeam: this.pull,
            // Aspecto calculado con la resolucion LOGICA, no la del target: si
            // no, el campo se deforma al bajar de escala.
            uResolution: res,
            uPointer: [this.pointer.x * 0.35, this.pointer.y * 0.35],
            uIntensity: this.particles ? 0.80 : 2.40
        });
        drawFullscreen(gl);

        // 2. Subirlo al target de escena. El filtrado bilineal del blit hace la
        //    interpolacion; no hace falta un pase de upsample propio.
        this.post.scene.bind();
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this.post.blit.use({ tDiffuse: this.fieldRT.texture });
        drawFullscreen(gl);

        // 3. Malla, antes de las particulas y con el mismo blend aditivo.
        //
        // Sin escritura de profundidad a proposito: es una cascara emisiva,
        // no un solido. Con depth write ocultaria las particulas que pasan
        // por detras, y lo que se busca es justamente que la nube la
        // atraviese — que se lea como un volumen dentro del polvo y no como
        // una calcomania encima.
        if (this.solar) {
            // Bien atras. El sistema tiene que estar DETRAS de la nube: su
            // trabajo es que el polvo tenga contra que medirse, no competir
            // con el.
            // La escala se calibro para que la orbita mas externa entre
            // completa en el encuadre. Con el sistema mas grande los anillos
            // exteriores se cortan contra los bordes y dejan de leerse como un
            // sistema: pasan a ser arcos sueltos cruzando la pantalla.
            this.solar.setTransform(time, 0.88, [0, 0.02, -2.10]);

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE);
            gl.depthMask(false);

            this.solar.draw({
                uProjection: this.projection,
                uView: this.view,
                uTime: time,
                uDoor: this.door,
                // El refuerzo en hover es chico: con el sistema muy brillante,
                // el bloom y la estela lo convierten en una lampara que deja
                // ilegible el texto de la puerta atenuada. Acompaña la
                // eleccion, no la celebra.
                uOpacity: 0.80 + 0.18 * this.pull
            });

            gl.depthMask(true);
            gl.disable(gl.BLEND);
        }

        // 4. Particulas a resolucion nativa.
        if (this.particles) {
            // El atractor vive del lado de la puerta activa, adelante del
            // volumen para que la corriente venga hacia el espectador.
            this.particles.simulate(time, dt, {
                attract: [this.door * 2.4, 0.15, 1.1],
                pull: this.pull
            });
            this.post.scene.bind();
            this.particles.draw(this.projection, this.view, res,
                                this.quality.particleSize, this.door);
        }

        this.post.glitch = this.glitch;
        this.post.render(this.width, this.height, time);
    }

    dispose() {
        this._observer?.disconnect();
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('pointermove', this._onPointer);
    }
}
