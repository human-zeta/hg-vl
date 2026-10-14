// Arma un WebP animado a partir de WebP quietos (los que escupe
// canvas.convertToBlob / toBlob). El bitstream VP8 lo deja el navegador;
// acá solo se escribe el contenedor ANIM/ANMF de la spec RIFF.

function fourcc(u8, o) {
  return String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
}

function u24(n) {
  const v = Math.max(0, Math.min(0xffffff, n | 0));
  return [v & 255, (v >> 8) & 255, (v >> 16) & 255];
}

function concat(parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function chunk(id, payload) {
  const size = payload.length;
  const pad = size & 1;
  const out = new Uint8Array(8 + size + pad);
  out[0] = id.charCodeAt(0);
  out[1] = id.charCodeAt(1);
  out[2] = id.charCodeAt(2);
  out[3] = id.charCodeAt(3);
  new DataView(out.buffer).setUint32(4, size, true);
  out.set(payload, 8);
  return out;
}

// Devuelve los chunks de bitstream (VP8 / VP8L / ALPH), con header y padding,
// listos para meter adentro de un ANMF.
export function extractWebpBitstream(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 20 || fourcc(u8, 0) !== 'RIFF' || fourcc(u8, 8) !== 'WEBP') {
    throw new Error('El navegador no devolvió un WebP válido.');
  }
  const chunks = [];
  let o = 12;
  while (o + 8 <= u8.length) {
    const id = fourcc(u8, o);
    const size = new DataView(u8.buffer, u8.byteOffset + o + 4, 4).getUint32(0, true);
    const dataEnd = o + 8 + size;
    if (dataEnd > u8.length) break;
    const pad = size & 1;
    if (id === 'VP8 ' || id === 'VP8L' || id === 'ALPH') {
      chunks.push(u8.subarray(o, dataEnd + pad));
    }
    o = dataEnd + pad;
  }
  if (!chunks.length) throw new Error('El WebP no trae bitstream VP8.');
  return concat(chunks);
}

export function muxAnimatedWebp(stills, delayMs, width, height) {
  if (!stills.length) throw new Error('No hay fotogramas para el WebP.');
  const w = width | 0;
  const h = height | 0;
  const delay = Math.max(1, Math.min(0xffffff, delayMs | 0));
  const parts = [];

  // VP8X: bit 1 = animación. Canvas width/height minus one, 24-bit LE.
  const vp8x = new Uint8Array(10);
  vp8x[0] = 0x02;
  vp8x.set(u24(w - 1), 4);
  vp8x.set(u24(h - 1), 7);
  parts.push(chunk('VP8X', vp8x));

  // ANIM: fondo negro opaco (BGRA) + loop 0 = infinito.
  const anim = new Uint8Array(6);
  anim[3] = 255;
  parts.push(chunk('ANIM', anim));

  for (const still of stills) {
    const bitstream = extractWebpBitstream(still);
    const header = new Uint8Array(16);
    header.set(u24(0), 0);
    header.set(u24(0), 3);
    header.set(u24(w - 1), 6);
    header.set(u24(h - 1), 9);
    header.set(u24(delay), 12);
    // B=0 (blend; sin alfa reemplaza el rectángulo) y D=0 (no dispose).
    // Es el byte que escribe libwebp; los decoders lo conocen.
    header[15] = 0x00;
    parts.push(chunk('ANMF', concat([header, bitstream])));
  }

  const body = concat(parts);
  const riff = new Uint8Array(12 + body.length);
  riff.set([0x52, 0x49, 0x46, 0x46], 0);
  new DataView(riff.buffer).setUint32(4, 4 + body.length, true);
  riff.set([0x57, 0x45, 0x42, 0x50], 8);
  riff.set(body, 12);
  return riff;
}
