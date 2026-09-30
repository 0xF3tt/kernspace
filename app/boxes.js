// The series-neutral half of the overlap checker: font metrics, boxes and the separating-axis test.
// A series' rules module (app/series/<series>.rules.js) rebuilds the boxes of a rendered sheet from these and
// applies its own rules; app/check.js is the entry point the test and the word editor call.
//
// Boxes. Widths come from the bundled fonts' own advances (useMetrics), at the weight the sheet draws:
// JetBrains Mono is 0.6em for every glyph a sheet uses; a Nunito line is measured glyph by glyph at the
// font-weight of its class (Cutting Mat's phrase: 300), the file's default instance (200) moved by its HVAR
// deltas (equal to what Chrome measures). Kerning can also widen a Nunito line: by at most 0.08em over the
// 3,700 texts the lexicons and presets hold, so every Nunito line gets 0.1em more, whatever its size. Without metrics (first paint in the app) the checker falls
// back to 0.6em and a conservative 0.56em per character.
// Vertically a box covers the ink, measured from the glyf bounds of the bundled fonts over ASCII plus · → °:
// JetBrains Mono 0.87em above the baseline ("$") to 0.18em below ("g"), Nunito 0.83em to 0.20em. Rotated
// labels keep their rotation: boxes are quads and the test is a separating-axis test, so a 60° label is not
// inflated to its axis-aligned hull. Stroked shapes include half their stroke, and so do labels drawn with a
// halo (a ground-colored stroke under the glyphs), since the halo erases whatever it lands on.
//
// Tolerance. Two shapes collide only if they overlap by more than TOL = 1px on every axis. That absorbs the
// renderer's rounding and the few font units the ink moves between the weights in use and the measured
// default; anything deeper is real.
//
// Colors. The sheets are drawn on one synthetic ground that gives each color role its own value, so each mark
// is told apart by its fill or stroke. Layout never depends on the palette: one pass covers all four.
export const len = (s) => [...s].length;              // code points: "·" and "→" count once
const pad2 = (v) => String(v).padStart(2, '0');
export const fail = (m) => { throw new Error(m); };

// ---------- font metrics

