// Fachada de los tools de video.
// Camino rápido: worker + mediabunny (demux) + VideoDecoder.
// Si WebCodecs o el codec no están, se vuelve al seek de <video> en el hilo principal.
import { applyLoop } from './loop-fx.js';
import { lumaFromImageData, shouldKeepScene, thresholdFor } from './scene.js';
import { clipTimestamps, fitSize, frameDelayMs, sceneTimestamps, spreadTimestamps } from './timeline.js';
import { muxAnimatedWebp } from './webp-anim.js';
import { zipFrames } from './zip-store.js';

const MEDIABUNNY = 'https://esm.sh/mediabunny@1.61.4';

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

export function webCodecsAvailable() {
  return typeof VideoDecoder === 'function' && typeof VideoFrame === 'function';
}

function workerAvailable() {
  return webCodecsAvailable()
    && typeof Worker === 'function'
    && typeof OffscreenCanvas === 'function';
}

export function fitOutputSize(srcW, srcH, targetW) {
  return fitSize(srcW, srcH, targetW);
}

export async function probeVideo(file) {
  if (!file) return { ok: false, reason: 'sin-video' };
  if (!webCodecsAvailable()) return { ok: false, reason: 'sin-webcodecs' };
  let input;
  try {
    const { Input, ALL_FORMATS, BlobSource } = await import(MEDIABUNNY);
    input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    const track = await input.getPrimaryVideoTrack();
    if (!track) return { ok: false, reason: 'sin-video' };
    const [decodable, duration, width, height, firstTimestamp] = await Promise.all([
      track.canDecode(),
      track.computeDuration(),
      track.getDisplayWidth(),
      track.getDisplayHeight(),
      track.getFirstTimestamp(),
    ]);
    let fps = null;
    try {
      const metrics = await track.computeFrameRateMetrics();
      fps = metrics.underlyingFrameRate || metrics.bestGuessFrameRate || null;
    } catch { /* sin fps estimado: la detección de escena usa 8 */ }
    return {
      ok: !!decodable,
      reason: decodable ? null : 'codec',
      duration,
      width,
      height,
      firstTimestamp,
      fps,
      codec: track.codec || null,
    };
  } catch (err) {
    return { ok: false, reason: 'demux', message: err && err.message ? err.message : 'No pude leer el archivo.' };
  } finally {
    try { input?.dispose(); } catch { /* el input ya se cerró */ }
  }
}

export function engineLabel(probe) {
  if (!probe) return 'mirando el archivo…';
  if (probe.ok) {
    const codec = probe.codec ? ` · ${probe.codec}` : '';
    const fps = probe.fps ? ` · ${Math.round(probe.fps * 100) / 100} fps` : '';
    return `motor <b>WebCodecs</b>${codec}${fps} · frame a frame`;
  }
  if (probe.reason === 'sin-webcodecs') return 'motor <b>compatibilidad</b> · este navegador no tiene WebCodecs';
  if (probe.reason === 'codec') return `motor <b>compatibilidad</b> · ${probe.codec || 'el codec'} no entra por WebCodecs`;
  if (probe.reason === 'sin-video') return 'motor <b>compatibilidad</b> · no vi pista de video, pruebo seek';
  return 'motor <b>compatibilidad</b> · seek';
}

export function progressLabel(p) {
  if (!p) return '';
  if (p.message) return p.message;
  const i = p.index || 0;
  const n = p.total || 0;
  const pair = n ? `<b>${i}/${n}</b>` : '';
  switch (p.phase) {
    case 'open': return 'abriendo el video…';
    case 'palette': return `armando la paleta global… ${pair}`;
    case 'decode': return `decodificando ${pair}`;
    case 'seek': return `extrayendo ${pair}`;
    case 'encode': return `codificando ${pair}`;
    case 'scene': return `mirando cortes ${pair}`;
    case 'loop': return 'armando el loop…';
    default: return 'procesando…';
  }
}

function canvasToBlob(canvas, type, quality) {
  if (typeof canvas.convertToBlob === 'function') return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No pude exportar ' + type))), type, quality);
  });
}

