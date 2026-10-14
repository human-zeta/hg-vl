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
