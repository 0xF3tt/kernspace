// The overlap checker and the slot rules, shared by the test (node app/render.test.mjs) and the word editor.
// It rebuilds, from a rendered sheet, a box for every text the renderer draws and every mark a text could
// hide behind, then checks, for one preset in one format:
//   1. no two texts overlap
//   2. panel texts (phrase, whoami, terminal, signature, side label) sit fully inside a panel and ISB
//      labels inside their tag; every other text stays clear of every panel and tag (panels are
//      opaque cut-outs drawn over the flows, source, sink and controls)
//   3. no text overlaps a tape chip, a control square, the source or sink dot, or a note tick
//   4. texts on the mat stay inside the frame; rulers and status lines stay off it, on the canvas
//   5. labels on the mat (flows, source, sink, controls, findings, notes) do not cross an ISB line:
//      each reads on one side of a trust boundary (the ISB tags sit on theirs by design)
//   6. tape chips and note ticks stay inside the frame, clear of panels, tags, controls, dots and each other
//   7. phone: only the rulers reach into the top third, where the lock-screen clock sits
//
// Boxes. Widths come from the bundled fonts' own advances (useMetrics), at the weight the sheet draws:
// JetBrains Mono is 0.6em for every glyph a sheet uses; the Nunito phrase is measured glyph by glyph at
// weight 300, the file's default instance (200) moved by its HVAR deltas (equal to what Chrome measures).
// Kerning can also widen a Nunito line: by at most 0.08em over the 3,700 texts the lexicons and presets
// hold, so every phrase line gets 0.1em more. Without metrics (first paint in the app) the checker falls
// back to 0.6em and a conservative 0.56em per character.
// Vertically a box covers the ink, measured from the glyf bounds of the bundled fonts over ASCII plus · → °:
// JetBrains Mono 0.87em above the baseline ("$") to 0.18em below ("g"), Nunito 0.83em to 0.20em. Rotated
// labels (the flows, the side label) keep their rotation: boxes are quads and the test is a separating-axis
// test, so a 60° label is not inflated to its axis-aligned hull. Stroked shapes (panels, tags, controls,
// frame, ticks) include half their stroke, and so do labels drawn with a halo (.t: a ground-colored stroke
// under the glyphs), since the halo erases whatever it lands on.
//
// Tolerance. Two shapes collide only if they overlap by more than TOL = 1px on every axis. That absorbs the
// renderer's rounding (flow anchors snap to whole pixels, the rest to 0.01px) and the few font units the ink
// moves between the weights in use (300-500) and the measured default; anything deeper is real.
//
// Colors. The sheets are drawn on one synthetic ground that gives each color role its own value, so each mark
// is told apart by its fill or stroke. Layout never depends on the palette: one pass covers all four.
import { FORMATS, HANDLE, MOTTO } from './render.js';
import { render } from './series/cutting-mat.js';

export const len = (s) => [...s].length;              // code points: "·" and "→" count once
const pad2 = (v) => String(v).padStart(2, '0');
const fail = (m) => { throw new Error(m); };

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

// the advances the boxes use: { mono, nunito } maps from advances(), JetBrains Mono at its default and Nunito at 300
let metrics = { mono: null, nunito: null };
export function useMetrics(m) { metrics = { ...metrics, ...m }; }
const FALLBACK = { mono: 0.6, nunito: 0.56 };
const KERN = { mono: 0, nunito: 0.1 };                 // em a line may gain from kerning pairs
const width = (face, s) => {
  const m = metrics[face];
  if (!m) return len(s) * FALLBACK[face];
  let w = KERN[face];
  for (const ch of s) w += m.get(ch.codePointAt(0)) ?? FALLBACK[face];
  return w;
};
// every character exists in the font that draws it (JetBrains Mono: at its fixed 0.6em)
export const glyphs = (face, s) => {
  const m = metrics[face];
  if (!m) return true;
  for (const ch of s) if (face === 'mono' ? m.get(ch.codePointAt(0)) !== 0.6 : !m.has(ch.codePointAt(0))) return false;
  return true;
};

// ---------- the scene of one sheet

