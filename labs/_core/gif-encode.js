// GIF en gifenc. Corre igual en el hilo principal (fallback) y en el worker.
import { GIFEncoder, quantize, applyPalette } from 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js';

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Tramado ordenado 4×4. Muta el buffer (Uint8ClampedArray clampea solo).
export function bayerDither(data, w, h) {
  const k = 22;
  for (let y = 0; y < h; y++) {
    const row = BAYER[y & 3];
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const t = (row[x & 3] / 16 - 0.5) * k;
      data[i] += t;
      data[i + 1] += t;
      data[i + 2] += t;
    }
  }
  return data;
}

export function buildPalette(frames) {
  let len = 0;
  for (const f of frames) len += f.length;
  if (!len) throw new Error('No hay píxeles para armar la paleta.');
  const cat = new Uint8ClampedArray(len);
  let o = 0;
  for (const f of frames) {
    cat.set(f, o);
    o += f.length;
  }
  return quantize(cat, 256);
}

export function samplePaletteFrames(frames, max = 8) {
  if (frames.length <= max) return frames.slice();
  const picks = [];
  for (let s = 0; s < max; s++) {
    const i = Math.min(frames.length - 1, Math.floor((s + 0.5) * frames.length / max));
    picks.push(frames[i]);
  }
  return picks;
}

export function createGifEncoder({ width, height, delay, palette, dither }) {
  const gif = GIFEncoder();
  return {
    add(rgba) {
      const src = dither ? bayerDither(new Uint8ClampedArray(rgba), width, height) : rgba;
      const index = applyPalette(src, palette);
      gif.writeFrame(index, width, height, { palette, delay });
    },
    finish() {
      gif.finish();
      const bytes = gif.bytes();
      return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    },
  };
}

export function encodeGifRgba(frames, width, height, delay, { dither = false } = {}) {
  if (!frames.length) throw new Error('No hay fotogramas para el GIF.');
  const palette = buildPalette(samplePaletteFrames(frames, 8));
  const enc = createGifEncoder({ width, height, delay, palette, dither });
  for (const f of frames) enc.add(f);
  return enc.finish();
}
