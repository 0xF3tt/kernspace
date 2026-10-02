// Renderer smoke test, no browser needed:  node app/render.test.mjs
// Every series in the registry (app/series/index.js) runs the shared contract: presets are discovered from its
// <dir>/index.json, checked for shape, and rendered in every palette, ground and format. Then the overlap checker
// (app/check.js, the same code the word editor uses in the browser) for every series that has one, and per-series
// blocks: Cutting Mat's presets against the README slot table; Specimen's against its own preset shape, the
// waterfall clip, the hero column and the keep-clear zones; Galley Proof's against its preset shape and content rules, a fixture
// with all eight mark types and renderer safety; both with a broken sheet for each rule the checker must catch.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { FORMATS, GRAIN, HANDLE, MOTTO, esc, validHandle, validMotto, whoamiLines } from './render.js';
import { SERIES } from './series/index.js';
import { GEOMETRY, heroSize } from './series/specimen.js';
import { AUTHOR, GEOMETRY as GALLEY, KEY, KEY_HEAD, tally, slip } from './series/galley-proof.js';
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
const STRINGS = { 'cutting-mat': cuttingMatStrings, specimen: specimenStrings, 'galley-proof': galleyStrings };

// leaked values: a NaN, undefined, null or [object …] in any attribute (coordinates, colors, transforms)
const leaked = svg => [...svg.matchAll(/ [\w:-]+="([^"]*)"/g)].map(m => m[1]).filter(v => /NaN|undefined|null|Infinity|\[object/.test(v));
// every text the sheet draws is one the test expects: preset strings, the whoami box, the signature, the
// ISB tags and the rulers (hex offsets, addresses, line numbers). Words like "NaN" are fine as words.
const EXTRA = { 'cutting-mat': ['0xF3tt', 'ISB-01', 'ISB-02'], specimen: [], 'galley-proof': ['0xF3tt'] };   // texts a series draws besides its preset's strings
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
  assert.ok(svg.includes(`>0xF3tt · ${MOTTO}</text>`) && svg.includes('>0xF3tt</text>') === (fmt !== 'phone'), `${where}: whoami and the signature`);
  if (fmt === 'phone') for (const [, x, t] of svg.matchAll(/<text x="([\d.]+)" y="[\d.]+" class="mt"[^>]*>([^<]*)</g)) assert.ok(+x + 18 * len(t) <= 1230, `${where}: "${t}" runs past x 1230`);
  assert.ok(!/<foreignObject|<div|<script|id="grain"/i.test(svg), `${where}: SVG text only`);
  const c = ground(pal, role), drawn = new Set(S.BAR.map(k => c[k]));   // the roles the sheet draws in
  for (const r of ['major', 'angle', 'diag', 'tb', 'sink', 'chip3']) assert.ok(drawn.has(c[r]) || !svg.includes(`"${c[r]}"`), `${where}: draws in ${r}, which Galley Proof never uses`);
  for (const [, d] of svg.matchAll(/<path d="([^"]*)"/g)) assert.ok(/^[MLHVC\d.,\s-]+$/.test(d) && d.startsWith('M'), `${where}: path uses only absolute M L H V C: ${d}`);
  for (const [, t] of svg.matchAll(/ transform="([^"]*)"/g)) assert.match(t, /^translate\(\d+,\d+\) rotate\(-1\.5\)$|^translate\([\d.]+,[\d.]+\) rotate\(-90\)$/, `${where}: transform form`);
  assert.equal((svg.match(/rotate\(-1\.5\)/g) ?? []).length, 7, `${where}: every slip element carries the turn`);
  assert.ok(!svg.includes('class="gl"') === (fmt === 'phone'), `${where}: glosses are desktop and wide only`);
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
    assert.ok(svg.includes(`>0xF3tt · ${MOTTO}</text>`), `${where}: default whoami`);
    assert.ok(svg.includes(fonts.nunito) && svg.includes(fonts.jbm), `${where}: fonts`);
    assert.ok(svg.includes('text{font-family:KMono') && svg.includes('font-variant-ligatures:none'), where);
    if (sid === 'cutting-mat') assert.ok(svg.includes('.t{font-size:') && /\.t\{[^}]*letter-spacing:0;/.test(svg), `${where}: halo labels need letter-spacing 0 (Safari cuts letters)`);
    assert.ok(!/<foreignObject|<div|<script/i.test(svg), `${where}: SVG text only`);
    balanced(svg);
    onCanvas(svg, w, h, where);
    if (sid === 'galley-proof') galleyRender(S, svg, pal, role, fmt, where);
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
assert.deepEqual(whoamiLines(''), ['# whoami', `0xF3tt · ${MOTTO}`]);
assert.deepEqual(whoamiLines('abcdefg'), ['# whoami', `abcdefg · ${MOTTO}`]);          // 48 chars: still 2 lines
assert.deepEqual(whoamiLines('abcdefgh'), ['# whoami', 'abcdefgh', MOTTO]);            // 49: wraps
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
  assert.ok(!svg.includes('{handle}') && !svg.includes('>0xF3tt · '), `${fmt}: no default name left in the prompt or the whoami box`);
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
  assert.ok(!SERIES['cutting-mat'].phoneCap && !SERIES.specimen.phoneCap, 'galley-proof: only Galley caps data.left below LIMITS.phone');

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

// ---------- the studio contract (app/main.js): every series answers the same questions about a preset

// what a phone leaves undrawn: slots with no box, fixed marks with no box (Specimen's phone: no test line, notes, second pair, matrix or side label; Galley's: no notes, key or side label)
const UNDRAWN_PHONE = { specimen: { slots: /^(test|notes|confusables\.1)/, fixed: /^(matrix\.axes|label)/ }, 'galley-proof': { slots: /^notes/, fixed: /^(key|label)/ } };
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

const sum = k => Object.values(studio).reduce((n, x) => n + x[k], 0), nf = Object.keys(FORMATS).length, per = sid =>
  `${sid} ${counts[sid]} renders (${INDEX[sid].length} presets × ${palettes.length} palettes × ${GROUNDS.length} grounds × ${nf} formats) · overlap checker: ${sheets[sid]} sheets clear`;
const contract = ([sid, x]) => `${sid} ${x.presets} presets, ${x.marks} marks, ${x.quads} slot boxes`;
console.log(`ok · ${Object.keys(SERIES).map(per).join(' · ')} · studio contract: ${Object.entries(studio).map(contract).join(' · ')} · total ${sum('presets')} presets, ${sum('marks')} marks, ${sum('quads')} slot boxes`);
