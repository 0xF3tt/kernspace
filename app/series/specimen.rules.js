// Specimen's rules: the overlap checker's scene and collisions, the slot table and the word editor's slot pieces.
// app/series/index.js registers them with the renderer. The studio's own pieces (marks, geometry, swatches, copy) close the file.
// The checker rebuilds, from a rendered sheet, a box for every text and every shape a text could touch (grid
// cells, the .notdef cell and its tofu box, the matrix, the whoami box), then checks, for one preset in one format:
//   1. no two texts overlap
//   2. charset glyphs and codes sit inside their cell, the .notdef label inside the .notdef cell, the whoami lines
//      inside their box, the matrix numbers inside the matrix
//   3. no text touches a cell, the tofu box, the matrix or the whoami box that is not its own
//   4. the left column (hero, family, class, waterfall labels, notes) stays left of the clip hairline; on desktop
//      and wide the right column (grid, confusables, matrix, test, whoami, side label) stays right of it
//   5. the waterfall: a line is clipped at the hairline, so its box stops there; the smallest line must show the
//      whole phrase, the largest must be cut (else the waterfall says nothing), and each label ends before its text
//   6. everything stays on the canvas and out of the keep-clear zones: desktop and wide the menu bar (top 110px)
//      and the Dock (1300x220, bottom centre); phone the clock (y < 932) and the bottom 260px
// Boxes, tolerance and colors: app/boxes.js.
import { FORMATS, HANDLE } from '../render.js';
import { GEOMETRY, heroSize, render } from './specimen.js';
import { INK, PROBE, ROLE, TOL, attrs, classes, fail, family, glyphs, hits, hull, len, quad, reBox, transform, unesc, union, width, within } from '../boxes.js';

const drawnRight = (s, handle) => s?.replaceAll('{handle}', handle || HANDLE);
// [pt, role index] per waterfall line; the phone drops one role
const lines = (g) => g.wf.sizes.map((size, i) => [size, i + (g.wf.drop && i >= g.wf.drop ? 1 : 0)]);
// the hero's ink: capitals and digits (Q's tail apart) sit on the baseline at 0.705-0.713 em in the font's own
// bounds; anything else may rise to an ascender or fall to a descender, and boxes like the widest ink of Nunito
const heroInk = (s) => (/^[A-PR-Z0-9]*$/.test(s) ? [0.73, 0.03] : INK.nunito);

// drawn string -> { key, name }: which preset field it comes from. key is the editor's slot id (a confusable's two
// parts are confusables.<i>.0 and .1); name reads well in a message. Editable slots come first, so they win a tie.
export function slotNames(p, fmt, handle = '') {
  const g = GEOMETRY[fmt], m = new Map(), put = (s, key, name = key) => s != null && !m.has(s) && m.set(s, { key, name });
  for (const k of ['hero', 'family', 'class', 'notdef', 'test']) put(p[k], k);
  put(p.waterfall.phrase, 'waterfall.phrase');
  p.confusables?.forEach(([t, c], i) => { put(t, `confusables.${i}.0`, `confusables[${i}] text`); put(c, `confusables.${i}.1`, `confusables[${i}] code`); });
  put(p.matrix.rating, 'matrix.rating');
  p.notes?.forEach((s, i) => put(s, `notes.${i}`, `notes[${i}]`));
  const data = fmt === 'phone' ? { ...p.data, ...p.phone?.data } : { ...p.data };
  for (const [k, s] of Object.entries(data)) put(k === 'right' ? drawnRight(s, handle) : s, `data.${k}`, `status line ${k}`);
  put(p.label, 'label', 'side label');
  lines(g).forEach(([size, r]) => put(`${size} pt · ${p.waterfall.roles[r]}`, `waterfall.roles.${r}`, `waterfall.roles[${r}]`));
  put(`${p.matrix.axes[0]} × ${p.matrix.axes[1]}`, 'matrix.axes');
  p.charset.slice(0, g.chars).forEach(({ glyph, code }, i) => { put(glyph, `charset.${i}.glyph`, `charset[${i}] glyph`); put(code, `charset.${i}.code`, `charset[${i}] code`); });
  return m;
}