// code point -> advance in em, read from a TrueType file (cmap format 12, else 4, + hmtx). With `wght`, the
// advances of that weight instance: the default instance moved by the HVAR deltas (and the avar map, if any).
export function advances(bytes, { wght } = {}) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (o) => v.getUint16(o), i16 = (o) => v.getInt16(o), u32 = (o) => v.getUint32(o), i32 = (o) => v.getInt32(o);
  const f2 = (o) => i16(o) / 16384;
  const tag = (o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  const tables = {};
  for (let i = 0; i < u16(4); i++) tables[tag(12 + 16 * i)] = u32(20 + 16 * i);
  const table = (t) => tables[t] ?? fail(`font: no ${t} table`);
  const cmap = table('cmap'), hmtx = table('hmtx'), long = u16(table('hhea') + 34), upem = u16(table('head') + 18);
  const delta = wght == null ? () => 0 : hvar(wght);
  const adv = (g) => (u16(hmtx + 4 * Math.min(g, long - 1)) + delta(g)) / upem, out = new Map();
  const subs = Array.from({ length: u16(cmap + 2) }, (_, i) => cmap + u32(cmap + 8 + 8 * i));
  const t = subs.find((o) => u16(o) === 12) ?? subs.find((o) => u16(o) === 4);
  if (u16(t) === 12) {
    for (let i = 0, o = t + 16; i < u32(t + 12); i++, o += 12)
      for (let c = u32(o); c <= u32(o + 4); c++) out.set(c, adv(u32(o + 8) + c - u32(o)));
  } else {
    const n = u16(t + 6) / 2, ends = t + 14, starts = ends + 2 * n + 2, deltas = starts + 2 * n, ranges = deltas + 2 * n;
    for (let i = 0; i < n; i++) for (let c = u16(starts + 2 * i); c <= u16(ends + 2 * i) && c < 0xFFFF; c++) {
      const r = u16(ranges + 2 * i), raw = r ? u16(ranges + 2 * i + r + 2 * (c - u16(starts + 2 * i))) : c;
      if (raw) out.set(c, adv((raw + i16(deltas + 2 * i)) & 0xFFFF));
    }
  }
  return out;

  // glyph id -> advance delta in font units at this wght (OpenType fvar, avar, HVAR and its item variation store)
  function hvar(value) {
    if (!tables.fvar || !tables.HVAR) return () => 0;
    const fv = tables.fvar, axes = fv + u16(fv + 4), count = u16(fv + 8), size = u16(fv + 10);
    const coords = [];
    for (let i = 0; i < count; i++) {
      const a = axes + i * size, min = i32(a + 4) / 65536, def = i32(a + 8) / 65536, max = i32(a + 12) / 65536;
      const x = tag(a) === 'wght' ? Math.min(max, Math.max(min, value)) : def;
      coords.push(x === def ? 0 : x < def ? (x - def) / (def - min) : (x - def) / (max - def));
    }
    if (tables.avar) {                                  // segment maps, one per axis, in fvar order
      let o = tables.avar + 8;
      for (let i = 0; i < count; i++) {
        const pairs = u16(o), map = Array.from({ length: pairs }, (_, k) => [f2(o + 2 + 4 * k), f2(o + 4 + 4 * k)]);
        o += 2 + 4 * pairs;
        const c = coords[i], j = map.findIndex(([from]) => from >= c);
        if (j > 0 && map[j][0] !== c) {
          const [x0, y0] = map[j - 1], [x1, y1] = map[j];
          coords[i] = y0 + (y1 - y0) * (c - x0) / (x1 - x0);
        } else if (j >= 0) coords[i] = map[j][1];
      }
    }
    const h = tables.HVAR, store = h + u32(h + 4), mapOff = u32(h + 8) ? h + u32(h + 8) : 0;
    const regions = store + u32(store + 2), axisCount = u16(regions), regionCount = u16(regions + 2);
    const scalars = Array.from({ length: regionCount }, (_, r) => {
      let s = 1;
      for (let a = 0; a < axisCount; a++) {
        const o = regions + 4 + (r * axisCount + a) * 6, start = f2(o), peak = f2(o + 2), end = f2(o + 4), c = coords[a];
        if (peak === 0 || c === peak) continue;
        if (c <= start || c >= end || (start < 0 && end > 0)) return 0;
        s *= c < peak ? (c - start) / (peak - start) : (end - c) / (end - peak);
      }
      return s;
    });
    const dataCount = u16(store + 6);
    const data = Array.from({ length: dataCount }, (_, k) => store + u32(store + 8 + 4 * k));
    return (g) => {
      let outer = 0, inner = g;
      if (mapOff) {
        const fmt = b[mapOff], entry = b[mapOff + 1], n = fmt === 0 ? u16(mapOff + 2) : u32(mapOff + 2);
        const at = mapOff + (fmt === 0 ? 4 : 6), size = ((entry & 0x30) >> 4) + 1, bits = (entry & 0x0F) + 1;
        let e = 0;
        for (let k = 0, o = at + Math.min(g, n - 1) * size; k < size; k++) e = (e << 8) | b[o + k];
        outer = e >>> bits; inner = e & ((1 << bits) - 1);
      }
      const d = data[outer];
      if (d == null || inner >= u16(d)) return 0;
      const words = u16(d + 2), wide = (words & 0x8000) !== 0, wordCount = words & 0x7FFF, regionIdx = u16(d + 4);
      const big = wide ? 4 : 2, small = wide ? 2 : 1, row = wordCount * big + (regionIdx - wordCount) * small;
      let o = d + 6 + 2 * regionIdx + inner * row, sum = 0;
      for (let k = 0; k < regionIdx; k++) {
        const r = u16(d + 6 + 2 * k);
        const x = k < wordCount ? (wide ? i32(o) : i16(o)) : (wide ? i16(o) : v.getInt8(o));
        o += k < wordCount ? big : small;
        sum += scalars[r] * x;
      }
      return sum;
    };
  }
}

// the advances the boxes use: { mono, nunito }. mono is a map from advances() (JetBrains Mono at its default);
// nunito is { [wght]: map }, one advances(bytes, { wght }) per weight a sheet draws (a bare map serves every weight)
let metrics = { mono: null, nunito: null };
export function useMetrics(m) { metrics = { ...metrics, ...m }; }
const FALLBACK = { mono: 0.6, nunito: 0.56 };
const KERN = { mono: 0, nunito: 0.1 };                 // em a line may gain from kerning pairs
const table = (face, wght) => {                        // the nearest weight measured
  const m = metrics[face];
  if (!m || m instanceof Map) return m;
  const ws = Object.keys(m).map(Number);
  return ws.length ? m[ws.reduce((a, b) => (Math.abs(b - wght) < Math.abs(a - wght) ? b : a))] : null;
};
export const width = (face, s, wght = 300) => {
  const m = table(face, wght);
  if (!m) return len(s) * FALLBACK[face];
  let w = KERN[face];
  for (const ch of s) w += m.get(ch.codePointAt(0)) ?? FALLBACK[face];
  return w;
};
// every character exists in the font that draws it (JetBrains Mono: at its fixed 0.6em)
export const glyphs = (face, s) => {
  const m = table(face, 300);
  if (!m) return true;
  for (const ch of s) if (face === 'mono' ? m.get(ch.codePointAt(0)) !== 0.6 : !m.has(ch.codePointAt(0))) return false;
  return true;
};

