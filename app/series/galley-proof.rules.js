// Galley Proof's rules: the overlap checker's scene and collisions, the slot table and the word editor's slot
// pieces, the "Read the galley" marks and the editor's geometry. app/series/index.js registers them with the renderer.
// The checker rebuilds, from a rendered sheet, a box for every text and every mark a text could touch (the strip, the
// slip, the proof marks, the margin items, the key, the whoami box), then checks, for one preset in one format:
//   1. no two texts overlap
//   2. slug, headline, code and tally texts sit inside the strip; whoami lines inside their box; slip texts inside the
//      slip, tested in the slip's own frame (the same turn applies to both)
//   3. an in-text mark stays inside its row band (b − 42u to b + 22u; a transpose spans its two rows) and touches no
//      other line's text or mark
//   4. a margin text is level with its line (baseline within 1px), a margin symbol's unstroked glyph sits in b − 36u to b
//      and a ring encloses its label; each starts at or right of the strip edge + 40, overlaps no other margin item or note,
//      and stays left of the key column (phone: inside the canvas)
//   5. the slip covers no code line, gutter number, in-text mark, margin item, note or the tally, and overlaps the strip
//   6. key entries, whoami lines and the side label stay out of the margin band; a key glyph touches no key text; notes sit in the margin head: inside
//      the band, above the first code line's row band
//   7. everything stays on the canvas and out of the keep-clear zones: desktop and wide the menu bar (top 110px) and
//      the Dock (1300x220, bottom centre); phone the clock (y < 932) and the bottom 260px
// Every text is named by class and order (`code line 4`, `margin 3 gloss`, `key 2 name`), never by string: the key
// repeats words from the margin, and two marks may share a `to`. Only the editable texts map to a slot by string.
// Boxes, tolerance and colors: app/boxes.js.
import { FORMATS, HANDLE } from '../render.js';
import { AUTHOR, GEOMETRY, KEY, KEY_HEAD, render, slip, tally } from './galley-proof.js';
import { INK, PROBE, ROLE, TOL, attrs, classes, fail, family, glyphs, hits, hull, len, quad, reBox, transform, unesc, union, width, within } from '../boxes.js';
export { poolOf } from './cutting-mat.rules.js';

const drawnRight = (s, handle) => s?.replaceAll('{handle}', handle || HANDLE);
const vol = (p) => String(+/\d+/.exec(p.title ?? '')?.[0]).padStart(2, '0');

// drawn string -> { key, name } for the editable and named texts. The headline's lines are phrase.0 and phrase.1.
export function slotNames(p, fmt, handle = '') {
  const m = new Map(), put = (s, key, name = key) => s != null && !m.has(s) && m.set(s, { key, name });
  p.phrase.forEach((s, i) => put(s, `phrase.${i}`, `phrase[${i}]`));
  p.notes?.forEach((s, i) => put(s, `notes.${i}`, `notes[${i}]`));
  put(p.errata?.throughout, 'errata.throughout');
  const data = fmt === 'phone' ? { ...p.data, ...p.phone?.data } : { ...p.data };
  for (const [k, s] of Object.entries(data)) put(k === 'right' ? drawnRight(s, handle) : s, `data.${k}`, `status line ${k}`);
  put(p.label, 'label', 'side label');
  return m;
}

const KIND = { sl: 'slug', hl: 'headline', gn: 'gutter', cd: 'code', ty: 'tally', mt: 'matter', ml: 'label', gl: 'gloss', eh: 'slipHead', eb: 'slip', nt: 'note',
  kh: 'keyHead', kn: 'keyName', kg: 'keyGloss', k: 'whoami', d: 'status', vl: 'side' };
const OWN = new Set(['hl', 'nt', 'd', 'vl']);                    // the classes whose texts the editor can name by string
const STRIP = new Set(['slug', 'headline', 'code', 'tally']);
const MARGIN = new Set(['matter', 'label', 'gloss']);
const KEYS = new Set(['keyHead', 'keyName', 'keyGloss', 'keyMark']);
const COVERED = new Set(['code', 'gutter', 'tally', 'note', ...MARGIN]);   // what the slip must not hide
const TAGS = ['svg', 'title', 'style', 'rect', 'line', 'path', 'text'];

// the hull of a path's points (cubic Beziers stay inside their control polygon) and its stroked box
function pathBox(a, at) {
  const d = a.d ?? '', half = +a['stroke-width'] / 2;
  if (ROLE[a.stroke] !== 'chip1' || a.fill !== 'none' || !/^M[MLHVC\d.,\s-]+$/.test(d)) fail(`overlap checker: unknown path ${at}`);
  const pts = []; let x = 0, y = 0;
  for (const [, c, v] of d.matchAll(/([MLHVC])([^MLHVC]*)/g)) {
    const n = v.trim().split(/[ ,]+/).map(Number);
    if (c === 'H') pts.push([(x = n[0]), y]); else if (c === 'V') pts.push([x, (y = n[0])]);
    else for (let i = 0; i < n.length; i += 2) pts.push([(x = n[i]), (y = n[i + 1])]);
  }
  const h = hull(pts);
  return { h0: h, q: quad(h.x0 - half, h.y0 - half, h.x1 + half, h.y1 + half) };
}

