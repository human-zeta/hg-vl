// Post-proceso: bloom piramidal y composite final.
//
// El bloom no es "poner un blur encima". Es una piramide: se extraen los
// pixeles brillantes, se desenfocan a tres escalas distintas y se suman con
// pesos decrecientes. Una sola escala da un halo plano de radio fijo; tres dan
// el falloff largo que el ojo lee como luz real. Es la estructura que Active
// Theory tiene como UnrealBloomLuminosity / UnrealBloomGaussian /
// UnrealBloomComposite. Ver dossier §9.
//
// Todo el post corre a MITAD de resolucion. El bloom es, por definicion, la
// parte desenfocada de la imagen: gastar 4x los pixeles en desenfocar algo es
// pagar por precision que despues se tira.

import { Program, RenderTarget, drawFullscreen, bindScreen } from '../core/gl.js';
import { Ascii } from './ascii.js';

const LEVELS = 3;

export class Post {
    constructor(gl, lib, width, height, quality) {
        this.gl = gl;
        this.quality = quality;
        this.enabled = quality.bloom;

        const hdr = {
            internalFormat: gl.RGBA16F,
            format: gl.RGBA,
            type: gl.HALF_FLOAT,
            filter: gl.LINEAR
        };

        // La escena se dibuja en HDR: los valores pueden pasar de 1.0 y esa
        // reserva por encima del blanco es lo que le da al bloom algo que
        // extraer. En 8 bits todo se recorta en 1.0 y el umbral no distingue
        // un highlight de una superficie blanca.
        this.scene = new RenderTarget(gl, width, height, { ...hdr, depth: true });

        // No hay target de "bright" separado: el pase de umbral escribe
        // directamente en el mip 0. Tenerlo aparte costaba un pase de pantalla
        // completa y un cambio de framebuffer para producir una textura
        // identica en tamaño a su destino.
        this.mips = [];
        for (let i = 0; i < LEVELS; i++) {
            const w = Math.max(1, width >> (i + 1));
            const h = Math.max(1, height >> (i + 1));
            this.mips.push({
                a: new RenderTarget(gl, w, h, hdr),
                b: new RenderTarget(gl, w, h, hdr)
            });
        }
        this.bloom = new RenderTarget(gl, width >> 1, height >> 1, hdr);

        // Estela anamorfica a CUARTO de resolucion. Es un desenfoque de varios
        // cientos de pixeles de largo: resolverlo fino es pagar por detalle
        // que el propio efecto destruye.
        this.streak = {
            a: new RenderTarget(gl, Math.max(1, width >> 2), Math.max(1, height >> 2), hdr),
            b: new RenderTarget(gl, Math.max(1, width >> 2), Math.max(1, height >> 2), hdr)
        };

        this.luminosity = lib.program(gl, Program, 'Fullscreen.vs', 'BloomLuminosity.fs', 'BloomLuminosity');
        this.blur       = lib.program(gl, Program, 'Fullscreen.vs', 'BloomBlur.fs', 'BloomBlur');
        this.combine    = lib.program(gl, Program, 'Fullscreen.vs', 'BloomComposite.fs', 'BloomComposite');
        this.streakPass = lib.program(gl, Program, 'Fullscreen.vs', 'LensStreak.fs', 'LensStreak');
        this.composite  = lib.program(gl, Program, 'Fullscreen.vs', 'Composite.fs', 'Composite');
        this.blit       = lib.program(gl, Program, 'Fullscreen.vs', 'Blit.fs', 'Blit');

        this.fade = 0;     // lo mueve la coreografia de entrada
        this.dim = 1;
        this.glitch = 0;   // lo mueve Scene.pulse(), decae solo
        this.flash = 0;    // estrobo de transicion; lo mueve Scene.flash()

        // Centro optico de la aberracion, en UV. Lo mueve el puntero.
        this.abCenter = [0.5, 0.5];
        // Refuerzo por velocidad del puntero, 0..1.
        this.abBoost = 0;

        // El composite ya no escribe a pantalla: escribe aca, y el pase ASCII
        // lo lee. Cuesta un target de resolucion completa mas, y es la unica
        // forma de que un efecto que necesita promediar celdas vea la imagen
        // terminada —con bloom, estela, aberracion y grade ya aplicados—.
        this.finalRT = new RenderTarget(gl, width, height, hdr);
        this.ascii = new Ascii(gl, lib, width, height);

        this.streakResult = this.streak.a;
        this.streakAmount = 0.30;
        this.bloomAmount = 0.55;
        // Frio y apenas desaturado. Una estela del mismo color que su fuente
        // se lee como bloom estirado; el desvio de tinte es lo que la hace
        // leer como optica.
        this.streakTint = [0.62, 0.80, 1.0];

        // Saturacion POR ENCIMA de 1, no por debajo.
        //
        // La correccion corre DESPUES de la aberracion cromatica en el
        // composite. Bajarla para "desaturar la escena" mataria justo el unico
        // color que la imagen tiene que conservar.
        //
        // Sobre una escena en escala de grises subirla no tiñe nada —el gris
        // tiene saturacion cero por definicion— pero enciende las franjas de
        // separacion de canal en los bordes. La desaturacion viene de las
        // rampas, no de aca.
        this.grade = {
            // Lift casi nulo: el fondo tiene que llegar a NEGRO total. El
            // valor anterior levantaba todas las sombras y el espacio se
            // veia gris lavado en vez de profundo.
            lift: [0.001, 0.001, 0.002],
            gamma: [1.00, 1.00, 1.00],
            gain: [1.02, 1.02, 1.02],
            saturation: 1.35
        };
    }

