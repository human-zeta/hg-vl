// Codifica una secuencia de frames ya dibujados.
// GIF: gifenc. WebP animado: canvas → WebP quieto + muxer propio.
// MP4 / WebM: mediabunny CanvasSource, que usa VideoEncoder.
// WebM con alpha: VP9 color + VP9 alpha (mediabunny lo parte solo).
// ZIP: secuencia PNG con alpha, cuando el encoder no puede transparencia.
// MP4 con audio: AudioBufferSource (AAC, u Opus si AAC no entra).
import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  getFirstEncodableVideoCodec,
} from 'https://esm.sh/mediabunny@1.61.4';
import { createGifEncoder, buildPalette, samplePaletteFrames } from './gif-encode.js';
import { muxAnimatedWebp } from './webp-anim.js';
import { frameDelayMs } from './timeline.js';
import { ZipStore } from './zip-store.js';
import { webmHasAlphaMode } from './webm-mark.js';

const codecCache = new Map();
const AAC_RATES = [48000, 44100, 32000, 24000, 22050, 16000];

function qualityOf(level) {
  const name = level === 'high' || level === 'low' || level === 'very-high' || level === 'very-low'
    ? level
    : 'medium';
  return new Quality({ quality: name, preferBitrate: true });
}

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
  canvas,
  alpha = false,
  audio = null,
  audioCodec = null,
  audioSampleRate = null,
  resample = false,
  quality = null,
  keyFrameInterval,
  pace = false,
  fastStart = false,
  extraFiles = null,
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
  if (format === 'zip') {
    return encodePngZip({ width, height, fps, draw, count: n, canvas, onProgress, pace, extraFiles });
  }
  if (format === 'mp4' || format === 'webm') {
    return encodeVideo({
      width, height, fps, container: format, draw, count: n, onProgress, canvas,
      alpha: !!alpha && format === 'webm',
      audio, audioCodec, audioSampleRate, resample, quality, keyFrameInterval, pace, fastStart,
    });
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

async function encodeVideo({
  width, height, fps, container, draw, count, onProgress, canvas: given,
  alpha, audio, audioCodec, audioSampleRate, resample, quality, keyFrameInterval, pace, fastStart,
}) {
  const w = Math.max(2, width | 0);
  const h = Math.max(2, height | 0);
  const level = quality || (alpha ? 'high' : 'medium');
  const q = qualityOf(level);
  let codec;
  if (alpha) {
    codec = await vp9Encodable(w, h, q) ? 'vp9' : null;
  } else if (container === 'mp4' && audio) {
    codec = await h264Encodable(w, h, q) ? 'avc' : null;
  } else {
    codec = await pickCodec(container, w, h, fps);
  }
  if (!codec) {
    throw new Error(alpha
      ? 'Este navegador no puede codificar WebM con alpha.'
      : container === 'mp4'
        ? 'Este navegador no puede codificar H.264.'
        : 'Este navegador no puede codificar WebM con VideoEncoder.');
  }
  const canvas = given || makeCanvas(w, h);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No pude abrir el canvas.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const fileFormat = container === 'mp4'
    ? (fastStart ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new Mp4OutputFormat())
    : new WebMOutputFormat();
  const output = new Output({ format: fileFormat, target: new BufferTarget() });
  const sourceConfig = {
    codec,
    quality: q,
    keyFrameInterval: Number.isFinite(keyFrameInterval) ? keyFrameInterval : (audio ? 2 : 1),
  };
  if (alpha || audio) sourceConfig.latencyMode = 'quality';
  if (alpha) sourceConfig.alpha = 'keep';
  const source = new CanvasSource(canvas, sourceConfig);
  output.addVideoTrack(source);
  let audioSource = null;
  let usedAudio = null;
  if (audio) {
    const picked = audioCodec || (await pickMp4Audio(audio.sampleRate, audio.numberOfChannels))?.codec;
    if (!picked) throw new Error('Este navegador no puede codificar el audio del MP4.');
    const audioConfig = { codec: picked, quality: qualityOf('high') };
    const targetRate = audioSampleRate || (picked === 'opus' ? 48000 : audio.sampleRate);
    if (resample || (picked === 'opus' && audio.sampleRate !== 48000) || (targetRate && targetRate !== audio.sampleRate)) {
      audioConfig.transform = { sampleRate: targetRate };
    }
    usedAudio = picked;
    audioSource = new AudioBufferSource(audioConfig);
    output.addAudioTrack(audioSource);
  }
  await output.start();
  try {
    const frameDur = 1 / fps;
    let audioAt = 0;
    for (let i = 0; i < count; i++) {
      if (alpha) ctx.clearRect(0, 0, w, h);
      await draw(ctx, i);
      if (audioSource) audioAt = await pumpAudio(audioSource, audio, audioAt, (i + 1) * frameDur);
      await source.add(i * frameDur, frameDur, i === 0 ? { keyFrame: true } : undefined);
      onProgress?.({ phase: 'encode', index: i + 1, total: count, ratio: 0.15 + ((i + 1) / count) * 0.85 });
      await yieldForPaint(pace, i);
    }
    if (audioSource) await pumpAudio(audioSource, audio, audioAt, Infinity);
    await output.finalize();
  } catch (err) {
    try { if (typeof output.cancel === 'function') await output.cancel(); } catch { /* ya cerrado */ }
    throw err;
  }
  const buffer = output.target.buffer;
  if (!buffer) throw new Error('La codificación no produjo bytes.');
  const bytes = new Uint8Array(buffer);
  if (alpha && !webmHasAlphaMode(bytes)) {
    throw new Error('El WebM salió sin canal alpha.');
  }
  return {
    bytes,
    mime: fileFormat.mimeType,
    ext: container,
    frames: count,
    codec,
    audioCodec: usedAudio,
  };
}

// Cada 8 cuadros se cede un frame de pantalla para que el progreso se pinte.
// requestAnimationFrame no ata la exportación a la duración del clip.
async function yieldForPaint(pace, index) {
  if (!pace || typeof document === 'undefined') return;
  if (typeof requestAnimationFrame === 'function' && index % 8 === 7) {
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    return;
  }
  if (index % 2 === 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

const audioFactories = new Map();

function audioFactory(sampleRate) {
  let ctx = audioFactories.get(sampleRate);
  if (ctx) return ctx;
  const Ctor = globalThis.OfflineAudioContext || globalThis.AudioContext;
  if (!Ctor) throw new Error('Este navegador no puede recortar audio.');
  ctx = new Ctor(1, 1, sampleRate);
  audioFactories.set(sampleRate, ctx);
  return ctx;
}

// Mete el audio de a ~1s, en muestras enteras, hasta el timestamp del video.
async function pumpAudio(source, buffer, fromSample, upToSec) {
  const sr = buffer.sampleRate;
  const limit = upToSec === Infinity
    ? buffer.length
    : Math.min(buffer.length, Math.ceil((upToSec + 1) * sr));
  const chunk = Math.max(1, Math.round(sr));
  let offset = fromSample | 0;
  while (offset < limit) {
    const frames = Math.min(chunk, limit - offset);
    const piece = audioFactory(sr).createBuffer(buffer.numberOfChannels, frames, sr);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      piece.copyToChannel(buffer.getChannelData(c).subarray(offset, offset + frames), c);
    }
    await source.add(piece);
    offset += frames;
  }
  return offset;
}

async function encodePngZip({ width, height, fps, draw, count, canvas: given, onProgress, pace, extraFiles }) {
  const canvas = given || makeCanvas(width, height);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No pude abrir el canvas.');
  const zip = new ZipStore();
  const lines = ['frame\ttimestamp_s'];
  const pad = String(count).length > 4 ? String(count).length : 4;
  for (let i = 0; i < count; i++) {
    ctx.clearRect(0, 0, width, height);
    await draw(ctx, i);
    const blob = await canvasToBlob(canvas, 'image/png');
    const png = new Uint8Array(await blob.arrayBuffer());
    const name = `frame-${String(i + 1).padStart(pad, '0')}.png`;
    zip.add(name, png);
    lines.push(`${name}\t${(i / fps).toFixed(4)}`);
    onProgress?.({ phase: 'encode', index: i + 1, total: count, ratio: (i + 1) / count });
    await yieldForPaint(pace, i);
  }
  const note = [
    'Secuencia PNG con transparencia.',
    `fps: ${fps}`,
    `cuadros: ${count}`,
    `tamaño: ${width}×${height}`,
    '',
    'En Premiere o After Effects: Importar y marcá secuencia de imágenes.',
    'OBS no reproduce una secuencia: si tu navegador puede, usá el .webm con alpha.',
    '',
  ].join('\n');
  zip.add('tiempos.txt', new TextEncoder().encode(lines.join('\n') + '\n'));
  zip.add('leeme.txt', new TextEncoder().encode(note));
  if (extraFiles) {
    for (const file of extraFiles) {
      const data = typeof file.data === 'string' ? new TextEncoder().encode(file.data) : file.data;
      zip.add(file.name, data);
    }
  }
  const bytes = new Uint8Array(await zip.toBlob().arrayBuffer());
  return { bytes, mime: 'application/zip', ext: 'zip', frames: count, codec: 'png' };
}

async function vp9Encodable(width, height, quality) {
  if (typeof VideoEncoder !== 'function') return false;
  try {
    const codecs = new WebMOutputFormat().getSupportedVideoCodecs();
    if (!codecs.includes('vp9')) return false;
    return await canEncodeVideo('vp9', { width, height, bitrate: quality });
  } catch {
    return false;
  }
}

async function h264Encodable(width, height, quality) {
  if (typeof VideoEncoder !== 'function') return false;
  try {
    const codecs = new Mp4OutputFormat().getSupportedVideoCodecs();
    if (!codecs.includes('avc')) return false;
    return await canEncodeVideo('avc', { width, height, bitrate: quality });
  } catch {
    return false;
  }
}

let alphaPipeline = null;

// Un WebM chico de verdad: canEncodeVideo descarta el alpha (mediabunny lo
// parte en dos encoders). Si el archivo no trae AlphaMode, este navegador
// no nos sirve para transparencia.
export function alphaPipelineWorks() {
  if (!alphaPipeline) {
    alphaPipeline = (async () => {
      if (!(await vp9Encodable(64, 64, qualityOf('medium')))) return false;
      try {
        const canvas = makeCanvas(64, 64);
        const ctx = canvas.getContext('2d', { alpha: true });
        const result = await encodeVideo({
          width: 64,
          height: 64,
          fps: 30,
          container: 'webm',
          count: 2,
          alpha: true,
          canvas,
          quality: 'medium',
          pace: false,
          draw: async (c, i) => {
            c.clearRect(0, 0, 64, 64);
            c.fillStyle = i ? 'rgba(255,0,0,0.6)' : '#f00';
            c.fillRect(16, 16, 32, 32);
          },
        });
        return webmHasAlphaMode(result.bytes);
      } catch {
        return false;
      }
    })();
  }
  return alphaPipeline;
}

export async function pickMp4Audio(sampleRate, channels) {
  if (typeof AudioEncoder !== 'function') return null;
  let supported;
  try {
    supported = new Mp4OutputFormat().getSupportedAudioCodecs();
  } catch {
    return null;
  }
  const ch = Math.max(1, Math.min(2, channels | 0 || 2));
  const q = qualityOf('high');
  const rate = sampleRate | 0;
  if (supported.includes('aac')) {
    const rates = [];
    if (AAC_RATES.includes(rate)) rates.push(rate);
    for (const r of [48000, 44100]) if (!rates.includes(r)) rates.push(r);
    for (const candidate of rates) {
      try {
        if (await canEncodeAudio('aac', { numberOfChannels: ch, sampleRate: candidate, bitrate: q })) {
          return { codec: 'aac', sampleRate: candidate, resample: candidate !== rate };
        }
      } catch { /* el siguiente rate */ }
    }
  }
  if (supported.includes('opus')) {
    try {
      if (await canEncodeAudio('opus', { numberOfChannels: ch, sampleRate: 48000, bitrate: q })) {
        return { codec: 'opus', sampleRate: 48000, resample: rate !== 48000 };
      }
    } catch { /* sin opus */ }
  }
  return null;
}

// Qué puede escribir este navegador para un clip dibujado (no un archivo de video).
// webcodecs: true si hay VideoEncoder, aunque el formato pedido no entre.
export async function probeDrawnExport({
  width,
  height,
  fps = 30,
  alpha = false,
  audio = false,
  sampleRate = 48000,
  channels = 2,
  quality = null,
}) {
  const webcodecs = typeof VideoEncoder === 'function';
  const w = Math.max(2, width | 0);
  const h = Math.max(2, height | 0);
  if (!webcodecs) return { ok: false, webcodecs: false, reason: 'no-webcodecs' };
  if (alpha) {
    const pipeline = await alphaPipelineWorks();
    const q = qualityOf(quality || 'high');
    if (pipeline && await vp9Encodable(w, h, q)) {
      return { ok: true, webcodecs: true, container: 'webm', videoCodec: 'vp9', alpha: true, audioCodec: null };
    }
    return { ok: false, webcodecs: true, reason: 'no-alpha' };
  }
  if (audio) {
    const q = qualityOf(quality || 'medium');
    const videoOk = await h264Encodable(w, h, q);
    const audioPick = videoOk ? await pickMp4Audio(sampleRate, channels) : null;
    if (videoOk && audioPick) {
      return {
        ok: true,
        webcodecs: true,
        container: 'mp4',
        videoCodec: 'avc',
        alpha: false,
        audioCodec: audioPick.codec,
        audioSampleRate: audioPick.sampleRate,
        resample: audioPick.resample,
      };
    }
    return { ok: false, webcodecs: true, reason: videoOk ? 'no-audio-codec' : 'no-avc' };
  }
  const q = qualityOf(quality || 'medium');
  try {
    const webm = await pickCodec('webm', w, h, fps);
    if (webm) {
      return { ok: true, webcodecs: true, container: 'webm', videoCodec: webm, alpha: false, audioCodec: null };
    }
  } catch { /* sin webm */ }
  if (await h264Encodable(w, h, q)) {
    return { ok: true, webcodecs: true, container: 'mp4', videoCodec: 'avc', alpha: false, audioCodec: null };
  }
  return { ok: false, webcodecs: true, reason: 'no-video' };
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
