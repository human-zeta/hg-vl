// La trayectoria del viaje.
//
// Reemplaza a la hélice de la versión anterior. No hay escalera: hay un vuelo
// que entra al sistema desde afuera, atraviesa los planos orbitales pasando
// cerca de los cuerpos, y termina frente al sol.
//
// Una sola definición del camino, compartida por la cámara y por cualquier
// cosa que necesite saber dónde está el espectador. Si se calcularan por
// separado, un ajuste de recorrido las desfasa y el síntoma es una cámara que
// llega al sol antes o después de que la escena lo anuncie.

const TAU = Math.PI * 2;

// El sistema solar vive en el origen. El viaje va de lejos hacia él.
export const START_Z = 15.4;
export const END_Z = 3.35;

// Deriva lateral: el vuelo no entra de frente sino en diagonal suave, y eso
// es lo que hace que se pase CERCA de los planetas en lugar de mirarlos de
// lejos. Un acercamiento recto sobre el eje deja todo el sistema quieto en el
// centro del encuadre durante todo el trayecto.
const SWAY_X = 2.25;
const SWAY_Y = 1.15;

// t: 0 afuera del sistema · 1 frente al sol
export function pathAt(t) {
    // Desaceleración al final: el último tramo se recorre mucho más lento en
    // unidades de mundo por unidad de scroll. Sin esto la llegada al sol es un
    // golpe, y lo que se busca es acercarse.
    const ease = 1 - Math.pow(1 - t, 2.4);
    const z = START_Z + (END_Z - START_Z) * ease;

    return {
        t,
        z,
        // Dos senos de período distinto: el recorrido nunca vuelve exactamente
        // sobre sí mismo y no se lee como un vaivén.
        x: Math.sin(t * TAU * 0.62) * SWAY_X * (1 - t * 0.55),
        y: Math.sin(t * TAU * 0.41 + 1.1) * SWAY_Y * (1 - t * 0.7) + 0.35
    };
}

// Hacia dónde mira.
//
// Al principio, un adelanto lateral para que el sistema entre en cuadro de
// costado y no de frente.
//
// Al final, un DESCENTRADO deliberado: la cámara no apunta al sol sino a un
// punto arriba y a la derecha de él, así el sol queda abajo a la izquierda y
// las erupciones tienen negro contra el cual leerse. Con el sol centrado
// llenando el cuadro no hay espacio donde arquearse, y las protuberancias —que
// es lo que da la imagen— se pierden dentro del propio disco.
const FRAME_X = 1.15;
const FRAME_Y = 0.72;

export function lookAt(t) {
    const lead = (1 - t) * (1 - t);
    const settle = t * t * (3 - 2 * t);
    return {
        x: Math.sin(t * TAU * 0.62 + 0.9) * 0.85 * lead + FRAME_X * settle,
        y: Math.sin(t * TAU * 0.41) * 0.5 * lead + FRAME_Y * settle,
        z: 0
    };
}

// Giro de barrena durante el transito.
//
// Una vuelta COMPLETA (TAU) entre la placa y el nucleo: arranca y termina
// derecho, asi el texto de VISUAL LAB y el de HUMAN GLITCHE se leen sobre un
// horizonte estable, y todo el giro ocurre en el tramo donde no hay nada que
// leer. El easing concentra la velocidad en el medio.
export function rollAt(t) {
    const s = Math.min(1, Math.max(0, (t - 0.34) / (0.72 - 0.34)));
    const e = s * s * (3 - 2 * s);
    return e * TAU;
}
