// Cutting Mat's rules: the overlap checker's scene and collisions, the slot table and the word editor's slot
// pieces, the "Read the mat" marks and the editor's geometry. app/series/index.js registers them with the renderer.
// The checker rebuilds, from a rendered sheet, a box for every text the renderer draws and every mark a text could
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
// Boxes, tolerance and colors: app/boxes.js.
import { HANDLE } from '../render.js';
import { INK, ROLE, TOL, attrs, classes, fail, family, glyphs, hits, hull, len, quad, reBox, transform, unesc, union, width, within } from '../boxes.js';

const PANELS = ['the phrase panel', 'the whoami panel', 'the side panel', 'the terminal panel'];   // render order
const TAPES = ['horizontal', 'vertical', 'square'];

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
  const css = classes(svg);
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

// ---------- the word editor's slots (series/cutting-mat/README.md)

export const SLOTS = [
  ['phrase', 'Phrase'], ['source', 'Source'], ['controls.0', 'ISB-01 control'], ['controls.1', 'ISB-02 control'], ['sink', 'Sink'],
  ['flows.0', '60° flow'], ['flows.1', '30° flow'], ['flows.2', '15° flow'],
  ['findings.0', 'Finding 1'], ['findings.1', 'Finding 2'], ['findings.2', 'Finding 3'],
  ['notes.0', 'Note 1'], ['notes.1', 'Note 2'], ['notes.2', 'Note 3'], ['data.left', 'Status line'], ['whoami', '# whoami'],
];
export const LABEL = Object.fromEntries(SLOTS);
// the lexicon's `mat.slots` names, per slot family
export const MAT = { source: 'source', sink: 'sink', controls: 'control', flows: 'flow', findings: 'finding', notes: 'note', data: 'status' };
// word types offered by type when a term has no `mat` hint
export const TYPES = { source: ['term', 'artifact', 'filename'], sink: ['term', 'artifact', 'filename'], flows: ['term', 'artifact', 'filename'], controls: ['term', 'artifact', 'snippet'], findings: ['id', 'term'], notes: ['quote', 'term', 'number'], data: ['status-line'] };
// what stays fixed, and why
export const FIXED = { label: ['Side label', 'names the volume'], panel: ['Terminal panel', 'tells one story in its title and lines'], 'data.right': ['Prompt line', 'shows your handle and the volume’s side of the loop'] };
export const fixedOf = (key) => (key === 'label' ? FIXED.label : key?.startsWith('panel') ? FIXED.panel : key === 'data.right' ? FIXED['data.right'] : null);
export const nameOf = (key) => LABEL[key] ?? LABEL[family(key)] ?? fixedOf(key)?.[0] ?? 'another label';
// the editor's "Fixed on this sheet" list: name, then what it does (FIXED covers only what a click on the sheet can hit)
export const FIXED_LIST = [
  ['Side label', 'It names the volume.'], ['Terminal panel', 'Its title and lines tell one story.'], ['Signature', 'The author credit, 0xF3tt.'],
  ['Prompt line', 'Your handle and the volume’s side of the loop.'], ['Flow angles and ISB tags', 'Set by their position.'],
];

// the slots this preset draws, in reading order ('whoami' is the viewer's own box)
export const slotsOf = (p) => SLOTS.map(([k]) => k).filter((k) => k === 'whoami' || get(p, k) != null);

// the part of a slot the volume fixes: the flow's angle, the role before a source or sink ("actor · ")
export function lockOf(key, shipped) {
  const a = family(key), v = get(shipped, key);
  if (a === 'flows') return `${ANGLES[+key.split('.')[1]]}° · `;
  if ((a === 'source' || a === 'sink') && v.includes(' · ')) return v.slice(0, v.indexOf(' · ') + 3);
  return '';
}

// a phrase on one line, or split at a space into two: after punctuation first, then the most even split
export function wrapPhrase(q, max = LIMITS.phrase) {
  const t = q.trim();
  if (len(t) <= Math.min(max, 15)) return [t];
  const words = t.split(' '), cuts = [];
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    if (len(a) <= max && len(b) <= max) cuts.push({ a, b, punct: /[,;:.?!]$/.test(a), long: Math.max(len(a), len(b)) });
  }
  cuts.sort((x, y) => (y.punct - x.punct) || (x.long - y.long));
  return cuts.length ? [cuts[0].a, cuts[0].b] : len(t) <= max ? [t] : null;
}