let webpSupport;
export function canEncodeWebp() {
  if (!webpSupport) {
    webpSupport = (async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 2;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 2, 2);
        const blob = await canvasToBlob(canvas, 'image/webp', 0.8);
        return !!(blob && blob.size > 24 && (!blob.type || blob.type === 'image/webp'));
      } catch {
        return false;
      }
    })();
  }
  return webpSupport;
}

export function mediaRecorderWebmMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((type) => MediaRecorder.isTypeSupported(type)) || null;
}

export async function detectOutputs(width, height) {
  const out = {
    gif: true,
    webp: false,
    mp4: false,
    webm: false,
    webmVia: null,
    mp4Codec: null,
    webmCodec: null,
  };
  out.webp = await canEncodeWebp();
  if (webCodecsAvailable()) {
    try {
      const { videoCodecs } = await import('./encode-sequence.js');
      const codecs = await videoCodecs(width, height);
      out.mp4Codec = codecs.mp4;
      out.webmCodec = codecs.webm;
      out.mp4 = !!codecs.mp4;
      if (codecs.webm) {
        out.webm = true;
        out.webmVia = 'webcodecs';
      }
    } catch { /* sin mediabunny: MP4/WebM por VideoEncoder quedan apagados */ }
  }
  if (!out.webm && mediaRecorderWebmMime()) {
    out.webm = true;
    out.webmVia = 'mediarecorder';
  }
  return out;
}

function usableDuration(video, probe) {
  const d = video && video.duration;
  if (Number.isFinite(d) && d > 0 && d !== Infinity) return d;
  if (probe && Number.isFinite(probe.duration) && probe.duration > 0) return probe.duration;
  return 0;
}

function viewCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

export function seekTo(video, t) {
  return new Promise((resolve) => {
    const dur = Number.isFinite(video.duration) ? video.duration : t;
    const target = Math.min(Math.max(0, t), Math.max(0, dur - 0.001));
    if (Math.abs((video.currentTime || 0) - target) < 0.0005 && video.readyState >= 2) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener('seeked', finish);
      resolve();
    };
    video.addEventListener('seeked', finish);
    try { video.currentTime = target; } catch { finish(); }
    setTimeout(finish, 4000);
  });
}

function workerFormatOk(format, outputs) {
  if (format === 'gif') return true;
  if (format === 'webp') return !!outputs?.webp;
  if (format === 'mp4') return !!outputs?.mp4;
  if (format === 'webm') return outputs?.webmVia === 'webcodecs';
  return false;
}

function blobResult(bytes, mime, ext, frames, codec, width, height, engine) {
  const copy = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return {
    blob: new Blob([copy], { type: mime }),
    mime,
    ext,
    frames,
    codec: codec || null,
    width,
    height,
    engine,
  };
}

export async function renderClip(opts) {
  const probe = opts.probe && opts.probe.ok !== undefined ? opts.probe : await probeVideo(opts.file);
  const outputs = opts.outputs || await detectOutputs(opts.width, opts.height);
  const duration = usableDuration(opts.video, probe);
  if (!duration) throw new Error('El video todavía no tiene duración. Esperá un segundo y probá de nuevo.');
  const first = Number.isFinite(probe.firstTimestamp) ? probe.firstTimestamp : 0;
  const timestamps = clipTimestamps(opts.start || 0, opts.dur, opts.fps, duration, first);
  const job = { ...opts, probe, outputs, timestamps };

  if (probe.ok && workerAvailable() && workerFormatOk(job.format, outputs)) {
    try {
      const done = await callWorker('clip', {
        file: job.file,
        format: job.format,
        width: job.width,
        height: job.height,
        fps: job.fps,
        timestamps,
        dither: !!job.dither,
        loop: job.loop || 'none',
        fade: job.fade || 0,
      }, { onProgress: job.onProgress });
      return blobResult(new Uint8Array(done.buffer), done.mime, done.ext, done.frames, done.codec, job.width, job.height, 'webcodecs');
    } catch (err) {
      job.onProgress?.({
        phase: 'note',
        ratio: 0,
        message: `WebCodecs no pudo (${err.message}). Sigo por compatibilidad…`,
      });
    }
  }
  const seeked = await renderClipSeek(job);
  return { ...seeked, engine: 'seek' };
}