const ROLES = ['bg', 'minor', 'major', 'angle', 'frame', 'rule', 'diag', 'text', 'text2', 'data', 'tb', 'sink', 'chip1', 'chip2', 'chip3'];
export const PROBE = Object.fromEntries(ROLES.map((r, i) => [r, `#0000${pad2((i + 1).toString(16))}`]));
const ROLE = Object.fromEntries(ROLES.map((r) => [PROBE[r], r]));
const TOL = 1;
const INK = { mono: [0.87, 0.18], nunito: [0.83, 0.2] };     // em above / below the baseline
const PANELS = ['the phrase panel', 'the whoami panel', 'the side panel', 'the terminal panel'];   // render order
const TAPES = ['horizontal', 'vertical', 'square'];
export const HANDLES = ['', 'abcdefg', 'x'.repeat(20)];     // default, longest two-line box, three lines
export const MOTTOS = ['', 'x'.repeat(40)];                  // default, longest

const XML_IN = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const unesc = (s) => s.replace(/&(lt|gt|amp|quot|apos);/g, (_, k) => XML_IN[k]);
const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const quad = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
export const hull = (q) => ({ x0: Math.min(...q.map((p) => p[0])), y0: Math.min(...q.map((p) => p[1])), x1: Math.max(...q.map((p) => p[0])), y1: Math.max(...q.map((p) => p[1])) });
const within = (q, r) => q.every(([x, y]) => x >= r.x0 - TOL && x <= r.x1 + TOL && y >= r.y0 - TOL && y <= r.y1 + TOL);

// SVG "translate(x,y) rotate(a)" applied to a quad
function transform(q, t) {
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
function hits(a, b) {
  const A = a.box ??= hull(a.q), B = b.box ??= hull(b.q);
  if (Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) <= TOL || Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) <= TOL) return false;
  return !(a.rot || b.rot) || depth(a.q, b.q) > TOL;
}

const drawnRight = (s, handle) => s?.replaceAll('{handle}', handle || HANDLE);

// drawn string -> { key, name }: which preset field (and layout entry) it comes from. key is the editor's slot
// id; name reads well in a message. The phone's status lines replace data.* on the phone only.
export function slotNames(p, fmt, handle = '') {
  const lay = `layout.${fmt === 'phone' ? 'phone' : 'desktop'}`;
  const m = new Map(), put = (s, key, name = key) => s != null && !m.has(s) && m.set(s, { key, name });
  p.phrase.forEach((s, i) => put(s, `phrase.${i}`, `phrase[${i}]`));
  for (const k of ['label', 'source', 'sink']) put(p[k], k);
  for (const k of ['controls', 'flows']) p[k]?.forEach((s, i) => put(s, `${k}.${i}`, `${k}[${i}]`));
  p.findings?.forEach((s, i) => put(s, `findings.${i}`, `findings[${i}] (${lay}.chips[${i}])`));
  p.notes?.forEach((s, i) => put(s, `notes.${i}`, `notes[${i}] (${lay}.notes[${i}])`));
  put(p.panel?.title, 'panel.title');
  p.panel?.lines?.forEach((s, i) => put(s, `panel.lines.${i}`, `panel.lines[${i}]`));
  const data = fmt === 'phone' ? { ...p.data, ...p.phone?.data } : { ...p.data };
  for (const [k, s] of Object.entries(data)) put(k === 'right' ? drawnRight(s, handle) : s, `data.${k}`, `status line ${k}`);
  return m;
}