// every other string on the sheet: the checker maps texts by string, so a word may appear once
export function usedStrings(p, key) {
  const m = new Map(), add = (v, where) => v != null && !m.has(v) && m.set(v, where);
  for (const k of slotsOf(p)) if (k !== key && k !== 'whoami' && k !== 'phrase') add(get(p, k), LABEL[k]);
  if (key !== 'phrase') p.phrase.forEach((v) => add(v, 'the phrase'));
  add(p.label, 'the side label'); add(p.panel?.title, 'the terminal panel');
  p.panel?.lines?.forEach((v) => add(v, 'the terminal panel'));
  for (const [k, v] of Object.entries(p.phone?.data ?? {})) if (key !== `data.${k}`) add(v, 'the phone status line');
  return m;
}

// ---------- what the word editor asks of a series (app/words.js)

export const HINTS = Object.values(MAT);
export const kindsOf = (key) => ({ slot: MAT[family(key)], types: TYPES[family(key)] });
// the phrase's own pool: the lexicon's phrases and quotes, wrapped to two lines, and the other volumes' phrases
export function poolOf(key, { entry, terms, index, presets, add }) {
  if (key !== 'phrase') return false;
  for (const t of terms) if (t.type === 'phrase' || t.type === 'quote') {
    const w = wrapPhrase(t.text);
    if (w) add(w, { group: 'lexicon', meaning: t.meaning, reference: t.reference });
  }
  for (const x of index) if (x.id !== entry.id && presets[x.id]) add(presets[x.id].phrase, { group: 'volumes', meaning: `From ${x.title}.` });
  return true;
}
// the words a term offers a slot, as { value, code?, meaning? }: hinted (its `as` form) or by type; an id also offers its code
export function offer(key, t, hinted, shipped) {
  const out = [{ value: lockOf(key, shipped) + (hinted ? t.mat.as || t.text : t.text) }];
  if (family(key) === 'findings' && t.type === 'id' && t.code && t.code !== t.text) out.push({ value: t.code, code: '', meaning: `${t.text}: ${t.meaning}` });
  return out;
}
// withSlot, except that the shipped status line brings back its own shorter phone line
export function put(p, key, v, shipped) {
  const q = withSlot(p, key, v), b = key.slice(5);
  if (key.startsWith('data.') && v === shipped.data?.[b] && shipped.phone?.data?.[b] != null) q.phone = { ...q.phone, data: { ...q.phone?.data, [b]: shipped.phone.data[b] } };
  return q;
}
// does a value fit this slot in one format? null: only the full checker can tell
export function fits(current, f, key, value, shipped, prepared) {
  if (key === 'phrase') return phraseFits(current, f, value, prepared);
  const drawn = f === 'phone' && key.startsWith('data.') ? put(current, key, value, shipped).phone?.data?.[key.slice(5)] ?? value : value;
  return quickFits(prepared(f), key, drawn);
}
// a failed fit in the interface's words (h: the hit of quickFits, or { what: 'full', name } from the full checker)
export const why = (h) => (h.what === 'text' ? `runs into ${h.slot ? nameOf(h.slot) : 'a ruler'}`
  : h.what === 'shape' ? `runs into ${h.name}` : h.what === 'edge' ? `crosses ${h.name}`
  : h.what === 'clock' ? 'reaches the lock-screen clock' : h.what === 'home' ? 'is too long for its panel'
  : /does not fit inside its panel/.test(h.name) ? 'is too wide for the phrase panel' : 'collides with another mark');
// the word a change replaced, for the note about where it lives on (the phrase: none)
export const oldWord = (p, key, shipped) => (key === 'phrase' ? '' : String(get(p, key)).slice(lockOf(key, shipped).length).trim());
// where else on the sheet a word appears, by name
export function elsewhere(p, key, re) {
  const where = new Set();
  for (const k of slotsOf(p)) if (k !== key && k !== 'whoami' && k !== 'phrase' && re.test(get(p, k))) where.add(LABEL[k]);
  if ([p.panel?.title, ...(p.panel?.lines ?? [])].some((v) => v && re.test(v))) where.add('the terminal panel');
  return [...where];
}

// the phrase line by line, on a scene prepared with the same number of lines (a one-line phrase sits lower)
export function phraseFits(current, f, value, prepared) {
  if (value.length !== current.phrase.length) return null;
  let box = null;
  for (const [i, line] of value.entries()) {
    const r = quickFits(prepared(f), `phrase.${i}`, line);
    if (!r?.ok) return r;
    box = union(box, r.box);
  }
  return { ok: true, box };
}

