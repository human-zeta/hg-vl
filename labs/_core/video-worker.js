// Worker: demux con mediabunny, decode con VideoDecoder (CanvasSink)
// y encode (gifenc / WebP / VideoEncoder) fuera del hilo de la UI.
import {
  ALL_FORMATS,
  BlobSource,
  CanvasSink,
  Input,
} from 'https://esm.sh/mediabunny@1.61.4';
import { createGifEncoder, buildPalette } from './gif-encode.js';
import { encodeSequence } from './encode-sequence.js';
import { applyLoop } from './loop-fx.js';
import { frameDelayMs } from './timeline.js';
import { lumaFromImageData, shouldKeepScene } from './scene.js';

function scratch(w, h) {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

function readRgba(source, dest) {
  dest.ctx.clearRect(0, 0, dest.canvas.width, dest.canvas.height);
  if (source) dest.ctx.drawImage(source, 0, 0, dest.canvas.width, dest.canvas.height);
  else {
    dest.ctx.fillStyle = '#000';
    dest.ctx.fillRect(0, 0, dest.canvas.width, dest.canvas.height);
  }
  return dest.ctx.getImageData(0, 0, dest.canvas.width, dest.canvas.height).data;
}

async function openSink(file, width, height) {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      input.dispose();
      throw new Error('No encontré una pista de video en ese archivo.');
    }
    const decodable = await track.canDecode();
    if (!decodable) {
      input.dispose();
      throw new Error('Este navegador no puede decodificar ese codec con WebCodecs.');
    }
    // poolSize 0: un canvas nuevo por frame. Así el prefetch del sink
    // no pisa el canvas que todavía estamos copiando.
    const sink = new CanvasSink(track, { width, height, fit: 'fill', poolSize: 0 });
    return { input, sink };
  } catch (err) {
    try { input.dispose(); } catch { /* ya cerrado */ }
    throw err;
  }
}

function postProgress(id, progress) {
  self.postMessage({ id, type: 'progress', ...progress });
}

async function clipJob(msg) {
  const { id, file, format, width, height, fps, timestamps, dither, loop, fade } = msg;
  const { input, sink } = await openSink(file, width, height);
  const dest = scratch(width, height);
  try {
    postProgress(id, { phase: 'open', index: 0, total: 1, ratio: 0.02 });
    const looped = loop && loop !== 'none';
    if (looped) {
      return await encodeLooped({ id, sink, dest, timestamps, width, height, fps, format, dither, loop, fade });
    }
    if (format === 'gif') {
      return await encodeGifStream({ id, sink, dest, timestamps, width, height, fps, dither });
    }
    return await encodeDirect({ id, sink, dest, timestamps, width, height, fps, format });
  } finally {
    input.dispose();
  }
}

async function takeRgba(iter, dest) {
  const step = await iter.next();
  if (step.done || !step.value) return null;
  // Copia sincrónica: el pool del sink puede reciclar el canvas en el próximo next().
  return readRgba(step.value.canvas, dest);
}

async function encodeGifStream({ id, sink, dest, timestamps, width, height, fps, dither }) {
  const nSamp = Math.min(8, timestamps.length);
  const sampleTs = [];
  for (let s = 0; s < nSamp; s++) {
    const i = Math.min(timestamps.length - 1, Math.floor((s + 0.5) * timestamps.length / nSamp));
    sampleTs.push(timestamps[i]);
  }
  const picks = [];
  let s = 0;
  for await (const frame of sink.canvasesAtTimestamps(sampleTs)) {
    picks.push(readRgba(frame && frame.canvas, dest));
    s += 1;
    postProgress(id, { phase: 'palette', index: s, total: nSamp, ratio: (s / nSamp) * 0.18 });
  }
  const palette = buildPalette(picks);
  const enc = createGifEncoder({ width, height, delay: frameDelayMs(fps), palette, dither });
  const iter = sink.canvasesAtTimestamps(timestamps)[Symbol.asyncIterator]();
  let last = null;
  for (let i = 0; i < timestamps.length; i++) {
    const rgba = await takeRgba(iter, dest);
    const use = rgba || last || readRgba(null, dest);
    last = use;
    enc.add(use);
    postProgress(id, {
      phase: 'encode',
      index: i + 1,
      total: timestamps.length,
      ratio: 0.18 + ((i + 1) / timestamps.length) * 0.82,
    });
  }
  const bytes = enc.finish();
  return { bytes, mime: 'image/gif', ext: 'gif', frames: timestamps.length, codec: 'gif' };
}

