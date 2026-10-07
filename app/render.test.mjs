// Renderer smoke test, no browser needed:  node app/render.test.mjs
// Every series in the registry (app/series/index.js) runs the shared contract: presets are discovered from its
// <dir>/index.json, checked for shape, and rendered in every palette, ground and format. Then the overlap checker
// (app/check.js, the same code the word editor uses in the browser) for every series that has one, and per-series
// blocks: Cutting Mat's presets against the README slot table; Specimen's against its own preset shape, the
// waterfall clip, the hero column and the keep-clear zones; Galley Proof's against its preset shape and content rules, a fixture
// with all eight mark types and renderer safety; Catalog Card's against its schema, its lexicon rules, two limit fixtures, the
// roles, papers and classes it draws and renderer safety; all three with a broken sheet for each rule the checker must catch.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { crc32 } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FORMATS, GRAIN, HANDLE, MOTTO, crc32 as crc, esc, srgbPNG, zip, validHandle, validMotto, whoamiLines } from './render.js';
import { SERIES } from './series/index.js';
import { GEOMETRY, heroSize } from './series/specimen.js';
import { AUTHOR, GEOMETRY as GALLEY, KEY, KEY_HEAD, tally, slip } from './series/galley-proof.js';
import { AUTHOR as CARD_AUTHOR, GEOMETRY as CARD, CLASSES, HEADS, DEPTH, paper, render as renderCard, stamp, view, defLines } from './series/catalog-card.js';
import { ID, SCHEMA, isId } from './series/catalog-card.rules.js';
import { ROLE } from './boxes.js';
import { ANGLES, HANDLES, LIMITS, MOTTOS, PROBE, advances, overlaps, prepare, useMetrics } from './check.js';

const file = path => new URL(`../${path}`, import.meta.url);
const json = path => JSON.parse(readFileSync(file(path), 'utf8'));
const palettes = ['purple', 'green', 'red', 'blue'].map(slug => json(`palettes/${slug}.json`));
const fonts = { nunito: 'data:font/ttf;base64,TlVOSVRP', jbm: 'data:font/ttf;base64,SkJN' };
const ground = (pal, role) => Object.values(pal.grounds).find(g => g.role === role).colors;
const len = s => [...s].length;                     // code points: "·" and "→" count once
const pad2 = v => String(v).padStart(2, '0');

// ---------- the index: an ordered list of { id, vol, title, topic, ground }

const GROUNDS = ['dark', 'mid', 'light'];
const TITLE = /^Vol\. (\d{2}) · (\S.*)$/;
const INDEX = {}, PRESETS = {};
for (const [sid, S] of Object.entries(SERIES)) {
  const DIR = S.dir, idx = INDEX[sid] = json(`${DIR}/index.json`), who = `${sid} index.json`;
  assert.ok(Array.isArray(idx) && idx.length > 0, `${who}: a non-empty list`);
  idx.forEach((e, i) => {
    const at = `${who}[${i}]`;
    assert.deepEqual(Object.keys(e ?? {}).sort(), ['ground', 'id', 'title', 'topic', 'vol'], `${at}: keys are id, vol, title, topic, ground`);
    assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${at}: id is a lowercase slug`);
    assert.equal(e.id, e.topic, `${at}: id is the topic slug (it names the preset file and the downloads)`);
    const m = e.title.match(TITLE);
    assert.ok(m && +m[1] === e.vol, `${at}: title "${e.title}" should read "Vol. ${pad2(e.vol)} · Name"`);
    assert.ok(len(m[2]) <= 10, `${at}: title name "${m[2]}" is ${len(m[2])} chars, max 10 (one line on its picker card)`);
    assert.ok(GROUNDS.includes(e.ground), `${at}: ground is dark, mid or light`);
    assert.ok(existsSync(file(`topics/${e.topic}.json`)), `${at}: topic "${e.topic}" has no lexicon in topics/`);
    assert.ok(existsSync(file(`${DIR}/${e.id}.json`)), `${at}: ${DIR}/${e.id}.json is missing`);
  });
  const dupes = k => idx.map(e => e[k]).filter((v, i, all) => all.indexOf(v) !== i);
  assert.deepEqual(dupes('id'), [], `${who}: duplicate ids`);
  assert.deepEqual(dupes('vol'), [], `${who}: duplicate volumes`);
  idx.forEach((e, i) => i && assert.ok(e.vol > idx[i - 1].vol, `${who}: volumes must increase in file order`));
  const listed = readdirSync(file(DIR)).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => f.slice(0, -5));
  assert.deepEqual(listed.sort(), idx.map(e => e.id).sort(), `${DIR}: every preset file is listed in index.json, and only those`);
  PRESETS[sid] = Object.fromEntries(idx.map(e => [e.id, json(`${DIR}/${e.id}.json`)]));
}
// Cutting Mat numbers its volumes 1, 2, 3… in file order; every other series takes its volumes from it: same vol, title and ground
INDEX['cutting-mat'].forEach((e, i) => assert.equal(e.vol, i + 1, `cutting-mat index.json: vol ${e.vol}, expected ${i + 1}`));
for (const sid of Object.keys(INDEX).filter(s => s !== 'cutting-mat')) for (const e of INDEX[sid]) {
  const twin = INDEX['cutting-mat'].find(t => t.topic === e.topic);
  assert.ok(twin, `${sid} ${e.id}: no Cutting Mat volume for topic "${e.topic}"`);
  assert.equal(e.vol, twin.vol, `${sid} ${e.id}: vol ${e.vol}, but Cutting Mat numbers this topic ${twin.vol}`);
  assert.equal(e.title, twin.title, `${sid} ${e.id}: title "${e.title}", but every series names a volume alike: "${twin.title}"`);   // Vol. 09 is "Key" everywhere
  assert.equal(e.ground, twin.ground, `${sid} ${e.id}: ground "${e.ground}", but every series copies the volume's ground: "${twin.ground}"`);
}
const index = INDEX['cutting-mat'], presets = PRESETS['cutting-mat'];   // the per-series blocks below

// ---------- glyph coverage: every character a preset uses exists in the font that draws it

const MONO_ADV = advances(readFileSync(file('fonts/jetbrains-mono/JetBrainsMono-Variable.ttf')));
const NUNITO_BYTES = readFileSync(file('fonts/nunito/Nunito-Variable.ttf'));
const NUNITO_ADV = advances(NUNITO_BYTES, { wght: 300 });   // .ph draws at 300
useMetrics({ mono: MONO_ADV, nunito: Object.fromEntries([200, 300, 400, 600, 800].map(wght => [wght, wght === 300 ? NUNITO_ADV : advances(NUNITO_BYTES, { wght })])) });   // Specimen draws all five
const hexCp = ch => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

// ---------- every preset against the README slot table

const KEYS = ['series', 'topic', 'title', 'ground', 'phrase', 'label', 'source', 'sink', 'controls', 'flows', 'findings', 'panel', 'notes', 'data', 'phone', 'layout'];
const REQUIRED = ['series', 'topic', 'title', 'ground', 'phrase', 'layout'];

function keys(v, allowed, at) {
  assert.ok(v && typeof v === 'object' && !Array.isArray(v), `${at}: must be an object`);
  for (const k of Object.keys(v)) assert.ok(allowed.includes(k), `${at}: unknown key "${k}" (allowed: ${allowed.join(', ')})`);
}
function str(v, max, at, { indent = false } = {}) {
  assert.equal(typeof v, 'string', `${at}: must be a string`);
  assert.ok(v.trim(), `${at}: empty`);
  assert.ok(!/[\u0000-\u001F\u007F-\u009F]/.test(v), `${at}: control character`);
  assert.equal(v, indent ? v.trimEnd() : v.trim(), `${at}: stray spaces in "${v}"`);
  assert.ok(len(v) <= max, `${at}: "${v}" is ${len(v)} chars, max ${max}`);
}
function list(v, n, max, at, opt) {
  assert.ok(Array.isArray(v) && v.length <= n, `${at}: a list of up to ${n}`);
  v.forEach((s, i) => str(s, max, `${at}[${i}]`, opt));
}

// the strings drawn in JetBrains Mono (everything but the phrase), phone status lines included
const monoStrings = p => [
  p.label, p.source, p.sink, ...(p.controls ?? []), ...(p.flows ?? []), ...(p.findings ?? []),
  p.panel?.title, ...(p.panel?.lines ?? []), ...(p.notes ?? []),
  ...Object.values(p.data ?? {}), ...Object.values(p.phone?.data ?? {}),
].filter(s => s != null);

for (const e of index) {
  const p = presets[e.id], at = `${e.id}.json`, name = e.title.match(TITLE)[2];
  keys(p, KEYS, at);
  for (const k of REQUIRED) assert.ok(k in p, `${at}: missing "${k}"`);
  assert.equal(p.series, 'cutting-mat', `${at}: series`);
  for (const k of ['topic', 'title', 'ground']) assert.equal(p[k], e[k], `${at}: ${k} differs from index.json`);
  assert.ok(Array.isArray(p.phrase) && p.phrase.length >= 1, `${at} phrase: one or two lines`);
  list(p.phrase, 2, LIMITS.phrase, `${at} phrase`);   // and the overlap checker measures each line against its panel
  if ('label' in p) {
    str(p.label, LIMITS.label, `${at} label`);
    const tail = `VOL. ${pad2(e.vol)} · ${name.toUpperCase()}`;
    assert.ok(p.label.endsWith(tail), `${at} label: "${p.label}" should end with "${tail}"`);
  }
  for (const k of ['source', 'sink']) if (k in p) str(p[k], LIMITS[k], `${at} ${k}`);
  if ('controls' in p) list(p.controls, 2, LIMITS.controls, `${at} controls`);
  if ('flows' in p) {
    list(p.flows, 3, LIMITS.flows, `${at} flows`);
    p.flows.forEach((f, i) => assert.ok(f.startsWith(`${ANGLES[i]}° · `), `${at} flows[${i}]: "${f}" should start with "${ANGLES[i]}° · "`));
  }
  if ('findings' in p) {
    list(p.findings, 3, Math.max(...LIMITS.findings), `${at} findings`);
    p.findings.forEach((f, i) => str(f, LIMITS.findings[i], `${at} findings[${i}]`));   // the square tape holds less
  }
  if ('panel' in p) {
    keys(p.panel, ['title', 'lines'], `${at} panel`);
    str(p.panel.title, LIMITS['panel.title'], `${at} panel.title`);
    list(p.panel.lines ?? [], 5, LIMITS['panel.lines'], `${at} panel.lines`, { indent: true });   // code may be indented
  }
  if ('notes' in p) list(p.notes, 3, LIMITS.notes, `${at} notes`);
  if ('data' in p) {
    keys(p.data, ['left', 'right'], `${at} data`);
    if ('left' in p.data) str(p.data.left, LIMITS['data.left'], `${at} data.left`);
    if ('right' in p.data) str(p.data.right, LIMITS['data.right'], `${at} data.right`);   // {handle} counts as written
  }
  if ('phone' in p) {
    keys(p.phone, ['data'], `${at} phone`);
    keys(p.phone.data, ['left', 'right'], `${at} phone.data`);
  }
  const phoneData = { ...p.data, ...p.phone?.data };  // what the phone draws: overrides merge over data
  for (const k of ['left', 'right']) if (phoneData[k] != null) str(phoneData[k], LIMITS.phone, `${at} phone status line ${k} (data.${k} unless phone.data.${k} overrides it)`);
  keys(p.layout, ['desktop', 'phone'], `${at} layout`);
  for (const f of ['desktop', 'phone']) {
    keys(p.layout[f], ['chips', 'notes'], `${at} layout.${f}`);
    for (const k of ['chips', 'notes']) {
      const v = p.layout[f][k];
      assert.ok(Array.isArray(v) && v.length === 3 && v.every(c => Array.isArray(c) && c.length === 2 && c.every(Number.isInteger)),
        `${at} layout.${f}.${k}: three [col, row] pairs of integers`);
    }
  }
  for (const s of monoStrings(p)) for (const ch of s)
    assert.equal(MONO_ADV.get(ch.codePointAt(0)), 0.6, `${at}: "${ch}" (${hexCp(ch)}) in "${s}" is not a JetBrains Mono glyph`);
  for (const s of p.phrase) for (const ch of s)
    assert.ok(NUNITO_ADV.has(ch.codePointAt(0)), `${at}: "${ch}" (${hexCp(ch)}) in phrase "${s}" is not a Nunito glyph`);
}

// ---------- every preset × palette × format renders a well-formed sheet

// every string a preset puts on one format, the viewer's handle in place of {handle}
const strings = (p, fmt, handle = '') => (STRINGS[p.series] ?? assert.fail(`no strings() for series "${p.series}": add it to STRINGS`))(p, fmt).map(s => s.replaceAll('{handle}', handle || HANDLE));
const cuttingMatStrings = (p, fmt) => [
  ...p.phrase, ...monoStrings({ ...p, data: fmt === 'phone' ? { ...p.data, ...p.phone?.data } : p.data, phone: null }),
];
// (Specimen's phone draws 4 waterfall lines, 11 glyphs + .notdef, one confusable pair and no matrix, test or notes)
function specimenStrings(p, fmt) {
  const g = GEOMETRY[fmt], phone = fmt === 'phone', roles = p.waterfall.roles.filter((_, i) => !phone || i !== g.wf.drop);
  return [
    p.hero, p.family, p.class, ...g.wf.sizes.flatMap((size, i) => [`${size} pt · ${roles[i]}`, p.waterfall.phrase]),
    ...p.charset.slice(0, g.chars).flatMap(c => [c.glyph, c.code]), p.notdef, p.matrix.rating, ...Object.values({ ...p.data, ...(phone ? p.phone?.data : null) }),
    ...(phone ? p.confusables[0] : [...p.confusables.flat(), `${p.matrix.axes[0]} × ${p.matrix.axes[1]}`, p.test, ...p.notes, p.label]),
  ];
}
// (Galley Proof draws the file's lines trimmed, each mark's `to` and note beside it, and on the phone no notes, key or side label)
const galleyMono = (p, fmt) => {   // the strings drawn in JetBrains Mono, the key and slip included
  const phone = fmt === 'phone', vol = pad2(+/\d+/.exec(p.title)[0]);
  return [`GALLEY ${vol} · ${p.file}`, tally(p), `ERRATA · GALLEY ${vol}`, ...slip(p, vol), ...Object.values({ ...p.data, ...(phone ? p.phone?.data : null) }),
    ...(phone ? [] : [...p.notes, p.label, KEY_HEAD, ...[...new Set(p.marks.map(m => m.type))].map(t => KEY[t][0])])].map(s => s.replaceAll('{handle}', HANDLE));
};
const galleyStrings = (p, fmt) => {
  const phone = fmt === 'phone', used = [...new Set(p.marks.map(m => m.type))], flip = m => m.type === 'sub' || m.type === 'ins';
  return [
    ...p.phrase, ...p.lines.map(l => l.trimStart()), ...galleyMono(p, fmt),
    ...p.marks.flatMap(m => [['tr', 'wf', 'stet'].includes(m.type) && m.type, flip(m) && (phone ? m.phone : m.to), (!phone || !flip(m)) && (phone ? m.phone : m.note)].filter(Boolean)),
    ...(phone ? [] : [...used.filter(t => ['tr', 'wf', 'stet'].includes(t)), ...(used.includes('query') ? ['?'] : []), ...used.map(t => KEY[t][1])]),
  ];
};
const NUMERALS = ['I.', 'II.'];
// (Catalog Card draws the phrase in one line on desktop and wide, in its stored lines on the phone; the phone's subsets, overrides and draft note come from view())
const cardStrings = (p, fmt) => {
  const v = view(p, fmt), phone = fmt === 'phone';
  return [...(phone ? p.phrase : [p.phrase.join(' ')]), v.drawer_label, ...v.guide_tabs, ...v.call_number, v.main_entry, stamp(p), ...defLines(p, fmt), v.collation, v.correction_new, ...v.notes,
    ...v.tracings_subject.flatMap((t, i) => [`${i + 1}.`, t]), ...v.tracings_added.flatMap((t, i) => [NUMERALS[i], t]), v.rod_invariant, HEADS[0], ...v.see_also,
    ...v.circulation_dates, ...(phone ? [] : [HEADS[1], p.label]), v.data.left, v.right];
};
const STRINGS = { 'cutting-mat': cuttingMatStrings, specimen: specimenStrings, 'galley-proof': galleyStrings, 'catalog-card': cardStrings };

// leaked values: a NaN, undefined, null or [object …] in any attribute (coordinates, colors, transforms)
const leaked = svg => [...svg.matchAll(/ [\w:-]+="([^"]*)"/g)].map(m => m[1]).filter(v => /NaN|undefined|null|Infinity|\[object/.test(v));
// every text the sheet draws is one the test expects: preset strings, the whoami box, the signature, the
// ISB tags and the rulers (hex offsets, addresses, line numbers). Words like "NaN" are fine as words.
const EXTRA = { 'cutting-mat': ['0xF3tt', 'ISB-01', 'ISB-02'], specimen: [], 'galley-proof': ['0xF3tt'], 'catalog-card': [] };   // texts a series draws besides its preset's strings
const RULER = /^([0-9A-F]{2}|0x[0-9A-F]{4}|\d{1,2})$/;
function unexpected(svg, p, fmt, handle = '', motto = '') {
  const ok = new Set([...strings(p, fmt, handle), ...whoamiLines(handle, motto), ...(EXTRA[p.series] ?? assert.fail(`no EXTRA for series "${p.series}": add it, [] if none`))]);
  return [...svg.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map(m => m[1].replace(/&(lt|gt|amp|quot|apos);/g, c => ({ '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&apos;': "'" }[c])))
    .filter(t => !ok.has(t) && !RULER.test(t));
}

// tags open and close in order (a cheap well-formedness check)
function balanced(svg) {
  const open = [];
  for (const [, close, name, self] of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    if (self) continue;
    if (!close) open.push(name);
    else assert.equal(open.pop(), name, `unbalanced </${name}>`);
  }
  assert.equal(open.length, 0, `unclosed <${open.at(-1)}>`);
}

// untransformed marks stay on the canvas
function onCanvas(svg, w, h, where) {
  for (const [el] of svg.matchAll(/<(line|rect|circle|text) [^>]*>/g)) {
    if (el.includes('transform=')) continue;
    for (const [, k, v] of el.matchAll(/ (x|y|x1|y1|x2|y2|cx|cy)="([^"]*)"/g)) {
      const max = k.startsWith('x') || k === 'cx' ? w : h;
      assert.ok(+v >= 0 && +v <= max, `${where}: ${k}="${v}" off canvas in ${el}`);
    }
  }
}

// what only a Galley Proof render must hold: the signature, the roles it draws in, the forms of its paths and turns
function galleyRender(S, svg, pal, role, fmt, where) {
  assert.ok(svg.includes(`>${HANDLE} · ${MOTTO}</text>`) && svg.includes('>0xF3tt</text>') === (fmt !== 'phone'), `${where}: whoami and the signature`);
  if (fmt === 'phone') for (const [, x, t] of svg.matchAll(/<text x="([\d.]+)" y="[\d.]+" class="mt"[^>]*>([^<]*)</g)) assert.ok(+x + 18 * len(t) <= 1230, `${where}: "${t}" runs past x 1230`);
  assert.ok(!/<foreignObject|<div|<script|id="grain"/i.test(svg), `${where}: SVG text only`);
  const c = ground(pal, role), drawn = new Set(S.BAR.map(k => c[k]));   // the roles the sheet draws in
  for (const r of ['major', 'angle', 'diag', 'tb', 'sink', 'chip3']) assert.ok(drawn.has(c[r]) || !svg.includes(`"${c[r]}"`), `${where}: draws in ${r}, which Galley Proof never uses`);
  for (const [, d] of svg.matchAll(/<path d="([^"]*)"/g)) assert.ok(/^[MLHVC\d.,\s-]+$/.test(d) && d.startsWith('M'), `${where}: path uses only absolute M L H V C: ${d}`);
  for (const [, t] of svg.matchAll(/ transform="([^"]*)"/g)) assert.match(t, /^translate\(\d+,\d+\) rotate\(-1\.5\)$|^translate\([\d.]+,[\d.]+\) rotate\(-90\)$/, `${where}: transform form`);
  assert.equal((svg.match(/rotate\(-1\.5\)/g) ?? []).length, 7, `${where}: every slip element carries the turn`);
  assert.ok(!svg.includes('class="gl"') === (fmt === 'phone'), `${where}: glosses are desktop and wide only`);
}

// what only a Catalog Card render must hold: the roles it draws in, the papers by structure, the one accent, the turns, the grid and the class table.
// Roles share hexes on many grounds (chip1 == data on indigo and soldermask, frame == rule on 7), so nothing is counted by hex alone.
function cardRender(S, svg, pal, role, fmt, where, p) {
  const c = ground(pal, role), g = CARD[fmt], P = view(p, fmt), L = paper(c), bare = svg.replace(/<(?:rect|path) class="pp"[^>]*\/>/g, ''), drawn = new Set([...S.BAR, 'data'].map(k => c[k]));
  assert.equal(S.BAR.length, 8, `${where}: the colour bar is 8 roles`);
  for (const r of ['minor', 'diag', 'tb', 'sink', 'chip2', 'chip3']) assert.ok(drawn.has(c[r]) || !bare.includes(`"${c[r]}"`), `${where}: draws in ${r}, which Catalog Card never uses`);
  const rows = P.guide_tabs.length, ladder = ['wall', 'wall', ...Array.from({ length: rows }, (_, i) => [L.guides[4 - rows + i], L.guides[4 - rows + i]]).flat(), 'see', 'main', 'front', 'blank', 'panel', 'metal', 'main', 'slip'];
  const fills = [...svg.matchAll(/<(?:rect|path) class="pp"[^>]*? fill="([^"]*)"/g)].map(m => m[1]);
  assert.deepEqual(fills, ladder.map(k => L[k] ?? k), `${where}: every paper is its layer's solved fill, in order`);
  const accent = [...bare.matchAll(/<(?:rect|line|circle|path|text)\b[^>]*>/g)].map(m => m[0]).filter(el => el.includes(`"${c.chip1}"`) && !/class="d"/.test(el));
  assert.equal(accent.length, 2, `${where}: chip1 is the strike and the pencil, nothing else`);
  assert.ok(accent.some(el => el.startsWith('<line') && el.includes(`stroke="${c.chip1}"`)) && accent.some(el => el.includes('class="pen"')), `${where}: the one accent is a line and the pencil`);
  assert.equal((svg.match(/class="pen"/g) ?? []).length, 1, `${where}: one pencil`);
  assert.ok(!svg.includes('ISB-0'), `${where}: no ISB tags`);
  const turns = [...svg.matchAll(/ transform="([^"]*)"/g)].map(m => m[1]);
  turns.forEach(t => assert.match(t, /^translate\(-?[\d.]+,-?[\d.]+\) rotate\(-?[\d.]+\)$/, `${where}: transform form`));
  assert.equal(turns.length, 2 + 1 + P.circulation_dates.length + (g.vl ? 1 : 0), `${where}: turns are the stamp (2), the pencil, each date and the side label`);
  assert.ok(!/<g[ >]/.test(svg) && !/<tspan|<foreignObject|<div|<script|id="grain"/i.test(svg), `${where}: no groups, SVG text only`);
  for (const [, d] of svg.matchAll(/<path d="([^"]*)"/g)) assert.match(d, /^M[MLHVQZ\d.,\s-]*$/, `${where}: path uses only absolute M L H V Q Z`);
  // the class table: every class's size, weight and family are CLASSES'; the card's text is 34 or more, chrome 26 / 30, the side label 24
  const K = CLASSES(g, p), css = Object.fromEntries([...svg.match(/<style>([\s\S]*?)<\/style>/)[1].matchAll(/\.([a-z][a-z\d]*)\{([^}]*)\}/g)].map(m => [m[1], m[2]]));
  assert.deepEqual(Object.keys(css).sort(), Object.keys(K).sort(), `${where}: a style per class`);
  for (const [k, [fam, sz, wt, ls]] of Object.entries(K)) {
    assert.equal(css[k], `${fam === 'n' ? 'font-family:KNunito,Nunito,sans-serif;' : ''}font-size:${sz}px;font-weight:${wt}${ls ? `;letter-spacing:${ls}em` : ''}`, `${where}: .${k}`);
    assert.ok(k === 'k' || k === 'd' ? sz === (fmt === 'phone' ? 30 : 26) : k === 'vl' ? sz === 24 : sz >= 34, `${where}: .${k} is ${sz}px`);
  }
  for (const [, k] of svg.matchAll(/<text[^>]* class="([a-z\d]+)"/g)) assert.ok(k in K, `${where}: class ${k} is in the table`);
  // plan.md's class table, literally (desktop and wide / phone), so a drift in CLASSES itself fails
  const SZ = { tab: [40, 34], call: [54, 38], entry: [80, 56], pen: [64, 54], k: [26, 30], d: [26, 30], vl: [24, 24], phr: [136, p.phrase.length === 2 ? 72 : 96] };
  for (const [k, [a, b]] of Object.entries(SZ)) if (k in css) assert.match(css[k], new RegExp(`font-size:${fmt === 'phone' ? b : a}px`), `${where}: .${k} is ${fmt === 'phone' ? b : a}px in plan.md's table`);
  // the tracing grid and the fixed indention: x positions from GEOMETRY, never from the words
  const A_ = 0.6, M = g.main, cx0 = M.x0 + M.pad, i1 = M.body === 'entry' ? cx0 + M.callMax * A_ * K.call[1] + M.gap : cx0, cols = M.tr.cols.map(ch => i1 + ch * A_ * K.trs[1]), nr = M.tr.bases.length;
  const COLS = fmt === 'phone' ? [134, 664.4] : [858.8, 1420.4, 1982], TERMS = fmt === 'phone' ? [195.2, 746] : [923.6, 1485.2, 2068.4];   // plan.md's grid, literally
  const xs = k => [...svg.matchAll(new RegExp(`<text x="([\\d.]+)" y="[\\d.]+" class="${k}"`, 'g'))].map(m => +m[1]), near = (a, b, w) => assert.ok(Math.abs(a - b) < 0.011, `${where}: ${w} at ${a}, expected ${b}`);
  const want = [...P.tracings_subject.map((_, i) => cols[Math.floor(i / nr)]), ...P.tracings_added.map(() => cols.at(-1))];
  xs('num').forEach((x, i) => { near(x, want[i], `numeral ${i + 1}`); assert.ok(COLS.some(v => Math.abs(x - v) < 0.011), `${where}: numeral at ${x} is off the grid ${COLS}`); });
  [...xs('trs'), ...xs('tra')].forEach(x => assert.ok(TERMS.some(v => Math.abs(x - v) < 0.011), `${where}: tracing at ${x} is off the grid ${TERMS}`));
  near(i1, fmt === 'phone' ? 134 : 858.8, 'first indention');
  const i2 = i1 + 2 * A_ * K.def[1];   // the definition's paragraph indention: line 1 at i2, the rest at i1
  xs('def').forEach((x, i) => near(x, i ? i1 : i2, `definition line ${i + 1}`));
  [...xs('trs'), ...xs('tra')].forEach((x, i) => near(x, want[i] + (i < P.tracings_subject.length ? 3 : 4) * A_ * K.trs[1], `tracing ${i + 1}`));
  near(xs('entry')[0] ?? i1, fmt === 'phone' ? 431.6 : 858.8, 'entry');
  const svgStamp = svg.match(/class="stamp"[^>]*>([^<]*)</)[1];
  assert.equal(svgStamp, stamp(p), `${where}: the stamp`);
  assert.ok(svgStamp.includes(CARD_AUTHOR), `${where}: the stamp credits the cataloger`);
}

const counts = {};
for (const [sid, S] of Object.entries(SERIES)) for (const [slug, p] of Object.entries(PRESETS[sid])) {
  // every ground, not only the preset's own: the app lets people switch it
  for (const pal of palettes) for (const role of GROUNDS) for (const [fmt, { w, h }] of Object.entries(FORMATS)) {
    const where = `${sid}/${slug}/${pal.slug}/${role}/${fmt}`;
    const svg = S.render({ preset: p, colors: ground(pal, role), format: fmt, handle: '', fonts });
    assert.match(svg, new RegExp(`^<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`), where);
    assert.ok(svg.endsWith('</svg>'), where);
    assert.deepEqual(leaked(svg), [], `${where}: bad value in an attribute`);
    assert.deepEqual(unexpected(svg, p, fmt), [], `${where}: text the preset does not hold`);
    for (const s of strings(p, fmt)) assert.ok(svg.includes(`>${esc(s)}</text>`), `${where}: missing ${s}`);
    assert.ok(svg.includes(`>${HANDLE} · ${MOTTO}</text>`), `${where}: default whoami`);
    assert.ok(svg.includes(fonts.nunito) && svg.includes(fonts.jbm), `${where}: fonts`);
    assert.ok(svg.includes('text{font-family:KMono') && svg.includes('font-variant-ligatures:none'), where);
    if (sid === 'cutting-mat') assert.ok(svg.includes('.t{font-size:') && /\.t\{[^}]*letter-spacing:0;/.test(svg), `${where}: halo labels need letter-spacing 0 (Safari cuts letters)`);
    assert.ok(!/<foreignObject|<div|<script/i.test(svg), `${where}: SVG text only`);
    balanced(svg);
    onCanvas(svg, w, h, where);
    if (sid === 'galley-proof') galleyRender(S, svg, pal, role, fmt, where);
    if (sid === 'catalog-card') cardRender(S, svg, pal, role, fmt, where, p);
    counts[sid] = (counts[sid] ?? 0) + 1;
  }
}

// film grain: every series takes it, and it adds the filter and one group around the sheet, nothing else
for (const [sid, S] of Object.entries(SERIES)) for (const fmt of Object.keys(FORMATS)) {
  const args = { preset: Object.values(PRESETS[sid])[0], colors: ground(palettes[0], 'mid'), format: fmt, handle: '', fonts };
  const plain = S.render(args), grain = S.render({ ...args, grain: true }), wrap = `<defs>${GRAIN}</defs><g filter="url(#grain)">`;
  assert.equal(grain.split(wrap).length, 2, `${sid}/${fmt}: the grain filter and its group, once`);
  assert.equal(grain.replace(wrap, '').replace(/<\/g><\/svg>$/, '</svg>'), plain, `${sid}/${fmt}: the grain changes nothing else`);
  balanced(grain);
}

// ---------- angular size: a wallpaper's pixels are scaled to the screen, so legibility is a visual angle
// arcmin per sheet px at the farthest viewing setup of each format: desktop 24" 1080p at 60 cm (27" 4K at 60 cm: 0.89),
// wide 13.6" MacBook Air 2560x1664 at 50 cm (14" MacBook Pro: 0.56), phone 6.7" phone at 36 cm
const ARCMIN = { desktop: 0.79, wide: 0.54, phone: 0.53 };
const XHEIGHT = { mono: 0.55, nunito: 0.484 };      // OS/2 sxHeight / unitsPerEm of the bundled fonts
const MIN_X = 4, MIN_STROKE = 1;                    // arcmin: a 20/20 letter's x-height; the finest line the eye resolves
// marks below the floor that stay (texture is exempt by rule: the grid's minor/major colors, lines with an opacity); Cutting Mat only
const THIN = [   // [format, element, stroke-width, why]
  ['wide', 'line', '1.5', 'ruler half-ticks'],
  ['phone', 'line', '1.6', 'ruler ticks'], ['phone', 'line', '1.2', 'ruler half-ticks'],
  ['phone', 'rect', '1.8', 'the dashed tape outline of a label'],
];
const SMALL = [['phone', 'vl', 'the rotated side label']];   // [format, class, why]
function angular(svg, colors, fmt, sid = '') {
  const k = ARCMIN[fmt], rules = [...svg.match(/<style>([\s\S]*?)<\/style>/)[1].matchAll(/([^{}@]+)\{([^}]*)\}/g)].map(m => [m[1].split(',').map(s => s.trim()), m[2]]);
  const decl = (tokens, prop) => rules.filter(([sel]) => sel.some(s => s === 'text' || tokens.some(t => s === `.${t}`))).map(([, d]) => d.match(new RegExp(`(?:^|;)${prop}:([^;]*)`))?.[1]).filter(Boolean);
  let text = Infinity, stroke = Infinity;
  const bad = [];
  for (const m of svg.matchAll(/<text\b([^>]*)>([^<]+)</g)) {
    const tokens = (/class="([^"]*)"/.exec(m[1])?.[1] ?? '').split(/\s+/), inline = /font-size[=:]"?([\d.]+)/.exec(m[1]);
    const size = inline ? +inline[1] : parseFloat(decl(tokens, 'font-size').pop()), nun = decl(tokens, 'font-family').pop()?.includes('KNunito');
    const x = size * (nun ? XHEIGHT.nunito : XHEIGHT.mono) * k;
    if (sid === 'cutting-mat' && SMALL.some(([f, c]) => f === fmt && tokens.includes(c))) continue;
    if (x < text) text = x;
    if (!(x >= MIN_X)) bad.push(`text "${m[2].slice(0, 20)}" (${tokens.join(' ')}) x-height ${x.toFixed(1)}′`);
  }
  for (const m of svg.matchAll(/<(?:line|path|rect|circle|polyline)\b[^>]*>/g)) {
    const a = Object.fromEntries([...m[0].matchAll(/ ([\w-]+)="([^"]*)"/g)].map(x => [x[1], x[2]]));
    if (a['stroke-width'] == null || !a.stroke || a.stroke === 'none' || a.stroke === colors.minor || a.stroke === colors.major || a.opacity != null) continue;
    const v = +a['stroke-width'] * k;
    if (sid === 'cutting-mat' && THIN.some(([f, tag, w]) => f === fmt && m[0].startsWith(`<${tag} `) && w === a['stroke-width'])) continue;
    if (v < stroke) stroke = v;
    if (!(v >= MIN_STROKE)) bad.push(`stroke ${a['stroke-width']}px (${m[0].slice(0, 40)}) ${v.toFixed(2)}′`);
  }
  return { text, stroke, bad };
}
let ANGULAR;
{
  const lines = [];
  for (const [sid, S] of Object.entries(SERIES)) {
    const cells = Object.keys(FORMATS).map(fmt => {
      const colors = ground(palettes[0], 'mid'), r = angular(S.render({ preset: Object.values(PRESETS[sid])[0], colors, format: fmt, handle: '', fonts }), colors, fmt, sid);
      assert.deepEqual(r.bad, [], `${sid} ${fmt}: below the angular floor at the farthest setup`);
      return `${fmt} text ≥ ${r.text.toFixed(1)}′ strokes ≥ ${r.stroke.toFixed(1)}′`;
    });
    lines.push(`${sid} ${cells.join(' · ')}`);
  }
  ANGULAR = lines.join(' · ');
  // the check bites: a 6px text is 3.6′ of x-height on the desktop, a half pixel line 0.4′ (grid colors and opacity stay exempt)
  const g = ground(palettes[0], 'mid'), tiny = `<svg><style>text{font-family:KMono}</style><text x="1" y="1" font-size="6">a</text><line x1="0" y1="0" x2="9" y2="0" stroke="#fff" stroke-width="0.5"/><line stroke="${g.minor}" stroke-width="0.5"/><line stroke="#fff" stroke-width="0.5" opacity=".3"/></svg>`;
  const hit = angular(tiny, g, 'desktop').bad;
  assert.equal(hit.length, 2, `angular check missed a 6px text or a 0.5px stroke; got ${JSON.stringify(hit)}`);
  const fine = '<svg><style>text{font-family:KMono}</style><text x="1" y="1" font-size="20">a</text><line stroke="#fff" stroke-width="2"/></svg>';
  assert.deepEqual(angular(fine, g, 'desktop').bad, [], 'angular check flags what is legible');
}