const KIND = { h: 'hero', fn: 'family', cl: 'class', lb: 'label', wf: 'wf', nt: 'note', g: 'glyph', cf: 'conf', mc: 'axes', mx: 'digit', rt: 'rating', ts: 'test', k: 'whoami', d: 'status', vl: 'side' };
const NAME = { hero: 'hero', family: 'family', class: 'class', label: 'waterfall label', wf: 'waterfall text', note: 'note', glyph: 'charset glyph', code: 'charset code',
  notdef: 'notdef', conf: 'confusable', axes: 'matrix axes', digit: 'matrix number', rating: 'rating', test: 'test', whoami: 'whoami line', status: 'status line', side: 'side label' };
const LEFT = new Set(['hero', 'family', 'class', 'label', 'note']);
const RIGHT = new Set(['glyph', 'code', 'notdef', 'conf', 'axes', 'digit', 'rating', 'test', 'whoami', 'side']);
const CLIP = { name: 'the clip hairline' };

// every text and shape of one rendered sheet, as named quads. A waterfall text's box stops at the hairline (the
// browser clips it there); `full` keeps how far the unclipped line runs.
export function scene(svg, slots) {
  const css = classes(svg), body = svg.replace(/<defs>.*?<\/defs>/s, '');
  const s = { texts: [], cells: [], shapes: [], clip: 0 };
  const hair = [...body.matchAll(/<line ([^>]*?)\/>/g)].map((m) => attrs(m[1])).find((a) => ROLE[a.stroke] === 'major');
  s.clip = +hair?.x1;
  const tb = [];
  let matrix, who;
  for (const [, at] of body.matchAll(/<rect ([^>]*?)\/>/g)) {
    const a = attrs(at);
    if (a.x == null) continue;                          // the background
    const x = +a.x, y = +a.y, w = +a.width, h = +a.height, half = (+a['stroke-width'] || 0) / 2, stroke = ROLE[a.stroke];
    const shape = { q: quad(x - half, y - half, x + w + half, y + h + half), in: { x0: x + half, y0: y + half, x1: x + w - half, y1: y + h - half } };
    if (stroke === 'major' && !tb.length) s.cells.push({ ...shape, name: `charset cell ${s.cells.length + 1}`, of: 'its cell', grp: 'grid' });
    else if (stroke === 'major') continue;              // a matrix cell, inside the matrix outline
    else if (stroke === 'tb') tb.push(shape);
    else if (stroke === 'frame') (ROLE[a.fill] === 'bg' ? (who = { ...shape, name: 'the whoami box', of: 'its box', grp: 'who' }) : (matrix = { ...shape, name: 'the matrix', of: 'the matrix', grp: 'matrix' }));
    else fail(`overlap checker: unknown rect ${at}`);
  }
  if (!(s.clip && s.cells.length >= 11 && tb.length === 2 && who)) fail('overlap checker: sheet structure changed');
  const notdef = { ...tb[0], name: 'the .notdef cell', of: 'its cell', grp: 'grid' }, tofu = { ...tb[1], name: 'the tofu box', grp: 'grid' };
  s.shapes = [...s.cells, notdef, tofu, ...(matrix ? [matrix] : []), who];
  let wf = 0;
  for (const [, at, body_] of body.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)) {
    const a = attrs(at), cs = a.class.split(' '), ax = +(a.x ?? 0), y = +(a.y ?? 0);
    const { size, ls = 0, face = 'mono', wght } = Object.assign({}, ...cs.map((k) => css[k]));
    if (!size) fail(`overlap checker: no font size for class "${a.class}"`);
    const cell = s.cells.find((c) => ax >= c.in.x0 && ax <= c.in.x1 && y >= c.in.y0 && y <= c.in.y1);
    const kind = cs[0] === 'cp' ? (ROLE[a.fill] === 'tb' ? 'notdef' : cell ? 'code' : 'conf') : KIND[cs[0]] ?? fail(`overlap checker: unknown text class "${a.class}"`);
    if ((kind === 'glyph' || kind === 'code') && !cell) fail('overlap checker: sheet structure changed');
    const str = unesc(body_), w = (width(face, str, wght) + len(str) * ls) * size, [up, down] = kind === 'hero' ? heroInk(str) : INK[face];
    const k = { middle: 0.5, end: 1 }[a['text-anchor']] ?? 0, x = ax - w * k, slot = kind === 'digit' || kind === 'whoami' ? null : slots.get(str);
    const t = {
      kind, str, slot: slot?.key, rot: !!a.transform, full: x + w,
      name: `${kind === 'wf' ? `waterfall line ${wf + 1} (${size} pt)` : slot?.name ?? NAME[kind]} "${str}"`,
      home: { glyph: cell, code: cell, notdef, digit: matrix, whoami: who }[kind],
      q: transform(quad(x, y - up * size, kind === 'wf' ? Math.min(x + w, s.clip) : x + w, y + down * size), a.transform),
      at: { x: ax, y, k, tr: a.transform, size, ls, face, wght, ink: INK[face], inkOf: kind === 'hero' ? heroInk : undefined, pad: 0 },
    };
    if (kind === 'wf') {
      t.wf = { i: wf++ };
      const prev = s.texts.at(-1);
      if (prev?.kind === 'label' && prev.at.y === y) prev.before = ax;   // an inline label ends before its text starts
    }
    s.texts.push(t);
  }
  for (const t of s.texts) if (t.wf) t.wf.n = wf;
  return s;
}

