// Geometria procedural.
//
// Es la pieza que faltaba respecto de Active Theory: ellos tienen mallas con
// material (PBRShader, GlassInner, TubeShader, ChainShader) y nosotros teniamos
// solo particulas. Esto instala el camino completo —buffers de vertices,
// normales, matriz de modelo, test de profundidad— sin traer ni un byte de
// asset: la malla se calcula al arrancar.
//
// Icosfera y no esfera UV: los triangulos quedan casi todos del mismo tamaño.
// Una esfera UV amontona vertices en los polos y las facetas se ven
// desparejas justo donde mas se nota.

import { Program } from '../core/gl.js';

const T = (1 + Math.sqrt(5)) / 2;

// Los 12 vertices del icosaedro: tres rectangulos aureos ortogonales.
const BASE_VERTS = [
    [-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0],
    [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T],
    [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1],
];

const BASE_FACES = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

function normalize(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
}

function midpoint(a, b) {
    return normalize([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
}

// Devuelve triangulos SUELTOS, no indexados.
//
// Indexar ahorraria memoria, pero compartir un vertice entre caras obliga a
// promediar su normal, y eso suaviza el sombreado justo cuando lo que se
// quiere es la faceta marcada. Ademas cada vertice necesita su coordenada
// baricentrica propia para el wireframe, que por definicion no se puede
// compartir entre caras.
export function icosphere(subdivisions = 2, radius = 1) {
    let faces = BASE_FACES.map(f => f.map(i => normalize(BASE_VERTS[i])));

    for (let s = 0; s < subdivisions; s++) {
        const next = [];
        for (const [a, b, c] of faces) {
            const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
            next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
        }
        faces = next;
    }

    const count = faces.length * 3;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const bary = new Float32Array(count * 3);

    // (1,0,0) (0,1,0) (0,0,1) por vertice de cada triangulo. En el fragment,
    // la distancia a la arista mas cercana es el minimo de las tres
    // componentes interpoladas: da el wireframe sin dibujar una sola linea.
    const BARY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

    let o = 0;
    for (const tri of faces) {
        // Normal plana: la de la cara, no la del vertice.
        const [a, b, c] = tri;
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = normalize([
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0],
        ]);

        for (let i = 0; i < 3; i++) {
            positions[o] = tri[i][0] * radius;
            positions[o + 1] = tri[i][1] * radius;
            positions[o + 2] = tri[i][2] * radius;
            normals[o] = n[0]; normals[o + 1] = n[1]; normals[o + 2] = n[2];
            bary[o] = BARY[i][0]; bary[o + 1] = BARY[i][1]; bary[o + 2] = BARY[i][2];
            o += 3;
        }
    }

    return { positions, normals, bary, count };
}

// Circulo en el plano XZ, para dibujar como LINE_LOOP.
export function ring(segments = 96) {
    const positions = new Float32Array(segments * 3);
    for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        positions[i * 3] = Math.cos(a);
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = Math.sin(a);
    }
    return { positions, count: segments };
}

export class Mesh {
    // data     : { positions, normals?, bary?, count }
    // opts.vs/fs : nombres de shader en el bundle
    // opts.instances : { count, attribs: [{ loc, array, size }] }
    //                  Un atributo por instancia avanza una vez por INSTANCIA
    //                  y no por vertice: es lo que hace `vertexAttribDivisor`.
    //                  Asi una sola icosfera se dibuja N veces en un solo draw
    //                  call, con parametros distintos cada una.
    constructor(gl, lib, data, opts = {}) {
        this.gl = gl;
        this.count = data.count;
        this.instances = opts.instances?.count ?? 0;
        this.mode = opts.mode ?? gl.TRIANGLES;

        // VAO propio: el resto del proyecto dibuja sin atributos y deja
        // bindeado el VAO vacio. Si la malla configurara sus punteros ahi,
        // los pases de pantalla completa arrastrarian atributos habilitados
        // que no usan.
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        this.buffers = [];
        const attrib = (loc, arr, size, divisor = 0) => {
            if (!arr) return;
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
            if (divisor) gl.vertexAttribDivisor(loc, divisor);
            this.buffers.push(buf);
        };

        // Ubicaciones fijas, declaradas con `layout(location=N)` en el shader.
        attrib(0, data.positions, 3);
        attrib(1, data.normals, 3);
        attrib(2, data.bary, 3);

        for (const a of opts.instances?.attribs ?? []) {
            attrib(a.loc, a.array, a.size, 1);
        }

        gl.bindVertexArray(null);

        this.program = lib.program(gl, Program,
            opts.vs ?? 'Mesh.vs', opts.fs ?? 'Mesh.fs', opts.label ?? 'Mesh');

        this.model = new Float32Array(16);
        this.normalMat = new Float32Array(9);
    }

    // Matriz de modelo: rotacion en Y y X mas escala uniforme. Sin traslacion
    // arbitraria — la posicion la fija `offset`.
    setTransform(rotY, rotX, scale, offset) {
        const cy = Math.cos(rotY), sy = Math.sin(rotY);
        const cx = Math.cos(rotX), sx = Math.sin(rotX);
        const m = this.model;

        // R = Ry * Rx, en columna mayor.
        m[0] = cy * scale;           m[1] = 0;              m[2] = -sy * scale;       m[3] = 0;
        m[4] = sy * sx * scale;      m[5] = cx * scale;     m[6] = cy * sx * scale;   m[7] = 0;
        m[8] = sy * cx * scale;      m[9] = -sx * scale;    m[10] = cy * cx * scale;  m[11] = 0;
        m[12] = offset[0];           m[13] = offset[1];     m[14] = offset[2];        m[15] = 1;

        // Con escala uniforme y rotacion pura, la matriz normal es la propia
        // rotacion: no hace falta invertir ni transponer.
        const n = this.normalMat;
        n[0] = cy;      n[1] = 0;    n[2] = -sy;
        n[3] = sy * sx; n[4] = cx;   n[5] = cy * sx;
        n[6] = sy * cx; n[7] = -sx;  n[8] = cy * cx;
        return this;
    }

    draw(uniforms) {
        const gl = this.gl;
        gl.bindVertexArray(this.vao);
        this.program.use({ ...uniforms, uModel: this.model, uNormalMatrix: this.normalMat });
        if (this.instances > 0) {
            gl.drawArraysInstanced(this.mode, 0, this.count, this.instances);
        } else {
            gl.drawArrays(this.mode, 0, this.count);
        }
        gl.bindVertexArray(null);
    }

    dispose() {
        const gl = this.gl;
        for (const b of this.buffers) gl.deleteBuffer(b);
        gl.deleteVertexArray(this.vao);
    }
}