async function renderClipSeek(job) {
  const looped = job.loop && job.loop !== 'none';
  if (looped) {
    const frames = await extractSeekRgba(job);
    const seq = applyLoop(frames, job.loop, job.fade || 0, job.fps);
    job.onProgress?.({ phase: 'loop', ratio: 0.58, message: 'armando el loop…' });
    return encodeBuffered(seq, job);
  }
  if (job.format === 'gif') return seekGif(job);
  if (job.format === 'webp') return seekWebp(job);
  if (job.format === 'mp4' || (job.format === 'webm' && job.outputs?.webmVia === 'webcodecs')) {
    return seekVideo(job);
  }
  if (job.format === 'webm') {
    const frames = await extractSeekRgba(job);
    return mediaRecorderWebm(frames, job);
  }
  throw new Error('Ese formato no está disponible en este navegador.');
}

async function extractSeekRgba(job) {
  const { ctx } = viewCanvas(job.width, job.height);
  const frames = [];
  const n = job.timestamps.length;
  for (let i = 0; i < n; i++) {
    await seekTo(job.video, job.timestamps[i]);
    ctx.drawImage(job.video, 0, 0, job.width, job.height);
    frames.push(ctx.getImageData(0, 0, job.width, job.height).data);
    job.onProgress?.({ phase: 'seek', index: i + 1, total: n, ratio: ((i + 1) / n) * 0.55 });
    if (i % 2 === 0) await nextTick();
  }
  return frames;
}

async function seekGif(job) {
  const gif = await import('./gif-encode.js');
  const { ctx } = viewCanvas(job.width, job.height);
  const n = job.timestamps.length;
  const nSamp = Math.min(8, n);
  const picks = [];
  for (let s = 0; s < nSamp; s++) {
    const i = Math.min(n - 1, Math.floor((s + 0.5) * n / nSamp));
    await seekTo(job.video, job.timestamps[i]);
    ctx.drawImage(job.video, 0, 0, job.width, job.height);
    picks.push(ctx.getImageData(0, 0, job.width, job.height).data);
    job.onProgress?.({ phase: 'palette', index: s + 1, total: nSamp, ratio: ((s + 1) / nSamp) * 0.18 });
  }
  const enc = gif.createGifEncoder({
    width: job.width,
    height: job.height,
    delay: frameDelayMs(job.fps),
    palette: gif.buildPalette(picks),
    dither: !!job.dither,
  });
  for (let i = 0; i < n; i++) {
    await seekTo(job.video, job.timestamps[i]);
    ctx.drawImage(job.video, 0, 0, job.width, job.height);
    enc.add(ctx.getImageData(0, 0, job.width, job.height).data);
    job.onProgress?.({ phase: 'encode', index: i + 1, total: n, ratio: 0.18 + ((i + 1) / n) * 0.82 });
    if (i % 2 === 0) await nextTick();
  }
  return blobResult(enc.finish(), 'image/gif', 'gif', n, 'gif', job.width, job.height, 'seek');
}

async function seekWebp(job) {
  if (!(await canEncodeWebp())) throw new Error('Este navegador no exporta WebP.');
  const { canvas, ctx } = viewCanvas(job.width, job.height);
  const stills = [];
  const n = job.timestamps.length;
  for (let i = 0; i < n; i++) {
    await seekTo(job.video, job.timestamps[i]);
    ctx.drawImage(job.video, 0, 0, job.width, job.height);
    const blob = await canvasToBlob(canvas, 'image/webp', 0.82);
    stills.push(new Uint8Array(await blob.arrayBuffer()));
    job.onProgress?.({ phase: 'encode', index: i + 1, total: n, ratio: (i + 1) / n });
    await nextTick();
  }
  const bytes = muxAnimatedWebp(stills, frameDelayMs(job.fps), job.width, job.height);
  return blobResult(bytes, 'image/webp', 'webp', n, 'webp', job.width, job.height, 'seek');
}