const zones = (W, H, phone) => (phone
  ? [['the lock-screen clock', 0, 0, W, 932], ['the phone\'s bottom buttons', 0, H - 260, W, H]]
  : [['the menu bar', 0, 0, W, 110], ['the Dock', (W - 1300) / 2, H - 220, (W + 1300) / 2, H]]
).map(([name, ...r]) => ({ name, q: quad(...r) }));
const around = (W, H, phone) => ({ W, H, phone, zs: zones(W, H, phone), canvas: { x0: 0, y0: 0, x1: W, y1: H } });

// every rule one text breaks: [verb, what it hit, the editor's kind of hit]; `others` are the texts to overlap-check
function broken(s, t, others, { phone, zs, canvas }) {
  const out = [], no = (verb, b, what) => out.push([verb, b, what]), tb = hull(t.q);
  for (const u of others) if (hits(t, u)) no('overlaps', u, 'text');                                                   // 1
  if (t.home && !within(t.q, t.home.in)) no('does not fit inside', { name: t.home.of }, 'home');                       // 2
  for (const c of s.shapes) if (c !== t.home && hits(t, c)) no('overlaps', c, 'shape');                               // 3
  if (LEFT.has(t.kind) && tb.x1 > s.clip + TOL) no('crosses', CLIP, 'clip');                                          // 4
  if (!phone && RIGHT.has(t.kind) && tb.x0 < s.clip - TOL) no('crosses', CLIP, 'clip');
  if (t.before != null && tb.x1 > t.before + TOL) no('ends after', { name: 'the start of its waterfall text', slot: 'waterfall.phrase' }, 'text');   // 5
  if (t.wf && t.wf.i === t.wf.n - 1 && t.full > s.clip + TOL) no('is cut by', CLIP, 'cut');
  if (t.wf && t.wf.i === 0 && t.full <= s.clip + TOL) no('is not cut by', CLIP, 'whole');
  if (!within(t.q, canvas)) no('leaves', { name: 'the canvas' }, 'edge');                                            // 6
  for (const z of zs) if (hits(t, z)) no('reaches', z, 'zone');
  return out;
}

// every rule broken on one sheet, as readable lines
export function collisions(s, W, H, phone) {
  const bad = [], ctx = around(W, H, phone);
  s.texts.forEach((t, i) => { for (const [verb, b] of broken(s, t, s.texts.slice(i + 1), ctx)) bad.push(`${t.name} ${verb} ${b.name}`); });
  s.shapes.forEach((c, i) => {
    if (!within(c.q, ctx.canvas)) bad.push(`${c.name} leaves the canvas`);
    for (const z of ctx.zs) if (hits(c, z)) bad.push(`${c.name} reaches ${z.name}`);
    for (const d of s.shapes.slice(i + 1)) if (c.grp !== d.grp && hits(c, d)) bad.push(`${c.name} overlaps ${d.name}`);
  });
  return bad;
}

