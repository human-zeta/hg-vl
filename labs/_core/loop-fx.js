// Boomerang y crossfade sobre buffers RGBA ya decodificados.
import { boomerangOrder } from './timeline.js';

export function blendRgba(a, b, al) {
  const out = new Uint8ClampedArray(a.length);
  const t = Math.min(1, Math.max(0, al));
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

// Devuelve la secuencia del loop. Boomerang reutiliza los buffers
// (no copia píxeles). Crossfade solo copia la cola que funde.
export function applyLoop(frames, mode, fadeSec, fps) {
  const n = frames.length;
  if (!n) return [];
  if (mode === 'boomerang') {
    return boomerangOrder(n).map((i) => frames[i]);
  }
  const X = Math.min(n - 1, Math.max(1, Math.round(Number(fadeSec) * Number(fps))));
  const seq = frames.slice();
  for (let j = 0; j < X; j++) {
    const i = n - X + j;
    seq[i] = blendRgba(frames[i], frames[0], (j + 1) / X);
  }
  return seq;
}
