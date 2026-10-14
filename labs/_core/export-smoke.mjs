// Prueba de navegador: export offline de alpha WebM, ZIP PNG y MP4 con audio.
// Uso: node labs/_core/export-smoke.mjs
// Chrome headless + un server estático de este repo. No es una página del sitio.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../..', import.meta.url));
const saveDir = join(tmpdir(), 'hg-export-' + process.pid);
mkdirSync(saveDir, { recursive: true });
const port = 8765 + (process.pid % 1000);
const debugPort = 9400 + (process.pid % 200);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wav': 'audio/wav',
};

function staticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.method === 'PUT' && req.url.startsWith('/__save/')) {
        const name = decodeURIComponent(req.url.slice('/__save/'.length)).replace(/[^a-zA-Z0-9._-]/g, '');
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          writeFileSync(join(saveDir, name), Buffer.concat(chunks));
          res.writeHead(204); res.end();
        });
        return;
      }
      const file = fileFor(req.url || '/');
      if (!file) { res.writeHead(404); res.end('no'); return; }
      try {
        const data = readFileSync(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(data);
      } catch {
        res.writeHead(404); res.end('no');
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function fileFor(urlPath) {
  const raw = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  const parts = [];
  for (const part of raw.split(/[/\\]/)) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  let file = join(root, ...parts);
  const rootPrefix = root.endsWith('/') ? root : root + '/';
  if (file !== root && !file.startsWith(rootPrefix)) return null;
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!statSync(file).isFile()) return null;
  } catch {
    return null;
  }
  return file;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitFor(fn, ms, label) {
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < ms) {
    try {
      const v = await fn();
      if (v && typeof v === 'object' && v.pending != null) last = String(v.pending);
      else if (v) return v;
      else if (v != null && v !== false) last = String(v);
    } catch (err) { last = err.message; }
    await sleep(200);
  }
  throw new Error('timeout ' + label + ' [' + last + ']');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.n = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails || {};
        const text = (d.exception && (d.exception.description || d.exception.value)) || d.text || '';
        console.log('EXC', String(text).split('\n')[0], d.url || '', d.lineNumber || '');
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.n;
    const p = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return p;
  }
  eval(expression, awaitPromise = false) {
    return this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  }
}

async function launchChrome(extra = [], port = debugPort) {
  const dir = join(tmpdir(), 'chrome-hg-' + process.pid + '-' + port);
  rmSync(dir, { recursive: true, force: true });
  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + dir,
    '--no-first-run',
    '--window-size=1280,900',
    ...extra,
    'about:blank',
  ], { stdio: 'ignore' });
  await waitFor(async () => {
    const r = await fetch('http://127.0.0.1:' + port + '/json/version');
    return r.ok;
  }, 15000, 'devtools');
  return chrome;
}

async function attach(port = debugPort) {
  const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  const cdp = new Cdp(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  return { cdp, ws };
}

async function open(cdp, path) {
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + port + path });
  await waitFor(async () => {
    const r = await cdp.eval('document.readyState');
    return r.result.value === 'complete';
  }, 20000, 'load ' + path);
}

