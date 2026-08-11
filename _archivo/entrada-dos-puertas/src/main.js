// Arranque y coreografia de la entrada HG·VL.
//
// Orden: perfilar → cargar → calentar → revelar. Nada se muestra hasta que el
// primer frame real ya se dibujo una vez fuera de pantalla. Lo que arruina la
// sensacion de calidad no es que una carga tarde dos segundos: es que aparezca
// a medio armar.

import { Render, Phase } from './core/render.js';
import { Scene } from './scene/scene.js';
import { delay, Timeline, damp } from './core/tween.js';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const loaderEl = $('#loader');
const barEl = $('.loader__bar i');
const pctEl = $('.loader__pct');

// --- Progreso ----------------------------------------------------------

// El valor mostrado persigue al real con amortiguacion. Un contador que va
// 0 → 45 → 100 en tres saltos se lee como roto aunque sea la verdad.
const load = { target: 0, shown: 0 };

Render.on(Phase.BEFORE_RENDER, (dt) => {
    if (load.shown >= 99.9) return;
    load.shown = damp(load.shown, load.target * 100, 6, dt);
    barEl.style.transform = `scaleX(${(load.shown / 100).toFixed(4)})`;
    pctEl.textContent = String(Math.round(load.shown)).padStart(2, '0');
});

// --- Capas de profundidad ----------------------------------------------
//
// Cada linea de texto tiene una profundidad y se inclina con el puntero. Al
// moverse distinto segun su capa, el bloque deja de ser una lamina plana.
//
// La perspectiva va como FUNCION de transform —`perspective(900px)` dentro del
// propio transform— y no como propiedad del contenedor. Motivo concreto: la
// puerta inactiva se atenua con `opacity`, y una opacidad menor que 1 fuerza
// `transform-style: flat` en todo lo que cuelga de ella. Un `preserve-3d` en
// el contenedor quedaria anulado justo en el estado que mas se mira.
//
// Cada elemento se convierte asi en su propia escena 3D. No es una camara
// compartida —cada uno rota sobre su centro— pero para capas de texto la
// diferencia no se percibe, y a cambio el efecto es inmune al contexto de
// apilado de sus ancestros.

const DEPTH = [
    ['h1',      1.00],
    ['.enter',  0.72],
    ['.name',   0.54],
    ['p',       0.40],
    ['.kick',   0.30],
    ['.tags',   0.16],
];

function depthOf(el) {
    for (const [sel, d] of DEPTH) if (el.matches(sel)) return d;
    return 0.22;
}

const layers = [];

function initLayers() {
    for (const el of $$('[data-line]')) {
        // rev = progreso de revelado, 0..1. Lo mueve la coreografia de entrada.
        layers.push({ el, depth: depthOf(el), rev: 0 });
        el.style.willChange = 'opacity, transform';
    }
}