// every text and shape of one rendered sheet, as named boxes, read in document order: the file's rows (gutter, code,
// then its marks in the text and in the margin), the foot and notes, the slip, the key, the whoami box, the status lines.
// A ring (circled note, query, stet, wf) belongs to the text it encloses.
export function scene(svg, slots) {
  const css = classes(svg), body = svg.replace(/<defs>.*?<\/defs>/s, '');
  for (const [, tag] of body.matchAll(/<([a-zA-Z]+)/g)) if (!TAGS.includes(tag)) fail(`overlap checker: unknown element <${tag}>`);
  const s = { texts: [], marks: [], margin: [], keyMarks: [], shapes: [], rows: [], strip: null, slip: null, paste: null, who: null, keyX: null, u: (css.cd?.size ?? fail('overlap checker: sheet structure changed')) / 36 };
  let phase = 'head', pend = [], grp = 0, keyN = 0, slipN = 0;
  for (const [, tag, at, txt] of body.matchAll(/<(rect|line|path|text) ([^>]*?)(?:\/>|>([^<]*)<\/text>)/g)) {
    const a = attrs(at), n = s.rows.length;
    if (tag === 'rect') {
      const x = +a.x, y = +a.y, w = +a.width, h = +a.height, half = (+a['stroke-width'] || 0) / 2, fill = ROLE[a.fill], stroke = ROLE[a.stroke];
      const shape = { q: quad(x - half, y - half, x + w + half, y + h + half), in: { x0: x + half, y0: y + half, x1: x + w - half, y1: y + h - half } };
      if (fill === 'bg' && !stroke && !a.transform) continue;                      // the background
      if (a.transform) {                                                           // the slip and its paste strip: turned together
        const turned = { ...shape, q: transform(shape.q, a.transform), rot: true };
        if (fill === 'text') { s.slip = { ...turned, name: 'the slip' }; phase = 'slip'; } else if (fill === 'minor') s.paste = { ...turned, name: 'the paste strip' }; else fail(`overlap checker: unknown rect ${at}`);
      } else if (fill === 'minor') s.strip = { ...shape, name: 'the strip' };
      else if (fill === 'bg' && stroke === 'frame') { s.who = { ...shape, name: 'the whoami box' }; phase = 'who'; } else fail(`overlap checker: unknown rect ${at}`);
    } else if (tag === 'line') {
      const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => +a[k]), half = +a['stroke-width'] / 2;
      if (ROLE[a.stroke] !== 'rule') fail(`overlap checker: unknown line ${at}`);
      s.shapes.push({ name: 'a hairline', q: quad(Math.min(x1, x2) - half, Math.min(y1, y2) - half, Math.max(x1, x2) + half, Math.max(y1, y2) + half) });
    } else if (tag === 'path') {
      const b = pathBox(a, at);
      if (phase === 'rows') {
        if (!s.strip || !n) fail('overlap checker: sheet structure changed');
        const hq = hull(b.q);
        if (b.h0.x1 <= s.strip.in.x1) s.marks.push({ ...b, row: n - 1, tall: hq.y1 - hq.y0 > 64 * s.u, name: `the mark on line ${n}` });   // in the text: a transpose is taller than a row band
        else pend.push({ ...b, row: n - 1 });
      } else if (phase === 'foot' || phase === 'key') pend.push(b); else fail(`overlap checker: unknown path ${at}`);
    } else {
      const cls = a.class, { size, ls = 0, face = 'mono', wght } = css[cls] ?? {}, kind = cls === 'ml' && phase === 'key' ? 'keyMark' : KIND[cls] ?? fail(`overlap checker: unknown text class "${cls}"`);
      if (!size) fail(`overlap checker: no font size for class "${cls}"`);
      if (cls === 'gn') { phase = 'rows'; s.rows.push({ b: +a.y, gut: null, cd: null }); }
      const r = s.rows.length, g = ++grp;
      if (kind === 'slip') slipN++;
      if (kind === 'keyName') keyN++;
      const str = unesc(txt), w = (width(face, str, wght) + len(str) * ls) * size, [up, down] = INK[face], ax = +(a.x ?? 0), y = +(a.y ?? 0);
      const k = { middle: 0.5, end: 1 }[a['text-anchor']] ?? 0, x = ax - w * k, slot = OWN.has(cls) || (kind === 'slip' && slipN === 4) ? slots.get(str) : null;
      const label = { slug: s.texts.some((t) => t.kind === 'slug') ? 'slug initials' : 'slug', headline: 'headline', gutter: `gutter ${r}`, code: `code line ${r}`, tally: 'tally',
        matter: `margin ${r} matter`, label: `margin ${r} label`, gloss: `margin ${r} gloss`, slipHead: 'slip head', slip: `slip line ${slipN}`, note: 'note', keyHead: 'key head',
        keyName: `key ${keyN} name`, keyGloss: `key ${keyN} gloss`, keyMark: `key ${keyN + 1} mark`, whoami: 'whoami line', status: 'status line', side: 'side label' }[kind];
      const t = {
        kind, str, slot: slot?.key, rot: !!a.transform, name: `${slot?.name ?? label} "${str}"`, grp: g, row: MARGIN.has(kind) ? r - 1 : undefined,
        q: transform(quad(x, y - up * size, x + w, y + down * size), a.transform),
        at: { x: ax, y, k, tr: a.transform, size, ls, face, wght, ink: INK[face], pad: 0 },
      };
      if (kind === 'label' || kind === 'keyMark' || kind === 'note') {            // circled: the ring just drawn belongs to this text
        if (pend.length !== 1) fail('overlap checker: sheet structure changed');
        const ring = { ...pend.pop(), name: kind === 'label' ? `margin ${r} ring` : kind === 'keyMark' ? `key ${keyN + 1} ring` : `${slot?.name ?? 'note'} ring`, grp: g, row: r - 1, of: t };
        t.ring = ring;
        if (kind === 'label') s.margin.push(ring); else if (kind === 'keyMark') s.keyMarks.push(ring);
      }
      for (const b of pend.splice(0)) {                                           // a symbol drawn before its text (dele loop, #, strike, caret)
        if (phase === 'rows') s.margin.push({ ...b, name: `margin ${r} mark`, grp: ++grp, row: r - 1 }); else if (phase === 'key') s.keyMarks.push({ ...b, name: `key ${keyN} mark` }); else fail('overlap checker: sheet structure changed');
      }
      if (kind === 'gutter') s.rows[r - 1].gut = t;
      if (kind === 'code') { s.rows[r - 1].cd = t; s.rows[r - 1].b = y; }
      if (kind === 'tally') phase = 'foot';
      if (kind === 'keyHead') { phase = 'key'; s.keyX = ax; }
      s.texts.push(t);
    }
  }
  if (!(s.strip && s.slip && s.paste && s.who && s.rows.length && s.rows.every((r) => r.cd && r.gut) && !pend.length)) fail('overlap checker: sheet structure changed');
  s.shapes.push(s.strip, s.slip, s.paste, s.who);
  return s;
}

