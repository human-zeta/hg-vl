// Interpolacion, easings y coreografia.
//
// Todo corre sobre el reloj de Render, no sobre rAF propio ni sobre
// transiciones CSS. Un unico reloj significa que un tween de una uniform de
// shader y un tween de una propiedad del DOM avanzan en el mismo frame con el
// mismo delta. Ver dossier §6.

import { Render, Phase } from './render.js';

// --- Easings -----------------------------------------------------------
// Set de Penner, la misma familia que expone Hydra en TweenManager.Interpolation.

const pow = Math.pow, sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt;
const c1 = 1.70158;              // sobrepaso de back
const c2 = c1 * 1.525;
const c3 = c1 + 1;
const c4 = (2 * Math.PI) / 3;    // periodo de elastic

export const Ease = {
    linear:      t => t,

    inQuad:      t => t * t,
    outQuad:     t => 1 - (1 - t) * (1 - t),
    inOutQuad:   t => t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2,

    inCubic:     t => t * t * t,
    outCubic:    t => 1 - pow(1 - t, 3),
    inOutCubic:  t => t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2,

    inQuart:     t => t * t * t * t,
    outQuart:    t => 1 - pow(1 - t, 4),
    inOutQuart:  t => t < 0.5 ? 8 * t * t * t * t : 1 - pow(-2 * t + 2, 4) / 2,

    inQuint:     t => pow(t, 5),
    outQuint:    t => 1 - pow(1 - t, 5),
    inOutQuint:  t => t < 0.5 ? 16 * pow(t, 5) : 1 - pow(-2 * t + 2, 5) / 2,

    inSine:      t => 1 - cos((t * Math.PI) / 2),
    outSine:     t => sin((t * Math.PI) / 2),
    inOutSine:   t => -(cos(Math.PI * t) - 1) / 2,

    inExpo:      t => t === 0 ? 0 : pow(2, 10 * t - 10),
    outExpo:     t => t === 1 ? 1 : 1 - pow(2, -10 * t),
    inOutExpo:   t => t === 0 ? 0 : t === 1 ? 1 : t < 0.5
                        ? pow(2, 20 * t - 10) / 2 : (2 - pow(2, -20 * t + 10)) / 2,

    inCirc:      t => 1 - sqrt(1 - pow(t, 2)),
    outCirc:     t => sqrt(1 - pow(t - 1, 2)),
    inOutCirc:   t => t < 0.5 ? (1 - sqrt(1 - pow(2 * t, 2))) / 2
                              : (sqrt(1 - pow(-2 * t + 2, 2)) + 1) / 2,

    inBack:      t => c3 * t * t * t - c1 * t * t,
    outBack:     t => 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2),
    inOutBack:   t => t < 0.5
                    ? (pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
                    : (pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2,

    outElastic:  t => t === 0 ? 0 : t === 1 ? 1
                    : pow(2, -10 * t) * sin((t * 10 - 0.75) * c4) + 1,

    outBounce:   t => {
        const n = 7.5625, d = 2.75;
        if (t < 1 / d) return n * t * t;
        if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
        if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
        return n * (t -= 2.625 / d) * t + 0.984375;
    }
};

// Resolutor de cubic-bezier, igual que el de CSS. Permite usar las curvas que
// entrega un diseñador desde una herramienta de motion sin traducirlas a un
// easing con nombre.
export function cubicBezier(x1, y1, x2, y2) {
    const A = (a, b) => 1 - 3 * b + 3 * a;
    const B = (a, b) => 3 * b - 6 * a;
    const C = a => 3 * a;
    const calc = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
    const slope = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);

    return function (x) {
        if (x1 === y1 && x2 === y2) return x;
        if (x <= 0) return 0;
        if (x >= 1) return 1;

        let t = x;
        // Newton-Raphson converge en 4 iteraciones para curvas razonables.
        for (let i = 0; i < 8; i++) {
            const d = slope(t, x1, x2);
            if (d === 0) break;
            t -= (calc(t, x1, x2) - x) / d;
        }
        return calc(t, y1, y2);
    };
}

// --- Suavizado independiente del framerate -----------------------------