// every text and mark of one rendered sheet, as named quads
export function scene(svg, slots) {
  const css = {};
  for (const [, cls, body] of svg.match(/<style>(.*?)<\/style>/s)[1].matchAll(/\.([a-z]+)\{([^}]*)\}/g)) {
    const c = (css[cls] ??= {}), size = body.match(/font-size:([\d.]+)px/), ls = body.match(/letter-spacing:(-?[\d.]+)em/);
    const halo = body.match(/stroke-width:([\d.]+)px|stroke-width:(0)/);
    if (size) c.size = +size[1];
    if (ls) c.ls = +ls[1];
    if (halo) c.halo = +(halo[1] ?? halo[2]);
    if (body.includes('font-family:KNunito')) c.face = 'nunito';
  }
  const s = { texts: [], panels: [], tags: [], chips: [], marks: [], ticks: [], isb: [], frame: null };
  for (const [, at, body] of svg.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)) {
    const a = attrs(at), classes = a.class.split(' '), cls = classes[0], fill = ROLE[a.fill];
    const { size, ls = 0, face = 'mono', halo = 0 } = Object.assign({}, ...classes.map((k) => css[k]));
    if (!size) fail(`overlap checker: no font size for class "${a.class}"`);
    const str = unesc(body), w = (width(face, str) + len(str) * ls) * size, [up, down] = INK[face], pad = halo / 2;
    const k = { middle: 0.5, end: 1 }[a['text-anchor']] ?? 0, x = +(a.x ?? 0) - w * k, y = +(a.y ?? 0);
    const kind = cls === 'r' ? 'ruler' : cls === 'd' ? 'status' : ['ph', 'w', 'k', 'sg', 'vl'].includes(cls) ? 'panel'
      : fill === 'tb' ? 'tag' : fill === 'angle' ? 'flow' : 'label';
    const slot = kind === 'ruler' || kind === 'tag' ? null : slots.get(str);   // a word may equal a ruler label
    s.texts.push({
      kind, str, name: `${slot?.name ?? (kind === 'panel' ? 'panel text' : kind)} "${str}"`, slot: slot?.key, rot: !!a.transform,
      q: transform(quad(x - pad, y - up * size - pad, x + w + pad, y + down * size + pad), a.transform),
      at: { x: +(a.x ?? 0), y, k, tr: a.transform, size, ls, face, ink: INK[face], pad },
    });
  }
  for (const [, at] of svg.matchAll(/<rect ([^>]*?)\/>/g)) {
    const a = attrs(at);
    if (a.x == null) continue;                          // the background
    const x = +a.x, y = +a.y, w = +a.width, h = +a.height, half = (+a['stroke-width'] || 0) / 2;
    const shape = { q: quad(x - half, y - half, x + w + half, y + h + half), in: { x0: x + half, y0: y + half, x1: x + w - half, y1: y + h - half } };
    const fill = ROLE[a.fill], stroke = ROLE[a.stroke];
    if (stroke === 'frame') s.frame = { ...shape, name: 'the frame' };
    else if (stroke === 'major') s.panels.push({ ...shape, name: PANELS[s.panels.length] });
    else if (stroke === 'tb') s.tags.push(shape);
    else if (stroke === 'diag') s.marks.push({ ...shape, name: `the ISB-0${s.marks.filter((m) => m.control).length + 1} control square`, control: true });
    else if (fill === 'diag') continue;                 // a control's center, inside its square
    else if (/^chip[123]$/.test(fill)) { const i = +fill.at(-1) - 1; s.chips.push({ ...shape, tape: i, name: `the ${TAPES[i]} tape` }); }
    else fail(`overlap checker: unknown rect ${at}`);
  }
  const rules = [];
  for (const [, at] of svg.matchAll(/<line ([^>]*?)\/>/g)) {
    const a = attrs(at), role = ROLE[a.stroke], half = +a['stroke-width'] / 2;
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => +a[k]);
    if (role === 'tb') s.isb.push({ y: y1, half, q: quad(x1, y1 - half, x2, y1 + half) });
    if (role === 'rule') rules.push({ q: quad(Math.min(x1, x2) - half, Math.min(y1, y2), Math.max(x1, x2) + half, Math.max(y1, y2)) });
  }
  for (const [, at] of svg.matchAll(/<circle ([^>]*?)\/>/g)) {
    const { cx, cy, r, fill } = attrs(at);
    s.marks.push({ q: quad(+cx - +r, +cy - +r, +cx + +r, +cy + +r), name: ROLE[fill] === 'sink' ? 'the sink dot' : 'the source dot' });
  }
  if (!(s.frame && s.panels.length === 4 && s.tags.length === 2 && s.isb.length === 2)) fail('overlap checker: sheet structure changed');
  const tagTexts = s.texts.filter((t) => t.kind === 'tag');   // rect, line and label come in the same order
  s.tags.forEach((t, i) => { t.name = `the ${tagTexts[i].str} tag`; s.isb[i].name = `the ${tagTexts[i].str} line`; });
  s.ticks = rules.filter((r) => hits(r, s.frame));              // ruler ticks keep off the frame; note ticks sit on the mat
  s.ticks.forEach((t, i) => { t.name = `note tick ${i + 1}`; });
  return s;
}