// collisions() for one text: null when the slot has no single text of its own (the waterfall phrase is drawn
// once per line) or its size follows the word (the hero is sized to its width): let the caller run overlaps().
// Else { ok, box } or { ok: false, box, hit } naming the first rule
export function quickFits(base, key, str) {
  const { s, W, H, phone } = base, i = s.texts.findIndex((x) => x.slot === key);
  if (key === 'hero' || i < 0 || s.texts.findIndex((x, j) => j > i && x.slot === key) >= 0) return null;
  const t = reBox(s.texts[i], str), tb = hull(t.q), first = broken(s, t, s.texts.filter((_, j) => j !== i), around(W, H, phone))[0];
  if (!first) return { ok: true, box: tb };
  const [, o, what] = first;
  return { ok: false, box: tb, hit: { what, name: o.name, slot: o.slot, box: o.q ? hull(o.q) : tb } };
}

// ---------- the slot table (series/specimen/README.md), one source for the test, the README and the editor

// characters per slot; a confusable is [text, code]. data.left is also drawn on the phone, where the cap is 30.
export const LIMITS = {
  hero: 4, family: 24, class: 36, 'waterfall.phrase': 64, notdef: 18, confusables: [12, 10], 'matrix.rating': 24, test: 44,
  notes: 28, 'data.left': 44, 'data.right': 44, phone: 30, handle: 20, motto: 40,
};
export const limitOf = (key, part = 0) => {
  const [a, b] = key.split('.');
  return a === 'confusables' ? LIMITS.confusables[part] : LIMITS[a === 'waterfall' || a === 'matrix' || a === 'data' ? `${a}.${b}` : a];
};
export const get = (p, key) => key.split('.').reduce((v, k) => v?.[k], p);
// an immutable copy with one slot replaced; a status line is written for the phone too, when it has its own
export function withSlot(p, key, value) {
  const [a, b] = key.split('.'), q = { ...p };
  if (a === 'data') {
    q.data = { ...p.data, [b]: value };
    if (p.phone?.data?.[b] != null) q.phone = { ...p.phone, data: { ...p.phone.data, [b]: value } };
  } else if (b == null) q[a] = value;
  else q[a] = Array.isArray(p[a]) ? p[a].map((v, i) => (i === +b ? value : v)) : { ...p[a], [b]: value };
  return q;
}
// why a value breaks the slot table (an empty list: it doesn't). Geometry is overlaps()'s job.
export function slotRules(p, key, value) {
  const why = [], a = family(key), pair = a === 'confusables', face = ['hero', 'family', 'waterfall'].includes(a) ? 'nunito' : 'mono';
  if (pair && !(Array.isArray(value) && value.length === 2)) return ['text and code'];
  for (const [i, s] of (pair ? value : [value]).entries()) {
    if (typeof s !== 'string' || !s.trim()) return ['empty'];
    if (/[\u0000-\u001F\u007F-\u009F]/.test(s)) why.push('control character');
    if (s !== s.trim()) why.push('stray spaces');
    if (a === 'hero' && /\s/.test(s)) why.push('spaces');
    const max = a === 'data' && p.phone?.data?.[key.slice(5)] != null ? Math.min(limitOf(key, i), LIMITS.phone) : limitOf(key, i);
    if (len(s) > max) why.push(`${len(s)}/${max}`);
    if (!glyphs(face, s)) why.push('glyph');
  }
  if (key === 'matrix.rating' && !value.startsWith(p.matrix.cell.join(''))) why.push('rating prefix');
  return why;
}

// ---------- the word editor's slots (series/specimen/README.md)

