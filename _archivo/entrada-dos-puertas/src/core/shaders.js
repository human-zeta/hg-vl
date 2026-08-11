// Carga y resolucion del bundle de shaders.
//
// Un solo archivo de texto con todos los shaders separados por {@}nombre{@},
// mas resolucion de #include contra los chunks del mismo archivo. Es el
// formato que usa Hydra en activetheory.net: 174 shaders en un fetch de 39 KB
// comprimidos. Ver dossier §3.
//
// El motivo no es estetico. Cada shader en su propio archivo son N requests en
// el arranque, y el arranque es exactamente cuando el navegador ya esta
// saturado bajando el bundle de JS. Uno solo, y el costo de partirlo es un
// split de string.

const HEADER_VS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

const HEADER_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

export class ShaderLibrary {
    constructor() {
        this.sources = new Map();
    }

    static async load(url) {
        const lib = new ShaderLibrary();
        const res = await fetch(url);
        if (!res.ok) throw new Error(`No se pudo cargar ${url}: ${res.status}`);
        lib.parse(await res.text());
        return lib;
    }

    parse(text) {
        // split con grupo de captura: [ '', nombre, cuerpo, nombre, cuerpo, ... ]
        const parts = text.split(/\{@\}([^{}\n]+?)\{@\}/);
        for (let i = 1; i < parts.length; i += 2) {
            this.sources.set(parts[i].trim(), parts[i + 1] ?? '');
        }
        return this;
    }

    has(name) { return this.sources.has(name); }

    // Resuelve #include recursivamente. El set `seen` cumple dos funciones:
    // corta ciclos y evita redefinir una funcion cuando dos chunks incluyen el
    // mismo tercero, que en GLSL es un error de compilacion y no una
    // advertencia.
    resolve(name, seen = new Set()) {
        const src = this.sources.get(name);
        if (src === undefined) throw new Error(`Shader desconocido: ${name}`);
        seen.add(name);

        return src.replace(/^[ \t]*#include[ \t]+([^\s]+)[ \t]*$/gm, (_, dep) => {
            if (seen.has(dep)) return `// #include ${dep} (ya resuelto)`;
            return this.resolve(dep, seen);
        });
    }

    // Cada etapa resuelve con su propio `seen`: vertex y fragment son
    // unidades de compilacion independientes y las dos necesitan su copia de
    // los chunks. Compartir el set dejaria al fragment sin common.glsl.
    program(gl, ProgramClass, vsName, fsName, label = fsName) {
        const vs = HEADER_VS + this.resolve(vsName, new Set());
        const fs = HEADER_FS + this.resolve(fsName, new Set());
        return new ProgramClass(gl, vs, fs, label);
    }
}
