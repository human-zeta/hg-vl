// Arranque y coreografía del descenso.
//
// Orden: perfilar → cargar → calentar → revelar. Nada se muestra hasta que el
// primer frame real ya se dibujó una vez fuera de pantalla.

import { Render, Phase } from './core/render.js';
import { Scroll } from './core/scroll.js';
import { Scene } from './scene/scene.js';
import { delay, Timeline, damp, clamp } from './core/tween.js';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const loaderEl = $('#loader');
const barEl = $('.loader__bar i');
const pctEl = $('.loader__pct');

// --- Progreso de carga -------------------------------------------------

const load = { target: 0, shown: 0 };

Render.on(Phase.BEFORE_RENDER, (dt) => {
    if (load.shown >= 99.9) return;
    load.shown = damp(load.shown, load.target * 100, 6, dt);
    barEl.style.transform = `scaleX(${(load.shown / 100).toFixed(4)})`;
    pctEl.textContent = String(Math.round(load.shown)).padStart(2, '0');
});

// --- Capas de profundidad ----------------------------------------------
//
// La perspectiva va como FUNCIÓN de transform y no como propiedad del
// contenedor: cualquier ancestro con opacity < 1 forzaría `transform-style:
// flat` en todo lo que cuelga de él. Cada elemento es su propia escena 3D.

const DEPTH = [
    ['h1',      1.00],
    ['h2',      0.92],
    ['.enter',  0.70],
    ['.lead',   0.42],
    ['.kick',   0.30],
    ['.tags',   0.18],
];

function depthOf(el) {
    for (const [sel, d] of DEPTH) if (el.matches(sel)) return d;
    return 0.24;
}

const layers = [];

function initLayers() {
    for (const el of $$('[data-line]')) {
        layers.push({ el, depth: depthOf(el), rev: 0 });
        el.style.willChange = 'opacity, transform';
    }
}

// Un único escritor de `transform` por elemento. Si el revelado y la
// inclinación escribieran cada uno por su lado, el último en correr pisaría al
// otro y el texto quedaría trabado a mitad de entrada.
function applyLayer(l, px, py) {
    const lift = (1 - l.rev) * 18;
    l.el.style.opacity = l.rev;

    if (REDUCED) {
        l.el.style.transform = `translate3d(0, ${lift.toFixed(2)}px, 0)`;
        return;
    }

    const d = l.depth;
    l.el.style.transform =
        `perspective(900px) rotateY(${(px * d * 3.0).toFixed(2)}deg) ` +
        `rotateX(${(py * d * 2.1).toFixed(2)}deg) ` +
        `translate3d(${(px * d * 14).toFixed(2)}px, ${(lift - py * d * 10).toFixed(2)}px, 0)`;
}

function bindParallax(scene) {
    Render.on(Phase.BEFORE_RENDER, () => {
        for (const l of layers) applyLayer(l, scene.pointer.x, scene.pointer.y);
    });
}

// --- Medidor de profundidad --------------------------------------------

const NIVELES = [
    [0.00, 'BORDE'],
    [0.22, 'VISUAL LAB'],
    [0.48, 'TRÁNSITO'],
    [0.74, 'EL SOL'],
];

function bindDepth(scene) {
    const fill = $('#depth-fill');
    const label = $('#depth-label');
    let last = '';

    Render.on(Phase.POST_RENDER, () => {
        const d = clamp(scene.descent, 0, 1);
        fill.style.height = (d * 100).toFixed(2) + '%';

        let name = NIVELES[0][1];
        for (const [at, n] of NIVELES) if (d >= at) name = n;
        if (name !== last) {
            last = name;
            label.textContent = name;
            // Un pulso de glitch al cruzar de nivel. Marca el umbral sin
            // necesidad de un cartel que lo anuncie.
            scene.pulse(0.45);
            scene.flash(0.5);
        }
    });
}

// --- Revelado por sección ----------------------------------------------

function bindReveals() {
    const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            io.unobserve(entry.target);

            const own = layers.filter(l => entry.target.contains(l.el));
            const ordered = own.sort((a, b) => b.depth - a.depth);
            const tl = new Timeline();
            tl.stagger(ordered, 0.075, 0.8, 'outQuart', (l, e) => { l.rev = e; }, 0);
            tl.play();
        }
    }, { rootMargin: '-14% 0px -14% 0px' });

    // La primera sección se revela con la coreografía de entrada, no por
    // observador: si esperara a la intersección, quedaría un frame en blanco
    // entre que se va el loader y aparece el texto.
    $$('[data-section]').slice(1).forEach(s => io.observe(s));
    $('footer') && io.observe($('footer'));
}

// --- Entrada -----------------------------------------------------------

function reveal(scene) {
    const first = $('.surface');
    const own = layers.filter(l => first.contains(l.el)).sort((a, b) => b.depth - a.depth);

    const tl = new Timeline();
    // El canvas entra solo. Si el texto entra al mismo tiempo, compiten por la
    // atención y no se percibe ninguno.
    tl.add(e => { scene.post.fade = e; }, 1.2, 'outCubic', 0);
    tl.stagger(own, 0.085, 0.8, 'outQuart', (l, e) => { l.rev = e; }, 0.35);
    return tl.play();
}

// --- Camino degradado --------------------------------------------------

function fallback(err) {
    console.warn('[espiral] sin escena, modo degradado:', err);
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
        // Ruta absoluta + marca de build. Relativa resolveria contra la URL
        // de la pagina (en la raiz seria /assets/, otra carpeta del sitio), y
        // la marca fuerza a los visitantes recurrentes a la version nueva.
        const BUILD = window.__BUILD || 'dev';
        await scene.load(`/entrada-tunel/assets/compiled.glsl?v=${BUILD}`, p => { load.target = p; });
    } catch (err) {
        fallback(err);
        return;
    }

    window.__scene = scene;
    Scroll.init();
    initLayers();
    bindParallax(scene);
    bindDepth(scene);
    bindReveals();

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