async function seekVideo(job) {
  const { encodeSequence } = await import('./encode-sequence.js');
  const n = job.timestamps.length;
  const result = await encodeSequence({
    width: job.width,
    height: job.height,
    fps: job.fps,
    format: job.format,
    count: n,
    renderFrame: async (ctx, i) => {
      await seekTo(job.video, job.timestamps[i]);
      ctx.drawImage(job.video, 0, 0, job.width, job.height);
    },
    onProgress: (p) => job.onProgress?.({ ...p, ratio: p.index / p.total }),
  });
  return blobResult(result.bytes, result.mime, result.ext, result.frames, result.codec, job.width, job.height, 'seek');
}

async function encodeBuffered(frames, job) {
  if (job.format === 'gif') {
    const gif = await import('./gif-encode.js');
    const bytes = gif.encodeGifRgba(frames, job.width, job.height, frameDelayMs(job.fps), { dither: !!job.dither });
    return blobResult(bytes, 'image/gif', 'gif', frames.length, 'gif', job.width, job.height, 'seek');
  }
  if (job.format === 'webp') {
    const { encodeSequence } = await import('./encode-sequence.js');
    const result = await encodeSequence({
      width: job.width,
      height: job.height,
      fps: job.fps,
      format: 'webp',
      frames,
      onProgress: (p) => job.onProgress?.({ ...p, ratio: 0.58 + (p.index / p.total) * 0.42 }),
    });
    return blobResult(result.bytes, result.mime, result.ext, result.frames, 'webp', job.width, job.height, 'seek');
  }
  if (job.format === 'mp4' || (job.format === 'webm' && job.outputs?.webmVia === 'webcodecs')) {
    const { encodeSequence } = await import('./encode-sequence.js');
    const result = await encodeSequence({
      width: job.width,
      height: job.height,
      fps: job.fps,
      format: job.format,
      frames,
      onProgress: (p) => job.onProgress?.({ ...p, ratio: 0.58 + (p.index / p.total) * 0.42 }),
    });
    return blobResult(result.bytes, result.mime, result.ext, result.frames, result.codec, job.width, job.height, 'seek');
  }
  if (job.format === 'webm') return mediaRecorderWebm(frames, job);
  throw new Error('Ese formato no está disponible en este navegador.');
}

function mediaRecorderWebm(frames, job) {
  const mime = mediaRecorderWebmMime();
  const { width, height, fps } = job;
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!mime || typeof canvas.captureStream !== 'function') {
      reject(new Error('Tu navegador no puede grabar WebM. Probá GIF o WebP.'));
      return;
    }
    const stream = canvas.captureStream(0);
    const track = stream.getVideoTracks()[0];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onerror = () => reject(new Error('Falló la grabación WebM.'));
    rec.onstop = async () => {
      try {
        const raw = new Blob(chunks, { type: 'video/webm' });
        const fixed = await fixWebmDuration(raw, frames.length / fps * 1000);
        resolve(blobResult(new Uint8Array(await fixed.arrayBuffer()), 'video/webm', 'webm', frames.length, 'mediarecorder', width, height, 'seek'));
      } catch (err) {
        reject(err);
      }
    };
    rec.start();
    let i = 0;
    const step = () => {
      if (i >= frames.length) {
        if (track.requestFrame) track.requestFrame();
        setTimeout(() => rec.stop(), 120);
        return;
      }
      ctx.putImageData(new ImageData(new Uint8ClampedArray(frames[i]), width, height), 0, 0);
      if (track.requestFrame) track.requestFrame();
      job.onProgress?.({
        phase: 'encode',
        index: i + 1,
        total: frames.length,
        ratio: 0.55 + ((i + 1) / frames.length) * 0.45,
        message: `grabando WebM <b>${i + 1}/${frames.length}</b> · tiempo real`,
      });
      i += 1;
      setTimeout(step, 1000 / fps);
    };
    step();
  });
}

