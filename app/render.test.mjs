// Renderer smoke test, no browser needed:  node app/render.test.mjs
// Presets are discovered from series/cutting-mat/presets/index.json. Each one is checked against the
// README slot table, rendered in every palette and format, and run through the overlap checker (app/check.js,
// the same code the word editor uses in the browser).
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { FORMATS, HANDLE, MOTTO, esc, validHandle, validMotto, whoamiLines } from './render.js';
import { render } from './series/cutting-mat.js';
import { ANGLES, HANDLES, LIMITS, MOTTOS, advances, overlaps, useMetrics } from './check.js';

const file = path => new URL(`../${path}`, import.meta.url);
const json = path => JSON.parse(readFileSync(file(path), 'utf8'));
const DIR = 'series/cutting-mat/presets';
const palettes = ['purple', 'green', 'red', 'blue'].map(slug => json(`palettes/${slug}.json`));
const fonts = { nunito: 'data:font/ttf;base64,TlVOSVRP', jbm: 'data:font/ttf;base64,SkJN' };
const ground = (pal, role) => Object.values(pal.grounds).find(g => g.role === role).colors;
const len = s => [...s].length;                     // code points: "·" and "→" count once
const pad2 = v => String(v).padStart(2, '0');

// ---------- the index: an ordered list of { id, vol, title, topic, ground }

const GROUNDS = ['dark', 'mid', 'light'];
const TITLE = /^Vol\. (\d{2}) · (\S.*)$/;
const index = json(`${DIR}/index.json`);
assert.ok(Array.isArray(index) && index.length > 0, 'index.json: a non-empty list');
index.forEach((e, i) => {
  const at = `index.json[${i}]`;
  assert.deepEqual(Object.keys(e ?? {}).sort(), ['ground', 'id', 'title', 'topic', 'vol'], `${at}: keys are id, vol, title, topic, ground`);
  assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${at}: id is a lowercase slug`);
  assert.equal(e.id, e.topic, `${at}: id is the topic slug (it names the preset file and the downloads)`);
  assert.equal(e.vol, i + 1, `${at}: vol ${e.vol}, expected ${i + 1} (volumes run 1, 2, 3… in file order)`);
  const m = e.title.match(TITLE);
  assert.ok(m && +m[1] === e.vol, `${at}: title "${e.title}" should read "Vol. ${pad2(e.vol)} · Name"`);
  assert.ok(len(m[2]) <= 10, `${at}: title name "${m[2]}" is ${len(m[2])} chars, max 10 (one line on its picker card)`);
  assert.ok(GROUNDS.includes(e.ground), `${at}: ground is dark, mid or light`);
  assert.ok(existsSync(file(`topics/${e.topic}.json`)), `${at}: topic "${e.topic}" has no lexicon in topics/`);
  assert.ok(existsSync(file(`${DIR}/${e.id}.json`)), `${at}: ${DIR}/${e.id}.json is missing`);
});
const dupes = k => index.map(e => e[k]).filter((v, i, all) => all.indexOf(v) !== i);
assert.deepEqual(dupes('id'), [], 'index.json: duplicate ids');
const listed = readdirSync(file(DIR)).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => f.slice(0, -5));
assert.deepEqual(listed.sort(), index.map(e => e.id).sort(), `${DIR}: every preset file is listed in index.json, and only those`);
const presets = Object.fromEntries(index.map(e => [e.id, json(`${DIR}/${e.id}.json`)]));

// ---------- glyph coverage: every character a preset uses exists in the font that draws it

const MONO_ADV = advances(readFileSync(file('fonts/jetbrains-mono/JetBrainsMono-Variable.ttf')));
const NUNITO_ADV = advances(readFileSync(file('fonts/nunito/Nunito-Variable.ttf')), { wght: 300 });   // .ph draws at 300
useMetrics({ mono: MONO_ADV, nunito: NUNITO_ADV });
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
const strings = (p, fmt, handle = '') => [
  ...p.phrase, ...monoStrings({ ...p, data: fmt === 'phone' ? { ...p.data, ...p.phone?.data } : p.data, phone: null }),
].map(s => s.replaceAll('{handle}', handle || HANDLE));

// leaked values: a NaN, undefined, null or [object …] in any attribute (coordinates, colors, transforms)
const leaked = svg => [...svg.matchAll(/ [\w:-]+="([^"]*)"/g)].map(m => m[1]).filter(v => /NaN|undefined|null|Infinity|\[object/.test(v));
// every text the sheet draws is one the test expects: preset strings, the whoami box, the signature, the
// ISB tags and the rulers (hex offsets, addresses, line numbers). Words like "NaN" are fine as words.
const RULER = /^([0-9A-F]{2}|0x[0-9A-F]{4}|\d{1,2})$/;
function unexpected(svg, p, fmt, handle = '', motto = '') {
  const ok = new Set([...strings(p, fmt, handle), ...whoamiLines(handle, motto), '0xF3tt', 'ISB-01', 'ISB-02']);
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

let count = 0;
for (const [slug, p] of Object.entries(presets)) {
  // every ground, not only the preset's own: the app lets people switch it
  for (const pal of palettes) for (const role of GROUNDS) for (const [fmt, { w, h }] of Object.entries(FORMATS)) {
    const where = `${slug}/${pal.slug}/${role}/${fmt}`;
    const svg = render({ preset: p, colors: ground(pal, role), format: fmt, handle: '', fonts });
    assert.match(svg, new RegExp(`^<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`), where);
    assert.ok(svg.endsWith('</svg>'), where);
    assert.deepEqual(leaked(svg), [], `${where}: bad value in an attribute`);
    assert.deepEqual(unexpected(svg, p, fmt), [], `${where}: text the preset does not hold`);
    for (const s of strings(p, fmt)) assert.ok(svg.includes(`>${esc(s)}</text>`), `${where}: missing ${s}`);
    assert.ok(svg.includes(`>0xF3tt · ${MOTTO}</text>`), `${where}: default whoami`);
    assert.ok(svg.includes(fonts.nunito) && svg.includes(fonts.jbm), `${where}: fonts`);
    assert.ok(svg.includes('text{font-family:KMono') && svg.includes('font-variant-ligatures:none'), where);
    assert.ok(svg.includes('.t{font-size:') && /\.t\{[^}]*letter-spacing:0;/.test(svg), `${where}: halo labels need letter-spacing 0 (Safari cuts letters)`);
    assert.ok(!/<foreignObject|<div|<script/i.test(svg), `${where}: SVG text only`);
    balanced(svg);
    onCanvas(svg, w, h, where);
    count++;
  }
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

const problems = [];
for (const e of index) for (const fmt of Object.keys(FORMATS)) for (const b of overlaps(presets[e.id], fmt)) problems.push(`${e.id}/${fmt}: ${b}`);
if (problems.length) assert.fail(`overlap checker: ${problems.length} collision(s)\n  ${problems.join('\n  ')}`);

// ---------- escaping, handles, whoami lines, format details

assert.equal(esc(`<&>"'`), '&lt;&amp;&gt;&quot;&apos;');
assert.equal(esc('a\u0000b\u001Fc'), 'abc');
const p = presets.appsec, colors = ground(palettes[0], p.ground);
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

const nf = Object.keys(FORMATS).length;
console.log(`ok · ${count} renders (${index.length} presets × ${palettes.length} palettes × ${GROUNDS.length} grounds × ${nf} formats)`
  + ` · overlap checker: ${index.length * nf * HANDLES.length * MOTTOS.length} sheets clear`);
