// Scroll.
//
// Decision deliberada: el scroll es NATIVO. El documento tiene su altura real,
// la barra funciona, Re Pag / Inicio / Fin funcionan, el buscador del navegador
// puede saltar a un resultado y un lector de pantalla recorre el contenido.
// Lo unico que hacemos es leer scrollY una vez por frame y suavizarlo para
// alimentar la escena.
//
// La alternativa —secuestrar la rueda y mover todo con transform, que es lo que
// hacen casi todos los sitios "smooth scroll"— compra inercia y paga con
// accesibilidad, buscador interno, y un comportamiento roto en trackpads de
// Windows. Para una landing que tiene que convertir, es un mal negocio.
// Ver dossier §7.

import { Render, Phase } from './render.js';
import { damp, clamp } from './tween.js';

class ScrollManager {
    constructor() {
        this.raw = 0;        // px
        this.smooth = 0;     // px, amortiguado
        this.progress = 0;   // 0..1 sobre el largo scrolleable
        this.velocity = 0;   // px/s suavizado, con signo
        this.max = 1;

        this._lastSmooth = 0;
        this._lambda = 9;    // mas alto = mas pegado al scroll real

        this._onScroll = () => { this.raw = window.scrollY || 0; };
        this._onResize = () => this.measure();
    }

    init() {
        this.measure();
        // passive: el handler no llama preventDefault, y decirselo al navegador
        // le permite no bloquear el hilo de compositing esperando a ver si lo hace.
        window.addEventListener('scroll', this._onScroll, { passive: true });
        window.addEventListener('resize', this._onResize);
        this._onScroll();
        this.smooth = this.raw;

        Render.on(Phase.BEFORE_RENDER, (dt) => this.update(dt));
        return this;
    }

    measure() {
        this.max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    }

    update(dt) {
        this.smooth = damp(this.smooth, this.raw, this._lambda, dt);

        const instant = (this.smooth - this._lastSmooth) / Math.max(dt, 1e-4);
        this.velocity = damp(this.velocity, instant, 6, dt);
        this._lastSmooth = this.smooth;

        this.progress = clamp(this.smooth / this.max, 0, 1);
    }

    // Progreso de un elemento respecto del viewport: 0 cuando su borde
    // superior toca el borde inferior de la pantalla, 1 cuando su borde
    // inferior sale por arriba. Es la base de cualquier animacion por seccion.
    progressOf(el, offset = 0) {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        return clamp((vh - r.top - offset) / (vh + r.height), 0, 1);
    }

    destroy() {
        window.removeEventListener('scroll', this._onScroll);
        window.removeEventListener('resize', this._onResize);
    }
}

export const Scroll = new ScrollManager();