const zones = (W, H, phone) => (phone
  ? [['the lock-screen clock', 0, 0, W, 932], ['the phone\'s bottom buttons', 0, H - 260, W, H]]
  : [['the menu bar', 0, 0, W, 110], ['the Dock', (W - 1300) / 2, H - 220, (W + 1300) / 2, H]]
).map(([name, ...r]) => ({ name, q: quad(...r) }));
// the margin band: from the strip's edge + 40 to the key column - 20 (phone: the canvas edge), over the strip's height
function around(s, W, H, phone) {
  const { x1, y0, y1 } = s.strip.in, band = { name: 'the margin', x0: x1 + 40, x1: s.keyX != null ? s.keyX - 20 : W, y0, y1 };
  return { W, H, phone, zs: zones(W, H, phone), canvas: { x0: 0, y0: 0, x1: W, y1: H }, band: { ...band, q: quad(band.x0, y0, band.x1, y1) }, head: s.rows[0].b - 42 * s.u };
}

// every rule one text breaks: [verb, what it hit, the editor's kind of hit]; `others` are the texts to overlap-check
function broken(s, t, others, { phone, zs, canvas, band, head }) {
  const out = [], no = (verb, b, what) => out.push([verb, b, what]), tb = hull(t.q), K = t.kind;
  for (const u of others) if (hits(t, u)) no('overlaps', u, 'text');                                                                // 1
  if (STRIP.has(K) && !within(t.q, s.strip.in)) no('does not fit inside', s.strip, 'home');                                        // 2
  if (K === 'whoami' && !within(t.q, s.who.in)) no('does not fit inside', { name: 'its box' }, 'home');
  if ((K === 'slipHead' || K === 'slip') && !within(reBox({ ...t, at: { ...t.at, tr: undefined } }, t.str).q, s.slip.in)) no('does not fit inside', s.slip, 'home');
  if (MARGIN.has(K)) {                                                                                                              // 4
    if (Math.abs(t.at.y - s.rows[t.row].b) > 1) no('is not level with', { name: `code line ${t.row + 1}` }, 'level');
    if (tb.x0 < band.x0 - TOL) no('starts left of', band, 'margin');
    if (s.keyX != null && tb.x1 > band.x1 + TOL) no('runs into', { name: 'the key column' }, 'margin');
    for (const b of s.margin) if (b.grp !== t.grp && hits(t, b)) no('overlaps', b, 'shape');
  }
  if (COVERED.has(K) && hits(t, s.slip)) no('overlaps', s.slip, 'shape');                                                           // 5
  if ((KEYS.has(K) || K === 'whoami' || K === 'side') && hits(t, band)) no('enters', band, 'margin');                              // 6
  if (K === 'note') {
    if (!within(t.q, band) || !within(t.ring.q, band)) no('leaves', band, 'margin');
    if (hull(t.ring.q).y1 > head + TOL) no('drops below', { name: 'the margin head' }, 'margin');
    for (const m of s.texts) if (MARGIN.has(m.kind) && hits(t.ring, m)) no('overlaps', m, 'text');
    for (const b of s.margin) if (hits(t.ring, b)) no('overlaps', b, 'shape');
    if (hits(t.ring, s.slip)) no('overlaps', s.slip, 'shape');
  }
  for (const e of [t, t.ring].filter(Boolean)) {                                                                                    // 7
    if (!within(e.q, canvas)) no('leaves', { name: 'the canvas' }, 'edge');
    for (const z of zs) if (hits(e, z)) no('reaches', z, 'zone');
  }
  return out;
}

