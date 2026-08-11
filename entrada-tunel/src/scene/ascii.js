// Render ASCII.
//
// La imagen se divide en celdas, se promedia la luminancia de cada una y se
// dibuja el caracter cuya densidad de tinta le corresponde. Es el mismo
// principio que un dithering ordenado, pero el patron en vez de ser puntos es
// un alfabeto.
//
// Entra progresivamente al llegar al sol: la escena se disuelve en caracteres
// justo en el momento de mayor cercania. Sobre una imagen ya desaturada
// funciona porque el efecto vive de LUMINANCIA — la unica variable que un
// caracter puede representar.

import { Program, RenderTarget, drawFullscreen } from '../core/gl.js';

// Ordenados por tinta creciente.
//
// Quince niveles. Con doce, el sol y sus filamentos se aplanaban: la diferencia
// de luminancia entre una cresta y su valle caia dentro del mismo caracter y
// el fuego perdia relieve. Los saltos agregados estan en la zona media, que es
// donde vive casi toda la superficie solar.
const CHARS = " .,:;~-+=*ox#%@";

// Lado de la celda en pixeles de DISPOSITIVO.
//
// A 12 px, en una pantalla con DPR 2 la celda mide 6 px CSS y los caracteres
// dejan de leerse como caracteres: el resultado es indistinguible de un
// dithering ordenado. El efecto solo existe si se reconoce el alfabeto, y para
// eso la celda tiene que rondar los 10-12 px CSS.
export const CELL = 17;

// 96 y no 64: el atlas se muestrea con LINEAR y a 64 los glifos finos —la
// coma, el guion— llegaban lavados a la pantalla.
function buildAtlas(gl, size = 96) {
    const canvas = document.createElement('canvas');
    canvas.width = size * CHARS.length;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(size * 0.78)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < CHARS.length; i++) {
        ctx.fillText(CHARS[i], i * size + size / 2, size / 2 + size * 0.04);
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // El canvas 2D tiene el origen arriba a la izquierda y GL lo espera abajo:
    // sin voltear, los glifos salen cabeza abajo.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return tex;
}

export class Ascii {
    constructor(gl, lib, width, height) {
        this.gl = gl;
        this.glyphs = buildAtlas(gl);
        this.count = CHARS.length;

        // Target a resolucion de CELDA. Dibujar la imagen completa en un
        // target de un doceavo con filtrado LINEAR ya promedia cada celda: no
        // hace falta un pase de reduccion propio ni leer NxN muestras por
        // pixel en el shader.
        this.cells = new RenderTarget(gl, this._cellsW(width), this._cellsH(height), {
            internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT,
            filter: gl.LINEAR
        });

        this.program = lib.program(gl, Program, 'Fullscreen.vs', 'Ascii.fs', 'Ascii');
        this.mix = 0;
    }

    _cellsW(w) { return Math.max(1, Math.round(w / CELL)); }
    _cellsH(h) { return Math.max(1, Math.round(h / CELL)); }

    resize(width, height) {
        this.cells.resize(this._cellsW(width), this._cellsH(height));
    }

    // source: RenderTarget con la imagen ya compuesta y mapeada a tono.
    render(source, blit, width, height, bindScreen) {
        const gl = this.gl;

        this.cells.bind(true);
        blit.use({ tDiffuse: source.texture });
        drawFullscreen(gl);

        bindScreen(gl, width, height);
        this.program.use({
            tScene: source.texture,
            tCells: this.cells.texture,
            tGlyphs: this.glyphs,
            uCellCount: [this.cells.width, this.cells.height],
            uGlyphCount: this.count,
            uMix: this.mix
        });
        drawFullscreen(gl);
    }

    dispose() {
        this.gl.deleteTexture(this.glyphs);
    }
}