export const SLOTS = [
  ['hero', 'Hero glyph'], ['family', 'Family name'], ['class', 'Classification'], ['waterfall.phrase', 'Waterfall phrase'], ['notdef', '.notdef label'],
  ['confusables.0', 'Confusable 1'], ['confusables.1', 'Confusable 2'], ['matrix.rating', 'Risk rating'], ['test', 'Test line'],
  ['notes.0', 'Note 1'], ['notes.1', 'Note 2'], ['notes.2', 'Note 3'], ['data.left', 'Status line'], ['whoami', '# whoami'],
];
export const LABEL = Object.fromEntries(SLOTS);
// the lexicon's `spec.slots` names, per slot family
export const SPEC = { hero: 'hero', family: 'family', class: 'class', waterfall: 'phrase', notdef: 'notdef', confusables: 'confusable', matrix: 'rating', test: 'test', notes: 'note', data: 'status' };
export const HINTS = Object.values(SPEC);
// word types offered by type when a term has no `spec` hint (a hero and a confusable pair need a hint)
export const TYPES = { hero: [], family: ['term', 'tool', 'artifact'], class: ['term', 'framework'], waterfall: [], notdef: ['status-line'], confusables: [], matrix: [], test: ['snippet'], notes: ['quote', 'term', 'number'], data: ['status-line'] };
// what stays fixed, and why
export const FIXED = {
  charset: ['Character set', 'holds the domain’s canonical vocabulary and IDs'],
  'waterfall.roles': ['Waterfall role list', 'names the principals, from least to most privileged'],
  'matrix.axes': ['Risk matrix', 'scores impact by likelihood, and its filled cell is the rating'],
  label: ['Side label', 'names the volume'],
  'data.right': ['Prompt line', 'shows your handle and the volume’s side of the loop'],
};
export const fixedOf = (key) => FIXED[Object.keys(FIXED).find((k) => key?.startsWith(k))] ?? null;
export const nameOf = (key) => LABEL[key] ?? LABEL[key.split('.').slice(0, 2).join('.')] ?? LABEL[family(key)] ?? fixedOf(key)?.[0] ?? 'another label';
// the editor's "Fixed on this sheet" list: name, then what it does
export const FIXED_LIST = Object.values(FIXED).map(([name, does]) => [name, `It ${does}.`]);

// the slots this preset draws, in reading order ('whoami' is the viewer's own box)
export const slotsOf = (p) => SLOTS.map(([k]) => k).filter((k) => k === 'whoami' || get(p, k) != null);

// the part of a slot the volume fixes: the rating starts with the filled cell ("42 · ")
export function lockOf(key, shipped) {
  const d = `${shipped.matrix.cell.join('')} · `;
  return key === 'matrix.rating' && get(shipped, key).startsWith(d) ? d : '';
}

// every other string on the sheet: the checker maps texts by string, so a word may appear once
export function usedStrings(p, key) {
  const m = new Map(), add = (v, where) => v != null && !m.has(v) && m.set(v, where);
  for (const k of slotsOf(p)) if (k !== key && k !== 'whoami') [get(p, k)].flat().forEach((v) => add(v, LABEL[k]));
  add(p.label, 'the side label');
  p.charset.forEach(({ glyph, code }) => { add(glyph, 'the character set'); add(code, 'the character set'); });
  for (const [k, v] of Object.entries(p.phone?.data ?? {})) if (key !== `data.${k}`) add(v, 'the phone status line');
  return m;
}

// ---------- what the word editor asks of a series (app/words.js)