// every rule broken on one sheet, as readable lines
export function collisions(s, W, H, phone) {
  const bad = [], ctx = around(s, W, H, phone), { canvas, zs, band } = ctx, say = (a, verb, b) => bad.push(`${a.name} ${verb} ${b.name ?? b}`);
  const edge = (e) => { if (!within(e.q, canvas)) say(e, 'leaves', 'the canvas'); for (const z of zs) if (hits(e, z)) say(e, 'reaches', z); };
  s.texts.forEach((t, i) => { for (const [verb, b] of broken(s, t, s.texts.slice(i + 1), ctx)) say(t, verb, b); });
  s.marks.forEach((m, i) => {                                                                                                       // 3
    const r = s.rows[m.row], last = s.rows[m.row + (m.tall ? 1 : 0)] ?? r;
    if (!within(m.q, { x0: s.strip.in.x0, x1: s.strip.in.x1, y0: r.b - 42 * s.u, y1: last.b + 22 * s.u })) say(m, 'leaves', 'its row band');
    s.rows.forEach((o, j) => { if (j !== m.row && !(m.tall && j === m.row + 1)) for (const t of [o.cd, o.gut]) if (hits(m, t)) say(m, 'overlaps', t); });
    for (const o of s.marks.slice(i + 1)) if (hits(m, o)) say(m, 'overlaps', o);
    if (hits(m, s.slip)) say(m, 'overlaps', s.slip);                                                                                // 5
    edge(m);
  });
  s.margin.forEach((b, i) => {                                                                                                      // 4
    const r = s.rows[b.row];                                                                                                        // a symbol sits in its glyph box, b − 36u to b, a ring round its label
    if (b.of ? !within(b.of.q, hull(b.q)) : !within(quad(b.h0.x0, b.h0.y0, b.h0.x1, b.h0.y1), { x0: -Infinity, x1: Infinity, y0: r.b - 36 * s.u, y1: r.b })) say(b, 'is not level with', `code line ${b.row + 1}`);
    if (b.h0.x0 < band.x0 - TOL) say(b, 'starts left of', band);
    if (s.keyX != null && hull(b.q).x1 > band.x1 + TOL) say(b, 'runs into', 'the key column');
    for (const o of s.margin.slice(i + 1)) if (o.grp !== b.grp && hits(b, o)) say(b, 'overlaps', o);
    if (hits(b, s.slip)) say(b, 'overlaps', s.slip);
    edge(b);
  });
  for (const b of s.keyMarks) { if (hits(b, band)) say(b, 'enters', band); for (const t of s.texts) if (['keyName', 'keyGloss', 'keyHead'].includes(t.kind) && hits(b, t)) say(b, 'overlaps', t); edge(b); }                                              // 6
  if (!hits(s.slip, s.strip)) say(s.slip, 'does not overlap', s.strip);                                                             // 5
  for (const c of s.shapes) edge(c);
  return bad;
}

// collisions() for one text: null when the slot has no single text of its own (the headline is two texts: phrase.0
// and phrase.1 each have one; `phrase` has none, and the full checker runs).
// Else { ok, box } or { ok: false, box, hit } naming the first rule. A note's ring grows with its text.
export function quickFits(base, key, str) {
  const { s, W, H, phone } = base, i = s.texts.findIndex((x) => x.slot === key);
  if (i < 0 || s.texts.findIndex((x, j) => j > i && x.slot === key) >= 0) return null;
  const old = s.texts[i], t = reBox(old, str);
  if (old.ring) { const r = hull(old.ring.q); t.ring = { ...old.ring, box: undefined, q: quad(r.x0, r.y0, r.x1 + hull(t.q).x1 - hull(old.q).x1, r.y1) }; }
  const tb = hull(t.q), first = broken(s, t, s.texts.filter((_, j) => j !== i), around(s, W, H, phone))[0];
  if (!first) return { ok: true, box: tb };
  const [, o, what] = first;
  return { ok: false, box: tb, hit: { what, name: o.name, slot: o.slot, box: o.q ? hull(o.q) : tb } };
}

