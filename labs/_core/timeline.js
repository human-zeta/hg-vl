// Tiempos y tamaños compartidos por GIF, LOOP y FRAMES.
// Sin DOM: lo usa el hilo principal, el worker y los tests.

export function frameDelayMs(fps) {
  const n = Number(fps);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.max(1, Math.round(1000 / n));
}

export function fitSize(srcW, srcH, targetW) {
  const tw = Math.max(2, (targetW | 0) - ((targetW | 0) % 2));
  if (!srcW || !srcH) return { width: tw, height: tw };
  let height = Math.round(tw * srcH / srcW);
  if (height % 2) height += 1;
  if (height < 2) height = 2;
  return { width: tw, height };
}

// Fotogramas de un recorte: el último cae justo antes de start+dur,
// igual que el camino viejo (i/fps), pero el caller puede clamp al
// primer timestamp real del archivo para no pedir frames que no existen.
export function clipTimestamps(start, dur, fps, mediaDuration, firstTimestamp = 0) {
  const total = Math.max(1, Math.round(Number(dur) * Number(fps)));
  const first = Number.isFinite(firstTimestamp) ? firstTimestamp : 0;
  const endCap = Number.isFinite(mediaDuration) && mediaDuration > 0
    ? Math.max(first, mediaDuration - 1e-3)
    : null;
  const ts = [];
  for (let i = 0; i < total; i++) {
    let t = Number(start) + i / Number(fps);
    if (t < first) t = first;
    if (endCap != null && t > endCap) t = endCap;
    ts.push(t);
  }
  return ts;
}

export function spreadTimestamps(n, duration, firstTimestamp = 0) {
  const count = Math.max(1, n | 0);
  const first = Number.isFinite(firstTimestamp) ? firstTimestamp : 0;
  const end = Number.isFinite(duration) && duration > first
    ? Math.max(first, duration - 0.04)
    : first;
  if (count === 1) return [first];
  const ts = [];
  for (let i = 0; i < count; i++) {
    ts.push(first + (i / (count - 1)) * (end - first));
  }
  return ts;
}

// Muestras para detección de cortes. Si el video es largo, baja el paso
// para cubrir todo el clip sin decodificar decenas de miles de frames.
export function sceneTimestamps(duration, sampleFps, firstTimestamp = 0, cap = 2400) {
  const fps = Math.min(12, Math.max(2, Number(sampleFps) || 8));
  const first = Number.isFinite(firstTimestamp) ? firstTimestamp : 0;
  const end = Number.isFinite(duration) && duration > first
    ? Math.max(first, duration - 0.04)
    : first;
  const span = Math.max(0, end - first);
  let step = 1 / fps;
  const estimated = Math.floor(span / step) + 1;
  if (estimated > cap) step = span / Math.max(1, cap - 1);
  const ts = [];
  for (let t = first; t <= end + 1e-6 && ts.length < cap; t += step) {
    ts.push(Math.min(t, end));
  }
  if (!ts.length) ts.push(first);
  return ts;
}

export function boomerangOrder(n) {
  const idx = [];
  for (let i = 0; i < n; i++) idx.push(i);
  for (let i = n - 2; i >= 1; i--) idx.push(i);
  return idx;
}

// Cuántos fotogramas entran en una duración a un fps dado.
// round, no ceil: 1.2s a 60 fps son 72, y el archivo dura count/fps.
export function exportFrameCount(durationSec, fps) {
  const d = Number(durationSec);
  const f = Number(fps);
  if (!(d > 0) || !(f > 0)) return 1;
  return Math.max(1, Math.round(d * f));
}

// Tiempo de la animación en el fotograma i. El último cae en `total`
// para que el cierre (texto asentado, stinger descubierto, barra al 100%)
// entre en el archivo. Los anteriores siguen i/fps * velocidad.
export function frameSampleTime(index, count, fps, speed, total) {
  const n = count | 0;
  const span = Number(total);
  if (!(span >= 0)) return 0;
  if (n <= 1) return span;
  if ((index | 0) >= n - 1) return span;
  const f = Number(fps);
  const s = Number(speed);
  if (!(f > 0) || !(s > 0)) return 0;
  return Math.min(span, (index / f) * s);
}

// Recorte de un AudioBuffer en muestras, sin flotar el índice.
export function audioSliceRange(length, sampleRate, startSec, durSec) {
  const n = Math.max(0, length | 0);
  const sr = Math.max(1, sampleRate | 0);
  const start = Math.max(0, Math.min(n, Math.floor(Math.max(0, Number(startSec) || 0) * sr)));
  const want = Math.max(1, Math.ceil(Math.max(0, Number(durSec) || 0) * sr));
  const end = Math.min(n, start + want);
  return { start, end, frames: Math.max(0, end - start) };
}