export async function renderFrames(opts) {
  const probe = opts.probe && opts.probe.ok !== undefined ? opts.probe : await probeVideo(opts.file);
  const duration = usableDuration(opts.video, probe);
  if (!duration) throw new Error('El video todavía no tiene duración. Esperá un segundo y probá de nuevo.');
  const first = Number.isFinite(probe.firstTimestamp) ? probe.firstTimestamp : 0;
  const nativeFps = probe.fps || 8;
  const sampleFps = duration <= 20 ? Math.min(nativeFps, 12) : Math.min(nativeFps, 8);
  const scene = opts.mode === 'scene';
  const timestamps = scene
    ? sceneTimestamps(duration, sampleFps, first)
    : spreadTimestamps(opts.count, duration, first);
  const job = {
    ...opts,
    probe,
    timestamps,
    threshold: thresholdFor(opts.sens),
    maxKeep: scene ? (opts.maxKeep || 24) : timestamps.length,
    minGap: 0.18,
  };

  if (probe.ok && workerAvailable()) {
    try {
      const frames = [];
      await callWorker('frames', {
        file: opts.file,
        width: opts.width,
        height: opts.height,
        timestamps,
        scene,
        threshold: job.threshold,
        maxKeep: job.maxKeep,
        minGap: job.minGap,
      }, {
        onProgress: opts.onProgress,
        onFrame: (msg) => {
          const frame = { png: new Uint8Array(msg.png), t: msg.t, index: frames.length };
          frames.push(frame);
          opts.onFrame?.(frame);
        },
      });
      return { frames, engine: 'webcodecs', width: opts.width, height: opts.height };
    } catch (err) {
      opts.onReset?.();
      opts.onProgress?.({
        phase: 'note',
        ratio: 0,
        message: `WebCodecs no pudo (${err.message}). Sigo por compatibilidad…`,
      });
    }
  }
  return renderFramesSeek(job);
}

async function renderFramesSeek(job) {
  const scene = job.mode === 'scene';
  const { canvas, ctx } = viewCanvas(job.width, job.height);
  const tiny = document.createElement('canvas');
  tiny.width = 32;
  tiny.height = 18;
  const tctx = tiny.getContext('2d', { willReadFrequently: true });
  const frames = [];
  let prev = null;
  let lastT = -Infinity;
  const n = job.timestamps.length;
  for (let i = 0; i < n; i++) {
    const t = job.timestamps[i];
    await seekTo(job.video, t);
    ctx.drawImage(job.video, 0, 0, job.width, job.height);
    let keep = !scene;
    if (scene) {
      tctx.drawImage(canvas, 0, 0, 32, 18);
      const fp = lumaFromImageData(tctx.getImageData(0, 0, 32, 18));
      keep = shouldKeepScene(prev, fp, t, lastT, job.threshold, job.minGap) && frames.length < job.maxKeep;
      if (keep) {
        prev = fp;
        lastT = t;
      }
    }
    if (keep) {
      const blob = await canvasToBlob(canvas, 'image/png');
      const frame = { png: new Uint8Array(await blob.arrayBuffer()), t, index: frames.length };
      frames.push(frame);
      job.onFrame?.(frame);
    }
    job.onProgress?.({
      phase: scene ? 'scene' : 'seek',
      index: i + 1,
      total: n,
      ratio: (i + 1) / n,
    });
    await nextTick();
    if (scene && frames.length >= job.maxKeep) break;
  }
  return { frames, engine: 'seek', width: job.width, height: job.height };
}

export async function downloadZip(items, filename) {
  if (!items.length) throw new Error('No hay frames para el ZIP.');
  const zip = zipFrames(items);
  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }],
      });
      const writable = await handle.createWritable();
      await zip.writeTo(writable);
      await writable.close();
      return 'file';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'abort';
    }
  }
  const url = URL.createObjectURL(zip.toBlob());
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  return 'blob';
}

export function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