// ---------- overlap checker (app/check.js explains the boxes, tolerance and colors)
// every preset × format, checked with the default, a two-line and a three-line whoami box, each with the
// default and the longest whoami line

// the checker bites: each broken preset must be caught
{
  const base = presets[index[0].id], lay = base.layout, bite = (fmt, change, pattern, what) => {
    const hit = overlaps({ ...base, ...change }, fmt);
    assert.ok(hit.some(b => pattern.test(b)), `overlap checker missed ${what}; got ${JSON.stringify(hit)}`);
  };
  const moved = (f, k, i, pos) => ({ layout: { ...lay, [f]: { ...lay[f], [k]: lay[f][k].map((v, j) => (j === i ? pos : v)) } } });
  bite('desktop', moved('desktop', 'chips', 1, lay.desktop.chips[0]), /tape .* overlaps .*tape|findings\[\d\].* overlaps/, 'two tapes on one spot');
  bite('desktop', { phrase: ['WWWWWWWWWWWWWWWW'] }, /phrase\[0\].* does not fit inside its panel/, 'a phrase line too wide for its panel');
  bite('wide', moved('desktop', 'notes', 0, [18, 10]), /notes\[0\].* overlaps the phrase panel/, 'a note under the phrase panel');
  bite('desktop', { ...moved('desktop', 'notes', 2, [40, 20]), notes: [...base.notes.slice(0, 2), 'x'.repeat(LIMITS.notes)] },
    /notes\[2\].* crosses the frame/, 'a note running off the mat');   // a fixed note: the fixture must not depend on Vol. 01's words
  bite('phone', { flows: [`60° · ${'x'.repeat(40)}`, ...base.flows.slice(1)] }, /flows\[0\].* crosses the ISB-02 line/, 'a flow across a trust boundary');
  bite('phone', moved('phone', 'notes', 0, [4, 4]), /notes\[0\].* reaches the lock-screen clock/, 'a note under the phone clock');
}

// Specimen bites too: a broken sheet per rule, asserted on the message that names the problem. A sheet is broken
// by editing the preset, or the rendered SVG (a class font size, a text's position) where the renderer would refuse.
{
  const S = SERIES.specimen, base = PRESETS.specimen.crypto, G = GEOMETRY;   // crypto: the fixture the cases below are written for (hero IND)
  const says = (hit, pattern, what) => assert.ok(hit.some(b => pattern.test(b)), `overlap checker missed ${what}; got ${JSON.stringify(hit)}`);
  const bite = (fmt, change, pattern, what) => says(overlaps({ ...base, ...change }, fmt), pattern, what);
  const cut = (fmt, edit, pattern, what) => {
    const { w, h } = FORMATS[fmt], svg = edit(S.render({ preset: base, colors: PROBE, format: fmt, handle: '', fonts: null }));
    says(S.collisions(S.scene(svg, S.slotNames(base, fmt)), w, h, fmt === 'phone'), pattern, what);
  };
  const edit = (re, to) => svg => { assert.match(svg, re); return svg.replace(re, to); };
  const place = (cls, x, y) => edit(new RegExp(`<text x="[\\d.]+" y="[\\d.]+" class="${cls}"`), `<text x="${x}" y="${y}" class="${cls}"`);   // a class's first text
  const wfall = base.waterfall;
  for (const fmt of ['desktop', 'wide', 'phone']) {
    cut(fmt, edit(/(\.h\{[^}]*font-size:)\d+/, (_, a) => `${a}1500`), /^hero "IND" crosses the clip hairline/, `a hero too wide on ${fmt}`);
    bite(fmt, { charset: [{ glyph: 'WWWWWW', code: base.charset[0].code }, ...base.charset.slice(1)] }, /^charset\[0\] glyph "WWWWWW" does not fit inside its cell/, `a charset glyph overflowing its cell on ${fmt}`);
    if (fmt !== 'wide') bite(fmt, { notdef: 'x'.repeat(18) }, /^notdef "x+" does not fit inside its cell/, `a notdef label wider than its cell on ${fmt}`);   // wide cells hold all 18
    bite(fmt, { waterfall: { ...wfall, phrase: 'Short.' } }, /^waterfall line 1 \(\d+ pt\) "Short\." is not cut by the clip hairline/, `a phrase too short to be cut on ${fmt}`);
    bite(fmt, { waterfall: { ...wfall, phrase: 'W'.repeat(64) } }, new RegExp(`^waterfall line ${G[fmt].wf.sizes.length} \\(${G[fmt].wf.sizes.at(-1)} pt\\) "W+" is cut by the clip hairline`), `a phrase too long for the smallest line on ${fmt}`);
  }
  bite('desktop', { waterfall: { ...wfall, roles: ['x'.repeat(40), ...wfall.roles.slice(1)] } }, /^waterfall\.roles\[0\] .* ends after the start of its waterfall text/, 'a waterfall label running into its text');
  cut('desktop', place('d', 1400, G.desktop.data.y), /^status line left ".*" reaches the Dock/, 'a text in the Dock band');
  cut('wide', place('d', 1400, G.wide.data.y), /^status line left ".*" reaches the Dock/, 'a text in the Dock band (wide)');
  cut('desktop', place('ts', G.desktop.grid.x, 60), /^test ".*" reaches the menu bar/, 'a text in the menu bar');
  cut('desktop', edit(new RegExp(`<rect x="[\\d.]+" y="${G.desktop.who.y}"`), m => m.replace(/y="\d+"/, 'y="50"')), /^the whoami box reaches the menu bar/, 'a shape in the menu bar');
  cut('phone', place('d', G.phone.hero.x, 500), /^status line left ".*" reaches the lock-screen clock/, 'a text under the phone clock');
  cut('phone', place('d', G.phone.hero.x, 2700), /^status line left ".*" reaches the phone's bottom buttons/, 'a text in the phone\'s bottom 260px');
  cut('desktop', place('cl', G.desktop.hero.x, G.desktop.fam.base), /^family ".*" overlaps class ".*"/, 'two texts overlapping');
  cut('desktop', place('nt', 2300, 1810), /^notes\[0\] ".*" crosses the clip hairline/, 'a left-column note in the right column');
  cut('desktop', place('lb', 2200, 1200), /^waterfall\.roles\[0\] ".*" crosses the clip hairline/, 'a waterfall label past the hairline');
  // whatever four capitals, the hero the renderer sizes passes; a hero with a descender really runs into the family name
  for (const fmt of ['desktop', 'wide', 'phone']) for (const hero of ['WWWW', 'MWMW', 'IND', '0123'])
    assert.deepEqual(overlaps({ ...base, hero }, fmt).filter(b => /^hero/.test(b)), [], `hero "${hero}" on ${fmt}`);
  bite('desktop', { hero: 'gypq' }, /^hero "gypq" overlaps family/, 'a hero whose descenders reach the family name');
}

