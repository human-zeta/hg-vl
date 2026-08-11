// Capa fina sobre WebGL2. No es una libreria de escena: son los cuatro
// primitivos que hacen falta (programa, FBO, quad, matrices) sin la superficie
// de una libreria completa. Ver dossier §2.

const FLOAT_EXT = ['EXT_color_buffer_float', 'OES_texture_float_linear'];

export function createContext(canvas) {
    const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,      // resolvemos aliasing en el post, no en el default framebuffer
        depth: true,
        stencil: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
        desynchronized: true
    });
    if (!gl) throw new Error('WebGL2 no disponible');

    const ext = {};
    for (const name of FLOAT_EXT) ext[name] = gl.getExtension(name);

    // VAO vacio permanente: los pases fullscreen y las particulas dibujan sin
    // atributos, derivando todo de gl_VertexID. Cero buffers de vertices.
    const emptyVAO = gl.createVertexArray();
    gl.bindVertexArray(emptyVAO);

    return { gl, ext, emptyVAO };
}

// --- Programas ---------------------------------------------------------

function compile(gl, type, source, label) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        const numbered = source.split('\n')
            .map((l, i) => String(i + 1).padStart(4) + ' | ' + l).join('\n');
        throw new Error(`Fallo compilando ${label}:\n${log}\n${numbered}`);
    }
    return sh;
}

const UNIFORM_SETTERS = {
    0x1406: (gl, l, v) => gl.uniform1f(l, v),                        // FLOAT
    0x8b50: (gl, l, v) => gl.uniform2fv(l, v),                       // FLOAT_VEC2
    0x8b51: (gl, l, v) => gl.uniform3fv(l, v),                       // FLOAT_VEC3
    0x8b52: (gl, l, v) => gl.uniform4fv(l, v),                       // FLOAT_VEC4
    0x1404: (gl, l, v) => gl.uniform1i(l, v),                        // INT
    0x8b56: (gl, l, v) => gl.uniform1i(l, v ? 1 : 0),                // BOOL
    0x8b5b: (gl, l, v) => gl.uniformMatrix3fv(l, false, v),          // FLOAT_MAT3
    0x8b5c: (gl, l, v) => gl.uniformMatrix4fv(l, false, v),          // FLOAT_MAT4
};
const SAMPLER_TYPES = new Set([0x8b5e, 0x8b60, 0x8dc1, 0x8dca, 0x8dd2]);

export class Program {
    constructor(gl, vsSource, fsSource, label = 'program') {
        this.gl = gl;
        this.label = label;

        const vs = compile(gl, gl.VERTEX_SHADER, vsSource, label + '.vs');
        const fs = compile(gl, gl.FRAGMENT_SHADER, fsSource, label + '.fs');

        const p = gl.createProgram();
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            throw new Error(`Fallo enlazando ${label}: ${gl.getProgramInfoLog(p)}`);
        }
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        this.program = p;

        // Las ubicaciones se resuelven una sola vez al enlazar. Pedirlas por
        // frame con getUniformLocation es una de las fugas de rendimiento mas
        // comunes y mas invisibles.
        this.uniforms = new Map();
        this.samplers = new Map();
        let unit = 0;
        const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < count; i++) {
            const info = gl.getActiveUniform(p, i);
            const name = info.name.replace(/\[0\]$/, '');
            const loc = gl.getUniformLocation(p, info.name);
            if (SAMPLER_TYPES.has(info.type)) {
                this.samplers.set(name, { loc, unit: unit++ });
            } else {
                this.uniforms.set(name, { loc, setter: UNIFORM_SETTERS[info.type] });
            }
        }
    }

    use(values) {
        const gl = this.gl;
        gl.useProgram(this.program);
        if (!values) return this;
        for (const key in values) {
            const v = values[key];
            const s = this.samplers.get(key);
            if (s) {
                gl.activeTexture(gl.TEXTURE0 + s.unit);
                gl.bindTexture(gl.TEXTURE_2D, v);
                gl.uniform1i(s.loc, s.unit);
                continue;
            }
            const u = this.uniforms.get(key);
            if (u && u.setter) u.setter(gl, u.loc, v);
        }
        return this;
    }
}