// Vols 01 to 03 tell one bug story
const STORY = /CWE-639|CWE-862|BOLA|IDOR|API1:2023|A01:2025|#0001/;
// the note under a changed word that belongs to that story (old and new as plain text)
export const story = (entry, old, now) => (entry.vol <= 3 && (STORY.test(old) || STORY.test(now))
  ? 'Vols 01 to 03 tell one bug story, and the other two still tell it as shipped.' : '');

// ---------- the studio: geometry, swatches and the "Read the mat" key

// the series' words in the studio: the "Read the …" section (mark: the key line shown first)
export const READ = {
  who: 'Your handle goes in the whoami box and in the prompt under the sheet; your line follows it. The signature stays 0xF3tt.',
  nav: 'Read the mat', title: 'Read the mat.', mark: 'taint', legendHead: ['', 'On the mat', 'In the threat model'],
  intro: 'The self-healing cutting mat on a designer\'s desk, printed as a threat model. Pick a line from the key to find its mark on the sheet.',
};
// the volume's line under its name: the phrase, in quotes
export const lineOf = (p) => p.phrase.join(' ');
// a parsed preset file the studio can draw (the strip skips the ones that aren't)
export const valid = (p) => !!p?.layout && Array.isArray(p.phrase);
// the tape chips under the sheet's title: each finding with the color of its tape
export const chipsOf = (p, colors) => (p.findings ?? []).map((text, k) => ({ text, color: colors[`chip${k + 1}`] }));
// the rail's swatch for a slot (a finding's tape), or null
export const swatch = (key, colors) => {
  const t = key.startsWith('findings.') ? +key.split('.')[1] : -1;
  return t >= 0 ? { cls: 'hvq'[t], color: colors[`chip${t + 1}`] } : null;
};
// the editor's zoom: U is the cell in sheet px, px(key, fmt) the drawn text size, as in cutting-mat.js
export const GEOM = {
  U: (fmt) => (fmt === 'phone' ? 60 : 80),
  px: (key, fmt) => (key === 'phrase' ? (fmt === 'phone' ? 70 : 92) : fmt === 'phone' ? 16 : 20),
};
// one box per slot as quads: its text plus the mark it belongs to, in sheet px (s: the prepared scene)
export function slotQuads(s, p, key) {
  const [a, b] = key.split('.'), i = +b, qs = [];
  if (key === 'phrase') qs.push(s.panels[0].q);
  else if (key === 'whoami') qs.push(s.panels[1].q);
  else if (key === 'label') qs.push(s.panels[2].q);
  else if (a === 'panel') qs.push(s.panels[3].q);
  else {
    const t = s.texts.find((x) => x.slot === key);
    if (t) qs.push(t.q);
    const mark = a === 'source' ? s.marks.find((m) => m.name === 'the source dot')
      : a === 'sink' ? s.marks.find((m) => m.name === 'the sink dot')
      : a === 'controls' ? s.marks.filter((m) => m.control)[i]
      : a === 'findings' ? s.chips.find((c) => c.tape === i)
      : a === 'notes' ? s.ticks[(p.notes ?? []).slice(0, i).filter((v) => v != null).length] : null;
    if (mark) qs.push(mark.q);
  }
  return qs;
}