// Un unico escritor de `transform` por elemento. Si el revelado y la
// inclinacion escribieran cada uno por su lado, el ultimo en correr pisaria al
// otro y el texto quedaria trabado a mitad de entrada.
function applyLayer(l, px, py) {
    const lift = (1 - l.rev) * 18;
    l.el.style.opacity = l.rev;

    if (REDUCED) {
        l.el.style.transform = `translate3d(0, ${lift.toFixed(2)}px, 0)`;
        return;
    }

    const d = l.depth;
    const ry = px * d * 3.4;
    const rx = py * d * 2.4;
    const tx = px * d * 16;
    const ty = lift - py * d * 11;

    l.el.style.transform =
        `perspective(900px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) ` +
        `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
}

function bindParallax(scene) {
    Render.on(Phase.BEFORE_RENDER, () => {
        const px = scene.pointer.x;
        const py = scene.pointer.y;
        for (const l of layers) applyLayer(l, px, py);
    });
}

// --- Puertas -----------------------------------------------------------

function bindDoors(scene) {
    const doors = $$('.door');

    for (const el of doors) {
        const which = el.dataset.door;   // 'hg' | 'vl'

        // pointerenter/leave y no mouseover: no burbujean desde los hijos, asi
        // que no hay parpadeo al pasar por encima del texto interno.
        el.addEventListener('pointerenter', () => {
            scene.setDoor(which);
            scene.pulse(0.35);
            document.body.dataset.door = which;
        });

        el.addEventListener('pointerleave', () => {
            scene.setDoor(null);
            delete document.body.dataset.door;
        });

        // El foco de teclado tiene que producir el mismo estado que el hover:
        // si no, quien navega con Tab recorre la pagina sin ninguna respuesta
        // de la escena y la mitad del diseño no existe para esa persona.
        el.addEventListener('focus', () => {
            scene.setDoor(which);
            document.body.dataset.door = which;
        });
        el.addEventListener('blur', () => {
            scene.setDoor(null);
            delete document.body.dataset.door;
        });

        el.addEventListener('click', (e) => {
            // Respetar cmd/ctrl/shift-click y el boton del medio: son
            // "abrir en pestaña nueva" y romperlos es de las cosas que mas
            // molestan de un sitio con transiciones.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

            e.preventDefault();
            scene.pulse(1);

            // La navegacion espera lo justo para que el glitch se lea, y no
            // mas. 260 ms es el limite en que una demora todavia se percibe
            // como respuesta y no como lentitud.
            setTimeout(() => { location.href = el.href; }, 260);
        });
    }
}

// --- Revelado ----------------------------------------------------------

function reveal(scene) {
    const tl = new Timeline();

    // El canvas entra solo. Si el texto entra al mismo tiempo, compiten por la
    // atencion y no se percibe ninguno.
    tl.add(e => { scene.post.fade = e; }, 1.1, 'outCubic', 0);

    // El revelado solo mueve `rev`; el transform lo escribe applyLayer en el
    // mismo frame, ya combinado con la inclinacion.
    //
    // Las capas entran ordenadas de mas cercana a mas lejana en vez de por
    // orden del documento: el titular primero y las etiquetas al final. La
    // profundidad que despues sostiene el parallax queda establecida ya en la
    // entrada.
    const ordered = [...layers].sort((a, b) => b.depth - a.depth);

    // Escalonado de 80 ms. Menos se lee como simultaneo; mas, como lento.
    tl.stagger(ordered, 0.08, 0.8, 'outQuart', (l, e) => { l.rev = e; }, 0.3);

    return tl.play();
}

// --- Camino degradado --------------------------------------------------

// Si WebGL2 no esta o algo falla, la entrada sigue siendo la entrada: dos
// puertas legibles sobre negro. Un fondo sin escena es aceptable; una pantalla
// en blanco no.
function fallback(err) {
    console.warn('[entrada] sin escena, modo degradado:', err);
    document.documentElement.classList.add('is-fallback');
    loaderEl.classList.add('is-done');
    $('#stage')?.remove();
    setTimeout(() => loaderEl.remove(), 700);
}

// --- Boot --------------------------------------------------------------

async function boot() {
    Render.start();

    let scene;
    try {
        scene = new Scene($('#stage'));
        await scene.load('assets/compiled.glsl', p => { load.target = p; });
    } catch (err) {
        fallback(err);
        return;
    }

    window.__scene = scene;   // ajuste en vivo desde consola, ver docs/particulas.md §5
    initLayers();
    bindParallax(scene);
    bindDoors(scene);

    // Se espera a que el contador llegue visualmente a 100 antes de tapar el
    // loader. Cortarlo en 87 porque los datos ya estan es la clase de detalle
    // que nadie sabe nombrar pero todos notan.
    load.target = 1;
    while (load.shown < 99) await delay(0.05);

    pctEl.textContent = '100';
    barEl.style.transform = 'scaleX(1)';

    await delay(0.15);
    loaderEl.classList.add('is-done');
    scene.pulse(0.6);

    await reveal(scene);
    loaderEl.remove();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