// ---------- the slot table (series/galley-proof/README.md), one source for the test, the README and the editor

// characters per slot. data.left is also drawn on the phone, where the cap is 30.
export const LIMITS = { phrase: 18, notes: 28, 'errata.throughout': 36, 'data.left': 44, 'data.right': 44, label: 40, phone: 30, handle: 20, motto: 40 };
export const limitOf = (key) => {
  const [a, b] = key.split('.');
  return LIMITS[a === 'errata' || a === 'data' ? `${a}.${b}` : a];
};
export const get = (p, key) => key.split('.').reduce((v, k) => v?.[k], p);
// an immutable copy with one slot replaced; a status line is written for the phone too, when it has its own
export function withSlot(p, key, value) {
  const [a, b] = key.split('.'), q = { ...p };
  if (key === 'phrase') q.phrase = [...value];
  else if (a === 'data') {
    q.data = { ...p.data, [b]: value };
    if (p.phone?.data?.[b] != null) q.phone = { ...p.phone, data: { ...p.phone.data, [b]: value } };
  } else if (b == null) q[a] = value;
  else q[a] = Array.isArray(p[a]) ? p[a].map((v, i) => (i === +b ? value : v)) : { ...p[a], [b]: value };
  return q;
}
// the status line's room on the phone: the line left of the prompt, set with the longest handle, and a space between
const room = (p) => {
  const g = GEOMETRY.phone, right = { ...p.data, ...p.phone?.data }.right?.replaceAll('{handle}', 'x'.repeat(LIMITS.handle)) ?? '';
  return Math.floor((g.R - g.left) / (0.6 * g.data.size) - len(right) - 1);
};
// why a value breaks the slot table (an empty list: it doesn't). Geometry is overlaps()'s job.
export function slotRules(p, key, value) {
  const why = [], a = family(key), lines = a === 'phrase' ? value : [value];
  if (!Array.isArray(lines) || !lines.length || lines.length > (a === 'phrase' ? 2 : 1)) return ['one or two lines'];
  for (const s of lines) {
    if (typeof s !== 'string' || !s.trim()) return ['empty'];
    if (/[\u0000-\u001F\u007F-\u009F]/.test(s)) why.push('control character');
    if (s !== s.trim()) why.push('stray spaces');
    if (/[<>&]/.test(s)) why.push('<, > or &');
    const max = key === 'data.left' ? phoneCap(p, key) : a === 'data' && p.phone?.data?.[key.slice(5)] != null ? Math.min(limitOf(key), LIMITS.phone) : limitOf(key);
    if (len(s) > max) why.push(`${len(s)}/${max}`);
    if (!glyphs(a === 'phrase' ? 'nunito' : 'mono', s)) why.push('glyph');
    if (key === 'errata.throughout' && !/^for .+ read .+$/.test(s)) why.push('for X read Y');
  }
  return why;
}

// the phone's room for data.left, for the editor's counter (the other series fall back to LIMITS.phone)
export const phoneCap = (p, key) => (key === 'data.left' ? Math.min(limitOf(key), LIMITS.phone, room(p)) : undefined);

// ---------- the word editor's slots (series/galley-proof/README.md)

export const SLOTS = [
  ['phrase', 'Headline'], ['notes.0', 'Note 1'], ['notes.1', 'Note 2'], ['notes.2', 'Note 3'], ['errata.throughout', 'Errata, throughout'], ['data.left', 'Status line'], ['whoami', '# whoami'],
];
export const LABEL = Object.fromEntries(SLOTS);
// the lexicon's `galley.slots` names, per slot family (the headline uses the phrase pool)
export const GAL = { notes: 'note', errata: 'errata', data: 'status' };
export const HINTS = Object.values(GAL);
// word types offered by type when a term has no `galley` hint (an erratum needs a hint: its `as` form is `for X read Y`)
export const TYPES = { phrase: [], notes: ['quote', 'term', 'number'], errata: [], data: ['status-line'] };
// what stays fixed, and why
export const FIXED = {
  file: ['Head slug', 'names the galley and the file under review'],
  lines: ['Galley', 'is the file itself, set line for line'],
  marks: ['Marking', 'puts each fix on the one line it belongs to'],
  'errata.line': ['Errata slip', 'corrects the released file and repeats one mark'],
  key: ['Marks key', 'glosses only the marks this sheet uses'],
  tally: ['Tally', 'counts the marks'],
  label: ['Side label', 'names the volume'],
  'data.right': ['Prompt line', 'shows your handle and the volume’s side of the loop'],
};
export const fixedOf = (key) => FIXED[Object.keys(FIXED).find((k) => key?.startsWith(k))] ?? null;
export const nameOf = (key) => LABEL[key] ?? LABEL[key.split('.').slice(0, 2).join('.')] ?? LABEL[family(key)] ?? fixedOf(key)?.[0] ?? 'another label';
// the editor's "Fixed on this sheet" list: name, then what it does
export const FIXED_LIST = Object.values(FIXED).map(([name, does]) => [name, `It ${does}.`]);

