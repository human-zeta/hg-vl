import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyLoop, blendRgba } from './loop-fx.js';
import { lumaGrid, mad, shouldKeepScene, thresholdFor } from './scene.js';
import { boomerangOrder, clipTimestamps, fitSize, sceneTimestamps, spreadTimestamps } from './timeline.js';
import { extractWebpBitstream, muxAnimatedWebp } from './webp-anim.js';
import { ZipStore, crc32 } from './zip-store.js';

function fakeStill(payload) {
  const size = payload.length;
  const pad = size & 1;
  const file = 12 + 8 + size + pad;
  const u = new Uint8Array(file);
  u.set([0x52, 0x49, 0x46, 0x46], 0);
  new DataView(u.buffer).setUint32(4, file - 8, true);
  u.set([0x57, 0x45, 0x42, 0x50], 8);
  u.set([0x56, 0x50, 0x38, 0x20], 12);
  new DataView(u.buffer).setUint32(16, size, true);
  u.set(payload, 20);
  return u;
}

const size = fitSize(1920, 1080, 480);
assert.deepEqual(size, { width: 480, height: 270 });
assert.equal(fitSize(100, 100, 161).width % 2, 0);
assert.equal(fitSize(0, 0, 320).height, 320);

const ts = clipTimestamps(1, 1, 10, 5, 0);
assert.equal(ts.length, 10);
assert.equal(ts[0], 1);
assert.ok(Math.abs(ts[9] - 1.9) < 1e-9);

const spread = spreadTimestamps(4, 3, 0);
assert.equal(spread.length, 4);
assert.equal(spread[0], 0);
assert.ok(spread[3] < 3);

const sceneTs = sceneTimestamps(2, 8, 0, 2400);
assert.ok(sceneTs.length > 8 && sceneTs.length < 30);
assert.equal(sceneTs[0], 0);
const capped = sceneTimestamps(3600, 12, 0, 100);
assert.equal(capped.length, 100);
assert.ok(capped[capped.length - 1] > 3000);

assert.deepEqual(boomerangOrder(4), [0, 1, 2, 3, 2, 1]);
assert.deepEqual(boomerangOrder(2), [0, 1]);

const a = new Uint8ClampedArray([0, 0, 0, 255]);
const b = new Uint8ClampedArray([100, 0, 0, 255]);
const mid = blendRgba(a, b, 0.5);
assert.equal(mid[0], 50);
const frames = [a, b, a, b];
const boom = applyLoop(frames, 'boomerang', 0, 10);
assert.equal(boom.length, 6);
assert.equal(boom[4], a);
const cross = applyLoop(frames, 'crossfade', 0.2, 10);
assert.equal(cross.length, 4);
assert.equal(cross[0], a);
assert.notEqual(cross[3], b);

assert.ok(thresholdFor(1) > thresholdFor(10));
assert.equal(mad(new Uint8Array([0]), new Uint8Array([255])), 1);
const grid = lumaGrid(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1, 2, 2);
assert.equal(grid.length, 4);
assert.equal(shouldKeepScene(null, grid, 0, 0, 0.2, 0.2), true);
assert.equal(shouldKeepScene(grid, grid, 1, 0, 0.2, 0.2), false);

const payload = new Uint8Array([1, 2, 3, 4, 5]);
const still = fakeStill(payload);
const bits = extractWebpBitstream(still);
assert.equal(bits[0], 0x56);
assert.equal(bits.length, 8 + 5 + 1);
const anim = muxAnimatedWebp([still, still], 83, 16, 16);
assert.equal(String.fromCharCode(...anim.subarray(0, 4)), 'RIFF');
assert.equal(String.fromCharCode(...anim.subarray(8, 12)), 'WEBP');
const vp8x = anim.indexOf(0x56); // first V of VP8X after WEBP
assert.equal(anim[vp8x + 8], 0x02);
let anmf = 0;
for (let i = 0; i < anim.length - 4; i++) {
  if (anim[i] === 0x41 && anim[i + 1] === 0x4e && anim[i + 2] === 0x4d && anim[i + 3] === 0x46) anmf += 1;
}
assert.equal(anmf, 2);

const zip = new ZipStore(new Date('2026-10-14T12:00:00Z'));
const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
zip.add('frame-001.png', png);
zip.add('tiempos.txt', new TextEncoder().encode('frame-001.png\t0.000\n'));
assert.equal(crc32(png) >>> 0, crc32(png));
const dir = mkdtempSync(join(tmpdir(), 'hgzip-'));
const zipPath = join(dir, 'frames.zip');
writeFileSync(zipPath, Buffer.from(await zip.toBlob().arrayBuffer()));
const listing = execFileSync('python3', ['-c', `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
print('\\n'.join(z.namelist()))
assert z.read('frame-001.png')[:4] == bytes([137,80,78,71])
assert b'0.000' in z.read('tiempos.txt')
`, zipPath], { encoding: 'utf8' });
assert.match(listing, /frame-001\.png/);
assert.match(listing, /tiempos\.txt/);

console.log('labs/_core unit tests ok');