// read the mat: the desktop sheet's geometry, from the renderer's grid (U 80, origin 240/160)
const gx = (c) => 240 + c * 80, gy = (r) => 160 + r * 80;
const ray = (deg) => { const t = Math.tan((deg * Math.PI) / 180), xt = 240 + 1760 / t; return xt <= 3600 ? [xt, 160] : [3600, 1920 - 3360 * t]; };
const L = (x1, y1, x2, y2) => `<line class="mk-line mk-draw" pathLength="1" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const R = (x, y, w, H) => `<rect class="mk" x="${x}" y="${y}" width="${w}" height="${H}" rx="10"/>`;
const C = (x, y, r) => `<circle class="mk" cx="${x}" cy="${y}" r="${r}"/>`;
export const GLYPH = {
  rulers: '<path d="M3 7h18M5 7v4M9 7v2.5M13 7v4M17 7v2.5M21 7v4M3 14h7M3 18h5"/>',
  taint: '<path d="M4 20 20 4"/><circle cx="7" cy="17" r="1.8" fill="currentColor"/><circle cx="17" cy="7" r="1.8" fill="currentColor"/>',
  tb: '<path d="M2 8h20M2 16h20" stroke-dasharray="3 2.4"/>',
  ctrl: '<rect x="6" y="6" width="12" height="12"/><rect x="10" y="10" width="4" height="4" fill="currentColor"/>',
  flows: '<path d="M3 21 11 4M3 21 20 9M3 21l18-5" stroke-dasharray="2.5 2"/>',
  tape: '<rect x="3" y="6" width="12" height="4" rx="2" fill="currentColor" stroke="none"/><rect x="17" y="6" width="4" height="12" rx="2" fill="currentColor" stroke="none"/><rect x="4" y="14" width="6" height="6" fill="currentColor" stroke="none"/>',
  notes: '<path d="M6 7v10M9 12h12"/>',
  term: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M6 9h6M6 12h10M6 15h8"/>',
  phrase: '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M8 11h8M9 14h6"/>',
  whoami: '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M7 10h3M7 13h10"/>',
  status: '<path d="M3 17h8M14 17h7M3 6h18"/>',
};
export function marks(p, handle) {
  const lay = p.layout.desktop, [[hc, hr], [vc, vr], [qc, qr]] = lay.chips, [nc, nr] = lay.notes[0];
  const sw = (s) => len(s ?? '') * 20 * 0.64, right = (p.data?.right ?? '').replaceAll('{handle}', handle || HANDLE);
  const noteBoxes = lay.notes.map(([c, r], i) => (p.notes?.[i] == null ? '' : R(gx(c) - 16, gy(r) - 34, len(p.notes[i]) * 12.4 + 44, 68))).join('');
  return [
    { id: 'rulers', term: 'Rulers on three edges', mean: 'Hex offsets along the top, memory addresses down the left, line numbers down the right.', svg: R(236, 100, 3368, 56) + R(120, 156, 116, 1768) + R(3606, 156, 96, 1768), pin: [1920, 50] },
    { id: 'taint', term: 'The 45° cutting line', mean: `The taint path: untrusted data from the source (${p.source}) to the sink (${p.sink}).`, svg: L(240, 1920, 2000, 160) + C(480, 1680, 34) + C(1840, 320, 34), pin: [1240, 1060] },
    { id: 'tb', term: 'Two dashed rules', mean: 'Trust boundaries, tagged ISB-01 and ISB-02.', svg: L(240, 1520, 3600, 1520) + L(240, 560, 3600, 560) + R(3455, 1498, 132, 44) + R(3455, 538, 132, 44), pin: [2700, 1450] },
    { id: 'ctrl', term: 'Where the cut crosses a rule', mean: `One control per boundary: ${(p.controls ?? []).join(' and ')}.`, svg: R(598, 1478, 84, 84) + R(1558, 518, 84, 84), pin: [900, 1600] },
    { id: 'flows', term: 'Angle lines at 60°, 30° and 15°', mean: 'Other data flows through the system, each one labeled.', svg: [60, 30, 15].map((d) => L(240, 1920, ...ray(d))).join(''), pin: [2500, 1300] },
    { id: 'tape', term: 'Bits of tape', mean: `Findings: ${(p.findings ?? []).join(', ')}.`, svg: R(gx(hc) - 4, gy(hr) + 18, 168, 44) + R(gx(vc) + 18, gy(vr) - 4, 44, 168) + R(gx(qc) + 10, gy(qr) + 10, 60, 60), pin: [gx(hc) + 80, gy(hr) - 30] },
    { id: 'notes', term: 'Measurement ticks', mean: 'Margin notes from the review.', svg: noteBoxes, pin: [gx(nc) + 160, gy(nr) - 70] },
    { id: 'term', term: 'The top panel', mean: `The artifact under review, here ${p.panel?.title ?? 'a snippet'}.`, svg: R(2150, 230, 660, 260), pin: [2480, 540] },
    { id: 'phrase', term: 'The center panel', mean: `The principle, in one line: “${p.phrase.join(' ')}”`, svg: R(1510, 870, 820, 340), pin: [1920, 1260] },
    { id: 'whoami', term: 'The label corner', mean: 'Your handle and your line, in the # whoami box.', svg: R(2710, 1590, 820, 260), pin: [3120, 1540] },
    { id: 'status', term: 'Lines under the frame', mean: `The status of the review (${p.data?.left}) and your prompt.`, svg: R(228, 1950, sw(p.data?.left) + 24, 44) + R(3588 - sw(right), 1950, sw(right) + 24, 44), pin: [1920, 2080] },
  ];
}
