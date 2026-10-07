// Shared helpers for kernspace renderers: formats, escaping, the whoami box, the film grain finish and bundled fonts.

export const FORMATS = {
  desktop: { w: 3840, h: 2160, label: 'Desktop 16:9' },
  wide: { w: 3840, h: 2400, label: 'Wide 16:10' },
  phone: { w: 1290, h: 2796, label: 'Phone' },
};

export const HANDLE = '0xF3tt';                     // default handle: the whoami box and the status line
export const MOTTO = 'somewhere exploring the purple colors.';   // default whoami line
const XML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

// XML-escape text and attribute values; also drops control chars XML 1.0 forbids
export const esc = s => String(s)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
  .replace(/[&<>"']/g, ch => XML[ch]);

export const validHandle = s => typeof s === 'string' && /^[A-Za-z0-9._-]{1,20}$/.test(s);

// a whoami line: up to 40 characters, no control characters, no leading or trailing space.
// Whether every character exists in JetBrains Mono is the caller's check (app/check.js glyphs()).
export const validMotto = s => typeof s === 'string' && s !== '' && s === s.trim()
  && !/[\u0000-\u001F\u007F-\u009F]/.test(s) && [...s].length <= 40;

// two lines while the handle fits beside the motto, three once it doesn't
export function whoamiLines(handle, motto) {
  const h = handle || HANDLE, m = motto || MOTTO, line = `${h} · ${m}`;
  return [...line].length <= 48 ? ['# whoami', line] : ['# whoami', h, m];
}

// Film grain, the optional finish: noise added to the whole sheet, type included (sheet + .12 × (noise − .5), about
// ±12 levels on every ground). The noise is one seamless 256 px tile repeated by feTile: PNG can't compress noise,
// but it finds the repeats, so a desktop PNG stays near 3.5 MB instead of 14–20 MB. Seeded: the same file draws the
// same grain. k3 is the strength; k4 is always -k3/2.
export const GRAIN = '<filter id="grain" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
  + '<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" stitchTiles="stitch" x="0" y="0" width="256" height="256"/>'
  + '<feColorMatrix type="matrix" values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1"/><feTile result="noise"/>'
  + '<feComposite in="SourceGraphic" in2="noise" operator="arithmetic" k1="0" k2="1" k3=".12" k4="-.06"/></filter>';
// a sheet's body (everything after its <style>), with the grain over it or as it is
export const finish = (body, grain) => (grain ? `<defs>${GRAIN}</defs><g filter="url(#grain)">${body}</g>` : body);

// Tag a PNG as sRGB: canvas exports carry no color chunk, and an untagged PNG may be read in the display's own space
// (Display P3 on a Mac), which shifts every ink. Adds an sRGB chunk (perceptual) after IHDR unless one is there already.
const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
export const crc32 = b => (b.reduce((c, v) => CRC[(c ^ v) & 255] ^ (c >>> 8), -1) ^ -1) >>> 0;
export function srgbPNG(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), at = 8 + 12 + dv.getUint32(8);   // signature, then IHDR
  for (let i = 8; i + 8 <= bytes.length; i += 12 + dv.getUint32(i)) {
    const t = String.fromCharCode(...bytes.subarray(i + 4, i + 8));
    if (t === 'sRGB' || t === 'iCCP') return bytes;
    if (t === 'IDAT') break;
  }
  const chunk = new Uint8Array(13), cv = new DataView(chunk.buffer);
  cv.setUint32(0, 1); chunk.set([0x73, 0x52, 0x47, 0x42, 0], 4); cv.setUint32(9, crc32(chunk.subarray(4, 9)));   // length 1, "sRGB", intent 0
  const out = new Uint8Array(bytes.length + 13);
  out.set(bytes.subarray(0, at)); out.set(chunk, at); out.set(bytes.subarray(at), at + 13);
  return out;
}

// A ZIP of files, STORED (a PNG is compressed already): local headers, central directory, end record. 32-bit sizes, UTF-8 names.
export function zip(files) {
  const d = new Date(), time = d.getHours() << 11 | d.getMinutes() << 5 | d.getSeconds() >> 1;
  const date = Math.max(0, d.getFullYear() - 1980) << 9 | (d.getMonth() + 1) << 5 | d.getDate();
  const enc = new TextEncoder(), parts = [], dir = [];
  let at = 0;
  const put = (n, ...v) => { const b = new Uint8Array(n), dv = new DataView(b.buffer); let o = 0; for (const [w, x] of v) { w === 2 ? dv.setUint16(o, x, true) : dv.setUint32(o, x, true); o += w; } return b; };
  for (const { name, bytes } of files) {
    const nm = enc.encode(name), crc = crc32(bytes), common = [[2, 0x0800], [2, 0], [2, time], [2, date], [4, crc], [4, bytes.length], [4, bytes.length], [2, nm.length], [2, 0]];
    parts.push(put(30, [4, 0x04034b50], [2, 20], ...common), nm, bytes);
    dir.push(put(46, [4, 0x02014b50], [2, 20], [2, 20], ...common, [2, 0], [2, 0], [2, 0], [4, 0], [4, at]), nm);   // comment length, disk, internal and external attrs, local header offset
    at += 30 + nm.length + bytes.length;
  }
  const size = dir.reduce((n, b) => n + b.length, 0), out = new Uint8Array(at + size + 22);
  let o = 0;
  for (const b of [...parts, ...dir, put(22, [4, 0x06054b50], [2, 0], [2, 0], [2, files.length], [2, files.length], [4, size], [4, at], [2, 0])]) { out.set(b, o); o += b.length; }
  return out;
}

const FONT_FILES = {
  nunito: 'fonts/nunito/Nunito-Variable.ttf',
  jbm: 'fonts/jetbrains-mono/JetBrainsMono-Variable.ttf',
};

// fetch one font as a data: URL (an SVG shown as an image can't load outside files)
async function dataURL(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font ${url}: HTTP ${res.status}`);
  const blob = new Blob([await res.arrayBuffer()], { type: 'font/ttf' });
  return new Promise((ok, fail) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.onerror = () => fail(fr.error);
    fr.readAsDataURL(blob);
  });
}

export async function loadFonts(base = '') {
  const [nunito, jbm] = await Promise.all([FONT_FILES.nunito, FONT_FILES.jbm].map(f => dataURL(base + f)));
  return { nunito, jbm };
}