// every rule broken on one sheet, as readable lines
export function collisions(s, W, H, phone) {
  const bad = [], F = s.frame, canvas = { x0: 0, y0: 0, x1: W, y1: H };
  const say = (a, verb, b) => bad.push(`${a.name} ${verb} ${b.name ?? b}`);
  const clock = (x) => phone && hull(x.q).y0 < H / 3 - TOL;
  const obstacles = [...s.chips, ...s.marks, ...s.ticks];
  s.texts.forEach((t, i) => {
    for (const u of s.texts.slice(i + 1)) if (hits(t, u)) say(t, 'overlaps', u);                            // 1
    const homes = t.kind === 'panel' ? s.panels : t.kind === 'tag' ? s.tags : [];
    const home = homes.find((c) => within(t.q, c.in));
    if (homes.length && !home) say(t, 'does not fit inside', t.kind === 'panel' ? 'its panel' : 'its tag');    // 2
    for (const c of [...s.panels, ...s.tags]) if (c !== home && hits(t, c)) say(t, 'overlaps', c);
    for (const m of obstacles) if (hits(t, m)) say(t, 'overlaps', m);                                        // 3
    if (t.kind === 'ruler' || t.kind === 'status') {                                                          // 4
      if (hits(t, F)) say(t, 'overlaps', F);
      if (!within(t.q, canvas)) say(t, 'leaves', 'the canvas');
    } else if (!within(t.q, F.in)) say(t, 'crosses', F);
    if (t.kind === 'flow' || t.kind === 'label') for (const b of s.isb) {                                     // 5
      const { y0, y1 } = hull(t.q);
      if (y0 < b.y + b.half - TOL && y1 > b.y - b.half + TOL) say(t, 'crosses', b);
    }
    if (t.kind !== 'ruler' && clock(t)) say(t, 'reaches', 'the lock-screen clock (top third)');             // 7
  });
  const placed = [...s.chips, ...s.ticks];
  placed.forEach((c, i) => {                                                                                  // 6
    if (!within(c.q, F.in)) say(c, 'crosses', F);
    for (const o of [...s.panels, ...s.tags, ...s.marks, ...placed.slice(i + 1)]) if (hits(c, o)) say(c, 'overlaps', o);
    if (clock(c)) say(c, 'reaches', 'the lock-screen clock (top third)');
  });
  return bad;
}

// all collisions of one preset in one format, deduplicated across the whoami boxes checked
export function overlaps(p, fmt, { handles = HANDLES, mottos = MOTTOS } = {}) {
  const { w, h } = FORMATS[fmt], out = new Set();
  for (const handle of handles) for (const motto of mottos) {
    const svg = render({ preset: p, colors: PROBE, format: fmt, handle, motto, fonts: null });
    for (const b of collisions(scene(svg, slotNames(p, fmt, handle)), w, h, fmt === 'phone')) out.add(b);
  }
  return [...out];
}

// ---------- the editor's fast path: one scene per preset and format, then only the changed text is re-boxed

export function prepare(p, fmt) {
  const { w, h } = FORMATS[fmt];
  const s = scene(render({ preset: p, colors: PROBE, format: fmt, handle: '', fonts: null }), slotNames(p, fmt));
  return { s, W: w, H: h, phone: fmt === 'phone' };
}
function reBox(t, str) {
  const A = t.at, w = (width(A.face, str) + len(str) * A.ls) * A.size, x = A.x - w * A.k, [up, down] = A.ink;
  return { ...t, str, box: undefined, q: transform(quad(x - A.pad, A.y - up * A.size - A.pad, x + w + A.pad, A.y + down * A.size + A.pad), A.tr) };
}
// collisions() for one text: null when the slot has no text of its own (let the caller run overlaps()),
// else { ok, box } or { ok: false, box, hit } where hit names the first obstacle and its box
export function quickFits(base, key, str) {
  const { s, W, H, phone } = base, i = s.texts.findIndex((x) => x.slot === key);
  if (i < 0 || s.texts.findIndex((x, j) => j > i && x.slot === key) >= 0) return null;
  const t = reBox(s.texts[i], str), F = s.frame, tb = hull(t.q);
  const no = (what, o) => ({ ok: false, box: tb, hit: { what, name: o.name, slot: o.slot, box: o.box ?? (o.q ? hull(o.q) : o) } });
  for (const [j, u] of s.texts.entries()) if (j !== i && hits(t, u)) return no('text', u);
  const homes = t.kind === 'panel' ? s.panels : t.kind === 'tag' ? s.tags : [], home = homes.find((c) => within(t.q, c.in));
  if (homes.length && !home) return no('home', { name: 'its panel', box: tb });
  for (const c of [...s.panels, ...s.tags]) if (c !== home && hits(t, c)) return no('shape', c);
  for (const m of [...s.chips, ...s.marks, ...s.ticks]) if (hits(t, m)) return no('shape', m);
  if (t.kind === 'ruler' || t.kind === 'status') {
    if (hits(t, F)) return no('shape', F);
    if (!within(t.q, { x0: 0, y0: 0, x1: W, y1: H })) return no('edge', { name: 'the edge of the sheet', box: tb });
  } else if (!within(t.q, F.in)) return no('edge', { name: 'the frame', box: tb });
  if (t.kind === 'flow' || t.kind === 'label') {
    const { y0, y1 } = tb, b = s.isb.find((l) => y0 < l.y + l.half - TOL && y1 > l.y - l.half + TOL);
    if (b) return no('shape', b);
  }
  if (t.kind !== 'ruler' && phone && tb.y0 < H / 3 - TOL) return no('clock', { name: 'the lock-screen clock', box: { x0: 0, y0: 0, x1: W, y1: H / 3 } });
  return { ok: true, box: tb };
}