// --- Render targets ----------------------------------------------------

export class RenderTarget {
    constructor(gl, width, height, opts = {}) {
        this.gl = gl;
        this.width = Math.max(1, width | 0);
        this.height = Math.max(1, height | 0);
        this.opts = {
            internalFormat: gl.RGBA16F,
            format: gl.RGBA,
            type: gl.HALF_FLOAT,
            filter: gl.LINEAR,
            wrap: gl.CLAMP_TO_EDGE,
            depth: false,
            ...opts
        };
        this.fbo = gl.createFramebuffer();
        this.texture = null;
        this.depthBuffer = null;
        this._allocate();
    }

    _allocate() {
        const gl = this.gl, o = this.opts;
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, o.internalFormat, this.width, this.height, 0,
                      o.format, o.type, o.data || null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, o.filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, o.filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, o.wrap);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, o.wrap);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);

        if (o.depth) {
            this.depthBuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthBuffer);
        }

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`Framebuffer incompleto: 0x${status.toString(16)}`);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    resize(width, height) {
        width = Math.max(1, width | 0);
        height = Math.max(1, height | 0);
        if (width === this.width && height === this.height) return;
        this.width = width;
        this.height = height;
        const gl = this.gl;
        gl.deleteTexture(this.texture);
        if (this.depthBuffer) gl.deleteRenderbuffer(this.depthBuffer);
        this._allocate();
    }

    // discardPrevious: declarar que no nos importa lo que habia en el target.
    //
    // Las GPU de render diferido por tiles (todo Apple Silicon, todo movil)
    // trabajan sobre una memoria chica dentro del chip y, al bindear un
    // framebuffer, CARGAN el contenido anterior desde la RAM por si el
    // proximo dibujo lee o mezcla encima. Cuando el pase siguiente es un
    // triangulo de pantalla completa que pisa todo, esa carga es puro trafico
    // tirado: 29 MB por target de 16 bits a 2560×1440, multiplicado por cada
    // pase de la cadena de post-proceso.
    //
    // invalidateFramebuffer le dice al driver que puede saltearsela.
    bind(discardPrevious = false) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.viewport(0, 0, this.width, this.height);
        if (discardPrevious) {
            gl.invalidateFramebuffer(gl.FRAMEBUFFER, [gl.COLOR_ATTACHMENT0]);
        }
        return this;
    }

    get texelSize() { return [1 / this.width, 1 / this.height]; }
}

// Par de targets intercambiables. La simulacion GPGPU no puede leer y escribir
// la misma textura en el mismo draw, asi que se alterna entre dos.
export class PingPong {
    constructor(gl, width, height, opts) {
        this.a = new RenderTarget(gl, width, height, opts);
        this.b = new RenderTarget(gl, width, height, opts);
    }
    get read()  { return this.a; }
    get write() { return this.b; }
    swap() { const t = this.a; this.a = this.b; this.b = t; }
}

export function bindScreen(gl, width, height) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
}

// Tres vertices, sin buffer. Ver Fullscreen.vs en el bundle.
export function drawFullscreen(gl) {
    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// --- Matrices ----------------------------------------------------------
// Lo minimo para una camara en perspectiva. Escribirlo evita 600 KB de
// dependencia para seis funciones.

export function perspective(out, fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0;  out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0;           out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
    return out;
}

export function lookAt(out, eye, center, up) {
    let z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
    let len = 1 / Math.hypot(z0, z1, z2);
    z0 *= len; z1 *= len; z2 *= len;

    let x0 = up[1] * z2 - up[2] * z1;
    let x1 = up[2] * z0 - up[0] * z2;
    let x2 = up[0] * z1 - up[1] * z0;
    len = Math.hypot(x0, x1, x2);
    if (len) { len = 1 / len; x0 *= len; x1 *= len; x2 *= len; } else { x0 = x1 = x2 = 0; }

    const y0 = z1 * x2 - z2 * x1;
    const y1 = z2 * x0 - z0 * x2;
    const y2 = z0 * x1 - z1 * x0;

    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    out[15] = 1;
    return out;
}