const problems = [], sheets = {};
for (const [sid, S] of Object.entries(SERIES)) if (S.collisions) for (const e of INDEX[sid]) for (const fmt of Object.keys(FORMATS)) {
  for (const b of overlaps(PRESETS[sid][e.id], fmt)) problems.push(`${sid}/${e.id}/${fmt}: ${b}`);
  sheets[sid] = (sheets[sid] ?? 0) + HANDLES.length * MOTTOS.length;
}
if (problems.length) assert.fail(`overlap checker: ${problems.length} collision(s)\n  ${problems.join('\n  ')}`);

// ---------- escaping, handles, whoami lines, format details

assert.equal(esc(`<&>"'`), '&lt;&amp;&gt;&quot;&apos;');
assert.equal(esc('a\u0000b\u001Fc'), 'abc');
const { render } = SERIES['cutting-mat'], p = presets.appsec, colors = ground(palettes[0], p.ground);
const evil = render({ preset: p, colors, format: 'desktop', handle: '<b>&"x', fonts });
assert.ok(evil.includes(`>&lt;b&gt;&amp;&quot;x · ${MOTTO}</text>`), 'handle escaped');
assert.ok(!evil.includes('<b>'), 'raw handle leaked');
balanced(evil);
assert.throws(() => render({ preset: p, colors: { ...colors, bg: 'red"/><script>' }, format: 'desktop', fonts }), /bad color/);
assert.throws(() => render({ preset: p, colors, format: 'desktop', fonts: { nunito: 'x");}<' } }), /data: URL/);
assert.throws(() => render({ preset: p, colors, format: 'square', fonts }), /unknown format/);

// handle rules, whoami lines and the whoami box
for (const ok of ['0xF3tt', 'a', 'a.b-c_d', 'x'.repeat(20)]) assert.ok(validHandle(ok), ok);
for (const bad of ['', 'x'.repeat(21), 'a b', '<b>', 'ñandú', null, 42]) assert.ok(!validHandle(bad), String(bad));
for (const ok of [MOTTO, 'a', 'explorando los colores púrpura', 'x'.repeat(LIMITS.motto)]) assert.ok(validMotto(ok), ok);
for (const bad of ['', ' a', 'a ', 'x'.repeat(LIMITS.motto + 1), 'a\nb', null, 42]) assert.ok(!validMotto(bad), String(bad));
assert.deepEqual(whoamiLines(''), ['# whoami', `${HANDLE} · ${MOTTO}`]);
assert.deepEqual(whoamiLines(HANDLES[1]), ['# whoami', `${HANDLES[1]} · ${MOTTO}`]);     // 48 chars: still 2 lines
assert.deepEqual(whoamiLines(`${HANDLES[1]}a`), ['# whoami', `${HANDLES[1]}a`, MOTTO]);   // 49: wraps
assert.deepEqual(whoamiLines('r2', 'reading the fine print'), ['# whoami', 'r2 · reading the fine print']);
assert.deepEqual(whoamiLines('x'.repeat(20), 'y'.repeat(40)), ['# whoami', 'x'.repeat(20), 'y'.repeat(40)]);
const long = 'x'.repeat(20);
for (const fmt of Object.keys(FORMATS)) {
  const svg = render({ preset: p, colors, format: fmt, handle: long, fonts });
  const box = [...svg.matchAll(/class="w"[^>]*>([^<]*)</g)].map(m => m[1]);
  assert.deepEqual(box, ['# whoami', long, MOTTO], `${fmt}: long handle -> 3 lines`);
  assert.ok(svg.includes('>0xF3tt</text>'), `${fmt}: signature stays 0xF3tt`);
}

// the status line's prompt is the viewer's handle; the side signature stays the author's
for (const fmt of Object.keys(FORMATS)) {
  const svg = render({ preset: p, colors, format: fmt, handle: 'r2_labs', motto: 'reading the fine print', fonts });
  const right = (fmt === 'phone' ? p.phone?.data?.right : null) ?? p.data.right;
  assert.ok(svg.includes(`>${esc(right.replace('{handle}', 'r2_labs'))}</text>`), `${fmt}: status line follows the handle`);
  const box = [...svg.matchAll(/class="w"[^>]*>([^<]*)</g)].map(m => m[1]).join('\n');   // the side label also says kernspace
  assert.ok(!svg.includes('{handle}') && !box.includes(HANDLE) && !svg.includes(`>${esc(right.replace('{handle}', HANDLE))}<`), `${fmt}: no default name left in the prompt or the whoami box`);
  assert.ok(svg.includes('>0xF3tt</text>'), `${fmt}: signature stays 0xF3tt`);
  assert.ok(svg.includes('>r2_labs · reading the fine print</text>'), `${fmt}: whoami line`);
}

// phone status lines merge over desktop ones: a right-only override keeps the left line
const part = render({ preset: { ...p, phone: { data: { right: 'R' } } }, colors, format: 'phone', fonts });
assert.ok(part.includes(`>${esc(p.data.left)}</text>`) && part.includes('>R</text>'), 'phone data merge');

// wide: the 45° diagonal (x + y = 2400) keeps clear of every panel corner
const wide = render({ preset: p, colors, format: 'wide', fonts });
for (const [, x, y, w, h] of wide.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="[^"]+" stroke="[^"]+" stroke-width="2.5"\/>/g))
  for (const [cx, cy] of [[+x, +y], [+x + +w, +y], [+x, +y + +h], [+x + +w, +y + +h]])
    assert.ok(Math.abs(cx + cy - 2400) / Math.SQRT2 > 40, `wide: panel corner ${cx},${cy} on the diagonal`);

// no fonts yet (first paint) still renders
assert.ok(!render({ preset: p, colors, format: 'phone', fonts: null }).includes('@font-face'));

// ---------- Specimen: its preset shape, the waterfall clip, the hero column, the phone and keep-clear zones

{
  const S = SERIES.specimen, CM = new Set(index.map(e => e.topic)), sp = PRESETS.specimen;
  const SKEYS = ['series', 'topic', 'title', 'ground', 'hero', 'family', 'class', 'waterfall', 'charset', 'notdef', 'confusables', 'matrix', 'test', 'notes', 'label', 'data', 'phone'];
  const NUNITO_800 = advances(readFileSync(file('fonts/nunito/Nunito-Variable.ttf')), { wght: 800 });
  const em = str => [...str].reduce((a, ch) => a + NUNITO_800.get(ch.codePointAt(0)), 0);
  for (const e of INDEX.specimen) {
    const p = sp[e.id], at = `specimen ${e.id}.json`, name = e.title.match(TITLE)[2];
    keys(p, SKEYS, at);
    for (const k of SKEYS.filter(k => k !== 'phone')) assert.ok(k in p, `${at}: missing "${k}"`);
    assert.equal(p.series, 'specimen', `${at}: series`);
    for (const k of ['topic', 'title', 'ground']) assert.equal(p[k], e[k], `${at}: ${k} differs from index.json`);
    assert.ok(CM.has(p.topic), `${at}: no Cutting Mat volume for this topic`);
    str(p.hero, 4, `${at} hero`); str(p.family, 24, `${at} family`); str(p.class, 36, `${at} class`);
    keys(p.waterfall, ['phrase', 'roles'], `${at} waterfall`);
    str(p.waterfall.phrase, 64, `${at} waterfall.phrase`);
    assert.equal(p.waterfall.roles.length, 5, `${at} waterfall.roles: five principals, least to most privileged`);
    list(p.waterfall.roles, 5, 12, `${at} waterfall.roles`);
    assert.ok(Array.isArray(p.charset) && p.charset.length >= 11 && p.charset.length <= 23, `${at} charset: 11-23 entries (plus the .notdef cell)`);
    p.charset.forEach((c, i) => {
      keys(c, ['glyph', 'code'], `${at} charset[${i}]`);
      str(c.glyph, 6, `${at} charset[${i}].glyph`); str(c.code, 10, `${at} charset[${i}].code`);
    });
    assert.equal(new Set(p.charset.map(c => c.code)).size, p.charset.length, `${at} charset: duplicate code points`);
    assert.equal(new Set(p.charset.map(c => c.glyph)).size, p.charset.length, `${at} charset: duplicate glyphs`);
    str(p.notdef, 18, `${at} notdef`);
    assert.ok(p.confusables.length === 2 && p.confusables.every(c => c.length === 2), `${at} confusables: two [text, code] pairs`);
    p.confusables.forEach(([t, c], i) => { str(t, 12, `${at} confusables[${i}] text`); str(c, 10, `${at} confusables[${i}] code`); });
    keys(p.matrix, ['axes', 'cell', 'rating'], `${at} matrix`);
    list(p.matrix.axes, 2, 12, `${at} matrix.axes`);
    assert.equal(p.matrix.axes.length, 2, `${at} matrix.axes: two axes`);
    assert.ok(p.matrix.cell.length === 2 && p.matrix.cell.every(v => Number.isInteger(v) && v >= 1 && v <= 4), `${at} matrix.cell: [impact, likelihood], each 1-4`);
    str(p.matrix.rating, 24, `${at} matrix.rating`);
    assert.ok(p.matrix.rating.startsWith(p.matrix.cell.join('')), `${at} matrix.rating: should start with the filled cell "${p.matrix.cell.join('')}"`);
    str(p.test, 44, `${at} test`);
    assert.ok(p.notes.length >= 2 && p.notes.length <= 3, `${at} notes: 2-3`);
    list(p.notes, 3, 28, `${at} notes`);
    str(p.label, 40, `${at} label`);
    assert.ok(p.label.endsWith(`VOL. ${pad2(e.vol)} · ${name.toUpperCase()}`), `${at} label: should end with "VOL. ${pad2(e.vol)} · ${name.toUpperCase()}"`);
    keys(p.data, ['left', 'right'], `${at} data`);
    for (const k of ['left', 'right']) str(p.data[k], 44, `${at} data.${k}`);
    if ('phone' in p) { keys(p.phone, ['data'], `${at} phone`); keys(p.phone.data, ['left', 'right'], `${at} phone.data`); }
    assert.ok(!/ISB-0/.test(JSON.stringify(p)), `${at}: the ISB tags belong to Cutting Mat only`);
    // glyph coverage: Nunito draws the hero, family and waterfall phrase; JetBrains Mono everything else
    for (const t of [p.hero, p.family, p.waterfall.phrase, ...p.charset.map(c => c.glyph)]) for (const ch of t)
      assert.ok(NUNITO_800.has(ch.codePointAt(0)), `${at}: "${ch}" (${hexCp(ch)}) in "${t}" is not a Nunito glyph`);
    const mono = [p.class, ...p.waterfall.roles, ...p.charset.map(c => c.code), p.notdef, ...p.confusables.flat(), ...p.matrix.axes, p.matrix.rating,
      p.test, ...p.notes, p.label, ...Object.values(p.data), ...Object.values(p.phone?.data ?? {})];
    for (const t of mono) for (const ch of t) assert.equal(MONO_ADV.get(ch.codePointAt(0)), 0.6, `${at}: "${ch}" (${hexCp(ch)}) in "${t}" is not a JetBrains Mono glyph`);
    // the hero fits its column at the size the renderer picks, whatever four capitals: WWWW is the widest
    for (const [fmt, g] of Object.entries(GEOMETRY)) for (const hero of [p.hero, 'WWWW', 'MWMW']) {
      const size = heroSize(hero, g.clip - g.hero.x - 40), width = em(hero) * size;
      assert.ok(hero.length > 4 || width <= g.clip - g.hero.x - 40 + 1, `${at} ${fmt}: hero "${hero}" is ${Math.round(width)}px wide, its column holds ${g.clip - g.hero.x - 40}`);
      assert.ok(size >= (fmt === 'phone' ? 200 : 300), `${at} ${fmt}: hero "${hero}" shrinks to ${size}px`);
    }
    // every format: the waterfall clips at the hairline, its lines carry class wf, the grid is charset + .notdef
    for (const [fmt, g] of Object.entries(GEOMETRY)) {
      const svg = S.render({ preset: p, colors: ground(palettes[0], p.ground), format: fmt, handle: '', fonts });
      const where = `${at} ${fmt}`, wf = [...svg.matchAll(/<text [^>]*class="wf w\d"[^>]*clip-path="url\(#wf\)"/g)];
      assert.equal(wf.length, g.wf.sizes.length, `${where}: waterfall lines`);
      assert.match(svg, new RegExp(`<clipPath id="wf"><rect x="0" [^>]*width="${g.clip}"`), `${where}: clip at the hairline x`);
      assert.ok(new RegExp(`<line x1="${g.clip}" [^>]*x2="${g.clip}" `).test(svg), `${where}: hairline`);
      const cells = Math.min(p.charset.length, g.chars) + 1, rows = Math.ceil(cells / g.grid.cols);
      assert.ok(rows >= (fmt === 'phone' ? 3 : 2) && rows <= (fmt === 'phone' ? 3 : fmt === 'wide' ? 5 : 4), `${where}: grid rows (${rows})`);   // a short vocabulary leaves the last rows empty
      assert.equal(g.grid.cols, fmt === 'phone' ? 4 : fmt === 'wide' ? 5 : 6, `${where}: grid columns`);
      assert.equal(svg.match(new RegExp(`stroke="${ground(palettes[0], p.ground).tb}"`, 'g')).length, 2, `${where}: the .notdef cell and its tofu box are the only accent marks`);
      // keep-clear: nothing drawn in the menu bar; phone: nothing above the clock line or in the bottom 260px
      const H = FORMATS[fmt].h, ys = [...svg.matchAll(/<(?:rect|text|line) [^>]*?\by="([\d.]+)"/g)].map(m => +m[1]);
      if (fmt === 'phone') assert.ok(ys.every(y => y >= 932 && y <= H - 260), `${where}: text or marks in the clock or bottom-button zone`);
      else assert.ok(ys.every(y => y >= 110), `${where}: marks in the menu bar`);
    }
  }
  // the renderer rejects what it cannot draw, as Cutting Mat's does
  const sp0 = sp[INDEX.specimen[0].id], c0 = ground(palettes[0], sp0.ground);
  assert.throws(() => S.render({ preset: sp0, colors: { ...c0, bg: 'red"/><script>' }, format: 'desktop', fonts }), /bad color/);
  assert.throws(() => S.render({ preset: sp0, colors: c0, format: 'desktop', fonts: { nunito: 'x");}<' } }), /data: URL/);
  assert.throws(() => S.render({ preset: sp0, colors: c0, format: 'square', fonts }), /unknown format/);
  const evil = S.render({ preset: sp0, colors: c0, format: 'desktop', handle: '<b>&"x', fonts });
  assert.ok(evil.includes(`>&lt;b&gt;&amp;&quot;x · ${MOTTO}</text>`) && !evil.includes('<b>'), 'specimen: handle escaped');
  balanced(evil);
  assert.ok(S.render({ preset: sp0, colors: c0, format: 'phone', handle: 'r2_labs', fonts }).includes('>r2_labs · blue builds</text>'), 'specimen: the prompt is the viewer\'s');
  assert.ok(!S.render({ preset: sp0, colors: c0, format: 'phone', fonts: null }).includes('@font-face'), 'specimen: no fonts yet still renders');
}

// ---------- Galley Proof: its preset shape and content rules, a fixture with all eight mark types, the checker bites, renderer safety

