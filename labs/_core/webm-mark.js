// AlphaMode (EBML 0x53C0 = 1) es la marca que mediabunny deja en el track
// de un WebM cuando el video lleva canal alpha (VP9 color + VP9 alpha).

function readVint(u8, pos) {
  if (pos >= u8.length) return null;
  const f = u8[pos];
  if (!f) return null;
  let len = 1;
  for (let m = 0x80; !(f & m); m >>= 1) len += 1;
  if (len > 8 || pos + len > u8.length) return null;
  let value = f & (0xff >> len);
  for (let i = 1; i < len; i++) value = value * 256 + u8[pos + i];
  return { value, next: pos + len };
}

export function webmHasAlphaMode(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  for (let i = 0; i < u8.length - 3; i++) {
    if (u8[i] !== 0x53 || u8[i + 1] !== 0xc0) continue;
    const size = readVint(u8, i + 2);
    if (!size || size.value < 1 || size.value > 8 || size.next + size.value > u8.length) continue;
    let val = 0;
    for (let k = 0; k < size.value; k++) val = val * 256 + u8[size.next + k];
    if (val === 1) return true;
  }
  return false;
}
