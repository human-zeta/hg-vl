// ZIP método STORE (sin recompresión: los PNG ya vienen comprimidos).
// Se puede ir escribiendo de a un archivo y cerrar al final, así la
// descarga no arma un base64 ni duplica el archivo entero en un solo buffer.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosStamp(date) {
  const d = date instanceof Date ? date : new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | ((d.getSeconds() / 2) | 0);
  const day = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, day };
}

function u16(n) {
  return [n & 255, (n >> 8) & 255];
}
function u32(n) {
  return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
}

export class ZipStore {
  constructor(date) {
    this.parts = [];
    this.entries = [];
    this.offset = 0;
    this.stamp = dosStamp(date);
  }

  add(name, data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const nameBytes = new TextEncoder().encode(String(name));
    const crc = crc32(bytes);
    const { time, day } = this.stamp;
    // bit 11 = nombre en UTF-8. Método 0 = store.
    const local = new Uint8Array(30 + nameBytes.length);
    local.set([0x50, 0x4b, 0x03, 0x04], 0);
    local.set(u16(20), 4);
    local.set(u16(0x0800), 6);
    local.set(u16(0), 8);
    local.set(u16(time), 10);
    local.set(u16(day), 12);
    local.set(u32(crc), 14);
    local.set(u32(bytes.length), 18);
    local.set(u32(bytes.length), 22);
    local.set(u16(nameBytes.length), 26);
    local.set(u16(0), 28);
    local.set(nameBytes, 30);
    this.entries.push({
      nameBytes,
      crc,
      size: bytes.length,
      offset: this.offset,
      time,
      day,
    });
    this.parts.push(local, bytes);
    this.offset += local.length + bytes.length;
    return local.length + bytes.length;
  }

  footer() {
    let centralSize = 0;
    const chunks = [];
    for (const e of this.entries) {
      const c = new Uint8Array(46 + e.nameBytes.length);
      c.set([0x50, 0x4b, 0x01, 0x02], 0);
      c.set(u16(20), 4);
      c.set(u16(20), 6);
      c.set(u16(0x0800), 8);
      c.set(u16(0), 10);
      c.set(u16(e.time), 12);
      c.set(u16(e.day), 14);
      c.set(u32(e.crc), 16);
      c.set(u32(e.size), 20);
      c.set(u32(e.size), 24);
      c.set(u16(e.nameBytes.length), 28);
      c.set(u16(0), 30);
      c.set(u16(0), 32);
      c.set(u16(0), 34);
      c.set(u16(0), 36);
      c.set(u32(0), 38);
      c.set(u32(e.offset), 42);
      c.set(e.nameBytes, 46);
      chunks.push(c);
      centralSize += c.length;
    }
    const eocd = new Uint8Array(22);
    eocd.set([0x50, 0x4b, 0x05, 0x06], 0);
    eocd.set(u16(this.entries.length), 8);
    eocd.set(u16(this.entries.length), 10);
    eocd.set(u32(centralSize), 12);
    eocd.set(u32(this.offset), 16);
    eocd.set(u16(0), 20);
    chunks.push(eocd);
    let total = 0;
    for (const c of chunks) total += c.length;
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  toBlob() {
    return new Blob([...this.parts, this.footer()], { type: 'application/zip' });
  }

  async writeTo(writable) {
    for (const part of this.parts) await writable.write(part);
    await writable.write(this.footer());
  }
}

export function zipFrames(items) {
  const zip = new ZipStore();
  const lines = ['frame\ttimestamp_s'];
  items.forEach((f, i) => {
    const name = `frame-${String(i + 1).padStart(3, '0')}.png`;
    zip.add(name, f.png);
    const t = Number.isFinite(f.t) ? f.t.toFixed(3) : '';
    lines.push(`${name}\t${t}`);
  });
  zip.add('tiempos.txt', new TextEncoder().encode(lines.join('\n') + '\n'));
  return zip;
}