{
  const S = SERIES['galley-proof'], GP = PRESETS['galley-proof'], TYPES = Object.keys(KEY), NEEDS_AT = ['dele', 'sub', 'ins', 'wf', 'stet', 'space'];
  // the preset's drawn strings by font; `to` and the key's mono names are mono, glosses and phrases are Nunito
  const everyString = (v, out = []) => (typeof v === 'string' ? out.push(v) : v && typeof v === 'object' && Object.values(v).forEach(x => everyString(x, out)), out);
  function checkGalley(p, e, at) {   // every content rule of one preset; throws on the first it breaks
    const name = e.title.match(TITLE)[2];
    keys(p, ['series', 'topic', 'title', 'ground', 'phrase', 'file', 'lines', 'marks', 'errata', 'notes', 'label', 'data', 'phone'], at);
    for (const k of ['series', 'topic', 'title', 'ground', 'phrase', 'file', 'lines', 'marks', 'errata', 'notes', 'label', 'data']) assert.ok(k in p, `${at}: missing "${k}"`);
    assert.equal(p.series, 'galley-proof', `${at}: series`);
    for (const k of ['topic', 'title', 'ground']) assert.equal(p[k], e[k], `${at}: ${k} differs from index.json`);
    list(p.phrase, 2, 18, `${at} phrase`); assert.ok(p.phrase.length >= 1, `${at} phrase: one or two lines`);
    str(p.file, 20, `${at} file`); assert.match(p.file, /^[\w.-]+$/, `${at} file`);
    list(p.lines, 12, 40, `${at} lines`, { indent: true }); assert.ok(p.lines.length >= 8, `${at} lines: 8-12`);
    p.lines.forEach((l, i) => assert.ok(!/\S {2,}/.test(l), `${at} lines[${i}]: a run of 2+ spaces after the indent`));
    assert.ok(Array.isArray(p.marks) && p.marks.length >= 4 && p.marks.length <= 7, `${at} marks: 4-7`);
    p.marks.forEach((m, i) => {
      const w = `${at} marks[${i}]`, ln = p.lines[m.line - 1]?.trimStart();
      keys(m, ['line', 'type', 'at', 'to', 'note', 'phone'], w);
      assert.ok(TYPES.includes(m.type), `${w}: type ${m.type}`);
      assert.ok(Number.isInteger(m.line) && ln != null, `${w}: line points into lines`);
      assert.equal(p.marks.filter(x => x.line === m.line).length, 1, `${w}: more than one mark on line ${m.line}`);
      if (NEEDS_AT.includes(m.type)) { str(m.at, 40, `${w} at`); assert.equal(ln.split(m.at).length - 1, 1, `${w}: "${m.at}" must occur exactly once in line ${m.line}`); }
      else assert.ok(!('at' in m), `${w}: ${m.type} takes no at`);
      if (m.type === 'sub' || m.type === 'ins') str(m.to, 24, `${w} to`); else assert.ok(!('to' in m), `${w}: only sub and ins take to`);
      str(m.note, 18, `${w} note`); str(m.phone, m.type === 'stet' ? 10 : ['tr', 'wf'].includes(m.type) ? 12 : 14, `${w} phone`);
      if (m.type === 'tr') assert.ok(m.line < p.lines.length, `${w}: tr is never on the last line`);
    });
    const sub = p.marks.find(m => m.line === p.errata?.line);
    keys(p.errata, ['line', 'throughout'], `${at} errata`);
    assert.equal(sub?.type, 'sub', `${at} errata.line must point at a sub mark`);
    assert.ok(len(`for ${sub.at} read ${sub.to}`) <= 36, `${at} errata: the sub line is over 36`);
    str(p.errata.throughout, 36, `${at} errata.throughout`); assert.match(p.errata.throughout, /^for .+ read .+$/, `${at} errata.throughout`);
    list(p.notes, 3, 28, `${at} notes`); assert.ok(p.notes.length >= 2, `${at} notes: 2-3`);
    str(p.label, 40, `${at} label`); assert.ok(p.label.endsWith(`VOL. ${pad2(e.vol)} · ${name.toUpperCase()}`), `${at} label: should end with "VOL. ${pad2(e.vol)} · ${name.toUpperCase()}"`);
    keys(p.data, ['left', 'right'], `${at} data`);
    for (const k of ['left', 'right']) str(p.data[k], 44, `${at} data.${k}`);
    keys(p.phone, ['data'], `${at} phone`);
    for (const k of Object.keys(p.phone.data)) str(p.phone.data[k], 30, `${at} phone.data.${k}`);
    const panel = PRESETS['cutting-mat'][p.topic]?.panel, cm = new Set((panel?.lines ?? []).map(l => l.trim()));   // kinship with the terminal panel stops at the topic
    assert.ok(panel?.title !== p.file && !p.lines.some(l => cm.has(l.trim())), `${at}: shares a file name or a line with Cutting Mat's ${p.topic} panel`);
    if (p.topic === 'dfir') assert.ok(p.marks.every(m => ['stet', 'query', 'sub'].includes(m.type)) && p.marks.filter(m => m.type === 'sub').length <= 1, `${at}: dfir takes only stet and query, and at most one sub`);
    for (const t of everyString(p)) {
      for (const [h] of t.matchAll(/\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|dev|app|ai|co|cloud|gov|edu)\b/gi)) assert.match(h, /(^|\.)example\.(com|org|net)$/i, `${at}: "${t}" names a real-looking domain`);
      assert.ok(!/[<>&]/.test(t), `${at}: "${t}" holds <, > or &`);
      assert.ok(!/@\w[\w.-]*\.\w/.test(t), `${at}: "${t}" looks like an email address`);
      for (const [, a, b, c] of t.matchAll(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}\b/g)) assert.ok(+a === 127 || ['192.0.2', '198.51.100', '203.0.113'].includes(`${a}.${b}.${c}`), `${at}: "${t}" holds a real-looking IPv4 address`);
    }
    for (const s of [...galleyMono(p, 'desktop'), ...Object.values(p.phone?.data ?? {}), ...p.lines, ...p.marks.flatMap(m => [m.at, m.to, m.phone])].filter(Boolean)) for (const ch of s)
      assert.equal(MONO_ADV.get(ch.codePointAt(0)), 0.6, `${at}: "${ch}" (${hexCp(ch)}) in "${s}" is not a JetBrains Mono glyph`);
    for (const s of [...p.phrase, ...p.marks.map(m => m.note), ...p.marks.filter(m => m.type === 'query').map(m => m.phone), ...Object.values(KEY).map(k => k[1]), 'tr', 'wf', 'stet', '?']) for (const ch of s)
      assert.ok(NUNITO_ADV.has(ch.codePointAt(0)), `${at}: "${ch}" (${hexCp(ch)}) in "${s}" is not a Nunito glyph`);
  }
  for (const e of INDEX['galley-proof']) checkGalley(GP[e.id], e, `galley-proof/${e.id}.json`);

  // a defensive Python file with all eight mark types, test-only
  const FIXTURE = {
    series: 'galley-proof', topic: 'crypto', title: 'Vol. 09 · Key', ground: 'dark', phrase: ['Trust no input', 'log less'], file: 'app.py',
    lines: ['import logging', 'log = logging.getLogger("app")', 'def handle(body):', '    log.info(body)', '    body = redact(body)',
      '    token = os.environ["TOKEN"]', '    print(token)', '    if user.is_admin or True:', '    return render(body)', '    verify(sig)', '    ok = check(a, b)'],
    marks: [
      { line: 2, type: 'query', note: 'which logger?', phone: 'which?' }, { line: 4, type: 'tr', note: 'redact first', phone: 'swap' },
      { line: 6, type: 'wf', at: 'environ', note: 'use the vault', phone: 'vault' }, { line: 7, type: 'dele', at: 'print(token)', note: 'never print secrets', phone: 'remove' },
      { line: 8, type: 'sub', at: 'or True', to: 'and audited', note: 'no bypass', phone: 'and audited' }, { line: 9, type: 'ins', at: 'render', to: 'escape', note: 'escape output', phone: 'escape' },
      { line: 10, type: 'stet', at: 'verify', note: 'checked upstream', phone: 'keep' }, { line: 11, type: 'space', at: 'b', note: 'keep apart', phone: 'space' },
    ],
    errata: { line: 8, throughout: 'for MD5 read SHA-256' }, notes: ['trust no input', 'log less, not more'], label: 'CRYPTO GALLEY · VOL. 09 · KEY',
    data: { left: 'exit 0', right: '{handle} · git:(main) · ok' }, phone: { data: { right: '{handle} · ok' } },
  };
  assert.equal(tally({ lines: Array(9).fill('x'), marks: [{ type: 'query' }, { type: 'query' }, { type: 'stet' }, { type: 'stet' }, { type: 'sub' }] }), '9 lines · 1 change · 2 queries · 2 stet');
  // crypto's renders come from the series loops above, with galleyRender; the fixture is no volume, so it has a matrix of its own
  for (const pal of palettes) for (const role of GROUNDS) for (const [fmt, { w, h }] of Object.entries(FORMATS)) {
    const p = FIXTURE, where = `galley-proof/fixture/${pal.slug}/${role}/${fmt}`, svg = S.render({ preset: p, colors: ground(pal, role), format: fmt, handle: '', fonts });
    assert.deepEqual(leaked(svg), [], `${where}: bad value in an attribute`);
    assert.deepEqual(unexpected(svg, p, fmt), [], `${where}: text the preset does not hold`);
    for (const s of strings(p, fmt)) assert.ok(svg.includes(`>${esc(s)}</text>`), `${where}: missing ${s}`);
    balanced(svg);
    onCanvas(svg, w, h, where);
    galleyRender(S, svg, pal, role, fmt, where);
  }
  const g0 = GP.crypto, gc = ground(palettes[0], 'dark'), gargs = { preset: g0, colors: gc, handle: '', fonts };
  assert.throws(() => S.render({ ...gargs, colors: { ...gc, bg: 'red"/><script>' }, format: 'desktop' }), /bad color/);
  assert.throws(() => S.render({ ...gargs, format: 'desktop', fonts: { nunito: 'x");}<' } }), /data: URL/);
  assert.throws(() => S.render({ ...gargs, format: 'square' }), /unknown format/);
  const gevil = S.render({ ...gargs, format: 'desktop', handle: '<b>&"x' });
  assert.ok(gevil.includes(`>&lt;b&gt;&amp;&quot;x · ${MOTTO}</text>`) && !gevil.includes('<b>'), 'galley-proof: handle escaped');
  balanced(gevil);
  assert.ok(gevil.includes('>0xF3tt</text>') && !gevil.includes('>&lt;b&gt;&amp;&quot;x</text>'), 'galley-proof: the slug signature is the author, never the handle');
  assert.ok(S.render({ ...gargs, format: 'phone', handle: 'r2_labs' }).includes('>r2_labs · blue builds</text>'), 'galley-proof: the prompt is the viewer\'s');
  assert.ok(!S.render({ ...gargs, format: 'phone', fonts: null }).includes('@font-face'), 'galley-proof: no fonts yet still renders');
  assert.equal(tally(g0), '11 lines · 5 changes · 1 query · 1 stet');
  assert.deepEqual(slip(g0, '09'), ['sshd_config, l. 2:', 'for ssh-rsa read ssh-ed25519', 'throughout:', 'for Kyber read ML-KEM']);
  assert.equal(slip({ ...g0, errata: { ...g0.errata, line: 5 } }, '09')[1], 'for hmac-sha1 read hmac-sha2-256', 'galley-proof: the slip repeats the sub at errata.line');
  assert.equal(KEY_HEAD, 'PROOF MARKS · CMOS 18');
  assert.deepEqual(KEY, { dele: ['delete', 'remove what must not ship'], sub: ['replace', 'set the right value'], ins: ['insert', 'add the missing control'], tr: ['transpose', 'wrong order · CWE-696'],
    wf: ['wrong font', 'wrong type · CWE-843'], stet: ['let it stand', 'risk accepted, on record'], query: ['query', 'open question to the author'], space: ['insert space', 'keep apart · CWE-653'] }, 'galley-proof: the key, word for word');
  assert.ok(Object.keys(GALLEY).join() === 'desktop,wide,phone', 'galley-proof: geometry per format');
  const gused = S.usedStrings(g0, 'notes.0');
  assert.ok(g0.lines.every((_, i) => gused.get(String(i + 1)) === 'the line numbers') && gused.get(AUTHOR) === 'the head slug', 'galley-proof: usedStrings holds the line numbers and the initials');
  assert.equal(S.phoneCap(g0, 'data.left'), 26, 'galley-proof: data.left keeps to the phone\'s room beside a 20-character handle');
  assert.ok(!SERIES['cutting-mat'].phoneCap && !SERIES.specimen.phoneCap, 'cutting-mat and specimen do not cap data.left below LIMITS.phone: only Galley Proof and Catalog Card do');

  // the checker bites: a broken copy of crypto (or the fixture) for each rule, asserted on the message that names the problem. A sheet is
  // broken by editing the preset, or the rendered SVG (a text's place, a mark's path) where the renderer would refuse.
  const says = (hit, pattern, what) => assert.ok(hit.some(b => pattern.test(b)), `overlap checker missed ${what}; got ${JSON.stringify(hit)}`);
  const cut = (p, fmt, edit, pattern, what) => {
    const { w, h } = FORMATS[fmt], svg = edit(S.render({ preset: p, colors: PROBE, format: fmt, handle: '', fonts: null }));
    says(S.collisions(S.scene(svg, S.slotNames(p, fmt)), w, h, fmt === 'phone'), pattern, what);
  };
  const edit = (re, to) => svg => { assert.match(svg, re); return svg.replace(re, to); };
  const place = (cls, x, y) => edit(new RegExp(`<text x="[\\d.]+" y="[\\d.]+" class="${cls}"`), `<text x="${x}" y="${y}" class="${cls}"`);   // a class's first text
  const move = (d, dx, dy) => d.replace(/([MLHVC])([^MLHVC]*)/g, (m, c, a) => {   // a path moved by (dx, dy)
    const v = a.trim().split(/[ ,]+/).map(Number);
    return c === 'H' ? `H${v[0] + dx}` : c === 'V' ? `V${v[0] + dy}` : c + v.map((x, i) => (i % 2 ? x + dy : x + dx)).join(',');
  });
  const moveY = (d, dy) => move(d, 0, dy);
  const row = (n, f) => svg => { const parts = svg.split(/(?=<text [^>]*class="gn")/); parts[n] = f(parts[n]); return parts.join(''); };   // line n's elements: from its gutter to the next
  const markDown = (n, dy) => row(n, r => r.replace(/<path d="([^"]*)"/g, (m, d) => (+d.match(/^M([\d.]+)/)[1] < 1800 ? `<path d="${moveY(d, dy)}"` : m)));   // its in-text paths, one line lower
  const marginMove = (n, dx, dy) => row(n, r => r.replace(/<path d="([^"]*)"/g, (m, d) => (+d.match(/^M([\d.]+)/)[1] >= 1800 ? `<path d="${move(d, dx, dy)}"` : m)));   // its margin symbol or ring, moved
  const marginDown = (n, dy) => marginMove(n, 0, dy);
  const crypto = GP.crypto, g = GALLEY.desktop;
  cut(crypto, 'desktop', markDown(4, g.code.pitch), /^the mark on line 4 leaves its row band/, 'a mark one line below its own');
  cut(crypto, 'desktop', edit(/translate\(1150,1650\)/g, 'translate(600,1420)'), /^code line 11 ".*" overlaps the slip/, 'the slip over line 11');
  says(overlaps({ ...crypto, marks: crypto.marks.map((m, i) => (i === 2 ? { ...m, note: 'W'.repeat(40) } : m)) }, 'desktop'), /^margin 4 gloss ".*" runs into the key column/, 'a margin note running into the key column');
  cut(crypto, 'desktop', place('d', 1400, g.data.y), /^status line left ".*" reaches the Dock/, 'a status line in the Dock');
  cut(crypto, 'phone', place('d', GALLEY.phone.left, 500), /^status line left ".*" reaches the lock-screen clock/, 'a text under the phone clock');
  cut(crypto, 'desktop', place('ty', g.code.x, g.code.base), /^code line 1 ".*" overlaps tally/, 'two overlapping texts');

  // one bite per rule left, each on the message that names it (mutation-checked: disabling the rule lets its bite through)
  const text = (n, cls, x, y) => row(n, r => r.replace(new RegExp(`<text x="[\\d.]+" y="[\\d.]+" class="${cls}"`), `<text x="${x}" y="${y}" class="${cls}"`));   // line n's first text of a class
  const noteMove = (dx, dy) => edit(/<path d="([^"]*)"([^>]*\/>)<text x="([\d.]+)" y="([\d.]+)"( class="nt")/, (m, d, r, x, y, c) => `<path d="${move(d, dx, dy)}"${r}<text x="${+x + dx}" y="${+y + dy}"${c}`);   // the first note and its ring
  const slipAt = (x, y) => edit(/translate\(1150,1650\)/g, `translate(${x},${y})`);
  // 2: a text leaves its home
  cut(crypto, 'desktop', place('sl', 1700, g.slug.base), /^slug ".*" does not fit inside the strip/, 'a slug leaving the strip');
  cut(crypto, 'desktop', place('hl', 1500, g.hl.bases[0]), /^phrase\[0\] ".*" does not fit inside the strip/, 'a headline leaving the strip');
  cut(crypto, 'desktop', place('cd', 1760, g.code.base), /^code line 1 ".*" does not fit inside the strip/, 'a code line leaving the strip');
  cut(crypto, 'desktop', place('ty', 1500, g.foot.base), /^tally ".*" does not fit inside the strip/, 'a tally leaving the strip');
  cut(crypto, 'desktop', place('eb', 700, 92), /^slip line 1 ".*" does not fit inside the slip/, 'a slip line outside the slip');
  cut(crypto, 'desktop', place('eh', 700, 46), /^slip head ".*" does not fit inside the slip/, 'the slip head outside the slip');
  cut(crypto, 'desktop', place('k', 3600, 1688.8), /^whoami line ".*" does not fit inside its box/, 'a whoami line outside its box');
  // 3: an in-text mark stays in its band and off other lines
  cut(crypto, 'desktop', edit(/<path d="M913.07,694.67 H1125.33"/, '<path d="M290,694.67 H400"'), /^the mark on line 2 leaves its row band/, 'a mark left of the strip');
  cut(crypto, 'desktop', markDown(5, -g.code.pitch), /^the mark on line 5 overlaps code line 4/, 'a mark over another line\'s text');
  cut(crypto, 'desktop', edit(/<path d="M538.67,958.67 H808.53"/, '<path d="M240,870.67 H300"'), /^the mark on line 5 overlaps gutter 4/, 'a mark over a gutter number');
  cut(crypto, 'desktop', edit(/<path d="M538.67,958.67 H808.53"/, '<path d="M938,870.67 H1208"'), /^the mark on line 4 overlaps the mark on line 5/, 'two marks touching');
  // 4: a margin item beside its line, right of the strip, clear of the others and the key
  cut(crypto, 'desktop', text(2, 'mt', 1840, 730), /^margin 2 matter ".*" is not level with code line 2/, 'a margin text off its baseline');
  cut(crypto, 'desktop', text(2, 'mt', 1700, 708), /^margin 2 matter ".*" starts left of the margin/, 'a margin text left of the margin');
  cut(crypto, 'desktop', marginMove(4, -60, 0), /^margin 4 mark starts left of the margin/, 'a dele loop left of the margin');
  cut(crypto, 'desktop', marginMove(4, 1000, 0), /^margin 4 mark runs into the key column/, 'a dele loop in the key column');
  cut(crypto, 'desktop', text(4, 'gl', 1850, 884), /^margin 4 gloss ".*" overlaps margin 4 mark/, 'a gloss over a margin symbol');
  cut(crypto, 'desktop', marginMove(6, 0, 4 * g.code.pitch), /^margin 6 ring overlaps margin 10 ring/, 'two margin rings');
  // 5: the slip hides nothing and stays tipped on the strip
  cut(crypto, 'desktop', slipAt(0, 1420), /^gutter 11 "11" overlaps the slip/, 'the slip over a gutter number');
  cut(crypto, 'desktop', slipAt(1800, 800), /^margin 4 mark overlaps the slip/, 'the slip over a margin symbol');
  cut(crypto, 'desktop', slipAt(1800, 1000), /^margin 7 matter ".*" overlaps the slip/, 'the slip over a margin text');
  cut(crypto, 'desktop', slipAt(1800, 250), /^notes\[0\] ".*" overlaps the slip/, 'the slip over a note');
  cut(crypto, 'desktop', slipAt(1800, 420), /^notes\[1\] ".*" overlaps the slip/, 'the slip over a note ring');
  cut(crypto, 'desktop', slipAt(300, 1800), /^tally ".*" overlaps the slip/, 'the slip over the tally');
  cut(crypto, 'desktop', slipAt(850, 600), /^the mark on line 2 overlaps the slip/, 'the slip over an in-text mark');
  cut(crypto, 'desktop', slipAt(2300, 1650), /^the slip does not overlap the strip/, 'a slip off the strip');
  // 6: the margin band is the marks' and notes' alone
  cut(crypto, 'desktop', edit(/<text x="2860" y="500" class="kh"/, '<text x="2860" y="500" text-anchor="end" class="kh"'), /^key head ".*" enters the margin/, 'the key head turned into the margin');
  cut(crypto, 'desktop', place('kn', 2000, 620), /^key 1 name ".*" enters the margin/, 'a key name in the margin');
  cut(crypto, 'desktop', place('kg', 2000, 670), /^key 1 gloss ".*" enters the margin/, 'a key gloss in the margin');
  cut(crypto, 'desktop', edit(/<path d="M2860,606.67 H2900"/, '<path d="M1960,606.67 H2000"'), /^key 1 mark enters the margin/, 'a key glyph in the margin');
  cut(crypto, 'desktop', place('k', 2000, 1000), /^whoami line ".*" enters the margin/, 'a whoami line in the margin');
  cut(crypto, 'desktop', edit(/translate\(3748.5,/, 'translate(2000,'), /^side label ".*" enters the margin/, 'the side label in the margin');
  cut(crypto, 'desktop', noteMove(0, 300), /^notes\[0\] ".*" drops below the margin head/, 'a note below the first code band');
  cut(crypto, 'desktop', noteMove(-100, 0), /^notes\[0\] ".*" leaves the margin/, 'a note left of the margin');
  cut(crypto, 'desktop', text(7, 'mt', 1845, 400), /^notes\[1\] ".*" overlaps margin 7 matter/, 'a note ring over a margin text');
  cut(crypto, 'desktop', marginMove(4, 0, -470), /^notes\[1\] ".*" overlaps margin 4 mark/, 'a note ring over a margin symbol');
  // 7: the canvas and the keep-clear zones
  cut(crypto, 'desktop', place('d', 3700, g.data.y), /^status line left ".*" leaves the canvas/, 'a text off the canvas');
  cut(crypto, 'desktop', place('sl', g.code.x, 60), /^slug ".*" reaches the menu bar/, 'a text in the menu bar');
  cut(crypto, 'desktop', edit(/<rect x="2860" y="1640"/, '<rect x="2860" y="50"'), /^the whoami box reaches the menu bar/, 'a shape in the menu bar');
  cut(crypto, 'desktop', edit(/(<rect x="300" y="150" width="1480" height=")1750"/, '$12000"'), /^the strip reaches the Dock/, 'the strip in the Dock');
  cut(crypto, 'desktop', edit(/<path d="M913.07,694.67 H1125.33"/, '<path d="M-20,694.67 H400"'), /^the mark on line 2 leaves the canvas/, 'a mark off the canvas');
  cut(crypto, 'desktop', markDown(2, -600), /^the mark on line 2 reaches the menu bar/, 'a mark in the menu bar');
  cut(crypto, 'desktop', marginMove(4, 2100, 0), /^margin 4 mark leaves the canvas/, 'a margin symbol off the canvas');
  cut(crypto, 'desktop', marginMove(4, 0, -780), /^margin 4 mark reaches the menu bar/, 'a margin symbol in the menu bar');
  cut(crypto, 'desktop', edit(/<path d="M2860,606.67 H2900"/, '<path d="M3830,606.67 H3870"'), /^key 1 mark leaves the canvas/, 'a key glyph off the canvas');
  cut(crypto, 'desktop', edit(/<path d="M2860,606.67 H2900"/, '<path d="M2860,60 H2900"'), /^key 1 mark reaches the menu bar/, 'a key glyph in the menu bar');
  cut(crypto, 'desktop', slipAt(3500, 1650), /^the slip leaves the canvas/, 'the slip off the canvas');
  cut(crypto, 'phone', place('d', GALLEY.phone.left, 2700), /^status line left ".*" reaches the phone's bottom buttons/, 'a text in the phone\'s bottom 260px');
  cut(crypto, 'phone', place('mt', 1195, 1350), /^margin \d+ matter ".*" leaves the canvas/, 'a phone margin text off the canvas');
  // the schema rules: a broken copy of crypto must be turned down by the content rules above
  const entry = INDEX['galley-proof'].find(e => e.id === 'crypto');
  assert.throws(() => checkGalley({ ...crypto, errata: { ...crypto.errata, line: 3 } }, entry, 'bite'), /errata\.line must point at a sub mark/);
  assert.throws(() => checkGalley({ ...crypto, lines: ['a < b', ...crypto.lines.slice(1)] }, entry, 'bite'), /holds <, > or &/);
  assert.throws(() => checkGalley({ ...crypto, lines: ['x'.repeat(41), ...crypto.lines.slice(1)] }, entry, 'bite'), /max 40/);
  const cmPanel = PRESETS['cutting-mat'].crypto.panel;
  assert.throws(() => checkGalley({ ...crypto, lines: [...crypto.lines.slice(0, -1), cmPanel.lines[0]] }, entry, 'bite'), /shares a file name or a line/);
  assert.throws(() => checkGalley({ ...crypto, file: cmPanel.title }, entry, 'bite'), /shares a file name or a line/);
  assert.throws(() => checkGalley({ ...crypto, notes: ['ask api.google.com', ...crypto.notes.slice(1)] }, entry, 'bite'), /names a real-looking domain/);
  assert.throws(() => checkGalley({ ...crypto, notes: ['ssh to 10.0.0.1', ...crypto.notes.slice(1)] }, entry, 'bite'), /holds a real-looking IPv4 address/);
  const dfir = GP.dfir, dfirEntry = INDEX['galley-proof'].find(e => e.id === 'dfir'), extra = type => ({ line: 6, type, at: 'tool', ...(type === 'sub' && { to: 'x' }), note: 'n', phone: 'p' });
  assert.throws(() => checkGalley({ ...dfir, marks: [...dfir.marks, extra('sub')] }, dfirEntry, 'bite'), /dfir takes only stet and query, and at most one sub/);
  assert.throws(() => checkGalley({ ...dfir, marks: [...dfir.marks, extra('dele')] }, dfirEntry, 'bite'), /dfir takes only stet and query, and at most one sub/);
  // one bite per mark type, on the fixture: the mark one line lower leaves its row band (a query draws only in the margin: its ring's text leaves its line)
  const fixtureLine = type => FIXTURE.marks.find(m => m.type === type).line;
  for (const type of TYPES.filter(t => t !== 'query')) cut(FIXTURE, 'desktop', markDown(fixtureLine(type), g.code.pitch), new RegExp(`^the mark on line ${fixtureLine(type)} leaves its row band`), `a ${type} mark one line below its own`);
  cut(FIXTURE, 'desktop', row(fixtureLine('query'), r => r.replace(/(<text x="[\d.]+" y=")([\d.]+)(" class="ml")/, (m, a, y, c) => `${a}${+y + g.code.pitch}${c}`)), /^margin 2 label ".*" is not level with code line 2/, 'a query one line below its own');
  cut(crypto, 'desktop', marginDown(4, 60), /^margin 4 mark is not level with code line 4/, 'a dele loop below its line');
  cut(crypto, 'desktop', marginDown(4, 20), /^margin 4 mark is not level with code line 4/, 'a dele loop 20px low');
  cut(FIXTURE, 'desktop', marginDown(fixtureLine('space'), 20), /^margin 11 mark is not level with code line 11/, 'a # 20px low');
  cut(crypto, 'desktop', marginDown(10, 25), /^margin 10 ring is not level with code line 10/, 'a stet ring off its label');
  cut(crypto, 'desktop', edit(/<text x="3010" /g, '<text x="2950" '), /^key \d ring overlaps key \d name "let it stand"/, 'a key ring over its name');
  cut(crypto, 'desktop', markDown(2, -45), /^the mark on line 2 leaves its row band/, 'a mark above its row band');
  cut(crypto, 'desktop', edit(/<path d="M913.07,694.67 H1125.33"/, '<path d="M1700,694.67 H1779.9"'), /^the mark on line 2 leaves its row band/, 'a strike past the strip edge');
  cut(crypto, 'desktop', marginDown(4, -20), /^margin 4 mark is not level with code line 4/, 'a dele loop 20px high');
  cut(crypto, 'desktop', edit(/<path d="M2860,606.67 H2900"/, '<path d="M2860,490 H2900"'), /^key 1 mark overlaps key head/, 'a key glyph over the key head');
  cut(crypto, 'desktop', edit(/<path d="M2860,606.67 H2900"/, '<path d="M3010,660 H3050"'), /^key 1 mark overlaps key 1 gloss/, 'a key glyph over its gloss');
  for (const fmt of Object.keys(FORMATS)) assert.deepEqual(overlaps(FIXTURE, fmt), [], `galley-proof fixture on ${fmt}`);   // all eight mark types clear the checker
}

// ---------- Catalog Card: its preset shape and content rules, its lexicon rules, two limit fixtures, the roles it draws, the checker bites, renderer safety
// (crypto's own renders and sheets come from the series loops above, with cardRender)

const card = { renders: 0, sheets: 0 };   // what this block ran besides the series loops, for the summary line
{
  const S = SERIES['catalog-card'], CC = PRESETS['catalog-card'], GP = PRESETS['galley-proof'];
  const LEX = Object.fromEntries(INDEX['cutting-mat'].map(e => [e.topic, json(`topics/${e.topic}.json`)]));
  const everyString = (v, out = []) => (typeof v === 'string' ? out.push(v) : v && typeof v === 'object' && Object.values(v).forEach(x => everyString(x, out)), out);

  // the schema and content rules of one preset; throws on the first it breaks (the lexicon rules are checkAccess's)
  function checkCard(p, e, at, galley) {
    const KEYS = ['series', 'topic', 'title', 'ground', 'phrase', 'drawer_label', 'guide_tabs', 'call_number', 'main_entry', 'definition', 'collation', 'correction_struck', 'correction_new', 'notes', 'drafts',
      'tracings_subject', 'tracings_added', 'see_also', 'rod_invariant', 'circulation_dates', 'label', 'data', 'phone'];
    keys(p, KEYS, at);
    for (const k of KEYS.filter(k => k !== 'phone')) assert.ok(k in p, `${at}: missing "${k}"`);
    assert.equal(p.series, 'catalog-card', `${at}: series`);
    for (const k of ['topic', 'title', 'ground']) assert.equal(p[k], e[k], `${at}: ${k} differs from index.json`);
    const name = e.title.match(TITLE)[2], one = (k, w = `${at} ${k}`) => str(p[k], SCHEMA[k][2], w), sized = (k, w = `${at} ${k}`) => {
      const [lo, hi, max] = SCHEMA[k];
      list(p[k], hi, max, w); assert.ok(p[k].length >= lo, `${w}: ${lo}-${hi} entries`);
    };
    sized('phrase');
    one('drawer_label'); one('main_entry');
    const range = p.drawer_label.match(/^[A-Z][A-Z ]* · ([A-Z]{2})–([A-Z]{2})$/), head = p.main_entry.slice(0, 2).toUpperCase();
    assert.ok(range && range[1] <= head && head <= range[2], `${at}: drawer_label "${p.drawer_label}" must read <TOPIC> · AA–BB and hold the entry's first two letters "${head}"`);
    assert.equal(p.guide_tabs.length, 4, `${at} guide_tabs: exactly 4`); sized('guide_tabs');
    assert.equal(p.call_number.length, 3, `${at} call_number: exactly 3`); sized('call_number');
    p.call_number.forEach(t => assert.ok(isId(t), `${at} call_number: "${t}" is not a known ID shape`));
    one('definition');
    assert.ok(defLines(p, 'desktop').length <= 2 && defLines(p, 'wide').length <= 2, `${at} definition: needs a third line on desktop or wide`);
    const lone = { ...p, phone: { ...p.phone, definition: undefined } }, needed = defLines(lone, 'phone').length > 2;   // the phone override is present only when it is needed
    assert.equal(!!p.phone?.definition, needed, `${at} phone.definition: ${needed ? 'the definition needs 3 lines on the phone, so an override is required' : 'the override is not needed'}`);
    assert.ok(defLines(p, 'phone').length <= 2, `${at} definition: needs a third line on the phone`);
    one('collation');
    const facts = p.collation.split(' ; ');
    assert.ok(facts.length >= 2 && facts.length <= 3 && facts.every(f => f.trim()), `${at} collation: 2-3 facts joined by " ; "`);
    one('correction_struck'); one('correction_new');
    const esc_ = p.correction_struck.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.equal(p.collation.split(p.correction_struck).length - 1, 1, `${at}: "${p.correction_struck}" must occur exactly once in the collation`);
    assert.ok(new RegExp(`(?<![\\p{L}\\d])${esc_}(?![\\p{L}\\d])`, 'u').test(p.collation), `${at}: "${p.correction_struck}" must stand as a whole token in the collation`);
    sized('notes');
    p.notes.forEach((t, i) => assert.ok(/^(Standard|Transition): /.test(t) && /\b(19|20)\d\d\b/.test(t) && /[A-Z]\w*[ -]\d/.test(t), `${at} notes[${i}]: "Standard: …" or "Transition: …", with an ID and a date`));
    assert.ok(Array.isArray(p.drafts), `${at} drafts: a list`);
    for (const d of p.drafts) assert.ok(['correction', 'collation', 'definition'].includes(d) || (/^circulation_dates\.(\d)$/.test(d) && +d.slice(-1) < p.circulation_dates.length), `${at} drafts: "${d}" names nothing on the card`);
    if (p.drafts.length) assert.ok(p.notes.some(t => /\bdraft\b/.test(t)) && /\bdraft\b/.test(view(p, 'phone').notes[0]), `${at}: a claim rests on a draft, so a note says "draft" (and the phone draws that note)`);
    one('rod_invariant');
    sized('tracings_subject'); sized('tracings_added'); sized('see_also');
    p.see_also.forEach((t, i) => { const m = t.match(/^(\S.*) · (\S.*)$/); assert.ok(m && isId(m[2]), `${at} see_also[${i}]: "${t}" must read NAME · ID with a known ID shape`); });
    sized('circulation_dates');
    const when = t => { const m = t.match(/^(?:(\d{4})-(0[1-9]|1[0-2])|>(\d{4})) \S/); assert.ok(m, `${at} circulation_dates: "${t}" must read YYYY-MM event or >YYYY event`); return m[1] ? +m[1] * 12 + +m[2] : +m[3] * 12 + 13; };
    p.circulation_dates.map(when).forEach((v, i, a) => i && assert.ok(v > a[i - 1], `${at} circulation_dates: not ascending at "${p.circulation_dates[i]}"`));
    for (const t of view(p, 'phone').circulation_dates) assert.ok(len(t) <= 16, `${at} circulation_dates: "${t}" is drawn on the phone and must be 16 or fewer`);
    one('label');
    assert.ok(/^[A-Z][A-Z ]* CATALOG CARD · VOL\. \d\d · /.test(p.label) && p.label.endsWith(`VOL. ${pad2(e.vol)} · ${name.toUpperCase()}`), `${at} label: "<TOPIC> CATALOG CARD · VOL. ${pad2(e.vol)} · ${name.toUpperCase()}"`);
    keys(p.data, ['left', 'right'], `${at} data`); for (const k of ['left', 'right']) str(p.data[k], 44, `${at} data.${k}`);
    keys(p.phone ?? {}, ['definition', 'data'], `${at} phone`); keys(p.phone?.data ?? {}, ['right'], `${at} phone.data`);
    if (p.phone?.definition) str(p.phone.definition, SCHEMA.definition[2], `${at} phone.definition`);
    if (p.phone?.data?.right) str(p.phone.data.right, 30, `${at} phone.data.right`);
    assert.ok(len(p.data.left) <= S.phoneCap(p, 'data.left'), `${at} data.left: ${len(p.data.left)} characters, the phone has room for ${S.phoneCap(p, 'data.left')} beside a 20-character handle`);
    // content: nothing drawn twice in a format, no markup characters, no real-looking hosts
    for (const fmt of Object.keys(FORMATS)) { const all = cardStrings(p, fmt); assert.deepEqual(all.filter((t, i) => all.indexOf(t) !== i), [], `${at} ${fmt}: a string is drawn twice`); }
    for (const t of everyString(p)) {
      const bare = p.circulation_dates.includes(t) && t.startsWith('>') ? t.slice(1) : t;
      assert.ok(!/[<>&]/.test(bare), `${at}: "${t}" holds <, > or & (only a date may start with >)`);
      for (const [h] of t.matchAll(/\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|dev|app|ai|co|cloud|gov|edu)\b/gi)) assert.match(h, /(^|\.)example\.(com|org|net)$/i, `${at}: "${t}" names a real-looking domain`);
      assert.ok(!/@\w[\w.-]*\.\w/.test(t), `${at}: "${t}" looks like an email address`);
      for (const [, a, b, c] of t.matchAll(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}\b/g)) assert.ok(+a === 127 || ['192.0.2', '198.51.100', '203.0.113'].includes(`${a}.${b}.${c}`), `${at}: "${t}" holds a real-looking IPv4 address`);
    }
    if (galley) {   // the correction is neither Galley's slip pair nor its errata.throughout (by string; the source rule is M5's)
      const pair = `for ${p.correction_struck} read ${p.correction_new}`, gs = slip(galley, pad2(e.vol));
      assert.ok(pair !== gs[1] && pair !== gs[3], `${at}: the correction repeats Galley's "${pair}"`);
    }
    const mono = [p.drawer_label, ...p.guide_tabs, ...p.call_number, p.main_entry, p.definition, p.phone?.definition, p.collation, ...p.notes, ...p.tracings_subject, ...p.tracings_added, ...p.see_also, p.rod_invariant,
      ...p.circulation_dates, p.label, ...Object.values(p.data), ...Object.values(p.phone?.data ?? {}), stamp(p), ...HEADS, ...NUMERALS, '1.', '2.', '3.', '4.'].filter(Boolean);
    for (const t of mono) for (const ch of t) assert.equal(MONO_ADV.get(ch.codePointAt(0)), 0.6, `${at}: "${ch}" (${hexCp(ch)}) in "${t}" is not a JetBrains Mono glyph`);
    for (const t of [...p.phrase, p.correction_new]) for (const ch of t) assert.ok(NUNITO_ADV.has(ch.codePointAt(0)), `${at}: "${ch}" (${hexCp(ch)}) in "${t}" is not a Nunito glyph`);
  }
  // the lexicon rules: the access points are hint-only, and the relation claims stay out of the fixed strings
  const whole = (s, code) => new RegExp(`(?<![\\p{L}\\p{N}])${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'u').test(s);
  const form = t => t.card.as || t.text, SLOTS_OF = { tracings_subject: 'subject', tracings_added: 'added', see_also: 'see' };
  function checkAccess(p, lexicon, at) {
    for (const [key, slot] of Object.entries(SLOTS_OF)) for (const v of p[key]) assert.ok(lexicon.terms.some(t => t.card?.slots?.includes(slot) && form(t) === v), `${at} ${key}: "${v}" is no term hinted for ${slot}`);
    const fixed = [...p.call_number, ...p.notes, ...p.circulation_dates, p.collation];
    for (const t of lexicon.terms) if (t.code && t.card?.slots?.some(s => Object.values(SLOTS_OF).includes(s))) for (const f of fixed) assert.ok(!whole(f, t.code), `${at}: the code ${t.code} of "${t.text}" stands in "${f}"`);
  }
  const checkSee = (lexicon, at) => lexicon.terms.forEach(t => { if (t.card?.slots?.includes('see')) { const m = form(t).match(/^(\S.*) · (\S.*)$/); assert.ok(m && isId(m[2]), `${at}: see hint "${form(t)}" must read NAME · ID with a known ID shape`); } });
  const catalog = Object.keys(CC);
  for (const [topic, lex] of Object.entries(LEX)) checkSee(lex, `topics/${topic}.json`);
  assert.deepEqual(S.LIMITS, { phrase: 18, tracings_subject: 20, tracings_added: 20, see_also: 24, 'data.left': 44, 'data.right': 44, label: 42, phone: 30, handle: 20, motto: 40 }, 'catalog-card: the slot table');

  assert.deepEqual(INDEX['catalog-card'], json('series/cutting-mat/presets/index.json').filter(r => catalog.includes(r.id)), 'catalog-card index.json: each row copied from Cutting Mat\'s, in its order');
  assert.ok(catalog.includes('crypto'), 'catalog-card presets: crypto (the bites below use it)');
  for (const e of INDEX['catalog-card']) { checkCard(CC[e.id], e, `catalog-card/${e.id}.json`, GP[e.id]); checkAccess(CC[e.id], LEX[e.topic], `catalog-card/${e.id}.json`); }
  const entry = INDEX['catalog-card'].find(e => e.id === 'crypto'), crypto = CC.crypto;

  // the two fixtures, every limit at its maximum and the fewest of everything (test-only, not volumes): examples/d-plan/max.json and min.json
  const MAX = {
    series: 'catalog-card', topic: 'crypto', title: 'Vol. 09 · Keys', ground: 'dark', phrase: ['Every key you hold', 'is a key to guard.'], drawer_label: 'CRYPTOGRAPHY · KE–KY',
    guide_tabs: ['Cryptographies', 'Symmetric keys', 'Authenticators', 'Message hashes'], call_number: ['NIST IR 8547', 'SP 800-63B-4', 'WSTG-INPV-05'], main_entry: 'Keyed-hash functions',
    definition: 'Sets up one shared secret over an open channel: sealed under a public key, opened only by its own private key.',
    collation: 'IND-CCA2 ; 64-bit block ; TripleDES-CBC-3key', correction_struck: 'TripleDES-CBC-3key', correction_new: 'AES-256-GCM-SIV-96',
    notes: ['Standard: NIST SP 800-38G Rev. 1 (Feb 2019).', 'Transition: NIST IR 8547 draft, Nov 12 2024.'], drafts: ['correction'],
    tracings_subject: ['Lattice cryptography', 'Side-channel attacks', 'Key derivation funcs', 'Quantum cryptanalyst'], tracings_added: ['Constant-time decaps', 'Crypto inventory map'],
    see_also: ['ML-DSA-87 · NIST IR 8547', 'SecP384MLKEM · RFC 10024'], rod_invariant: 'private key never leaves HSM',
    circulation_dates: ['1976-11 DH paper', '1994-11 Shor alg', '2024-08 FIPS 203/4', '2025-09 SP 800-227', '>2035 disallowed'], label: 'CRYPTOGRAPHY CATALOG CARD · VOL. 09 · KEYS',
    data: { left: 'Verify return code: 0 (ok)', right: '{handle} · git:(main) · blue builds' },
    phone: { definition: 'Seals one fresh shared secret under a public key so only its matching private key can ever open it.', data: { right: '{handle} · blue builds' } },
  };
  const MIN = {
    ...crypto, phrase: ['Trust the math.'], notes: [crypto.notes[0]], drafts: [], tracings_subject: ['Shor\'s algorithm', 'Forward secrecy'], tracings_added: ['Crypto agility'],
    see_also: ['ML-DSA-65 · FIPS 204'], circulation_dates: ['1994-11 Shor', '2024-08 FIPS 203', '2025-03 HQC pick'],
  };
  for (const [id, p] of Object.entries({ max: MAX, min: MIN })) checkCard(p, { topic: 'crypto', title: p.title, ground: 'dark', vol: 9 }, `fixture ${id}`, GP.crypto);

  // schema bites: a broken copy of crypto for each kind of rule
  const bad = (change, re, what) => assert.throws(() => checkCard({ ...crypto, ...change }, entry, 'bite', GP.crypto), re, `checkCard missed ${what}`);
  bad({ collation: 'RSA-2048 ; 1 round trip ; RSA-2048' }, /exactly once/, 'the struck word twice');
  bad({ collation: 'IND-CCA2 ; 1 round trip ; RSA-2049' }, /exactly once/, 'the struck word missing');
  bad({ collation: 'IND-CCA2 ; 1 round trip ; xRSA-2048', correction_struck: 'RSA-2048' }, /whole token/, 'the struck word inside another word');
  bad({ tracings_subject: ['Lattice cryptography!', ...crypto.tracings_subject.slice(1)] }, /max 20/, 'a 21-character tracing');
  bad({ see_also: ['ML-DSA-65 · FIPS 204 · ABC', crypto.see_also[1]] }, /max 24/, 'a 25-character see-also');
  bad({ see_also: ['ML-DSA-65 FIPS 204', crypto.see_also[1]] }, /NAME · ID/, 'a see-also without " · "');
  bad({ call_number: ['LLM01:2025', ...crypto.call_number.slice(1)] }, /known ID shape/, 'a 2025 LLM ID');
  bad({ definition: crypto.definition + ' Sets up.' }, /max 110/, 'a long definition');
  bad({ drawer_label: 'CRYPTO · AA–BB' }, /first two letters/, 'a range that misses the entry');
  bad({ circulation_dates: [crypto.circulation_dates[1], crypto.circulation_dates[0], ...crypto.circulation_dates.slice(2)] }, /not ascending/, 'dates out of order');
  bad({ rod_invariant: 'keys & locks' }, /holds <, > or &/, '& in a string');
  bad({ circulation_dates: [crypto.circulation_dates[0], '2024-08 a>b', ...crypto.circulation_dates.slice(2)] }, /holds <, > or &/, '> mid-string');
  bad({ phone: { ...crypto.phone, extra: 'x' } }, /unknown key "extra"/, 'an extra phone key');
  bad({ label: 'CRYPTO CATALOG CARD · VOL. 09 · KEYS' }, /label/, 'a wrong label tail');
  bad({ notes: ['Standard: FIPS 203, ML-KEM (13 Aug 2024).', 'Transition: NIST IR 8547 (Nov 2024).'] }, /says "draft"/, 'a draft-based claim with no note that says draft');
  bad({ drafts: ['circulation_dates.7'] }, /names nothing/, 'a draft path that does not exist');
  bad({ correction_struck: 'ssh-rsa', correction_new: 'ssh-ed25519', collation: 'IND-CCA2 ; 1 round trip ; ssh-rsa' }, /repeats Galley/, 'the topic\'s Galley pair');
  bad({ phone: { data: crypto.phone.data } }, /needs 3 lines on the phone, so an override is required/, 'a missing phone definition override');
  bad({ phone: { ...crypto.phone, definition: crypto.phone.definition + ' Sets up one more key too.' } }, /needs a third line on the phone/, 'a phone definition that wraps to 3 lines');
  bad({ definition: 'Seals a fresh key under a public key.' }, /override is not needed/, 'a phone override the definition does not need');
  bad({ main_entry: undefined }, /main_entry/, 'a missing main_entry (a message, not a TypeError)');
  bad({ circulation_dates: ['1994-11 Shor', '2024-13 FIPS 203', ...crypto.circulation_dates.slice(2)] }, /YYYY-MM event/, 'month 13');
  bad({ data: { ...crypto.data, left: 'Verify return code: 0 (ok) again' } }, /room for 26/, 'a status line over the phone room');
  bad({ guide_tabs: crypto.guide_tabs.slice(1) }, /exactly 4/, 'three guide tabs');
  bad({ main_entry: 'Zebra' }, /first two letters/, 'a main entry outside the drawer range');
  bad({ rod_invariant: 'x'.repeat(29) }, /max 28/, 'a 29-character rod caption');
  // the lexicon rules bite on a small lexicon of their own: a hinted tracing passes, an unhinted one, a code inside a note and a bad see form do not
  {
    const lex = { terms: [{ text: 'Shor\'s algorithm', card: { slots: ['subject'] } }, { text: 'Forward secrecy', card: { slots: ['subject'] } }, { text: 'Lattice cryptography', card: { slots: ['subject'] } }, { text: 'Diffie–Hellman key exchange', card: { slots: ['subject'], as: 'Diffie–Hellman' } },
      { text: 'X25519MLKEM768 · 0x11EC', code: '0x11EC', card: { slots: ['added'], as: 'X25519MLKEM768' } }, { text: 'Crypto agility', card: { slots: ['added'] } },
      { text: 'ML-DSA-65 · FIPS 204', code: 'FIPS 204', card: { slots: ['see'] } }, { text: 'HQC', code: 'NIST IR 8545', card: { slots: ['see'], as: 'HQC · NIST IR 8545' } }] };
    checkAccess(crypto, lex, 'bite');
    assert.throws(() => checkAccess({ ...crypto, tracings_subject: ['Enigma', ...crypto.tracings_subject.slice(1)] }, lex, 'bite'), /is no term hinted for subject/, 'checkAccess missed a shipped tracing that is no hinted term');
    assert.throws(() => checkAccess({ ...crypto, tracings_subject: ['Crypto agility', ...crypto.tracings_subject.slice(1)] }, lex, 'bite'), /is no term hinted for subject/, 'checkAccess missed an added entry used as a subject');
    assert.throws(() => checkAccess({ ...crypto, notes: ['Standard: FIPS 204, ML-DSA (13 Aug 2024).', crypto.notes[1]] }, lex, 'bite'), /stands in/, 'checkAccess missed a hinted code inside a note');
    assert.throws(() => checkAccess({ ...crypto, circulation_dates: ['1994-11 Shor', '2024-08 NIST IR 8545', ...crypto.circulation_dates.slice(2)] }, lex, 'bite'), /stands in/, 'checkAccess missed a hinted code inside a date');
    for (const c of ['FIPS 2040', 'xFIPS 204']) checkAccess({ ...crypto, collation: `IND-CCA2 ; ${c} ; RSA-2048` }, lex, 'bite');   // another token: the whole-token rule lets it by, on either side
    assert.throws(() => checkSee({ terms: [{ text: 'CNSA 2.0', card: { slots: ['see'] } }] }, 'bite'), /must read NAME · ID/, 'checkSee missed a see hint with no ID');
    assert.throws(() => checkSee({ terms: [{ text: 'Thing', card: { slots: ['see'], as: 'Thing · FOO 1' } }] }, 'bite'), /must read NAME · ID/, 'checkSee missed a see hint with an unknown ID shape');
  }

  // the fixtures' renders, in every palette, ground and format (crypto's come from the series loops)
  const ANG = {};
  for (const [id, p] of Object.entries({ max: MAX, min: MIN })) for (const pal of palettes) for (const role of GROUNDS) for (const fmt of Object.keys(FORMATS)) {
    const where = `catalog-card/${id}/${pal.slug}/${role}/${fmt}`, { w, h } = FORMATS[fmt], svg = S.render({ preset: p, colors: ground(pal, role), format: fmt, handle: '', fonts });
    assert.match(svg, new RegExp(`^<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`), where);
    assert.ok(svg.endsWith('</svg>'), where);
    assert.deepEqual(leaked(svg), [], `${where}: bad value in an attribute`);
    assert.deepEqual(unexpected(svg, p, fmt), [], `${where}: text the preset does not hold`);
    for (const t of strings(p, fmt)) assert.ok(svg.includes(`>${esc(t)}</text>`), `${where}: missing ${t}`);
    assert.ok(svg.includes(`>${HANDLE} · ${MOTTO}</text>`), `${where}: default whoami`);
    assert.ok(svg.includes(fonts.nunito) && svg.includes(fonts.jbm) && svg.includes('text{font-family:KMono') && svg.includes('font-variant-ligatures:none'), `${where}: fonts`);
    balanced(svg);
    onCanvas(svg, w, h, where);
    cardRender(S, svg, pal, role, fmt, where, p);
    const ang = angular(svg, ground(pal, role), fmt, 'catalog-card');
    assert.deepEqual(ang.bad, [], `${where}: below the angular floor at the farthest setup`);
    card.renders++; ANG[fmt] = [Math.min(ANG[fmt]?.[0] ?? 1e9, ang.text), Math.min(ANG[fmt]?.[1] ?? 1e9, ang.stroke)];
  }
  card.angular = ANG;
  // both fixtures clear the checker in every format, with every handle and motto
  for (const p of [MAX, MIN]) for (const fmt of Object.keys(FORMATS)) { assert.deepEqual(overlaps(p, fmt), [], `catalog-card fixture ${p.phrase.length === 2 ? 'max' : 'min'} on ${fmt}`); card.sheets += HANDLES.length * MOTTOS.length; }

  // the structure the checker relies on, read in PROBE colours: papers by order, marks by tag and role
  for (const [id, p] of Object.entries({ crypto, max: MAX, min: MIN })) for (const fmt of Object.keys(FORMATS)) {
    const where = `catalog-card/${id}/probe/${fmt}`, svg = S.render({ preset: p, colors: PROBE, format: fmt, handle: '', fonts: null }), P = view(p, fmt), g = CARD[fmt];
    const lines = [...svg.matchAll(/<line [^>]*>/g)].map(m => m[0]), by = r => lines.filter(l => l.includes(`stroke="${PROBE[r]}"`));
    // every text is drawn in the role the plan's class table gives it (Decision 2 = C: the numerals, heads, dates and notes in text2; only the stamp in rule)
    const got = {};
    for (const [, k, f] of svg.matchAll(/<text[^>]* class="([a-z\d]+)" fill="([^"]*)"/g)) (got[k] ??= []).push(ROLE[f]);
    const ONE = { seeh: 'text2', see: 'text', call: 'text', entry: 'text', stamp: 'rule', def: 'text', coll: 'text', pen: 'chip1', note: 'text2', num: 'text2', trs: 'text', tra: 'text', cap: 'text2', phr: 'text', lab: 'text', slh: 'text2', date: 'text2', d: 'data', vl: 'text2' };
    for (const [k, roles] of Object.entries(got)) {
      const want = k === 'tab' ? [...roles.slice(1).fill('text2'), 'text'] : k === 'k' ? ['rule', ...roles.slice(1).fill('text2')] : roles.map(() => ONE[k]);
      assert.deepEqual(roles, want, `${where}: .${k} is drawn in the wrong role`);
    }
    assert.equal(by('rule').length, 1, `${where}: one header line in rule`);
    assert.ok(by('rule')[0].includes(`stroke-width="${g.sw.rule}"`) && svg.indexOf(by('rule')[0]) > svg.indexOf('class="stamp"'), `${where}: the header line, drawn after the stamp`);
    assert.equal(by('chip1').length, 1, `${where}: one strike`);
    assert.ok(by('chip1')[0].includes(`stroke-width="${fmt === 'phone' ? 4 : 5}"`) && by('chip1')[0].includes('stroke-linecap="round"'), `${where}: the strike is ${fmt === 'phone' ? 4 : 5} px with round caps`);
    assert.equal(by('major').length, fmt === 'phone' ? 2 : P.circulation_dates.length, `${where}: the slip's rules`);
    // the clip is D's: a black jaw (a trapezoid, wide at the bottom, in bg) and two 3 px wires splayed outward as a V, no loop, no rounded body
    const wires = by('frame').map(l => ['x1', 'y1', 'x2', 'y2'].map(a => +l.match(new RegExp(` ${a}="([^"]*)"`))[1])), jaw = svg.match(/<path d="M([\d.]+),([\d.]+) H([\d.]+) L([\d.]+),([\d.]+) H([\d.]+) Z" fill="[^"]*" stroke="[^"]*" stroke-width="3"\/>/);
    assert.equal(wires.length, 2, `${where}: the clip's two wires`);
    assert.ok(by('frame').every(l => l.includes('stroke-width="3"') && l.includes('stroke-linecap="round"')), `${where}: 3 px round wires`);
    assert.ok(jaw && +jaw[3] - +jaw[1] === g.clip.wt && +jaw[4] - +jaw[6] === g.clip.wb && +jaw[5] - +jaw[2] === g.clip.h, `${where}: the jaw is a trapezoid ${g.clip.wb} wide at the bottom, ${g.clip.wt} at the top`);
    assert.ok(wires[0][2] < wires[0][0] && wires[1][2] > wires[1][0] && wires[0][3] === wires[1][3] && wires[0][1] > wires[0][3], `${where}: the wires rise from the jaw and splay outward as a V`);
    assert.ok(![...svg.matchAll(/<rect (?![^>]*class="pp")(?![^>]*transform=)[^>]*>/g)].some(m => m[0].includes(' rx=')), `${where}: no rounded clip body`);
    assert.equal((svg.match(/<rect [^>]*transform=/g) ?? []).length, 1, `${where}: one turned rect, the stamp box`);
    assert.equal((svg.match(/<circle /g) ?? []).length, 3, `${where}: the rod hole and two rivets`);
    assert.equal((svg.match(/class="pp"/g) ?? []).length, 10 + 2 * P.guide_tabs.length, `${where}: papers`);
    assert.equal((svg.match(/<path (?![^>]*class="pp")/g) ?? []).length, 1, `${where}: the clip's jaw is the one other path`);
  }
  assert.deepEqual(Object.keys(CARD), ['desktop', 'wide', 'phone'], 'catalog-card: geometry per format');
  // the phone's subsets are rules: the last 3 tabs, the first 2 tracings, the draft note, the first, second and last date
  const pv = view(crypto, 'phone');
  assert.deepEqual(pv.guide_tabs, ['Public-key', 'Key exchange', 'Post-quantum'], 'catalog-card: the phone draws the last 3 tabs');
  assert.deepEqual(pv.tracings_subject, ["Shor's algorithm", 'Forward secrecy'], 'catalog-card: the phone draws the first 2 tracings');
  assert.deepEqual(pv.notes, ['Transition: NIST IR 8547 draft (Nov 2024).'], 'catalog-card: the phone draws the draft note');
  assert.deepEqual(pv.circulation_dates, ['1994-11 Shor', '2024-08 FIPS 203', '>2035 disallowed'], 'catalog-card: the phone draws the first, second and last date');
  // crypto: the numbers the plan quotes (desktop 9 turns, phone 6), the grid, the wrap
  assert.equal([...S.render({ preset: crypto, colors: ground(palettes[0], 'dark'), format: 'desktop', fonts: null }).matchAll(/ transform=/g)].length, 9, 'catalog-card: crypto turns 9 on desktop');
  assert.equal([...S.render({ preset: crypto, colors: ground(palettes[0], 'dark'), format: 'phone', fonts: null }).matchAll(/ transform=/g)].length, 6, 'catalog-card: crypto turns 6 on the phone');

  // renderer safety, as the siblings
  const c0 = ground(palettes[0], 'dark'), cargs = { preset: crypto, colors: c0, handle: '', fonts };
  assert.throws(() => S.render({ ...cargs, colors: { ...c0, bg: 'red"/><script>' } }), /bad color/);
  for (const role of ['bg', 'major']) assert.throws(() => S.render({ ...cargs, colors: { ...c0, [role]: '#abc' } }), /bad color/, `catalog-card: a #RGB ${role} cannot be solved into papers`);
  assert.throws(() => S.render({ ...cargs, colors: { ...c0, chip1: 'nope' } }), /bad color/);
  assert.throws(() => S.render({ ...cargs, fonts: { nunito: 'x");}<' } }), /data: URL/);
  assert.throws(() => S.render({ ...cargs, format: 'square' }), /unknown format/);
  assert.throws(() => S.render({ ...cargs, preset: null }), /parsed preset/);
  const evil = S.render({ ...cargs, format: 'desktop', handle: '<b>&"x' });
  assert.ok(evil.includes(`>&lt;b&gt;&amp;&quot;x · ${MOTTO}</text>`) && !evil.includes('<b>'), 'catalog-card: handle escaped');
  balanced(evil);
  assert.ok(evil.includes(`>${stamp(crypto)}</text>`) && !evil.includes('cat. &lt;'), 'catalog-card: the stamp credits the cataloger, never the handle');
  assert.ok(S.render({ ...cargs, format: 'phone', handle: 'r2_labs' }).includes('>r2_labs · blue builds</text>'), 'catalog-card: the prompt is the viewer\'s');
  assert.ok(!S.render({ ...cargs, format: 'phone', fonts: null }).includes('@font-face'), 'catalog-card: no fonts yet still renders');
  assert.equal(S.render({ ...cargs, format: { w: 1290, h: 2796 } }), S.render({ ...cargs, format: 'phone' }), 'catalog-card: a {w, h} format is its key');

  // exact copy pins
  assert.equal(stamp(crypto), 'KS-CC-09 · cat. 0xF3tt'); assert.equal(CARD_AUTHOR, '0xF3tt');
  assert.deepEqual(HEADS, ['SEE ALSO', 'DATE DUE']);
  assert.deepEqual(DEPTH, { guides: [1.05, 1.09, 1.13, 1.18], wall: 1.12, see: 1.20, slip: 1.25, front: 1.31, blank: 1.38, panel: 1.44, main: 1.50, metal: 1.58 }, 'catalog-card: the paper ladder targets');
  assert.deepEqual(paper(c0), { guides: ['#140D28', '#191030', '#1E1336', '#23163E'], wall: '#1D1235', see: '#251741', slip: '#2A1948', front: '#2F1C4D', blank: '#341F55', panel: '#37215A', main: '#3C2360', metal: '#402666' }, 'catalog-card: the paper on aniline');
  assert.deepEqual(Object.values(paper(PROBE)).flat(), Array(12).fill('#000003'), 'catalog-card: under PROBE every paper is a role hex scene() never reads');
  assert.throws(() => paper({ bg: '#abc', major: '#9A86C8' }), /bad color/);
  assert.deepEqual(defLines(crypto, 'desktop').map(len), [72, 31], 'catalog-card: crypto wraps 72 + 31 on desktop (greedy, the first line 2 short of 77)');
  assert.deepEqual(defLines(crypto, 'phone').map(len), [47, 30], 'catalog-card: crypto\'s phone definition wraps 47 + 30');
  assert.deepEqual(defLines(MAX, 'phone').map(len), [48, 50], 'catalog-card: max\'s phone definition fills 48 + 50');
  assert.equal(S.phoneCap(crypto, 'data.left'), 26, 'catalog-card: data.left keeps to the phone\'s room beside a 20-character handle');
  assert.equal(S.phoneCap(crypto, 'phrase'), undefined);
  assert.deepEqual(['Verify return code: 0 (ok)', 'x'.repeat(27)].map(v => S.slotRules(crypto, 'data.left', v)), [[], ['27/26']], 'catalog-card: the status line holds the phone cap');

  // the slot table and the word editor's pieces
  assert.deepEqual(S.slotsOf(crypto), ['phrase', 'tracings_subject.0', 'tracings_subject.1', 'tracings_subject.2', 'tracings_subject.3', 'tracings_added.0', 'tracings_added.1', 'see_also.0', 'see_also.1', 'data.left', 'whoami']);
  assert.deepEqual(S.slotsOf(MIN), ['phrase', 'tracings_subject.0', 'tracings_subject.1', 'tracings_added.0', 'see_also.0', 'data.left', 'whoami']);
  assert.equal(Object.keys(S.FIXED).length, 13); assert.equal(S.FIXED_LIST.length, 13);
  assert.ok(S.FIXED_LIST.every(([, does]) => /^It \w+s /.test(does)), 'catalog-card: every fixed line reads "It <verb>s …"');
  for (const k of S.slotsOf(crypto)) assert.ok(!S.fixedOf(k), `catalog-card: ${k} is editable, so no FIXED key is its prefix`);
  assert.deepEqual(S.HINTS, ['subject', 'added', 'see', 'status']);
  assert.deepEqual(S.kindsOf('tracings_subject.2'), { slot: 'subject', types: [] }); assert.deepEqual(S.kindsOf('data.left'), { slot: 'status', types: ['status-line'] });
  assert.deepEqual(S.offer('see_also.0', { text: 'HQC', card: { slots: ['see'], as: 'HQC · NIST IR 8545' } }, true), [{ value: 'HQC · NIST IR 8545', code: '' }], 'catalog-card: a see-also shows no code beside its ID');
  assert.deepEqual(S.offer('tracings_subject.0', { text: 'Diffie–Hellman key exchange', card: { slots: ['subject'], as: 'Diffie–Hellman' } }, true), [{ value: 'Diffie–Hellman' }]);
  assert.deepEqual(S.offer('data.left', { text: 'unknown_ca(48)' }, false), [{ value: 'unknown_ca(48)' }]);
  assert.deepEqual([S.slotRules(crypto, 'see_also.0', 'HQC NIST IR 8545'), S.slotRules(crypto, 'see_also.0', 'HQC · FOO 1'), S.slotRules(crypto, 'see_also.0', 'HQC · NIST IR 8545')], [['NAME · ID'], ['NAME · ID'], []], 'catalog-card: a see-also reads NAME · ID');
  assert.deepEqual(S.slotRules(crypto, 'tracings_subject.0', 'x'.repeat(21)), ['21/20']);
  assert.deepEqual(S.slotRules(crypto, 'phrase', ['a', 'b', 'c']), ['one or two lines']);
  assert.deepEqual(S.slotRules(crypto, 'phrase', ['<&']), ['<, > or &']);
  assert.deepEqual(S.slotRules(crypto, 'tracings_added.0', ' x'), ['stray spaces']);
  assert.deepEqual(S.slotRules(crypto, 'tracings_added.0', '日本'), ['glyph']);
  const w1 = S.withSlot(crypto, 'tracings_subject.1', 'Side-channel attack'), w2 = S.withSlot(crypto, 'phrase', ['A', 'B']), w3 = S.withSlot(crypto, 'data.left', 'unknown_ca(48)');
  assert.deepEqual([w1.tracings_subject[1], w2.phrase, w3.data.left, w3.data.right, crypto.tracings_subject[1], w1.phone === crypto.phone], ['Side-channel attack', ['A', 'B'], 'unknown_ca(48)', crypto.data.right, 'Forward secrecy', true], 'catalog-card: withSlot copies, and writes no phone line');
  const used = S.usedStrings(crypto, 'tracings_subject.0');
  assert.deepEqual(['KS-CC-09 · cat. 0xF3tt', 'ML-KEM-768', 'RSA-2048', 'II.', 'SEE ALSO', 'DATE DUE', crypto.main_entry, crypto.rod_invariant, ...defLines(crypto, 'phone'), ...defLines(crypto, 'desktop'), 'Only the key is secret.', ...crypto.guide_tabs, ...crypto.call_number,
    ...crypto.circulation_dates, ...crypto.notes, crypto.label, crypto.data.right, crypto.phone.data.right, crypto.drawer_label, 'Forward secrecy', crypto.see_also[0], crypto.data.left].filter(v => !used.has(v)), [], 'catalog-card: usedStrings holds every other drawn string');
  assert.ok(!used.has("Shor's algorithm") && !S.usedStrings(crypto, 'phrase').has('Only the key is secret.'), 'catalog-card: usedStrings leaves out the slot being edited');
  assert.equal(S.oldWord(crypto, 'phrase'), ''); assert.equal(S.oldWord(crypto, 'tracings_subject.1'), 'Forward secrecy'); assert.equal(S.lockOf(), ''); assert.equal(S.story(), '');
  assert.deepEqual(S.elsewhere(crypto, 'tracings_subject.0', /Forward secrecy/i), ['Subject 2'], 'catalog-card: elsewhere names the slot');
  assert.deepEqual(S.elsewhere(crypto, 'tracings_subject.0', /FIPS 203/), ['the card', 'the date due slip']);
  assert.ok(S.valid(crypto) && S.valid(MAX) && !S.valid({}) && !S.valid(null) && !S.valid({ ...crypto, drafts: 'x' }) && !S.valid({ ...crypto, tracings_added: undefined }), 'catalog-card: valid()');
  assert.deepEqual(S.chipsOf(crypto, c0), [{ text: 'RSA-2048 → ML-KEM-768', color: c0.chip1 }, { text: 'private key stays private', color: c0.text2 }], 'catalog-card: the findings tape');
  assert.equal(S.swatch(), null); assert.deepEqual([S.GEOM.U('desktop'), S.GEOM.U('wide'), S.GEOM.U('phone')], [56, 60, 48]);
  assert.deepEqual(['phrase', 'tracings_subject.0', 'see_also.1', 'data.left', 'whoami'].map(k => ['desktop', 'phone'].map(f => S.GEOM.px(k, f))), [[136, 72], [36, 34], [36, 34], [26, 30], [26, 30]], 'catalog-card: GEOM.px');
  const rd = S.READ;
  assert.deepEqual([rd.nav, rd.title, rd.mark, rd.legendHead], ['Read the card', 'Read the card.', 'correction', ['', 'On the card', 'In the body of knowledge']]);
  // the key: the 17 marks, each a term and a line computed from the preset
  const ml = S.marks(crypto, 'r2_labs');
  assert.deepEqual(ml.map(m => m.id), Object.keys(S.GLYPH), 'catalog-card: the key and the glyphs agree');
  assert.deepEqual(ml.map(m => m.id), ['tabs', 'call', 'entry', 'stamp', 'definition', 'collation', 'correction', 'notes', 'tracings', 'rod', 'see', 'slip', 'holder', 'phrase', 'whoami', 'side', 'status'], 'catalog-card: 17 marks in reading order');
  assert.equal(ml.find(m => m.id === 'tabs').mean, 'The taxonomy, from the field down to this entry: Cryptography › Public-key › Key exchange › Post-quantum.');
  assert.equal(ml.find(m => m.id === 'correction').mean, 'Advice that changed: RSA-2048 struck through, ML-KEM-768 pencilled above it.');
  assert.equal(ml.find(m => m.id === 'rod').mean, 'The invariant that pins the entry in the drawer: private key stays private.');
  assert.equal(ml.find(m => m.id === 'phrase').mean, 'The principle behind the drawer: “Only the key is secret.”');
  assert.equal(ml.find(m => m.id === 'tracings').svg.match(/<rect /g).length, 2, 'catalog-card: tracings mark the subjects and the controls apart');
  assert.equal(ml.find(m => m.id === 'tabs').svg.match(/<rect /g).length, 4, 'catalog-card: one box per guide tab');
  // the editor's fast path: a slot the format leaves undrawn, and a phrase whose line count changes, go to the full checker
  { const ph = prepare(crypto, 'phone'), dk = prepare(crypto, 'desktop');
    assert.equal(S.quickFits(ph, 'tracings_subject.2', 'x'), null, 'catalog-card: the phone draws no 3rd subject');
    assert.equal(S.quickFits(ph, 'phrase', 'x'), null, 'catalog-card: the phone phrase is two texts, no quick fit for the joined line');
    assert.equal(S.fits(crypto, 'phone', 'phrase', ['One line only.'], crypto, f => prepare(crypto, f)), null, 'catalog-card: a phrase that changes the phone\'s line count needs the full checker');
    assert.ok(S.fits(crypto, 'desktop', 'phrase', ['Only the key', 'is secret.'], crypto, f => prepare(crypto, f)).ok);
    assert.equal(S.quickFits(dk, 'tracings_subject.0', "Shor's algorithm").ok, true);
    // a string drawn in two families (a status line equal to a tracing) leaves each slot with the text of its own family
    const twin = prepare({ ...crypto, data: { ...crypto.data, left: 'Forward secrecy' } }, 'desktop');
    assert.equal(S.quickFits(twin, 'tracings_subject.1', 'Side-channel attack')?.ok, true, 'catalog-card: a slot is judged on the text of its own family');
    // a hit says what it hit, and why() puts it in the interface's words (one row per kind)
    const hit = (b, key, v) => S.quickFits(b, key, v).hit, wide = hit(dk, 'see_also.0', 'x'.repeat(25)), col = hit(dk, 'tracings_subject.0', 'x'.repeat(21)), run = hit(ph, 'data.left', 'x'.repeat(44)), gp = hit(dk, 'phrase', 'x'.repeat(33));
    assert.deepEqual([wide.what, wide.name, S.why(wide)], ['home', 'the see-also card', 'is too wide for the see-also card']);
    assert.deepEqual([col.what, S.why(col)], ['column', 'is too long for its column']);
    assert.deepEqual([run.what, S.why(run)], ['text', 'runs into Prompt line']);
    assert.deepEqual([gp.what, S.why(gp)], ['home', 'is too wide for the blank guide']);
    const full = n => S.why({ what: 'full', name: n });
    assert.deepEqual([
      full('subject 1 "x" overlaps def 2 "y"'), full('tab 1 "x" does not fit inside its guide tab'), full('call 1 "x" crosses the header line'), full('see-also 1 "x" is covered by the main card'), full('subject 1 "x" is off its grid'),
      full('subject 1 "x" comes within 20.0 px of the rod hole'), full('subject 1 "x" comes within 1.0 px of the clip'), full('phrase "x" reaches the Dock'), full('phrase[1] "x" drops below the notification line'), full('date 1 "x" leaves the canvas'),
      full('the whoami box comes within 8.0 px of the drawer front'), full('the pencil is not centred on the struck word'),
      full('subject 1 "x" comes within -3.2 px of the clip'), full('the whoami box comes within -4.0 px of the drawer front'),
    ], ['runs into def 2 "y"', 'is too wide for its guide tab', 'crosses the header rule', 'slips under the main card', 'is too long for its column', 'crowds the rod hole', 'runs into the clip', 'reaches the Dock',
      'sinks under the notifications', 'runs off the sheet', 'pushes the whoami box into the drawer front', 'collides with another mark', 'runs into the clip', 'pushes the whoami box into the drawer front'], 'catalog-card: why() in the interface\'s words');
  }

  // the checker bites: a broken copy of crypto for each rule, asserted on the message that names the problem. A sheet is broken by editing the
  // preset, or the rendered SVG (a text's place, a mark's coordinates) where the renderer would refuse; the structural ones throw inside scene().
  const says = (hit, pattern, what) => assert.ok(hit.some(b => pattern.test(b)), `overlap checker missed ${what}; got ${JSON.stringify(hit)}`);
  const sheet = (p, fmt, edit = x => x) => edit(S.render({ preset: p, colors: PROBE, format: fmt, handle: '', fonts: null }));
  const cut = (p, fmt, edit, pattern, what) => { const { w, h } = FORMATS[fmt]; says(S.collisions(S.scene(sheet(p, fmt, edit), S.slotNames(p, fmt)), w, h, fmt === 'phone'), pattern, what); };
  const hits = (p, fmt, pattern, what) => says(overlaps(p, fmt), pattern, what);
  const edit = (re, to) => svg => { assert.match(svg, re); return svg.replace(re, to); };
  const move = (cls, nth, dx, dy = 0) => svg => {   // the nth text of a class, moved (its x and y, or its translate())
    let i = 0, done = false;
    const out = svg.replace(new RegExp(`<text\\b[^>]*class="${cls}"[^>]*>`, 'g'), t => {
      if (++i !== nth) return t;
      done = true;
      return /transform="translate\(/.test(t) ? t.replace(/translate\((-?[\d.]+),(-?[\d.]+)\)/, (_, x, y) => `translate(${+x + dx},${+y + dy})`) : t.replace(/ x="(-?[\d.]+)" y="(-?[\d.]+)"/, (_, x, y) => ` x="${+x + dx}" y="${+y + dy}"`);
    });
    assert.ok(done, `no text ${nth} of class ${cls}`);
    return out;
  };
  const strike = dy => edit(/(<line x1="[\d.]+" y1=")([\d.]+)(" x2="[\d.]+" y2=")([\d.]+)(" stroke="#00000d")/, (m, a, y1, b, y2, c) => `${a}${+y1 + dy}${b}${+y2 + dy}${c}`);
  const strikeX = dx => edit(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)"( y2="[\d.]+" stroke="#00000d")/, (m, x1, y1, x2, r) => `<line x1="${+x1 + dx}" y1="${y1}" x2="${x2}"${r}`);
  const strikeX2 = dx => edit(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)"( y2="[\d.]+" stroke="#00000d")/, (m, x1, y1, x2, r) => `<line x1="${x1}" y1="${y1}" x2="${+x2 + dx}"${r}`);
  // 1: two texts overlap
  cut(crypto, 'desktop', move('call', 2, 0, -64), /^call 1 ".*" overlaps call 2/, 'two texts overlapping');
  cut(crypto, 'desktop', move('def', 2, 0, -56), /^def 1 ".*" overlaps def 2/, 'two definition lines overlapping');
  // 2: a text leaves its own paper
  cut(crypto, 'desktop', move('entry', 1, 1000), /^entry ".*" does not fit inside the text column/, 'a card text past the pad');
  cut(crypto, 'desktop', move('call', 3, 0, 80), /^call 3 ".*" crosses the header line/, 'a header text under the rule');
  cut(crypto, 'desktop', move('def', 1, 0, -72), /^def 1 ".*" crosses the header line/, 'a body text over the rule');
  hits({ ...crypto, see_also: ['x'.repeat(25), crypto.see_also[1]] }, 'desktop', /^see-also 1 ".*" does not fit inside the see-also card/, 'a 25-character see-also');
  cut(crypto, 'desktop', move('phr', 1, 1300), /^phrase ".*" does not fit inside the blank guide/, 'the phrase past x 2660');
  cut(crypto, 'desktop', move('tab', 4, 60), /^tab 4 ".*" does not fit inside its guide tab/, 'a tab label past its tab');
  cut(crypto, 'desktop', move('date', 2, 300), /^date 2 ".*" does not fit inside the date due slip/, 'a date out of the slip');
  cut(crypto, 'desktop', move('slh', 1, 400), /^slip head ".*" does not fit inside the date due slip/, 'the slip head out of the slip');
  hits({ ...crypto, circulation_dates: ['1994-11 Shor 1234', ...crypto.circulation_dates.slice(1)] }, 'phone', /^date 1 ".*" does not fit inside its date cell/, 'a 17-character phone date out of its cell');
  hits({ ...crypto, drawer_label: 'x'.repeat(24) }, 'desktop', /^drawer label ".*" does not fit inside the drawer label holder/, 'the drawer label out of its holder');
  cut(crypto, 'desktop', move('k', 1, 900), /^whoami line 1 ".*" does not fit inside the whoami box/, 'a whoami line out of its box');
  cut(crypto, 'desktop', edit(/<text x="-224\.4"/, '<text x="-124.4"'), /^stamp ".*" does not fit inside the stamp box/, 'the stamp text out of its box');
  cut(crypto, 'desktop', move('pen', 1, 2000), /^pencil ".*" does not fit inside the card/, 'the pencil off the card');
  cut(crypto, 'phone', edit(/(<text x="[\d.]+" y="[\d.]+" class="def")/, '<text x="174.8" y="1442" class="def" fill="#000008">x</text>$1'), /^def 1 ".*"/, 'an extra definition line');
  hits({ ...crypto, phone: { data: crypto.phone.data } }, 'phone', /^the definition needs 3 lines/, 'a definition that needs a third line');
  cut({ ...crypto, phone: { data: crypto.phone.data } }, 'phone', edit(/<text [^>]*class="def"[^>]*>[^<]*<\/text>(?![\s\S]*class="def")/, ''), /^the definition needs 3 lines/, 'a third line counted by defLines, not by the drawn texts');
  // 3: a paper in front covers a text, a tab or the see-also card
  cut(crypto, 'desktop', move('tab', 4, 450), /^tab 4 ".*" is covered by the see-also card/, 'a tab label under the see-also card');
  cut(crypto, 'desktop', move('see', 2, 0, 40), /^see-also 2 ".*" is covered by the main card/, 'a see-also line under the main card');
  cut(crypto, 'desktop', move('cap', 1, 0, 40), /^caption ".*" is covered by the front card/, 'the caption under the front card');
  cut(crypto, 'desktop', move('phr', 1, 0, 160), /^phrase ".*" is covered by the drawer front/, 'the phrase under the drawer front');
  cut(crypto, 'desktop', edit(/<rect class="pp" x="1970" y="300" width="590"/, '<rect class="pp" x="1900" y="300" width="660"'), /^the shape of tab 4 comes within [\d.]+ px of the see-also card/, 'the front tab\'s shape within 16 px of the see-also card');
  cut(crypto, 'desktop', edit(/<rect class="pp" x="290" y="512" width="2320" height="1278"/, '<rect class="pp" x="290" y="488" width="2320" height="1302"'), /^the shape of tab 4 comes within [\d.]+ px of the main card/, 'the main card within 4 px of a tab\'s shape');
  // 4: the strike and the pencil
  cut(crypto, 'desktop', strike(56), /^the strike-through is not at the collation’s strike-through height/, 'the strike one row down');
  cut(crypto, 'desktop', strikeX(40), /^the strike-through does not run through the struck word/, 'the strike off the struck word');
  cut(crypto, 'desktop', strikeX2(-60), /^the strike-through does not run through the struck word/, 'the strike ending short of the struck word');
  cut(crypto, 'desktop', move('pen', 1, 2), /^pencil ".*" is not centred on the struck word/, 'the pencil 2 px off the struck word');
  cut(crypto, 'desktop', move('pen', 1, 0, -40), /^def 2 ".*" overlaps pencil/, 'the pencil into the definition');
  cut(crypto, 'desktop', move('pen', 1, 0, 34), /^pencil ".*" comes within -?[\d.]+ px of the strike-through/, 'the pencil on the strike');
  hits({ ...crypto, collation: 'IND-CCA2 ; 1 round trip ; RSA-2049' }, 'desktop', /^the struck word is not in the collation/, 'a struck word the collation lacks');
  // 5: the rod hole
  cut(crypto, 'desktop', edit(/<circle cx="1450" cy="1424" r="80"/, '<circle cx="1458" cy="1424" r="80"'), /^the rod hole is not centred on the card/, 'the rod hole off centre');
  cut(crypto, 'desktop', move('cap', 1, 30), /^caption ".*" is not centred on the rod hole/, 'the caption off the ring\'s centre');
  cut(crypto, 'desktop', move('cap', 1, 0, 14), /^caption ".*" is [\d.]+ px below the ring, not 24/, 'the caption off its gap');
  cut(crypto, 'desktop', move('trs', 4, 0, 4), /^subject 4 ".*" comes within [\d.]+ px of the rod hole/, 'a tracing within 24 px of the ring');
  // 6: the stamp
  cut(crypto, 'desktop', edit(/translate\(2305\.6,599\.59\)/g, 'translate(2305.6,775)'), /^the accession stamp comes within -?[\d.]+ px of the header rule/, 'the stamp box over the rule');
  cut(crypto, 'desktop', edit(/translate\(2305\.6,599\.59\)/g, 'translate(2305.6,1700)'), /^the accession stamp does not fit inside the main card/, 'the stamp box off the card\'s face');
  cut(crypto, 'desktop', move('entry', 1, 1000), /^entry ".*" comes within -?[\d.]+ px of the accession stamp/, 'the entry into the stamp box');
  // 7: the tracing grid
  hits({ ...crypto, tracings_subject: ['x'.repeat(21), ...crypto.tracings_subject.slice(1)] }, 'desktop', /^subject 1 ".*" runs past its column/, 'a tracing past its column');
  hits({ ...crypto, tracings_added: ['x'.repeat(24), crypto.tracings_added[1]] }, 'desktop', /^added I\. ".*" runs past its column/, 'an added entry past the text column');
  cut(crypto, 'desktop', move('num', 1, 5), /^num 1\. "1\." is off its grid/, 'a numeral off the grid');
  cut(crypto, 'desktop', move('trs', 1, 5), /^subject 1 ".*" is off its grid/, 'a tracing off the grid');
  // 8: a text within 4 px of a mark it does not own
  cut(crypto, 'desktop', move('def', 1, 0, -70), /^def 1 ".*" comes within -?[\d.]+ px of the header rule/, 'a text on the header rule');
  cut(crypto, 'desktop', move('def', 1, 0, -36.7), /^def 1 ".*" comes within [\d.]+ px of the header rule/, 'a text 2 px off the header rule (near, not touching)');
  cut(crypto, 'desktop', move('lab', 1, -140), /^drawer label ".*" comes within -?[\d.]+ px of a rivet/, 'a text on a rivet');
  cut(crypto, 'desktop', move('date', 2, 0, -50), /^date 2 ".*" comes within -?[\d.]+ px of the slip.s rules/, 'a date on the slip\'s rules');
  cut(crypto, 'desktop', move('d', 2, 0, -170), /^status line right ".*" comes within -?[\d.]+ px of the whoami box/, 'a text on the whoami box');
  cut(crypto, 'phone', move('date', 1, -40), /^date 1 ".*" comes within -?[\d.]+ px of the clip/, 'a phone date onto the clip');
  // 9: the whoami box
  cut(crypto, 'phone', edit(/y="2154" width="1210" height="166"/, 'y="2154" width="1210" height="178"'), /^the whoami box comes within [\d.]+ px of the drawer front/, 'the whoami box within 16 px of the drawer front');
  // 10: the canvas, the keep-clear zones and the notification line
  cut(crypto, 'desktop', move('d', 1, 1240), /^status line left ".*" reaches the Dock/, 'a text in the Dock');
  cut(crypto, 'desktop', move('call', 1, 0, -560), /^call 1 ".*" reaches the menu bar/, 'a text in the menu bar');
  cut(crypto, 'desktop', move('d', 2, 300), /^status line right ".*" leaves the canvas/, 'a text off the canvas');
  cut(crypto, 'phone', move('d', 1, 0, -2000), /^status line left ".*" reaches the clock/, 'a text under the phone clock');
  cut(crypto, 'phone', move('d', 1, 0, 200), /^status line left ".*" reaches the bottom of the screen/, 'a text in the phone\'s bottom 260 px');
  cut(crypto, 'phone', move('phr', 2, 0, 90), /^phrase\[1\] ".*" drops below the notification line/, 'the phone phrase below 2215');
  cut(crypto, 'phone', move('pen', 1, 0, 700), /^pencil ".*" drops below the notification line/, 'the phone pencil below 2215');
  cut(crypto, 'desktop', edit(/<rect x="2800" y="1690"/, '<rect x="2800" y="50"'), /^the whoami box reaches the menu bar/, 'a shape in the menu bar');
  cut(crypto, 'desktop', edit(/(<rect class="pp" x="290" y="512" width="2320" height=")1278"/, '$12000"'), /^the main card reaches the Dock/, 'the main card in the Dock');
  // structural bites: what the checker cannot read throws from scene(), never passes quietly
  const struct = (edits, re, what, fmt = 'desktop') => assert.throws(() => S.scene(sheet(crypto, fmt, edits), S.slotNames(crypto, fmt)), re, `scene() missed ${what}`);
  struct(edit(/(<text [^>]*class="coll" fill=")#000008/, '$1#123456'), /unknown color #123456/, 'an unknown fill');
  struct(edit(/<line x1="330"/, '<g transform="rotate(3)"><line x1="330"'), /unknown element <g>/, 'a <g transform>');
  struct(edit(/translate\(1550,992\) rotate\(-2\)/, 'translate(1550,992) rotate(-2 5 5)'), /unexpected transform/, 'rotate(a cx cy)');
  struct(edit(/class="coll"/, 'class="zz"'), /unknown text class "zz"/, 'an unknown class');
  struct(edit(/<rect class="pp" x="1970" y="300"[^>]*\/>/, ''), /sheet structure changed/, 'a removed paper');
  struct(edit(/<line x1="330" y1="784"[^>]*\/>/, ''), /sheet structure changed/, 'a missing header rule');
  struct(edit(/<text x="0" y="0" transform="translate\(1550,992\) rotate\(-2\)"[^>]*>[^<]*<\/text>/, ''), /sheet structure changed/, 'a strike without its pencil');
  // M3 gate review: bites at the rule's edge (a looser tolerance or a missing class no longer passes), and the guards with no bite yet
  cut(crypto, 'desktop', move('def', 1, 0, -35.7), /^def 1 ".*" comes within 3\.0 px of the header rule/, 'a text 3 px off the header rule (between half and the full 4)');
  cut(crypto, 'desktop', strikeX(2), /^the strike-through does not run through the struck word/, 'the strike starting 2 px late');
  cut(crypto, 'desktop', strikeX2(-2), /^the strike-through does not run through the struck word/, 'the strike ending 2 px short');
  cut(crypto, 'desktop', move('note', 1, 750), /^note 1 ".*" does not fit inside the text column/, 'a note 7 px past the pad');
  cut(crypto, 'desktop', move('tra', 1, 0, 370), /^added I\. ".*" is covered by the front card/, 'an added entry under the front card');
  cut(crypto, 'desktop', move('num', 1, 0, -480), /^num 1\. "1\." crosses the header line/, 'a numeral over the header rule');
  cut(crypto, 'desktop', move('pen', 1, 870), /^pencil ".*" does not fit inside the card/, 'the pencil 5 px past the card\'s side padding');
  cut(crypto, 'desktop', edit(/<text x="-224\.4"/, '<text x="-208.4"'), /^stamp ".*" does not fit inside the stamp box/, 'the stamp text 3 px out of its box');
  cut(crypto, 'desktop', edit(/translate\(2305\.6,599\.59\)/g, 'translate(2305.6,748.3)'), /^the accession stamp comes within [\d.]+ px of the header rule/, 'the stamp box 2 px off the rule');
  cut(crypto, 'desktop', move('lab', 1, 125), /^drawer label ".*" comes within -?[\d.]+ px of a rivet/, 'a text on the right rivet');
  cut(crypto, 'desktop', move('slh', 1, 200, -128), /^slip head ".*" comes within -?[\d.]+ px of the clip/, 'a text between the clip\'s wires');
  cut(crypto, 'desktop', edit(/<circle cx="1743" cy="1864"/, '<circle cx="2790" cy="1750"'), /^the whoami box comes within [\d.]+ px of a rivet/, 'the whoami box near a mark');
  cut(crypto, 'phone', edit(/y="2154" width="1210" height="166"/, 'y="2154" width="1210" height="171"'), /^the whoami box comes within 13\.\d px of the drawer front/, 'the whoami box 14 px from the drawer front');
  cut(crypto, 'phone', move('tab', 1, 0, -40), /^tab 1 ".*" reaches the clock/, 'a text 2 px into the phone clock');
  cut(crypto, 'desktop', move('call', 1, 0, -458), /^call 1 ".*" reaches the menu bar/, 'a text 3 px into the menu bar');
  cut(crypto, 'phone', move('d', 1, 0, 8), /^status line left ".*" reaches the bottom of the screen/, 'a text 2 px into the phone\'s bottom 260 px');
  cut(crypto, 'desktop', move('cap', 1, 0, 22), /^caption ".*" does not fit inside the text column/, 'the caption 2 px into the 4 px above the front card');
  cut(crypto, 'desktop', move('see', 2, 0, 33), /^see-also 2 ".*" does not fit inside the see-also card/, 'a see-also line 1.5 px into the 4 px above the main card');
  cut(crypto, 'desktop', move('phr', 1, 0, 35.5), /^phrase ".*" does not fit inside the blank guide/, 'the phrase 1.5 px into the 4 px above the drawer front');
  cut(crypto, 'desktop', move('k', 2, 40), /^whoami line 2 ".*" does not fit inside the whoami box/, 'a whoami line 3 px past its box');
  struct(edit(/<line x1="2987\.4" y1="638"[^>]*\/>/, ''), /sheet structure changed/, 'a clip with one wire');
  struct(edit(/<circle cx="1743"[^>]*\/>/, ''), /sheet structure changed/, 'a missing rivet');
  struct(edit(/<line x1="2732" y1="1224"[^>]*\/>/, ''), /sheet structure changed/, 'a missing slip rule');
  struct(edit(/<path class="pp" d="M240,1816 V266 H2660 V1816 Z"[^>]*\/>/, '<rect class="pp" x="240" y="266" width="2420" height="1550" fill="#000003"/>'), /sheet structure changed/, 'a plain card drawn as a rect');
  assert.equal(S.fits(crypto, 'phone', 'phrase', ['W'.repeat(18), 'is secret.'], crypto, f => prepare(crypto, f)).ok, false, 'catalog-card: the phone phrase fails on its first line');
  assert.equal(S.fits(crypto, 'phone', 'phrase', ['Only the key', 'W'.repeat(18)], crypto, f => prepare(crypto, f)).ok, false, 'catalog-card: the phone phrase fails on its second line');
  assert.deepEqual(SCHEMA, { phrase: [1, 2, 18], drawer_label: [1, 1, 20], guide_tabs: [4, 4, 14], call_number: [3, 3, 12], main_entry: [1, 1, 20], definition: [1, 1, 110], collation: [1, 1, 44], correction_struck: [1, 1, 18],
    correction_new: [1, 1, 18], notes: [1, 2, 44], rod_invariant: [1, 1, 28], tracings_subject: [2, 4, 20], tracings_added: [1, 2, 20], see_also: [1, 2, 24], circulation_dates: [3, 5, 18], label: [1, 1, 42] }, 'catalog-card: the schema table');
  assert.deepEqual(['A04:2025', 'LLM01:2026', 'API1:2023', 'CWE-327', 'CAPEC-66', 'TA0001', 'T1059.001', 'M1041', 'AML.T0051', 'MASWE-0005', 'MASVS-AUTH-1', 'SP 800-63B-4', 'SP 800-61r3', 'SP 800-227', 'NIST IR 8547', 'FIPS 140-3',
    'FIPS 203', 'RFC 9180', 'PR.AA-01', 'PO.1.1', 'IA-5(1)', 'A.5.17', 'IAM-12', 'V2.1.1', 'D3-MFA', 'WSTG-INPV-05', 'STR31-C'].filter(x => !isId(x)), [], 'catalog-card: every known ID shape');
  assert.deepEqual(['A06:2021', 'LLM01:2025', 'API1:2019', 'CWE-XYZ', 'SP 800-63B-x', 'T1059.1', 'FIPS 203-ipd', 'RFC9180', 'A.9.1'].filter(isId), [], 'catalog-card: an old edition or a malformed ID is no known shape');
  {
    const lex = { terms: [{ text: 'Shor\'s algorithm', card: { slots: ['subject'] } }, { text: 'Forward secrecy', card: { slots: ['subject'] } }, { text: 'Lattice cryptography', card: { slots: ['subject'] } }, { text: 'Diffie–Hellman key exchange', card: { slots: ['subject'], as: 'Diffie–Hellman' } },
      { text: 'X25519MLKEM768 · 0x11EC', code: '0x11EC', card: { slots: ['added'], as: 'X25519MLKEM768' } }, { text: 'Crypto agility', card: { slots: ['added'] } },
      { text: 'ML-DSA-65 · FIPS 204', code: 'FIPS 204', card: { slots: ['see'] } }, { text: 'HQC', code: 'NIST IR 8545', card: { slots: ['see'], as: 'HQC · NIST IR 8545' } }] };
    assert.throws(() => checkAccess({ ...crypto, tracings_added: ['Enigma', crypto.tracings_added[1]] }, lex, 'bite'), /is no term hinted for added/, 'checkAccess missed an added entry that is no hinted term');
    assert.throws(() => checkAccess({ ...crypto, see_also: ['Enigma · RFC 1', crypto.see_also[1]] }, lex, 'bite'), /is no term hinted for see/, 'checkAccess missed a see-also that is no hinted term');
    assert.throws(() => checkAccess({ ...crypto, call_number: ['A04:2025', 'CWE-327', 'FIPS 204'] }, lex, 'bite'), /stands in "FIPS 204"/, 'checkAccess missed a hinted code as a call line');
    assert.throws(() => checkAccess({ ...crypto, collation: 'IND-CCA2 ; FIPS 204 ; RSA-2048' }, lex, 'bite'), /stands in "IND-CCA2/, 'checkAccess missed a hinted code inside the collation');
    assert.throws(() => checkAccess({ ...crypto, notes: [crypto.notes[0], 'Transition: 0x11EC codepoint (Aug 2026).'] }, lex, 'bite'), /code 0x11EC/, 'checkAccess missed an added entry\'s code inside a note');
  }
}

// ---------- the studio contract (app/main.js): every series answers the same questions about a preset

// what a phone leaves undrawn: slots with no box, fixed marks with no box (Specimen's phone: no test line, notes, second pair, matrix or side label; Galley's: no notes, key or side label; Catalog Card's: no 3rd and 4th subject or side label)
const UNDRAWN_PHONE = { specimen: { slots: /^(test|notes|confusables\.1)/, fixed: /^(matrix\.axes|label)/ }, 'galley-proof': { slots: /^notes/, fixed: /^(key|label)/ }, 'catalog-card': { slots: /^tracings_subject\.[23]$/, fixed: /^label$/ } };
const studio = {};   // per series: presets, marks, slot boxes
for (const [sid, S] of Object.entries(SERIES)) {
  const st = studio[sid] = { presets: 0, marks: 0, quads: 0 };
  assert.ok(S.READ.nav && S.READ.title && S.READ.intro && S.READ.who && S.READ.mark && S.READ.legendHead.length === 3, `${sid}: the "Read the …" copy`);
  assert.ok(S.FIXED_LIST.length >= 3 && S.FIXED_LIST.every(([name, does]) => name?.trim() && does?.trim()), `${sid}: the fixed list has at least three entries, each with a name and a line`);
  assert.equal(Object.keys(S.FIXED).every(k => S.fixedOf(k)), true, `${sid}: fixedOf knows every FIXED key`);
  assert.ok(Array.isArray(S.typed) && S.typed.includes(sid) && S.typed.every(s => Object.hasOwn(SERIES, s)), `${sid}: typed lists its own series and only registered ones`);
  for (const e of INDEX[sid]) {
    const p = PRESETS[sid][e.id], at = `${sid}/${e.id}`, colors = ground(palettes[0], p.ground);
    assert.ok(S.valid(p) && !S.valid({}) && !S.valid(null), `${at}: valid()`);
    assert.ok(S.lineOf(p)?.trim(), `${at}: the volume's line`);
    const chips = S.chipsOf(p, colors);
    assert.ok(chips.length >= 1 && chips.every(c => c.text?.trim() && Object.values(colors).includes(c.color)), `${at}: chipsOf gives text and a palette color`);
    const list = S.marks(p, 'r2_labs'), W = FORMATS.desktop.w, H = FORMATS.desktop.h, box = (x, y) => x >= 0 && x <= W && y >= 0 && y <= H;
    assert.ok(list.length >= 8, `${at}: the key holds at least 8 marks`);
    assert.equal(new Set(list.map(m => m.id)).size, list.length, `${at}: mark ids are unique`);
    for (const m of list) {
      assert.ok(m.term?.trim() && m.mean?.trim(), `${at} ${m.id}: term and mean`);
      assert.ok(box(...m.pin), `${at} ${m.id}: pin ${m.pin} inside the canvas`);
      assert.match(S.GLYPH[m.id] ?? '', /^<(path|rect|circle)/, `${at} ${m.id}: a GLYPH`);
      assert.equal(typeof m.svg, 'string', `${at} ${m.id}: svg`);
      assert.equal(m.svg.replace(/<(rect|line|circle) [^>]*\/>/g, ''), '', `${at} ${m.id}: svg is only rect, line and circle elements`);
      for (const [el] of m.svg.matchAll(/<(rect|line|circle) [^>]*\/>/g)) {
        const a = Object.fromEntries([...el.matchAll(/ ([\w-]+)="([^"]*)"/g)].map(x => [x[1], x[2]])), n = k => { assert.ok(Number.isFinite(+a[k]), `${at} ${m.id}: ${k} in ${el}`); return +a[k]; };
        const [x0, y0, x1, y1] = el.startsWith('<rect') ? [n('x'), n('y'), n('x') + n('width'), n('y') + n('height')]
          : el.startsWith('<line') ? [n('x1'), n('y1'), n('x2'), n('y2')] : [n('cx') - n('r'), n('cy') - n('r'), n('cx') + n('r'), n('cy') + n('r')];
        assert.ok(box(x0, y0) && box(x1, y1), `${at} ${m.id}: ${el} leaves the canvas`);
      }
    }
    for (const [fmt, { w, h }] of Object.entries(FORMATS)) {
      const base = prepare(p, fmt), keys = S.slotsOf(p);
      assert.ok(S.GEOM.U(fmt) > 0, `${at} ${fmt}: GEOM.U`);
      for (const key of keys) {
        const px = S.GEOM.px(key, fmt), qs = S.slotQuads(base.s, p, key);
        assert.ok(px > 0, `${at} ${fmt} ${key}: GEOM.px is ${px}`);
        if (!qs.length) { assert.ok(fmt === 'phone' && UNDRAWN_PHONE[sid]?.slots.test(key), `${at} ${fmt} ${key}: no box`); continue; }   // a slot the phone leaves undrawn
        for (const q of qs) for (const [x, y] of q) assert.ok(x >= -1 && x <= w + 1 && y >= -1 && y <= h + 1, `${at} ${fmt} ${key}: box leaves the canvas`);
        st.quads++;
      }
      for (const key of Object.keys(S.FIXED)) {   // the fixed marks a click can hit have a box too (bar what a phone leaves undrawn)
        if (!(fmt === 'phone' && UNDRAWN_PHONE[sid]?.fixed.test(key))) assert.ok(S.slotQuads(base.s, p, key).length, `${at} ${fmt} fixed ${key}: no box`);
      }
    }
    st.presets++; st.marks += list.length;
  }
}

// ---------- PNG export: an sRGB chunk right after IHDR, once

{
  const be = (n, ...b) => [n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255, ...b];
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...be(13), 73, 72, 68, 82, ...new Array(13).fill(0), ...be(0), ...be(0, 73, 68, 65, 84), ...be(0)]);   // IHDR, empty IDAT (CRCs unchecked)
  const tagged = srgbPNG(png), at = 8 + 12 + 13;
  assert.equal(tagged.length, png.length + 13, 'srgbPNG adds one 13-byte chunk');
  assert.deepEqual([...tagged.subarray(0, at)], [...png.subarray(0, at)], 'signature and IHDR untouched');
  assert.deepEqual([...tagged.subarray(at, at + 9)], [...be(1, 0x73, 0x52, 0x47, 0x42, 0)], 'sRGB, length 1, intent 0, right after IHDR');
  assert.equal(new DataView(tagged.buffer).getUint32(at + 9), crc32(Buffer.from(tagged.subarray(at + 4, at + 9))), 'CRC-32 over type + data');
  assert.deepEqual([...tagged.subarray(at + 13)], [...png.subarray(at)], 'the rest follows unchanged');
  assert.deepEqual([...srgbPNG(tagged)], [...tagged], 'a tagged PNG passes through');
}

// ---------- ZIP export: stored entries, read back through the end record, the central directory and the local headers

{
  assert.equal(crc(new TextEncoder().encode('123456789')), 0xCBF43926, 'CRC-32 check value');
  const enc = new TextEncoder(), files = [{ name: '01_a.png', bytes: enc.encode('hello zip') }, { name: '02_é.png', bytes: Uint8Array.from({ length: 300 }, (_, i) => i * 7) }];
  const z = zip(files), dv = new DataView(z.buffer), dec = new TextDecoder();
  const eocd = z.length - 22;
  assert.equal(dv.getUint32(eocd, true), 0x06054b50, 'end record');
  assert.equal(dv.getUint16(eocd + 10, true), 2, 'two entries');
  let c = dv.getUint32(eocd + 16, true);
  assert.equal(c + dv.getUint32(eocd + 12, true), eocd, 'the directory ends where the end record starts');
  files.forEach((f, i) => {
    assert.equal(dv.getUint32(c, true), 0x02014b50, 'central header');
    const n = dv.getUint16(c + 28, true), off = dv.getUint32(c + 42, true);
    assert.equal(dec.decode(z.subarray(c + 46, c + 46 + n)), f.name, 'central name');
    assert.equal(dv.getUint32(c + 20, true), f.bytes.length, 'central size');
    assert.equal(dv.getUint32(c + 16, true), crc32(Buffer.from(f.bytes)), 'central CRC');
    assert.equal(dv.getUint16(c + 8, true) & 0x0800, 0x0800, 'UTF-8 flag');
    assert.equal(dv.getUint32(off, true), 0x04034b50, 'local header');
    assert.equal(dv.getUint16(off + 8, true), 0, 'stored');
    assert.equal(dv.getUint32(off + 14, true), crc32(Buffer.from(f.bytes)), 'local CRC');
    assert.equal(dec.decode(z.subarray(off + 30, off + 30 + n)), f.name, 'local name');
    assert.deepEqual([...z.subarray(off + 30 + n, off + 30 + n + f.bytes.length)], [...f.bytes], 'data');
    c += 46 + n;
  });
  const dir = mkdtempSync(join(tmpdir(), 'ks-zip-')), path = join(dir, 'pack.zip');
  writeFileSync(path, z);
  const r = spawnSync('unzip', ['-t', path]);
  if (!r.error) assert.equal(r.status, 0, `unzip -t: ${r.stdout}`);
}

const sum = k => Object.values(studio).reduce((n, x) => n + x[k], 0), nf = Object.keys(FORMATS).length, per = sid =>
  `${sid} ${counts[sid]} renders (${INDEX[sid].length} presets × ${palettes.length} palettes × ${GROUNDS.length} grounds × ${nf} formats) · overlap checker: ${sheets[sid]} sheets clear`;
const contract = ([sid, x]) => `${sid} ${x.presets} presets, ${x.marks} marks, ${x.quads} slot boxes`;
console.log(`ok · ${Object.keys(SERIES).map(per).join(' · ')} · studio contract: ${Object.entries(studio).map(contract).join(' · ')} · total ${sum('presets')} presets, ${sum('marks')} marks, ${sum('quads')} slot boxes · angular (farthest setup): ${ANGULAR} · catalog-card fixtures max and min: ${card.renders} renders (2 × ${palettes.length} palettes × ${GROUNDS.length} grounds × ${nf} formats), ${card.sheets} sheets clear, angular ${Object.keys(FORMATS).map(f => `${f} text ≥ ${card.angular[f][0].toFixed(1)}′ strokes ≥ ${card.angular[f][1].toFixed(1)}′`).join(' · ')}`);
