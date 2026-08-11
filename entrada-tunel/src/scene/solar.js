// Sistema solar.
//
// Reemplaza la icosfera suelta que estaba detras de la juntura. Hace el mismo
// trabajo —dar escala a una nube que por si sola no tiene tamaño de
// referencia— pero ademas introduce jerarquia y tiempo: hay un centro, hay
// cuerpos que lo recorren, y el conjunto cambia mientras alguien mira.
//
// Una sola geometria de icosfera dibujada con `drawArraysInstanced`. Los
// elementos orbitales van como atributos POR INSTANCIA y la posicion se
// resuelve en el vertex shader a partir de uTime: el buffer se sube una vez al
// arrancar y no se vuelve a tocar. La CPU no calcula ni una orbita por frame.

import { icosphere, ring, Mesh } from './geometry.js';

// radio, escala, inclinacion (rad), fase (rad), color (0..1)
//
// Los radios no son parejos y las velocidades siguen la tercera ley de Kepler
// (ω ∝ r^-1.5): los de afuera van mas lentos. Con velocidades iguales el
// conjunto gira como un plato y se lee como una rueda dentada; con la ley real
// los cuerpos se adelantan y se cruzan, y nunca repite la misma figura.
const BODIES = [
    // El sol es el final del viaje y tiene que ocupar el cuadro al llegar. Con
    // radio 0,24 a 2,55 de distancia subtendia 8 grados: un punto brillante,
    // no un destino.
    { r: 0.00, s: 0.52, inc: 0.00,  phase: 0.0,  color: 0.95, sun: true },
    { r: 0.62, s: 0.090, inc: 0.05, phase: 0.4,  color: 0.30 },
    { r: 0.92, s: 0.140, inc: -0.09, phase: 2.1, color: 0.55 },
    { r: 1.28, s: 0.105, inc: 0.13, phase: 4.0,  color: 0.42 },
    { r: 1.70, s: 0.185, inc: -0.06, phase: 1.2, color: 0.70 },
    { r: 2.15, s: 0.120, inc: 0.17, phase: 5.3,  color: 0.38 },
    { r: 2.62, s: 0.080, inc: -0.14, phase: 3.1, color: 0.60 },
];

const BASE_SPEED = 0.55;

export class SolarSystem {
    constructor(gl, lib, subdivisions = 2) {
        this.gl = gl;

        const planets = BODIES.filter(b => !b.sun);

        // --- Atributos por instancia -----------------------------------
        // loc 3: aOrbit = (radio, velocidad angular, fase, inclinacion)
        // loc 4: aBody  = (escala, color, giro propio, es_sol)
        const n = BODIES.length;
        const orbit = new Float32Array(n * 4);
        const body = new Float32Array(n * 4);

        BODIES.forEach((b, i) => {
            const speed = b.r > 0 ? BASE_SPEED * Math.pow(b.r, -1.5) : 0;
            orbit[i * 4 + 0] = b.r;
            orbit[i * 4 + 1] = speed;
            orbit[i * 4 + 2] = b.phase;
            orbit[i * 4 + 3] = b.inc;

            body[i * 4 + 0] = b.s;
            body[i * 4 + 1] = b.color;
            // Giro propio con signo alternado: un sistema donde todo gira
            // igual se ve mecanico.
            body[i * 4 + 2] = (i % 2 ? -1 : 1) * (0.35 + i * 0.12);
            body[i * 4 + 3] = b.sun ? 1 : 0;
        });

        this.bodies = new Mesh(gl, lib, icosphere(subdivisions, 1.0), {
            vs: 'Body.vs', fs: 'Body.fs', label: 'Body',
            instances: {
                count: n,
                attribs: [
                    { loc: 3, array: orbit, size: 4 },
                    { loc: 4, array: body, size: 4 },
                ]
            }
        });

        // --- Anillos de orbita -----------------------------------------
        // Mismo buffer de elementos orbitales, otra geometria y otro modo de
        // dibujo. Solo los planetas: el sol no orbita nada.
        const ringOrbit = new Float32Array(planets.length * 4);
        planets.forEach((b, i) => {
            ringOrbit[i * 4 + 0] = b.r;
            ringOrbit[i * 4 + 1] = 0;
            ringOrbit[i * 4 + 2] = 0;
            ringOrbit[i * 4 + 3] = b.inc;
        });

        this.orbits = new Mesh(gl, lib, ring(120), {
            vs: 'Orbit.vs', fs: 'Orbit.fs', label: 'Orbit',
            mode: gl.LINE_LOOP,
            instances: {
                count: planets.length,
                attribs: [{ loc: 3, array: ringOrbit, size: 4 }]
            }
        });

        this.count = n;
    }

    // El sistema entero se inclina y precesa lento. Sin inclinacion las
    // orbitas se proyectan como circulos concentricos y el conjunto se lee
    // como una diana plana, no como algo con volumen.
    setTransform(time, scale, offset) {
        const tilt = -0.46 + Math.sin(time * 0.035) * 0.06;
        const precession = time * 0.018;
        this.bodies.setTransform(precession, tilt, scale, offset);
        this.orbits.setTransform(precession, tilt, scale, offset);
        return this;
    }

    draw(uniforms) {
        // Las orbitas primero: son la referencia sobre la que se leen los
        // cuerpos, y al ir en aditivo el orden no altera el resultado — pero
        // deja el codigo en el orden en que se piensa la escena.
        this.orbits.draw(uniforms);
        this.bodies.draw(uniforms);
    }

    dispose() {
        this.bodies.dispose();
        this.orbits.dispose();
    }
}