// the slots this preset draws, in reading order ('whoami' is the viewer's own box)
export const slotsOf = (p) => SLOTS.map(([k]) => k).filter((k) => k === 'whoami' || get(p, k) != null);
export const lockOf = () => '';                                // no slot has a part the volume fixes

// every other string on the sheet: a word may appear once, so an edit never equals a fixed one
export function usedStrings(p, key) {
  const m = new Map(), add = (v, where) => v != null && !m.has(v) && m.set(v, where), types = [...new Set(p.marks.map((x) => x.type))];
  for (const k of slotsOf(p)) if (k !== key && k !== 'whoami') [get(p, k)].flat().forEach((v) => add(v, LABEL[k]));
  p.lines.forEach((l) => add(l.trimStart(), 'the galley'));
  p.marks.forEach((x) => [x.at, x.to, x.note, x.phone].forEach((v) => add(v, 'the proof marks')));
  ['tr', 'wf', 'stet', '?'].forEach((v) => add(v, 'the proof marks'));
  types.forEach((t) => { add(KEY[t][0], 'the marks key'); add(KEY[t][1], 'the marks key'); });
  add(KEY_HEAD, 'the marks key'); add(tally(p), 'the tally'); add(`GALLEY ${vol(p)} · ${p.file}`, 'the head slug'); add(`ERRATA · GALLEY ${vol(p)}`, 'the errata slip');
  slip(p).slice(0, 3).forEach((v) => add(v, 'the errata slip'));
  p.lines.forEach((_, i) => add(String(i + 1), 'the line numbers')); add(AUTHOR, 'the head slug');
  add(p.label, 'the side label'); add(p.data?.right, 'the prompt line');
  for (const [k, v] of Object.entries(p.phone?.data ?? {})) if (key !== `data.${k}`) add(v, 'the phone status line');
  return m;
}

// ---------- what the word editor asks of a series (app/words.js)

export const story = () => '';                          // no volume tells a story across sheets
// the words a term offers a slot, as { value, code?, meaning? }: hinted (its `as` form) or by type
export const offer = (key, t, hinted) => [{ value: hinted ? t.galley.as || t.text : t.text }];
export const kindsOf = (key) => ({ slot: GAL[family(key)], types: TYPES[family(key)] });
// withSlot, except that the shipped status line brings back its own shorter phone line
export function put(p, key, v, shipped) {
  const q = withSlot(p, key, v), b = key.slice(5);
  if (key.startsWith('data.') && v === shipped.data?.[b] && shipped.phone?.data?.[b] != null) q.phone = { ...q.phone, data: { ...q.phone?.data, [b]: shipped.phone.data[b] } };
  return q;
}
// does a value fit this slot in one format? the headline line by line, on a scene prepared with the same number of lines
export function fits(current, f, key, value, shipped, prepared) {
  if (key === 'phrase') {
    if (value.length !== current.phrase.length) return null;
    let box = null;
    for (const [i, line] of value.entries()) {
      const r = quickFits(prepared(f), `phrase.${i}`, line);
      if (!r?.ok) return r;
      box = union(box, r.box);
    }
    return { ok: true, box };
  }
  const drawn = f === 'phone' && key.startsWith('data.') ? put(current, key, value, shipped).phone?.data?.[key.slice(5)] ?? value : value;
  return quickFits(prepared(f), key, drawn);
}
// a failed fit in the interface's words (h: the hit of quickFits, or { what: 'full', name } from the full checker)
export function why(h) {
  const zone = h.what === 'full' && h.name.match(/ (?:reaches|leaves) (the .+)$/)?.[1], home = h.what === 'full' && h.name.match(/does not fit inside (the .+|its box)$/)?.[1];
  return h.what === 'text' ? `runs into ${h.slot ? nameOf(h.slot) : h.name}`
    : h.what === 'shape' ? `runs into ${h.name}` : h.what === 'zone' || zone ? `reaches ${zone || h.name}` : h.what === 'edge' ? `crosses ${h.name}`
    : h.what === 'home' || home ? `is too wide for ${home || h.name}`
    : h.what === 'margin' || /(?:enters|leaves|starts left of|runs into) the (?:margin|key column)|drops below the margin head/.test(h.name) ? 'leaves the margin'
    : h.what === 'level' || /is not level with/.test(h.name) ? 'is not level with its line' : /overlaps the slip/.test(h.name) ? 'runs into the slip' : 'collides with another mark';
}
// the word a change replaced, for the note about where it lives on (the headline: none)
export const oldWord = (p, key) => (key === 'phrase' ? '' : String(get(p, key)).trim());
// where else on the sheet a word appears, by name
export function elsewhere(p, key, re) {
  const where = new Set(), has = (v) => v != null && re.test(v);
  for (const k of slotsOf(p)) if (k !== key && k !== 'whoami' && [get(p, k)].flat().some(has)) where.add(LABEL[k]);
  if (p.lines.some(has)) where.add('the galley');
  if (p.marks.some((x) => [x.at, x.to, x.note, x.phone].some(has))) where.add('the proof marks');
  if (slip(p).slice(0, 3).some(has)) where.add('the errata slip');
  if (has(p.label)) where.add('the side label');
  return [...where];
}