async function encodeDirect({ id, sink, dest, timestamps, width, height, fps, format }) {
  const iter = sink.canvasesAtTimestamps(timestamps)[Symbol.asyncIterator]();
  let last = null;
  const result = await encodeSequence({
    width,
    height,
    fps,
    format,
    count: timestamps.length,
    renderFrame: async (ctx) => {
      const rgba = await takeRgba(iter, dest);
      const use = rgba || last;
      if (use) {
        last = use;
        ctx.putImageData(new ImageData(new Uint8ClampedArray(use), width, height), 0, 0);
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
      }
    },
    onProgress: (p) => postProgress(id, p),
  });
  return result;
}

async function encodeLooped({ id, sink, dest, timestamps, width, height, fps, format, dither, loop, fade }) {
  const frames = [];
  let i = 0;
  for await (const frame of sink.canvasesAtTimestamps(timestamps)) {
    frames.push(readRgba(frame && frame.canvas, dest));
    i += 1;
    postProgress(id, { phase: 'decode', index: i, total: timestamps.length, ratio: (i / timestamps.length) * 0.55 });
  }
  postProgress(id, { phase: 'loop', index: 1, total: 1, ratio: 0.57 });
  const seq = applyLoop(frames, loop, fade, fps);
  const result = await encodeSequence({
    width,
    height,
    fps,
    format,
    frames: seq,
    dither,
    onProgress: (p) => postProgress(id, {
      ...p,
      ratio: 0.58 + (p.index / p.total) * 0.42,
    }),
  });
  return result;
}

async function toPng(dest) {
  const blob = await dest.canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

async function framesJob(msg) {
  const { id, file, width, height, timestamps, scene, threshold, maxKeep, minGap } = msg;
  const { input, sink } = await openSink(file, width, height);
  const dest = scratch(width, height);
  const tiny = new OffscreenCanvas(32, 18);
  const tinyCtx = tiny.getContext('2d', { willReadFrequently: true });
  let kept = 0;
  let prev = null;
  let lastT = -Infinity;
  try {
    postProgress(id, { phase: 'open', index: 0, total: timestamps.length, ratio: 0.01 });
    let i = 0;
    for await (const frame of sink.canvasesAtTimestamps(timestamps)) {
      const t = timestamps[i] ?? 0;
      i += 1;
      if (frame && frame.canvas) {
        dest.ctx.drawImage(frame.canvas, 0, 0, width, height);
      } else {
        dest.ctx.fillStyle = '#000';
        dest.ctx.fillRect(0, 0, width, height);
      }
      let keep = !scene;
      if (scene) {
        tinyCtx.drawImage(dest.canvas, 0, 0, 32, 18);
        const fp = lumaFromImageData(tinyCtx.getImageData(0, 0, 32, 18));
        keep = shouldKeepScene(prev, fp, t, lastT, threshold, minGap) && kept < maxKeep;
        if (keep) {
          prev = fp;
          lastT = t;
        }
      }
      if (keep) {
        const png = await toPng(dest);
        kept += 1;
        self.postMessage({
          id,
          type: 'frame',
          index: kept - 1,
          t,
          png: png.buffer,
        }, [png.buffer]);
      }
      const ratio = i / timestamps.length;
      postProgress(id, {
        phase: scene ? 'scene' : 'decode',
        index: i,
        total: timestamps.length,
        ratio: scene ? ratio * 0.98 : ratio,
      });
      if (scene && kept >= maxKeep) break;
    }
    return { frames: kept, mime: 'image/png', ext: 'png' };
  } finally {
    input.dispose();
  }
}

self.onmessage = async (event) => {
  const msg = event.data;
  try {
    if (msg.op === 'clip') {
      const result = await clipJob(msg);
      const bytes = result.bytes instanceof Uint8Array ? result.bytes : new Uint8Array(result.bytes);
      const copy = new Uint8Array(bytes);
      self.postMessage({
        id: msg.id,
        type: 'done',
        buffer: copy.buffer,
        mime: result.mime,
        ext: result.ext,
        frames: result.frames,
        codec: result.codec || null,
      }, [copy.buffer]);
      return;
    }
    if (msg.op === 'frames') {
      const result = await framesJob(msg);
      self.postMessage({ id: msg.id, type: 'done', frames: result.frames, mime: result.mime });
      return;
    }
    throw new Error('Operación desconocida.');
  } catch (err) {
    self.postMessage({
      id: msg.id,
      type: 'error',
      message: (err && err.message) ? err.message : String(err),
    });
  }
};
