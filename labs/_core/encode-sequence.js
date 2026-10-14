// Codifica una secuencia de frames ya dibujados.
// GIF: gifenc. WebP animado: canvas → WebP quieto + muxer propio.
// MP4 / WebM: mediabunny CanvasSource, que usa VideoEncoder.
import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
  getFirstEncodableVideoCodec,
} from 'https://esm.sh/mediabunny@1.61.4';
import { createGifEncoder, buildPalette, samplePaletteFrames } from './gif-encode.js';
import { muxAnimatedWebp } from './webp-anim.js';
import { frameDelayMs } from './timeline.js';

const codecCache = new Map();

function makeCanvas(width, height) {
  // En el hilo principal, el canvas del documento puede dibujar un <video>.
  // En el worker no hay document: OffscreenCanvas.
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }
  return new OffscreenCanvas(width, height);
}

function canvasToBlob(canvas, type, quality) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No pude exportar ' + type))), type, quality);
  });
}

async function pickCodec(container, width, height, fps) {
  const key = `${container}:${width}x${height}@${fps}`;
  if (codecCache.has(key)) return codecCache.get(key);
  const format = container === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat();
  const codec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), {
    width,
    height,
    frameRate: fps,
  });
  codecCache.set(key, codec);
  return codec;
}

function paint(ctx, frame, width, height) {
  if (!frame) return false;
  if (typeof ImageData !== 'undefined' && frame instanceof ImageData) {
    ctx.putImageData(frame, 0, 0);
    return true;
  }
  if (ArrayBuffer.isView(frame)) {
    const rgba = new Uint8ClampedArray(frame);
    ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
    return true;
  }
  ctx.drawImage(frame, 0, 0, width, height);
  return true;
}

// frames: array de RGBA, ImageData o canvas. O un async render(ctx, i).
export async function encodeSequence({
  width,
  height,
  fps,
  format,
  frames,
  renderFrame,
  count,
  dither = false,
  onProgress,
}) {
  const n = count || (frames ? frames.length : 0);
  if (!n) throw new Error('No hay fotogramas para codificar.');
  const draw = async (ctx, i) => {
    if (renderFrame) {
      await renderFrame(ctx, i);
      return;
    }
    paint(ctx, frames[i], width, height);
  };

  if (format === 'gif') return encodeGif({ width, height, fps, frames, renderFrame, count: n, dither, onProgress });
  if (format === 'webp') return encodeWebp({ width, height, fps, draw, count: n, onProgress });
  if (format === 'mp4' || format === 'webm') {
    return encodeVideo({ width, height, fps, container: format, draw, count: n, onProgress });
  }
  throw new Error('Formato desconocido: ' + format);
}

async function collectRgba(width, height, frames, renderFrame, count) {
  if (frames && frames.length && ArrayBuffer.isView(frames[0])) return frames;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const out = [];
  const n = frames ? frames.length : count;
  for (let i = 0; i < n; i++) {
    if (renderFrame) await renderFrame(ctx, i);
    else paint(ctx, frames[i], width, height);
    out.push(ctx.getImageData(0, 0, width, height).data);
  }
  return out;
}

async function encodeGif({ width, height, fps, frames, renderFrame, count, dither, onProgress }) {
  const rgba = await collectRgba(width, height, frames, renderFrame, count);
  const delay = frameDelayMs(fps);
  const palette = buildPalette(samplePaletteFrames(rgba, 8));
  const enc = createGifEncoder({ width, height, delay, palette, dither });
  for (let i = 0; i < rgba.length; i++) {
    enc.add(rgba[i]);
    onProgress?.({ phase: 'encode', index: i + 1, total: rgba.length, ratio: 0.55 + ((i + 1) / rgba.length) * 0.45 });
  }
  const bytes = enc.finish();
  return { bytes, mime: 'image/gif', ext: 'gif', frames: rgba.length };
}

async function encodeWebp({ width, height, fps, draw, count, onProgress }) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const stills = [];
  for (let i = 0; i < count; i++) {
    await draw(ctx, i);
    const blob = await canvasToBlob(canvas, 'image/webp', 0.82);
    if (!blob || (blob.type && blob.type !== 'image/webp')) {
      throw new Error('Este navegador no exporta WebP.');
    }
    stills.push(new Uint8Array(await blob.arrayBuffer()));
    onProgress?.({ phase: 'encode', index: i + 1, total: count, ratio: (i + 1) / count });
  }
  const bytes = muxAnimatedWebp(stills, frameDelayMs(fps), width, height);
  return { bytes, mime: 'image/webp', ext: 'webp', frames: count };
}

async function encodeVideo({ width, height, fps, container, draw, count, onProgress }) {
  const codec = await pickCodec(container, width, height, fps);
  if (!codec) {
    throw new Error(container === 'mp4'
      ? 'Este navegador no puede codificar MP4.'
      : 'Este navegador no puede codificar WebM con VideoEncoder.');
  }
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const fileFormat = container === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat();
  const output = new Output({ format: fileFormat, target: new BufferTarget() });
  const source = new CanvasSource(canvas, {
    codec,
    quality: new Quality({ quality: 'medium', preferBitrate: true }),
    keyFrameInterval: 1,
  });
  output.addVideoTrack(source);
  await output.start();
  const frameDur = 1 / fps;
  for (let i = 0; i < count; i++) {
    await draw(ctx, i);
    await source.add(i * frameDur, frameDur, i === 0 ? { keyFrame: true } : undefined);
    onProgress?.({ phase: 'encode', index: i + 1, total: count, ratio: 0.15 + ((i + 1) / count) * 0.85 });
  }
  await output.finalize();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error('La codificación no produjo bytes.');
  return {
    bytes: new Uint8Array(buffer),
    mime: fileFormat.mimeType,
    ext: container,
    frames: count,
    codec,
  };
}

export async function stillWebpSupported() {
  try {
    const canvas = makeCanvas(2, 2);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 2, 2);
    const blob = await canvasToBlob(canvas, 'image/webp', 0.8);
    return !!(blob && blob.size > 24 && (!blob.type || blob.type === 'image/webp'));
  } catch {
    return false;
  }
}

export async function videoCodecs(width, height, fps = 30) {
  const out = { mp4: null, webm: null };
  if (typeof VideoEncoder !== 'function') return out;
  try {
    out.mp4 = await pickCodec('mp4', width, height, fps);
    out.webm = await pickCodec('webm', width, height, fps);
  } catch { /* feature detection: si falla, el formato queda apagado */ }
  return out;
}

export { canvasToBlob, makeCanvas };