// ---------- the studio: geometry, copy and the "Read the galley" key

// the series' words in the studio: the "Read the …" section (mark: the key line shown first)
export const READ = {
  nav: 'Read the galley', title: 'Read the galley.', mark: 'marks', legendHead: ['', 'On the sheet', 'In the review'],
  who: 'Your handle goes in the whoami box and in the prompt under the sheet; your line follows it.',
  intro: 'A galley proof marked by a proofreader, read as a security review. Pick a line from the key to find its mark on the sheet.',
};
// the volume's line under its name: the headline, in quotes
export const lineOf = (p) => p.phrase.join(' ');
// a parsed preset file the studio can draw (the strip skips the ones that aren't)
export const valid = (p) => Array.isArray(p?.phrase) && typeof p.file === 'string' && Array.isArray(p.lines) && Array.isArray(p.marks) && !!p.errata && typeof p.errata === 'object'
  && Array.isArray(p.notes) && typeof p.label === 'string' && !!p.data && typeof p.data === 'object';
// the tags under the sheet's title: the slip's repeated correction, then the first query's note
export const chipsOf = (p, colors) => {
  const q = p.marks.find((m) => m.type === 'query');
  return [{ text: slip(p)[1], color: colors.chip1 }, ...(q ? [{ text: q.note, color: colors.chip2 }] : [])];
};
export const swatch = () => null;
// the editor's zoom: U is the margin around a slot in sheet px, px(key, fmt) the drawn text size (both from GEOMETRY)
export const GEOM = {
  U: (fmt) => GEOMETRY[fmt].code.pitch,
  px(key, fmt) {
    const g = GEOMETRY[fmt];
    return { phrase: g.hl.size, notes: g.notes?.size ?? g.data.size, errata: g.slip.body, whoami: g.who.size }[family(key)] ?? g.data.size;
  },
};
// the texts of a slot (the headline's lines are phrase.0 and phrase.1)
const textsOf = (s, ...kinds) => s.texts.filter((t) => kinds.includes(t.kind));
const slotOf = (s, key) => s.texts.filter((t) => t.slot === key || t.slot?.startsWith(`${key}.`));
// one box per slot as quads: its text plus the mark it belongs to, in sheet px (s: the prepared scene). A fixed key's box is what it covers.
export function slotQuads(s, p, key) {
  const q = (list) => list.flatMap((x) => [x.q, x.ring?.q].filter(Boolean));
  if (key === 'whoami') return [s.who.q];
  if (key.startsWith('notes.')) return q(slotOf(s, key));
  if (key === 'file') return q(textsOf(s, 'slug'));
  if (key === 'lines') return [s.strip.q];
  if (key === 'marks') return [...s.marks, ...s.margin, ...textsOf(s, ...MARGIN)].map((x) => x.q);
  if (key === 'errata.line') return [s.slip.q];
  if (key === 'key') return [...q(textsOf(s, 'keyHead', 'keyName', 'keyGloss', 'keyMark')), ...s.keyMarks.map((b) => b.q)];
  if (key === 'tally') return q(textsOf(s, 'tally'));
  return q(slotOf(s, key));
}

// the key's icons: 24×24 strokes, one per mark
export const GLYPH = {
  galley: '<rect x="6" y="3" width="12" height="18"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  slug: '<path d="M4 8h10M17 8h3M4 13h16"/>',
  gutter: '<path d="M4 7h2M4 12h2M4 17h2M10 7h10M10 12h8M10 17h6"/>',
  headline: '<path d="M4 8h16M4 15h9" stroke-width="2.5"/>',
  marks: '<path d="M2 17h10c5 0 7-4 5-7s-6.5-1.5-5.5 2 6 4 9.5 0"/>',
  margin: '<path d="M5 4v16"/><path d="M9 8h10M9 12h7M9 16h9"/>',
  key: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M8 9h3M13 9h4M8 13h3M13 13h4M8 17h3M13 17h4"/>',
  errata: '<path d="M5 7 19 5v11L5 18z"/><path d="M8 10l8-1M8 14l6-1"/>',
  tally: '<path d="M5 7v10M9 7v10M13 7v10M17 7v10M3 15 19 9"/>',
  notes: '<rect x="3" y="7" width="18" height="10" rx="5"/><path d="M8 12h8"/>',
  whoami: '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M7 10h3M7 13h10"/>',
  side: '<path d="M9 4v16M13 18V9M17 18v-6"/>',
  status: '<path d="M3 17h8M14 17h7M3 6h18"/>',
};