// El error clasico es `v += (target - v) * 0.1` por frame: a 120 Hz converge
// al doble de velocidad que a 60 y el sitio "se siente distinto" segun el
// monitor. La forma exponencial es exacta para cualquier delta.
export function damp(current, target, lambda, dt) {
    return target + (current - target) * Math.exp(-lambda * dt);
}

export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function smoothstep(a, b, v) {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
}

// --- Tweens ------------------------------------------------------------

const active = new Set();

Render.on(Phase.BEFORE_RENDER, (dt) => {
    for (const tw of active) tw._update(dt);
});

class Tween {
    constructor(target, props, duration, ease, delay) {
        this.target = target;
        this.duration = Math.max(duration, 1e-6);
        this.ease = typeof ease === 'function' ? ease : (Ease[ease] || Ease.outCubic);
        this.elapsed = -(delay || 0);
        this.done = false;
        this.onUpdate = null;

        this.from = {};
        this.to = {};
        for (const k in props) {
            this.from[k] = target[k] ?? 0;
            this.to[k] = props[k];
        }

        this.promise = new Promise(resolve => { this._resolve = resolve; });
        active.add(this);
    }

    _update(dt) {
        this.elapsed += dt;
        if (this.elapsed < 0) return;

        const t = clamp(this.elapsed / this.duration, 0, 1);
        const e = this.ease(t);

        for (const k in this.to) {
            this.target[k] = this.from[k] + (this.to[k] - this.from[k]) * e;
        }
        if (this.onUpdate) this.onUpdate(e, t);

        if (t >= 1) this.kill(true);
    }

    kill(completed = false) {
        if (this.done) return;
        this.done = true;
        active.delete(this);
        this._resolve(completed);
    }

    then(fn) { return this.promise.then(fn); }
}

export function tween(target, props, duration, ease = 'outCubic', delay = 0) {
    return new Tween(target, props, duration, ease, delay);
}

export function clearTweens(target) {
    for (const tw of active) if (tw.target === target) tw.kill(false);
}

// Espera N segundos en el reloj de Render. A diferencia de setTimeout se
// detiene con la pestana y respeta timeScale, asi que una secuencia
// coreografiada no se desarma cuando el usuario cambia de tab a la mitad.
export function delay(seconds) {
    const holder = { v: 0 };
    return new Tween(holder, { v: 1 }, seconds, Ease.linear, 0).promise;
}

// --- Coreografia -------------------------------------------------------

// Una linea de tiempo con offsets explicitos. Es la version en codigo de lo
// que Active Theory resuelve con un editor visual (TimelineUIL): la diferencia
// de calidad no esta en el motor de tweens sino en poder ajustar los tiempos
// mirando el resultado en vez de adivinando numeros. Ver dossier §6.3.
export class Timeline {
    constructor() {
        this.entries = [];
        this.cursor = 0;
    }

    // at: numero absoluto en segundos, o '+=0.2' / '-=0.1' relativo al final
    // de lo ultimo agregado.
    add(fn, duration, ease = 'outCubic', at = '+=0') {
        let start;
        if (typeof at === 'number') start = at;
        else if (at.startsWith('+=')) start = this.cursor + parseFloat(at.slice(2));
        else if (at.startsWith('-=')) start = this.cursor - parseFloat(at.slice(2));
        else start = parseFloat(at) || 0;

        this.entries.push({
            start,
            duration: Math.max(duration, 1e-6),
            ease: typeof ease === 'function' ? ease : (Ease[ease] || Ease.outCubic),
            fn
        });
        this.cursor = start + duration;
        return this;
    }

    // Desfase constante entre elementos: el recurso mas barato para que una
    // lista entre "con vida" en lugar de como un bloque.
    stagger(items, step, duration, ease, fn, at = '+=0') {
        items.forEach((item, i) => {
            this.add(e => fn(item, e, i), duration, ease, i === 0 ? at : `-=${duration - step}`);
        });
        return this;
    }

    get duration() {
        return this.entries.reduce((m, e) => Math.max(m, e.start + e.duration), 0);
    }

    play() {
        const total = this.duration;
        const clock = { t: 0 };
        const tw = new Tween(clock, { t: total }, total, Ease.linear, 0);
        tw.onUpdate = () => {
            for (const e of this.entries) {
                const local = clamp((clock.t - e.start) / e.duration, 0, 1);
                e.fn(e.ease(local), local);
            }
        };
        return tw.promise;
    }
}