const smokeHtml = `<!doctype html><meta charset="utf-8"><title>smoke</title><pre id="out"></pre>
<script type="module">
import { detectDrawnExport, renderDrawnClip } from '/labs/_core/video.js';
import { webmHasAlphaMode } from '/labs/_core/webm-mark.js';
const out = document.getElementById('out');
const log = (s) => { out.textContent += s + '\\n'; };
async function save(name, blob) {
  const res = await fetch('/__save/' + name, { method: 'PUT', body: blob });
  if (!res.ok) throw new Error('no pude guardar ' + name);
}
try {
  const alphaCaps = await detectDrawnExport({ width: 96, height: 64, fps: 30, alpha: true, quality: 'medium' });
  log('alpha ' + alphaCaps.engine + ' ' + (alphaCaps.videoCodec || '') + ' ' + (alphaCaps.container || ''));
  if (alphaCaps.engine !== 'webcodecs') throw new Error('alpha engine ' + alphaCaps.engine);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const webm = await renderDrawnClip({
    width: 96, height: 64, fps: 30, count: 6, canvas, container: 'webm', alpha: true, quality: 'medium', pace: false,
    renderFrame() {
      ctx.clearRect(0, 0, 96, 64);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(24, 16, 48, 32);
    },
  });
  const bytes = new Uint8Array(await webm.blob.arrayBuffer());
  if (!webmHasAlphaMode(bytes)) throw new Error('el webm no trae AlphaMode');
  await save('alpha.webm', webm.blob);
  log('webm ' + bytes.length + ' ' + webm.codec);

  const { ALL_FORMATS, BufferSource, CanvasSink, Input } = await import('https://esm.sh/mediabunny@1.61.4');
  const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(bytes) });
  const track = await input.getPrimaryVideoTrack();
  const transparent = await track.canBeTransparent();
  log('transparent ' + transparent);
  if (!transparent) throw new Error('el track no declara alpha');
  const sink = new CanvasSink(track, { width: 96, height: 64, fit: 'fill', poolSize: 0 });
  let frame = null;
  for await (const item of sink.canvasesAtTimestamps([0])) frame = item;
  input.dispose();
  if (!frame || !frame.canvas) throw new Error('no decodifiqué el frame');
  const view = document.createElement('canvas');
  view.width = 96; view.height = 64;
  const vx = view.getContext('2d');
  vx.fillStyle = '#00ff00';
  vx.fillRect(0, 0, 96, 64);
  vx.drawImage(frame.canvas, 0, 0);
  const corner = vx.getImageData(2, 2, 1, 1).data;
  const center = vx.getImageData(48, 32, 1, 1).data;
  log('preview-canvas corner ' + [...corner].join(',') + ' center ' + [...center].join(','));

  const zip = await renderDrawnClip({
    width: 32, height: 24, fps: 10, count: 3, container: 'zip', quality: 'medium', pace: false,
    renderFrame(c, i) {
      c.clearRect(0, 0, 32, 24);
      c.fillStyle = 'rgba(0,128,255,' + (i === 1 ? 0 : 1) + ')';
      c.fillRect(4, 4, 10, 10);
    },
  });
  await save('frames.zip', zip.blob);
  log('zip ' + zip.blob.size);

  const audioCaps = await detectDrawnExport({
    width: 64, height: 64, fps: 25, audio: true, sampleRate: 48000, channels: 1, quality: 'medium',
  });
  log('mp4 ' + audioCaps.engine + ' ' + (audioCaps.videoCodec || '') + ' ' + (audioCaps.audioCodec || ''));
  if (audioCaps.engine !== 'webcodecs') throw new Error('audio engine ' + audioCaps.engine);
  const actx = new AudioContext({ sampleRate: 48000 });
  const tone = actx.createBuffer(1, 9600, 48000);
  const ch = tone.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.sin(2 * Math.PI * 440 * i / 48000) * 0.45;
  const box = document.createElement('canvas');
  const mp4 = await renderDrawnClip({
    width: 64, height: 64, fps: 25, count: 5, canvas: box, container: 'mp4',
    audio: tone, audioCodec: audioCaps.audioCodec, audioSampleRate: audioCaps.audioSampleRate,
    resample: !!audioCaps.resample, quality: 'medium', pace: false,
    renderFrame(c, i) {
      c.fillStyle = i % 2 ? '#123' : '#b8ff00';
      c.fillRect(0, 0, 64, 64);
    },
  });
  await save('tone.mp4', mp4.blob);
  log('tone ' + mp4.blob.size + ' ' + mp4.codec + ' ' + (mp4.audioCodec || audioCaps.audioCodec));
  log('OK');
  document.title = 'OK';
} catch (err) {
  log('FAIL ' + (err && err.stack ? err.stack : err));
  document.title = 'FAIL';
}
</script>`;

function ffprobe(file) {
  const raw = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,pix_fmt',
    '-of', 'json', file,
  ], { encoding: 'utf8' });
  return JSON.parse(raw);
}

function writeWav(file) {
  const sr = 48000;
  const n = sr;
  const header = Buffer.alloc(44);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const s = Math.sin((2 * Math.PI * 440 * i) / sr) * 0.4;
    data.writeInt16LE(Math.max(-32767, Math.min(32767, (s * 32767) | 0)), i * 2);
  }
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sr, 24);
  header.writeUInt32LE(sr * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([header, data]));
}

function assertAlphaWebm(file, w, h, atSec) {
  const probe = ffprobe(file);
  const v = probe.streams.find((s) => s.codec_type === 'video');
  if (!v || v.codec_name !== 'vp9') throw new Error(file + ' no es vp9');
  if (v.width !== w || v.height !== h) throw new Error(file + ' mide ' + v.width + 'x' + v.height);
  const png = file + '.alpha.png';
  const rawFile = file + '.alpha.raw';
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', file, '-ss', String(atSec), '-update', '1', '-vf', 'alphaextract', '-frames:v', '1', png]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'gray', '-frames:v', '1', rawFile]);
  const raw = readFileSync(rawFile);
  let opaque = 0;
  let clear = 0;
  for (const b of raw) {
    if (b > 200) opaque += 1;
    else if (b < 20) clear += 1;
  }
  console.log(file, 'alpha opaque', opaque, 'clear', clear, 'of', raw.length);
  if (opaque < 500) throw new Error(file + ' no tiene pixeles opacos');
  if (clear < 500) throw new Error(file + ' no tiene transparencia');
}