export const story = () => '';                          // no volume tells a story across sheets
// the words a term offers a slot, as { value, code?, meaning? }: hinted (its `as` form) or by type
export function offer(key, t, hinted, shipped) {
  const text = lockOf(key, shipped) + (hinted ? t.spec.as || t.text : t.text);
  return [family(key) === 'confusables' ? { value: [hinted ? t.spec.as || t.text : t.text, t.code], code: '' } : { value: text }];
}
export const kindsOf = (key) => ({ slot: SPEC[family(key)], types: TYPES[family(key)] });
// withSlot, except that the shipped status line brings back its own shorter phone line
export function put(p, key, v, shipped) {
  const q = withSlot(p, key, v), b = key.slice(5);
  if (key.startsWith('data.') && v === shipped.data?.[b] && shipped.phone?.data?.[b] != null) q.phone = { ...q.phone, data: { ...q.phone?.data, [b]: shipped.phone.data[b] } };
  return q;
}
// does a value fit this slot in one format? a confusable is two texts; the waterfall phrase is drawn once per line (null)
export function fits(current, f, key, value, shipped, prepared) {
  if (family(key) === 'confusables') {
    let box = null;
    for (const j of [0, 1]) {
      const r = quickFits(prepared(f), `${key}.${j}`, value[j]);
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
  const zone = h.what === 'full' && h.name.match(/ (?:reaches|leaves) (the .+)$/)?.[1];
  return h.what === 'text' ? `runs into ${h.slot ? nameOf(h.slot) : h.name}`
    : h.what === 'shape' ? `runs into ${h.name}` : h.what === 'zone' || zone ? `reaches ${zone || h.name}` : h.what === 'edge' ? `crosses ${h.name}`
    : h.what === 'home' || /does not fit inside/.test(h.name) ? `is too wide for ${h.what === 'home' ? h.name : 'its cell'}`
    : h.what === 'clip' || /crosses the clip hairline/.test(h.name) ? 'crosses the waterfall hairline'
    : h.what === 'cut' || /is cut by/.test(h.name) ? 'is too long: the smallest waterfall line is cut off'
    : h.what === 'whole' || /is not cut by/.test(h.name) ? 'is too short: the largest waterfall line is not cut off' : 'collides with another mark';
}
// the word a change replaced, for the note about where it lives on (a pair or the phrase: none)
export const oldWord = (p, key, shipped) => (family(key) === 'confusables' || key === 'waterfall.phrase' ? '' : String(get(p, key)).slice(lockOf(key, shipped).length).trim());
// where else on the sheet a word appears, by name
export function elsewhere(p, key, re) {
  const where = new Set();
  for (const k of slotsOf(p)) if (k !== key && k !== 'whoami' && [get(p, k)].flat().some((v) => re.test(v))) where.add(LABEL[k]);
  if (p.charset.some(({ glyph, code }) => re.test(glyph) || re.test(code))) where.add('the character set');
  return [...where];
}

// ---------- the studio: geometry, swatches, copy and the "Read the specimen" key

// the series' words in the studio: the "Read the …" section (mark: the key line shown first)
export const READ = {
  who: 'Your handle goes in the whoami box and in the prompt under the sheet; your line follows it.',
  nav: 'Read the specimen', title: 'Read the specimen.', mark: 'waterfall', legendHead: ['', 'On the sheet', 'In the threat model'],
  intro: 'A foundry\'s type specimen sheet, printed as a threat model. Pick a line from the key to find its mark on the sheet.',
};
// the volume's line under its name: the waterfall's sentence, in quotes
export const lineOf = (p) => p.waterfall.phrase;
// a parsed preset file the studio can draw (the strip skips the ones that aren't)
export const valid = (p) => typeof p?.hero === 'string' && Array.isArray(p.waterfall?.roles) && typeof p.waterfall.phrase === 'string' && Array.isArray(p.charset)
  && Array.isArray(p.confusables) && Array.isArray(p.matrix?.axes) && Array.isArray(p.matrix.cell) && Array.isArray(p.notes) && typeof p.label === 'string' && !!p.data;
// the tags under the sheet's title: the accent's one unhandled case, then the filled cell's rating
export const chipsOf = (p, colors) => [{ text: p.notdef, color: colors.tb }, { text: p.matrix.rating, color: colors.chip1 }];
// the rail's swatch for a slot (the same two marks), or null
export const swatch = (key, colors) => (key === 'notdef' ? { cls: 'q', color: colors.tb } : key === 'matrix.rating' ? { cls: 'q', color: colors.chip1 } : null);
// the editor's zoom: U is the margin around a slot in sheet px, px(key, fmt) the drawn text size (both from GEOMETRY)
export const GEOM = {
  U: (fmt) => Math.round(GEOMETRY[fmt].grid.ch * (fmt === 'phone' ? .5 : .4)),
  px(key, fmt) {
    const g = GEOMETRY[fmt];
    return { hero: heroSize('WWWW', g.clip - g.hero.x - 40), family: g.fam.size, class: g.cls.size, waterfall: g.wf.sizes.at(-1), notdef: g.grid.code,
      confusables: g.conf.size, matrix: g.mat?.rate ?? g.rate.size, test: g.test?.size, notes: g.note?.size, whoami: g.who.size }[family(key)] ?? g.data.size;
  },
};
// the texts of a slot (a slot may draw several: the waterfall phrase once per line, a confusable's text and code)
const textsOf = (s, key) => s.texts.filter((t) => t.slot === key || t.slot?.startsWith(`${key}.`));
const shape = (s, name) => s.shapes.filter((c) => c.name === name);
// one box per slot as quads: its text plus the shape it belongs to, in sheet px (s: the prepared scene)
export function slotQuads(s, p, key) {
  const own = textsOf(s, key).map((t) => t.q);
  if (key === 'notdef') return [...own, ...shape(s, 'the .notdef cell').map((c) => c.q)];
  if (key === 'matrix.rating' || key === 'matrix.axes') return [...own, ...shape(s, 'the matrix').map((c) => c.q)];
  if (key === 'whoami') return shape(s, 'the whoami box').map((c) => c.q);
  return key === 'charset' ? s.cells.map((c) => c.q) : own;
}

// the key's icons: 24×24 strokes, one per mark
export const GLYPH = {
  hero: '<path d="M5 19 12 5l7 14M8 14h8"/>',
  family: '<path d="M4 8h16M4 13h10M4 17h6"/>',
  waterfall: '<path d="M3 5h14M3 9h11M3 13h8M3 17h5"/><path d="M19 3v18" stroke-dasharray="2 2.4"/>',
  charset: '<rect x="4" y="4" width="16" height="16"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>',
  notdef: '<rect x="5" y="4" width="14" height="16" stroke-dasharray="3 2"/><rect x="9" y="8" width="6" height="8"/>',
  confusables: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
  matrix: '<rect x="4" y="4" width="16" height="16"/><path d="M8 4v16M12 4v16M16 4v16M4 8h16M4 12h16M4 16h16"/><rect x="12" y="8" width="4" height="4" fill="currentColor"/>',
  test: '<path d="M4 12h9"/><path d="m15 12 2 2 4-5"/>',
  notes: '<path d="M5 6v4M8 8h12M5 14v4M8 16h9"/>',
  whoami: '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M7 10h3M7 13h10"/>',
  side: '<path d="M9 4v16M13 18V9M17 18v-6"/>',
  status: '<path d="M3 17h8M14 17h7M3 6h18"/>',
};

// read the specimen: the desktop sheet's boxes, from the prepared scene and the renderer's geometry
export function marks(p, handle) {
  const { w: W, h: H } = FORMATS.desktop, g = GEOMETRY.desktop, s = scene(render({ preset: p, colors: PROBE, format: 'desktop', handle, motto: '', fonts: null }), slotNames(p, 'desktop', handle));
  const at = (...keys) => keys.flatMap((k) => textsOf(s, k)), the = (list, k = 18) => {
    const b = hull(list.flatMap((x) => x.q));
    return { x0: Math.max(0, b.x0 - k), y0: Math.max(0, b.y0 - k), x1: Math.min(W, b.x1 + k), y1: Math.min(H, b.y1 + k) };
  };
  const R = (b) => `<rect class="mk" x="${Math.round(b.x0)}" y="${Math.round(b.y0)}" width="${Math.round(b.x1 - b.x0)}" height="${Math.round(b.y1 - b.y0)}" rx="10"/>`;
  const L = (x1, y1, x2, y2) => `<line class="mk-line mk-draw" pathLength="1" x1="${Math.round(x1)}" y1="${Math.round(y1)}" x2="${Math.round(x2)}" y2="${Math.round(y2)}"/>`;
  const above = (b) => [Math.round((b.x0 + b.x1) / 2), Math.max(60, Math.round(b.y0 - 46))], below = (b) => [Math.round((b.x0 + b.x1) / 2), Math.min(H - 60, Math.round(b.y1 + 46))];
  const roles = p.waterfall.roles, [ax, ay] = p.matrix.axes, [ci, cl] = p.matrix.cell, q = g.mat.cell, c0 = p.charset[0];
  const hero = the(at('hero')), fam = the(at('family', 'class')), lab = the(s.texts.filter((t) => t.kind === 'label')), wf = the(s.texts.filter((t) => t.kind === 'wf'));
  const grid = the(s.cells, 6), nd = the(shape(s, 'the .notdef cell'), 6), pairs = [0, 1].map((i) => the(at(`confusables.${i}`))), mx = the([...shape(s, 'the matrix'), ...at('matrix.axes')], 8);
  const cell = { q: quad(g.grid.x + (cl - 1) * q, g.mat.y + (ci - 1) * q, g.grid.x + cl * q, g.mat.y + ci * q) };
  const notes = p.notes.map((_, i) => the(at(`notes.${i}`)));
  const who = the(shape(s, 'the whoami box'), 6), side = the(at('label')), left = the(at('data.left')), right = the(at('data.right'));
  const top = Math.min(lab.y0, wf.y0), bottom = Math.max(lab.y1, wf.y1);
  return [
    { id: 'hero', term: 'Hero glyphs, set very large', mean: `The domain’s core primitive, ${p.hero}: the smallest unit everything else is built from.`, svg: R(hero), pin: above(hero) },
    { id: 'family', term: 'Family name and classification', mean: `The asset under study, ${p.family}, and its category: ${p.class}.`, svg: R(fam), pin: below(fam) },
    { id: 'waterfall', term: 'Size waterfall, cut at one hairline', mean: `Need-to-know by privilege. Each label names a principal, from ${roles[0]} to ${roles.at(-1)}; the larger the type, the less of the sentence shows before the cut.`, svg: R(lab) + R(wf) + L(s.clip, top - 10, s.clip, bottom + 10), pin: [s.clip, Math.round(top - 56)] },
    { id: 'charset', term: 'Character set with code points', mean: `The closed vocabulary and its official IDs: ${c0.glyph} is ${c0.code}. ${p.charset.length} entries.`, svg: R(grid), pin: above(grid) },
    { id: 'notdef', term: 'The .notdef box', mean: `The unhandled case, ${p.notdef}: input no rule covers. This is the finding.`, svg: R(nd), pin: below(nd) },
    { id: 'confusables', term: 'Lookalike pairs with code points', mean: `Identical on screen, trusted differently: ${p.confusables.map((c) => c[0]).join(' and ')}.`, svg: pairs.map(R).join(''), pin: above(pairs[0]) },
    { id: 'matrix', term: 'Numbered matrix, one cell filled', mean: `Risk as ${ax} × ${ay}: the first digit is ${ax}, the second ${ay}. The filled cell reads ${p.matrix.rating}.`, svg: R(mx) + R(the([cell], 4)) + R(the(at('matrix.rating'))), pin: below(mx) },
    { id: 'test', term: 'The test line', mean: `A known-answer test in the pangram’s place: ${p.test}`, svg: R(the(at('test'))), pin: above(the(at('test'))) },
    { id: 'notes', term: 'Margin notes on a tick', mean: 'Adages from the review, each hung on its own tick.', svg: notes.map((b) => R({ ...b, x0: Math.max(0, b.x0 - 24) })).join(''), pin: above(notes[0] ?? who) },
    { id: 'whoami', term: 'The foundry block', mean: 'Your handle and your line, in the # whoami box: the foundry that issued this specimen.', svg: R(who), pin: above(who) },
    { id: 'side', term: 'The vertical side label', mean: `The series and volume index, fixed: ${p.label}.`, svg: R(side), pin: [Math.round(side.x0 - 260), Math.round((side.y0 + side.y1) / 2)] },
    { id: 'status', term: 'Lines under the sheet', mean: `A coverage summary (${p.data.left}) and your prompt.`, svg: R(left) + R(right), pin: [Math.round(W / 2), Math.min(H - 50, Math.round(left.y1 + 46))] },
  ];
}