// read the galley: the desktop sheet's boxes, from the prepared scene
export function marks(p, handle) {
  const { w: W, h: H } = FORMATS.desktop, s = scene(render({ preset: p, colors: PROBE, format: 'desktop', handle, motto: '', fonts: null }), slotNames(p, 'desktop', handle));
  const the = (list, k = 18) => {
    const b = hull(list.flatMap((x) => [x.q, x.ring?.q].filter(Boolean)).flat());
    return { x0: Math.max(0, b.x0 - k), y0: Math.max(0, b.y0 - k), x1: Math.min(W, b.x1 + k), y1: Math.min(H, b.y1 + k) };
  };
  const R = (b) => `<rect class="mk" x="${Math.round(b.x0)}" y="${Math.round(b.y0)}" width="${Math.round(b.x1 - b.x0)}" height="${Math.round(b.y1 - b.y0)}" rx="10"/>`;
  const above = (b) => [Math.round((b.x0 + b.x1) / 2), Math.max(60, Math.round(b.y0 - 46))], below = (b) => [Math.round((b.x0 + b.x1) / 2), Math.min(H - 60, Math.round(b.y1 + 46))];
  const sub = p.marks.find((m) => m.line === p.errata.line && m.type === 'sub'), nn = vol(p), N = (k) => textsOf(s, k);
  const strip = the([s.strip], 6), slug = the(N('slug')), gut = the(N('gutter'), 10), hl = the(N('headline')), key = the([...N('keyHead'), ...N('keyName'), ...N('keyGloss'), ...N('keyMark'), ...s.keyMarks]);
  const rows = s.rows.map((_, i) => [...textsOf(s, ...MARGIN).filter((t) => t.row === i), ...s.margin.filter((b) => b.row === i)]).filter((l) => l.length).map((l) => the(l, 12));
  const ins = s.marks.map((m) => the([m], 10)), notes = N('note').map((t) => the([t])), who = the([s.who], 6), side = the(N('side')), tal = the(N('tally'));
  const left = the(N('status').filter((t) => t.slot === 'data.left')), right = the(N('status').filter((t) => t.slot === 'data.right')), slp = the([s.slip], 6);
  return [
    { id: 'galley', term: 'The galley strip', mean: `The file under review, ${p.file}, set line for line as the printer pulled it.`, svg: R(strip), pin: above(strip) },
    { id: 'slug', term: 'Head slug and initials', mean: `The review’s number and file, GALLEY ${nn} · ${p.file}, initialled by the proofreader.`, svg: R(slug), pin: above(slug) },
    { id: 'gutter', term: 'Line numbers in the gutter', mean: 'Exact locations: every finding points at one line.', svg: R(gut), pin: above(gut) },
    { id: 'headline', term: 'The headline', mean: `The principle the review enforces: “${p.phrase.join(' ')}”`, svg: R(hl), pin: above(hl) },
    { id: 'marks', term: 'Proof marks in the text', mean: 'Each finding marked where it sits: struck out, ringed, or a caret where something is missing.', svg: ins.map(R).join(''), pin: above(ins[0] ?? strip) },
    { id: 'margin', term: 'The margin, level with each line', mean: 'What to do about each finding, in the proofreader’s own hand.', svg: rows.map(R).join(''), pin: above(rows[0] ?? strip) },
    { id: 'key', term: 'The marks key', mean: 'The marks this sheet uses, from the Chicago Manual of Style, each with the weakness it stands for.', svg: R(key), pin: above(key) },
    { id: 'errata', term: 'The errata slip, tipped in', mean: `The advisory: on line ${p.errata.line}, for ${sub?.at} read ${sub?.to}; and one correction that holds throughout.`, svg: R(slp), pin: above(slp) },
    { id: 'tally', term: 'The tally at the foot', mean: `The review in numbers: ${tally(p)}.`, svg: R(tal), pin: below(tal) },
    { id: 'notes', term: 'Circled notes', mean: 'Remarks to the author that belong to no single line.', svg: notes.map(R).join(''), pin: above(notes[0] ?? who) },
    { id: 'whoami', term: 'The proofreader’s box', mean: 'Your handle and your line, in the # whoami box.', svg: R(who), pin: above(who) },
    { id: 'side', term: 'The vertical side label', mean: `The series and volume index, fixed: ${p.label}.`, svg: R(side), pin: [Math.round(side.x0 - 260), Math.round((side.y0 + side.y1) / 2)] },
    { id: 'status', term: 'Lines under the sheet', mean: `A status line (${p.data.left}) and your prompt.`, svg: R(left) + R(right), pin: [Math.round(W / 2), Math.min(H - 50, Math.round(left.y1 + 46))] },
  ];
}