let worker;
let jobSeq = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./video-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    const msg = event.data;
    const job = pending.get(msg.id);
    if (!job) return;
    if (msg.type === 'progress') job.onProgress?.(msg);
    else if (msg.type === 'frame') job.onFrame?.(msg);
    else if (msg.type === 'done') {
      pending.delete(msg.id);
      job.resolve(msg);
    } else if (msg.type === 'error') {
      pending.delete(msg.id);
      job.reject(new Error(msg.message || 'Falló el worker.'));
    }
  };
  worker.onerror = (event) => {
    const err = new Error(event.message || 'No pude cargar el worker de video.');
    for (const job of pending.values()) job.reject(err);
    pending.clear();
    worker.terminate();
    worker = null;
  };
  return worker;
}

function callWorker(op, payload, hooks) {
  const id = ++jobSeq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress: hooks && hooks.onProgress, onFrame: hooks && hooks.onFrame });
    try {
      getWorker().postMessage({ id, op, ...payload });
    } catch (err) {
      pending.delete(id);
      reject(err);
    }
  });
}

// Chrome no escribe Duration en los WebM de MediaRecorder. Parche EBML
// (Segment → Info + Duration) cuando es seguro; si no, devuelve el blob tal cual.
async function fixWebmDuration(blob, durationMs) {
  try {
    const u8 = new Uint8Array(await blob.arrayBuffer());
    let pos = 0;
    const rv = (keep) => {
      if (pos >= u8.length) return null;
      const f = u8[pos];
      if (!f) return null;
      let len = 1;
      for (let m = 0x80; !(f & m); m >>= 1) len += 1;
      if (len > 8 || pos + len > u8.length) return null;
      let val = keep ? f : f & (0xFF >> len);
      let ones = !keep && val === (0xFF >> len);
      for (let i = 1; i < len; i++) {
        val = val * 256 + u8[pos + i];
        if (u8[pos + i] !== 0xFF) ones = false;
      }
      pos += len;
      return { val, len, unknown: ones && !keep };
    };
    let segC = -1;
    let segUnk = false;
    while (pos < u8.length) {
      const id = rv(true);
      if (!id) return blob;
      const sz = rv(false);
      if (!sz) return blob;
      if (id.val === 0x18538067) { segC = pos; segUnk = sz.unknown; break; }
      pos += sz.val;
    }
    if (segC < 0 || !segUnk) return blob;
    pos = segC;
    let infoId = -1;
    let infoC = -1;
    let infoSz = 0;
    while (pos < u8.length) {
      const ip = pos;
      const id = rv(true);
      if (!id) return blob;
      const sz = rv(false);
      if (!sz || sz.unknown) return blob;
      if (id.val === 0x114D9B74 || id.val === 0x1F43B675) return blob;
      if (id.val === 0x1549A966) { infoId = ip; infoC = pos; infoSz = sz.val; break; }
      pos += sz.val;
    }
    if (infoC < 0) return blob;
    pos = infoC;
    let scale = 1e6;
    while (pos < infoC + infoSz) {
      const id = rv(true);
      if (!id) return blob;
      const sz = rv(false);
      if (!sz) return blob;
      if (id.val === 0x4489) return blob;
      if (id.val === 0x2AD7B1) {
        let v = 0;
        for (let i = 0; i < sz.val; i++) v = v * 256 + u8[pos + i];
        if (v) scale = v;
      }
      pos += sz.val;
    }
    const dur = new Uint8Array(11);
    dur[0] = 0x44;
    dur[1] = 0x89;
    dur[2] = 0x88;
    new DataView(dur.buffer).setFloat64(3, durationMs * 1e6 / scale);
    const ns = infoSz + 11;
    const sv = new Uint8Array(8);
    sv[0] = 0x01;
    for (let i = 7, v = ns; i >= 1; i--) { sv[i] = v & 0xFF; v = Math.floor(v / 256); }
    return new Blob([
      u8.slice(0, infoId + 4),
      sv,
      u8.slice(infoC, infoC + infoSz),
      dur,
      u8.slice(infoC + infoSz),
    ], { type: blob.type || 'video/webm' });
  } catch {
    return blob;
  }
}
