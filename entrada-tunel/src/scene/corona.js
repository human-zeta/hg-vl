// Corona y erupciones solares.
//
// Un raymarch sobre la cáscara esférica que rodea al sol. Es volumen de
// verdad: los filamentos tienen espesor, se superponen y se ven por delante y
// por fuera del disco, que es lo que hace que se lean como plasma saliendo y
// no como una textura pegada a una esfera.
//
// Se renderiza a CUARTO de resolución. La imagen después pasa por el render
// ASCII, que la cuantiza en celdas de 18 píxeles: resolver la corona fina para
// después promediarla en celdas sería pagar por detalle que el propio efecto
// destruye. Es el mismo argumento que el campo de fondo a media resolución,
// pero acá el ahorro es de 16×.

import { Program, RenderTarget, drawFullscreen } from '../core/gl.js';

const DIV = 4;

export class Corona {
    constructor(gl, lib, width, height) {
        this.gl = gl;
        this.target = new RenderTarget(gl, this._w(width), this._h(height), {
            internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT,
            filter: gl.LINEAR
        });
        this.program = lib.program(gl, Program, 'Fullscreen.vs', 'Corona.fs', 'Corona');
        this.strength = 0;
    }

    _w(w) { return Math.max(1, Math.round(w / DIV)); }
    _h(h) { return Math.max(1, Math.round(h / DIV)); }

    resize(width, height) {
        this.target.resize(this._w(width), this._h(height));
    }

    // cam: { eye, forward, right, up, tanHalfFov, aspect }
    render(cam, time, sunRadius) {
        const gl = this.gl;

        // Dirección del limbo visible.
        //
        // El sol está en el origen, así que `eye` normalizado es la dirección
        // sol→cámara. Cualquier vector perpendicular a ella cae sobre el borde
        // visible del disco: ahí una protuberancia se ve de perfil, recortada
        // contra el negro. Se inclina hacia arriba para que arquee hacia el
        // espacio vacío del encuadre y no hacia el texto.
        const e = cam.eye;
        const el = Math.hypot(e[0], e[1], e[2]) || 1;
        const toCam = [e[0] / el, e[1] / el, e[2] / el];
        // side = normalize(cross(toCam, worldUp))
        let sx = toCam[1] * 0 - toCam[2] * 1;
        let sy = toCam[2] * 0 - toCam[0] * 0;
        let sz = toCam[0] * 1 - toCam[1] * 0;
        const sl = Math.hypot(sx, sy, sz) || 1;
        sx /= sl; sy /= sl; sz /= sl;

        let lx = sx * 0.80, ly = sy * 0.80 + 0.62, lz = sz * 0.80;
        const ll = Math.hypot(lx, ly, lz) || 1;

        this.target.bind(true);
        this.program.use({
            uLimb: [lx / ll, ly / ll, lz / ll],
            uEye: cam.eye,
            uForward: cam.forward,
            uRight: cam.right,
            uUp: cam.up,
            uTanHalfFov: cam.tanHalfFov,
            uAspect: cam.aspect,
            uTime: time,
            uSunRadius: sunRadius,
            uStrength: this.strength
        });
        drawFullscreen(gl);
        return this.target;
    }
}