    resize(width, height) {
        this.scene.resize(width, height);
        for (let i = 0; i < LEVELS; i++) {
            const w = Math.max(1, width >> (i + 1));
            const h = Math.max(1, height >> (i + 1));
            this.mips[i].a.resize(w, h);
            this.mips[i].b.resize(w, h);
        }
        this.bloom.resize(width >> 1, height >> 1);
        this.streak.a.resize(Math.max(1, width >> 2), Math.max(1, height >> 2));
        this.streak.b.resize(Math.max(1, width >> 2), Math.max(1, height >> 2));
        this.finalRT.resize(width, height);
        this.ascii.resize(width, height);
    }

    // Tres pases horizontales con offset creciente: 13 muestras cada uno, y
    // el alcance total es 6·(1+4+12) = 102 texels a cuarto de resolucion, o
    // sea unos 408 pixeles de pantalla.
    //
    // La primera version usaba escalas 1, 7 y 49. A cuarto de resolucion eso
    // da un alcance de 294 texels sobre una textura de 334 de ancho: el kernel
    // abarcaba la textura entera y promediaba el negro de los bordes. El
    // alcance de la ultima etapa no puede acercarse al ancho del target.
    _streak() {
        const gl = this.gl;
        const { a, b } = this.streak;
        const SCALES = [1.0, 4.0, 12.0];
        const ATTEN = 0.74;
        // Ganancia calibrada a la suma de pesos del kernel (≈5,74): GAIN
        // 0,20 da amplificacion ≈1,15 por pase. El valor anterior (0,55)
        // multiplicaba ×3,16 por pase — ×31 en la cadena — y convertia el
        // sol en una sabana gris horizontal.
        const GAIN = 0.20;

        let src = this.mips[0].a;
        let dst = a, other = b;

        for (const uScale of SCALES) {
            dst.bind(true);
            this.streakPass.use({
                tDiffuse: src.texture,
                uTexelSize: dst.texelSize,
                uScale, uAtten: ATTEN, uGain: GAIN
            });
            drawFullscreen(gl);
            src = dst;
            const t = dst; dst = other; other = t;
        }

        // `src` quedo apuntando al ultimo target escrito.
        this.streakResult = src;
        return src;
    }

    // Gaussiano separable in-place sobre el par del nivel: a → b horizontal,
    // b → a vertical. Dos pases de 5 lecturas en lugar de uno de 25.
    _blur(level) {
        const gl = this.gl;
        const { a, b } = this.mips[level];

        b.bind(true);
        this.blur.use({ tDiffuse: a.texture, uDirection: [1, 0], uTexelSize: a.texelSize });
        drawFullscreen(gl);

        a.bind(true);
        this.blur.use({ tDiffuse: b.texture, uDirection: [0, 1], uTexelSize: b.texelSize });
        drawFullscreen(gl);

        return a;
    }

    render(width, height, time) {
        const gl = this.gl;
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);

        if (this.enabled) {
            // Umbral directo al mip 0, que ya esta a media resolucion.
            this.mips[0].a.bind(true);
            this.luminosity.use({
                tDiffuse: this.scene.texture,
                uThreshold: 0.50,
                uKnee: 0.36
            });
            drawFullscreen(gl);

            // La estela se toma ACA, del umbral todavia nitido, antes de que
            // _blur(0) lo desenfoque en el lugar.
            //
            // Tomandola despues del blur, la fuente ya venia repartida y la
            // estela salia como una neblina horizontal pareja en vez de
            // trazos: medido, la relacion media/pico daba 0,61, o sea casi una
            // banda uniforme. Una estela anamorfica necesita puntos definidos
            // de donde salir.
            this._streak();
            this._blur(0);

            // Cada nivel siguiente parte del anterior ya desenfocado: el blit
            // a la mitad de tamaño con filtrado LINEAR hace de downsample, y
            // encadenar los desenfoques agranda el radio efectivo sin ampliar
            // el kernel.
            for (let i = 1; i < LEVELS; i++) {
                this.mips[i].a.bind(true);
                this.blit.use({ tDiffuse: this.mips[i - 1].a.texture });
                drawFullscreen(gl);
                this._blur(i);
            }

            this.bloom.bind(true);
            this.combine.use({
                tMip0: this.mips[0].a.texture,
                tMip1: this.mips[1].a.texture,
                tMip2: this.mips[2].a.texture
            });
            drawFullscreen(gl);
        }

        this.finalRT.bind(true);
        const g = this.grade;
        this.composite.use({
            tScene: this.scene.texture,
            // Sin bloom, tBloom y tStreak apuntan a la escena y sus factores
            // van en cero: mantiene los samplers ligados sin ramificar el
            // shader ni subir una textura negra.
            tBloom: this.enabled ? this.bloom.texture : this.scene.texture,
            tStreak: this.enabled ? this.streakResult.texture : this.scene.texture,
            uResolution: [width, height],
            uTime: time,
            uBloom: this.enabled ? this.bloomAmount : 0.0,
            uStreak: this.enabled ? this.streakAmount : 0.0,
            uStreakTint: this.streakTint,
            uAberration: this.quality.aberration,
            uGrain: this.quality.grain,
            uFade: this.fade * this.dim,
            uGlitch: this.glitch,
            uFlash: this.flash,
            uAbCenter: this.abCenter,
            uAbBoost: this.abBoost,
            uLift: g.lift,
            uGamma: g.gamma,
            uGain: g.gain,
            uSaturation: g.saturation
        });
        drawFullscreen(gl);

        // Ultimo pase, el unico que escribe a pantalla. Con uMix en 0 devuelve
        // la imagen tal cual y sale temprano.
        this.ascii.render(this.finalRT, this.blit, width, height, bindScreen);
    }
}