// ---------- the slot table (series/cutting-mat/README.md), one source for the test, the README and the editor

export const ANGLES = [60, 30, 15];
// characters per slot. The phrase is also measured against its panel; findings[2] (the square tape) is
// shorter because it sits nearer the frame; data.left is also drawn on the phone, where the cap is 30.
export const LIMITS = {
  phrase: 18, label: 40, source: 24, sink: 22, controls: 14, flows: 21, findings: [20, 20, 18], notes: 26,
  'panel.title': 20, 'panel.lines': 38, 'data.left': 40, 'data.right': 44, phone: 30, handle: 20, motto: 40,
};
export const family = (key) => key.split('.')[0];
export const limitOf = (key) => {
  const [a, b] = key.split('.');
  if (a === 'findings') return LIMITS.findings[+b] ?? LIMITS.findings[0];
  return LIMITS[a === 'panel' || a === 'data' ? `${a}.${b}` : a];
};
export const get = (p, key) => {
  if (key === 'phrase') return p.phrase;
  const [a, b, c] = key.split('.');
  if (a === 'panel') return c == null ? p.panel?.[b] : p.panel?.lines?.[+c];
  if (a === 'data') return p.data?.[b];
  return b == null ? p[a] : p[a]?.[+b];
};
// an immutable copy with one slot replaced; a status line is written for the phone too, when it has its own
export function withSlot(p, key, value) {
  const [a, b] = key.split('.'), q = { ...p };
  if (key === 'phrase') q.phrase = [...value];
  else if (a === 'data') {
    q.data = { ...p.data, [b]: value };
    if (p.phone?.data?.[b] != null) q.phone = { ...p.phone, data: { ...p.phone.data, [b]: value } };
  } else if (b == null) q[a] = value;
  else q[a] = p[a].map((s, i) => (i === +b ? value : s));
  return q;
}
// why a value breaks the slot table (an empty list: it doesn't). Geometry is overlaps()'s job.
export function slotRules(p, key, value) {
  const why = [], a = family(key), lines = key === 'phrase' ? value : [value];
  if (!Array.isArray(lines) || !lines.length || lines.length > (key === 'phrase' ? 2 : 1)) return ['one or two lines'];
  for (const s of lines) {
    if (typeof s !== 'string' || !s.trim()) return ['empty'];
    if (/[\u0000-\u001F\u007F-\u009F]/.test(s)) why.push('control character');
    if (s !== s.trim()) why.push('stray spaces');
    const max = a === 'data' && p.phone?.data?.[key.slice(5)] != null ? Math.min(limitOf(key), LIMITS.phone) : limitOf(key);
    if (len(s) > max) why.push(`${len(s)}/${max}`);
    if (!glyphs(a === 'phrase' ? 'nunito' : 'mono', s)) why.push('glyph');
  }
  if (a === 'flows' && !value.startsWith(`${ANGLES[+key.split('.')[1]]}° · `)) why.push('angle prefix');
  return why;
}