async function toolExport(cdp, opts) {
  await open(cdp, opts.path);
  await cdp.eval(`(() => {
    if (window.__hgHook) return;
    window.__hgHook = true;
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      if (this.download && this.href) (window.__dls = window.__dls || []).push({ name: this.download, href: this.href });
      return orig.apply(this, arguments);
    };
  })()`);
  await waitFor(async () => {
    const r = await cdp.eval(opts.status);
    const t = (r.result && r.result.value) || '';
    return opts.ready(t) ? t : { pending: t || '(vacío)' };
  }, 40000, opts.label + ' motor');
  if (opts.prepare) await opts.prepare();
  let saw = false;
  await cdp.eval(opts.go);
  const t0 = Date.now();
  let finalText = '';
  while (Date.now() - t0 < 300000) {
    const r = await cdp.eval(opts.status);
    const t = r.result.value || '';
    if (t.includes('codificando')) saw = true;
    if (t.includes('listo') || t.includes('falló') || t.includes('no pude')) { finalText = t; break; }
    await sleep(80);
  }
  console.log(opts.label, finalText, 'progress', saw);
  if (!finalText.includes('listo')) throw new Error(opts.label + ' no exportó: ' + finalText);
  if (!saw) throw new Error(opts.label + ' no mostró progreso');
  const saved = await cdp.eval(`(async () => {
    const d = (window.__dls || []).slice(-1)[0];
    if (!d) return '';
    const blob = await (await fetch(d.href)).blob();
    const res = await fetch('/__save/' + encodeURIComponent(d.name), { method: 'PUT', body: blob });
    return d.name + ' ' + blob.size + ' ' + res.status;
  })()`, true);
  const line = saved.result.value || '';
  console.log(opts.label, 'file', line);
  const name = line.split(' ')[0];
  if (!name) throw new Error(opts.label + ' no descargó');
  return join(saveDir, decodeURIComponent(name));
}

async function main() {
  writeFileSync(join(root, 'labs/_core/export-smoke.html'), smokeHtml);
  const server = await staticServer();
  const chrome = await launchChrome();
  const { cdp, ws } = await attach();
  try {
    await open(cdp, '/labs/_core/export-smoke.html');
    await waitFor(async () => {
      const r = await cdp.eval('document.title');
      const title = r.result.value;
      return title === 'OK' || title === 'FAIL';
    }, 90000, 'smoke');
    const text = (await cdp.eval('document.getElementById("out").textContent')).result.value;
    console.log(text);
    if (!text.includes('\nOK') && text.trim() !== 'OK' && !text.endsWith('OK')) {
      throw new Error('la prueba de motor no cerró en OK');
    }
    const alpha = ffprobe(join(saveDir, 'alpha.webm'));
    const v = alpha.streams.find((s) => s.codec_type === 'video');
    if (!v || v.codec_name !== 'vp9') throw new Error('alpha.webm no es vp9: ' + JSON.stringify(v));
    const alphaPng = join(saveDir, 'alpha-extract.png');
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', join(saveDir, 'alpha.webm'), '-update', '1', '-vf', 'alphaextract', '-frames:v', '1', alphaPng]);
    const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', alphaPng, '-f', 'rawvideo', '-pix_fmt', 'gray', '-frames:v', '1', 'pipe:1']);
    const at = (x, y) => raw[y * 96 + x];
    console.log('alpha plane corner', at(2, 2), 'center', at(48, 32));
    if (at(2, 2) > 16) throw new Error('la esquina del WebM no es transparente');
    if (at(48, 32) < 200) throw new Error('el centro del WebM no es opaco');

    const mp4 = ffprobe(join(saveDir, 'tone.mp4'));
    const video = mp4.streams.find((s) => s.codec_type === 'video');
    const audio = mp4.streams.find((s) => s.codec_type === 'audio');
    if (!video || video.codec_name !== 'h264') throw new Error('el mp4 no es h264: ' + JSON.stringify(video));
    if (!audio) throw new Error('el mp4 no tiene audio');
    console.log('mp4', video.codec_name, audio.codec_name, video.width + 'x' + video.height);

    const listing = execFileSync('python3', ['-c', `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
names = z.namelist()
print('\\n'.join(names))
png = z.read(next(n for n in names if n.endswith('.png')))
ctype = png[25]
assert png[:8] == bytes([137,80,78,71,13,10,26,10])
assert ctype == 6, ctype
assert 'leeme.txt' in names
assert 'tiempos.txt' in names
`, join(saveDir, 'frames.zip')], { encoding: 'utf8' });
    console.log(listing);
    console.log('CORE OK');

    const kineticFile = await toolExport(cdp, {
      path: '/kinetic/',
      label: 'kinetic',
      status: "document.getElementById('recinfo').textContent",
      ready: (t) => t.includes('WebCodecs'),
      go: "document.getElementById('rec').click()",
    });
    assertAlphaWebm(kineticFile, 1920, 1080, 1.1);

    const stingerFile = await toolExport(cdp, {
      path: '/stingers/',
      label: 'stingers',
      status: "document.getElementById('recinfo').textContent",
      ready: (t) => t.includes('WebCodecs'),
      go: "document.getElementById('rec').click()",
    });
    assertAlphaWebm(stingerFile, 1920, 1080, 0.2);

    const wav = join(saveDir, 'tone.wav');
    writeWav(wav);
    const audioFile = await toolExport(cdp, {
      path: '/audiograma/',
      label: 'audiograma',
      status: "document.getElementById('recNote').textContent",
      ready: (t) => t.includes('WebCodecs'),
      prepare: async () => {
        const doc = await cdp.send('DOM.getDocument');
        const found = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#fileA' });
        await cdp.send('DOM.setFileInputFiles', { nodeId: found.nodeId, files: [wav] });
        await waitFor(async () => {
          const r = await cdp.eval("document.getElementById('play').disabled ? '' : 'ready'");
          return r.result.value === 'ready';
        }, 20000, 'audio listo');
        await cdp.eval("document.querySelector('#durs').lastElementChild.click()");
      },
      go: "document.getElementById('rec').click()",
    });
    const probed = ffprobe(audioFile);
    const av = probed.streams.find((s) => s.codec_type === 'video');
    const aa = probed.streams.find((s) => s.codec_type === 'audio');
    if (!av || av.codec_name !== 'h264') throw new Error('audiograma no es h264');
    if (!aa) throw new Error('audiograma no tiene audio');
    if (!(av.height > av.width)) throw new Error('audiograma no salió vertical: ' + av.width + 'x' + av.height);
    console.log('AUDIOGRAMA', av.width + 'x' + av.height, av.codec_name, aa.codec_name);
    if (aa.codec_name !== 'aac' && aa.codec_name !== 'opus') {
      throw new Error('el audio del mp4 no es AAC ni Opus: ' + aa.codec_name);
    }

    console.log('PAGES OK');
    try { ws.close(); } catch { /* */ }
    chrome.kill('SIGKILL');
    await assertNoWebCodecs();
  } finally {
    try { ws.close(); } catch { /* */ }
    chrome.kill('SIGKILL');
    server.close();
    rmSync(join(root, 'labs/_core/export-smoke.html'), { force: true });
  }
}