// ---------- shapes

export const ROLES = ['bg', 'minor', 'major', 'angle', 'frame', 'rule', 'diag', 'text', 'text2', 'data', 'tb', 'sink', 'chip1', 'chip2', 'chip3'];
export const PROBE = Object.fromEntries(ROLES.map((r, i) => [r, `#0000${pad2((i + 1).toString(16))}`]));
export const ROLE = Object.fromEntries(ROLES.map((r) => [PROBE[r], r]));
export const TOL = 1;
export const INK = { mono: [0.87, 0.18], nunito: [0.83, 0.2] };     // em above / below the baseline
const XML_IN = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
export const unesc = (s) => s.replace(/&(lt|gt|amp|quot|apos);/g, (_, k) => XML_IN[k]);
export const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
export const quad = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
export const hull = (q) => ({ x0: Math.min(...q.map((p) => p[0])), y0: Math.min(...q.map((p) => p[1])), x1: Math.max(...q.map((p) => p[0])), y1: Math.max(...q.map((p) => p[1])) });
export const within = (q, r) => q.every(([x, y]) => x >= r.x0 - TOL && x <= r.x1 + TOL && y >= r.y0 - TOL && y <= r.y1 + TOL);

// SVG "translate(x,y) rotate(a)" applied to a quad
export function transform(q, t) {
  if (!t) return q;
  const m = t.match(/^translate\((-?[\d.]+),(-?[\d.]+)\) rotate\((-?[\d.]+)\)$/) ?? fail(`overlap checker: unexpected transform "${t}"`);
  const [tx, ty, deg] = m.slice(1).map(Number), c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
  return q.map(([x, y]) => [tx + x * c - y * s, ty + x * s + y * c]);
}

// how deep two convex quads overlap along their shallowest separating axis (<= 0: apart)
function depth(A, B) {
  let min = Infinity;
  for (const Q of [A, B]) for (let i = 0; i < 4; i++) {
    const [x1, y1] = Q[i], [x2, y2] = Q[(i + 1) % 4], nx = y1 - y2, ny = x2 - x1, l = Math.hypot(nx, ny);
    if (!l) continue;
    const a = A.map(([x, y]) => (x * nx + y * ny) / l), b = B.map(([x, y]) => (x * nx + y * ny) / l);
    min = Math.min(min, Math.min(Math.max(...a), Math.max(...b)) - Math.max(Math.min(...a), Math.min(...b)));
  }
  return min;
}
// axis-aligned hulls first (exact for two unrotated boxes), the separating-axis test only for rotated ones
export function hits(a, b) {
  const A = a.box ??= hull(a.q), B = b.box ??= hull(b.q);
  if (Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) <= TOL || Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) <= TOL) return false;
  return !(a.rot || b.rot) || depth(a.q, b.q) > TOL;
}

// a text re-boxed with another string (the editor's fast path)
export function reBox(t, str) {
  const A = t.at, w = (width(A.face, str, A.wght) + len(str) * A.ls) * A.size, x = A.x - w * A.k, [up, down] = A.inkOf?.(str) ?? A.ink;
  return { ...t, str, box: undefined, q: transform(quad(x - A.pad, A.y - up * A.size - A.pad, x + w + A.pad, A.y + down * A.size + A.pad), A.tr) };
}

export const family = (key) => key.split('.')[0];
export const union = (a, b) => (a && b ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : a ?? b);

// the <style> of a rendered sheet, per class: font size, weight, letter spacing, halo (stroke width) and face
export function classes(svg) {
  const css = {};
  for (const [, cls, body] of svg.match(/<style>(.*?)<\/style>/s)[1].matchAll(/\.([a-z][a-z\d]*)\{([^}]*)\}/g)) {
    const c = (css[cls] ??= {}), size = body.match(/font-size:([\d.]+)px/), ls = body.match(/letter-spacing:(-?[\d.]+)em/);
    const halo = body.match(/stroke-width:([\d.]+)px|stroke-width:(0)/), wght = body.match(/font-weight:(\d+)/);
    if (size) c.size = +size[1];
    if (wght) c.wght = +wght[1];
    if (ls) c.ls = +ls[1];
    if (halo) c.halo = +(halo[1] ?? halo[2]);
    if (body.includes('font-family:KNunito')) c.face = 'nunito';
  }
  return css;
}
