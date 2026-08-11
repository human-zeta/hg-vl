// El render loop.
//
// Un solo requestAnimationFrame para toda la aplicacion. Todo lo que se mueve
// —escena, tweens, scroll, DOM— cuelga de aca. Si cada sistema abre su propio
// rAF terminan desfasados entre si por un frame y esa diferencia es
// exactamente lo que se percibe como "el texto va atras de la animacion".
// Ver dossier §4.

// Frecuencias reales de pantalla. La medicion se ajusta a la mas cercana en
// vez de usarse cruda: medir da 59.94 o 143.7 y hacer cuentas con eso
// arrastra error.
const REFRESH_TABLE = [30, 60, 72, 90, 100, 120, 144, 165, 240];

export const Phase = {
    BEFORE_RENDER: 0,
    RENDER: 1,
    POST_RENDER: 2
};

class RenderLoop {
    constructor() {
        this.REFRESH_RATE = 60;
        // Cuanto dura este frame medido en frames de 60 Hz. En una pantalla de
        // 120 Hz vale 0.5. Toda animacion escrita "por frame" se multiplica por
        // esto y corre igual de rapido en cualquier pantalla.
        this.HZ_MULTIPLIER = 1;

        this.time = 0;          // segundos acumulados, afectados por timeScale
        this.delta = 1 / 60;    // segundos del ultimo frame, ya escalados
        this.frame = 0;
        this.running = false;
        this.timeScale = 1;

        this._callbacks = [[], [], []];
        this._last = 0;
        this._rafId = 0;
        this._samples = [];
        this._measured = false;
        this._tick = this._tick.bind(this);

        // Al volver de una pestana en segundo plano el primer delta puede ser
        // de varios segundos. Sin este corte, todo lo que integra por delta
        // (las particulas) salta a otro universo en un frame.
        this._maxDelta = 1 / 15;

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.stop();
            else this.start();
        });
    }

    on(phase, fn) {
        this._callbacks[phase].push(fn);
        return () => this.off(phase, fn);
    }

    off(phase, fn) {
        const arr = this._callbacks[phase];
        const i = arr.indexOf(fn);
        if (i !== -1) arr.splice(i, 1);
    }

    start() {
        if (this.running) return;
        this.running = true;
        this._last = performance.now();
        this._rafId = requestAnimationFrame(this._tick);
    }

    stop() {
        this.running = false;
        cancelAnimationFrame(this._rafId);
    }

    _measure(rawDelta) {
        if (this._measured) return;
        // Se descartan los primeros frames: el arranque incluye compilacion de
        // shaders y subida de texturas, y esos deltas no representan nada.
        if (this.frame < 10) return;
        this._samples.push(1000 / rawDelta);
        if (this._samples.length < 30) return;

        this._samples.sort((a, b) => a - b);
        const median = this._samples[this._samples.length >> 1];
        let best = REFRESH_TABLE[0];
        for (const hz of REFRESH_TABLE) {
            if (Math.abs(hz - median) < Math.abs(best - median)) best = hz;
        }
        this.REFRESH_RATE = best;
        this.HZ_MULTIPLIER = 60 / best;
        this._measured = true;
    }

    _tick(now) {
        if (!this.running) return;
        this._rafId = requestAnimationFrame(this._tick);

        const rawDelta = now - this._last;
        this._last = now;
        this._measure(rawDelta);

        const dt = Math.min(rawDelta / 1000, this._maxDelta) * this.timeScale;
        this.delta = dt;
        this.time += dt;
        this.frame++;

        for (let p = 0; p < 3; p++) {
            const list = this._callbacks[p];
            for (let i = 0; i < list.length; i++) {
                try {
                    list[i](dt, this.time);
                } catch (err) {
                    // Un callback que explota no puede matar el loop: dejaria
                    // la pantalla congelada sin ningun sintoma en consola
                    // despues del primer error.
                    console.error('[render] callback fallo', err);
                }
            }
        }
    }
}

export const Render = new RenderLoop();