async function pageText(cdp, expr, ms, label) {
  return waitFor(async () => {
    const r = await cdp.eval(expr);
    const t = (r.result && r.result.value) || '';
    return t ? t : { pending: '(vacío)' };
  }, ms, label);
}

async function assertNoWebCodecs() {
  // Este Chrome no apaga VideoEncoder con --disable-features=WebCodecs.
  // El sitio decide por `typeof VideoEncoder`, así que la prueba lo oculta
  // antes de que corran los scripts de la página.
  const port = debugPort + 1;
  const chrome = await launchChrome([], port);
  const { cdp, ws } = await attach(port);
  try {
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `for (const name of ['VideoEncoder','VideoDecoder','AudioEncoder','AudioDecoder','VideoFrame']) {
        try { delete globalThis[name]; } catch (e) {}
        try { Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: undefined }); } catch (e) {}
      }`,
    });
    await open(cdp, '/kinetic/');
    const kind = (await cdp.eval('typeof VideoEncoder')).result.value;
    console.log('sin WebCodecs, VideoEncoder es', kind);
    if (kind !== 'undefined') throw new Error('no pude ocultar VideoEncoder para la prueba de fallback');
    const kinetic = await pageText(cdp, "document.getElementById('recinfo').textContent", 20000, 'kinetic fallback');
    console.log('kinetic fallback', kinetic);
    if (!/tiempo real|sin WebCodecs/i.test(kinetic)) throw new Error('kinetic no volvió a tiempo real: ' + kinetic);
    await open(cdp, '/stingers/');
    const stingers = await pageText(cdp, "document.getElementById('recinfo').textContent", 20000, 'stingers fallback');
    console.log('stingers fallback', stingers);
    if (!/tiempo real|sin WebCodecs/i.test(stingers)) throw new Error('stingers no volvió a tiempo real: ' + stingers);
    await open(cdp, '/audiograma/');
    const audio = await pageText(cdp, "document.getElementById('recNote').textContent", 20000, 'audiograma fallback');
    console.log('audiograma fallback', audio);
    if (!/tiempo real/i.test(audio)) throw new Error('audiograma no volvió a tiempo real: ' + audio);
    console.log('FALLBACK OK');
  } finally {
    try { ws.close(); } catch { /* */ }
    chrome.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error(err);
  rmSync(join(root, 'labs/_core/export-smoke.html'), { force: true });
  process.exit(1);
});
