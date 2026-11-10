// Studio regression tests, no browser needed:  node app/studio.test.mjs
// 0XF-103: a series id is an own key. Inherited names and unknown slugs never open or switch the studio.
// 0XF-104: a whoami line is checked against the face that series draws it in. Missing metrics are not a pass.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SERIES, bootSeries, isSeries, seriesSwitch } from './series/index.js';
import { DEFAULT } from './store.js';
import { PROBE, advances, classes, glyphs, useMetrics } from './boxes.js';
import { FACES, faceMetrics } from './fonts.js';
import { confirmedMotto, fieldMotto, mottoStatus, mottoToStore } from './whoami.js';

const link = (series, extra = {}) => ({ series, vol: null, ink: null, ground: null, format: null, ...extra });
// names Object.prototype owns. SERIES[name] is truthy, and it has no READ.mark.
const INHERITED = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 'toLocaleString'];
const UNKNOWN = ['not-a-series', '', 'prototype', 'font'];

for (const id of INHERITED) {
  assert.equal(isSeries(id), false, `${id} is not a series`);
  assert.ok(SERIES[id], `${id} is an inherited property, so a truthiness check would accept it`);
  assert.equal(bootSeries(link(id), 'specimen'), DEFAULT, `?series=${id} opens the default studio`);
  assert.equal(bootSeries(null, id), DEFAULT, `a saved ${id} opens the default studio`);
  assert.equal(seriesSwitch('specimen', id), 'specimen', `switching to ${id} keeps the current series`);
  assert.doesNotThrow(() => bootSeries(link(id), id), `${id} does not reject startup`);
}
for (const id of UNKNOWN) {
  assert.equal(isSeries(id), false, `${id} is not a series`);
  assert.equal(SERIES[id], undefined, `${id} was already absent`);
  assert.equal(bootSeries(link(id), 'galley-proof'), DEFAULT, `?series=${id} opens the default, not the saved series`);
  assert.equal(seriesSwitch('catalog-card', id), 'catalog-card', `switching to ${id} keeps the current series`);
}
for (const id of [undefined, null, 0, 1, true, false, {}, [], Object.prototype]) assert.equal(isSeries(id), false);

for (const id of Object.keys(SERIES)) {
  assert.equal(isSeries(id), true, id);
  assert.equal(typeof SERIES[id].READ.mark, 'string', `${id} can open the studio`);
  assert.equal(bootSeries(link(id), id === DEFAULT ? 'specimen' : DEFAULT), id, `?series=${id} wins over the saved series`);
  assert.equal(bootSeries(null, id), id, `a saved ${id} is restored when the URL has no studio params`);
  assert.equal(seriesSwitch(id === DEFAULT ? 'specimen' : DEFAULT, id), id, `a switch to ${id} lands there`);
  assert.equal(seriesSwitch(id, id), id, `switching to the current series leaves it`);
}

// a link that names some other param and no series does not fall through to the saved series
assert.equal(bootSeries(link(null, { vol: '4' }), 'specimen'), DEFAULT);
assert.equal(bootSeries(null, undefined), DEFAULT);
assert.equal(bootSeries(null, null), DEFAULT);
assert.equal(DEFAULT, 'cutting-mat');

// ---------- 0XF-104 whoami face

const file = (path) => new URL(`../${path}`, import.meta.url);
const json = (path) => JSON.parse(readFileSync(file(path), 'utf8'));
const MONO_ONLY = '₿';     // U+20BF, in JetBrains Mono, absent from Source Code Pro
const GALLEY_ONLY = '✓';   // U+2713, in Source Code Pro, absent from JetBrains Mono
const SHARED = 'déjà vu';  // Latin plus accents, in both monos
const MARKS = 'café · →';  // middle dot and arrow, the ink the checker measures, in both monos
assert.equal(MONO_ONLY.codePointAt(0), 0x20BF);
assert.equal(GALLEY_ONLY.codePointAt(0), 0x2713);

// before any metrics: absence is not coverage, and the line stays in the field unconfirmed
for (const face of ['mono', 'sourceCode']) {
  assert.equal(glyphs(face, 'A'), null, `${face} metrics are not loaded`);
  assert.equal(mottoStatus(GALLEY_ONLY, face), 'pending');
  assert.equal(confirmedMotto(GALLEY_ONLY, GALLEY_ONLY, face), '', `${face}: an unmeasured line is not exported`);
  assert.equal(mottoToStore(GALLEY_ONLY, ''), GALLEY_ONLY, `${face}: an unmeasured line is not discarded`);
}

const bytes = Object.fromEntries(Object.keys(FACES).map((k) => [k, readFileSync(file(FACES[k].file))]));
useMetrics({ mono: faceMetrics('mono', bytes.mono, advances) });
assert.equal(glyphs('sourceCode', GALLEY_ONLY), null, 'mono metrics do not validate Galley Proof');
assert.equal(mottoStatus(GALLEY_ONLY, 'sourceCode'), 'pending');
assert.equal(glyphs('mono', GALLEY_ONLY), false);
assert.equal(glyphs('mono', MONO_ONLY), true);

useMetrics(Object.fromEntries(Object.keys(FACES).map((k) => [k, faceMetrics(k, bytes[k], advances)])));
assert.equal(glyphs('sourceCode', GALLEY_ONLY), true);
assert.equal(glyphs('sourceCode', MONO_ONLY), false);
assert.equal(glyphs('mono', SHARED), true);
assert.equal(glyphs('sourceCode', SHARED), true);
assert.equal(glyphs('mono', MARKS), true);
assert.equal(glyphs('sourceCode', MARKS), true);

const cap = SERIES['cutting-mat'].LIMITS.motto;
const full = 'm'.repeat(cap);
for (const S of Object.values(SERIES)) assert.equal(S.LIMITS.motto, cap, `${S.name} motto limit`);
for (const face of ['mono', 'sourceCode']) {
  assert.equal(mottoStatus(full, face), 'ok', `${face} accepts a full line`);
  assert.equal(confirmedMotto(full, '', face), full);
  assert.equal(mottoStatus(full + 'm', face), 'length');
  assert.equal(mottoStatus(SHARED, face), 'ok');
  assert.equal(mottoStatus(MARKS, face), 'ok');
}

for (const [id, S] of Object.entries(SERIES)) {
  assert.ok(FACES[S.whoFace], `${id} names a face`);
  assert.ok(S.fonts.includes(S.whoFace), `${id} loads the whoami face`);
  const preset = json(`${S.dir}/${json(`${S.dir}/index.json`)[0].id}.json`);
  const svg = S.render({ preset, colors: PROBE, format: 'desktop', handle: '', motto: '', fonts: null });
  assert.equal(classes(svg).k.face, S.whoFace, `${id} draws the whoami box in ${S.whoFace}`);
  assert.equal(mottoStatus(MONO_ONLY, S.whoFace) === 'ok', S.whoFace === 'mono', `${id} checks ₿ against its own face`);
  assert.equal(mottoStatus(GALLEY_ONLY, S.whoFace) === 'ok', S.whoFace === 'sourceCode', `${id} checks ✓ against its own face`);
}

// opening Galley Proof directly and arriving there from another series agree
for (const from of Object.values(SERIES)) for (const to of Object.values(SERIES)) {
  for (const text of [MONO_ONLY, GALLEY_ONLY, SHARED, MARKS, full]) {
    const direct = confirmedMotto(text, '', to.whoFace);
    const via = confirmedMotto(text, confirmedMotto(text, '', from.whoFace), to.whoFace);
    assert.equal(via, direct, `${from.name} → ${to.name}: ${text}`);
  }
}

// a line the new face cannot draw stays in the field and out of the export, and comes back on a face that can
assert.equal(confirmedMotto(MONO_ONLY, MONO_ONLY, 'sourceCode'), '');
assert.equal(mottoToStore(MONO_ONLY, ''), MONO_ONLY);
assert.equal(confirmedMotto(MONO_ONLY, '', 'mono'), MONO_ONLY);
assert.equal(fieldMotto(MONO_ONLY, ''), MONO_ONLY, 'a saved line is shown before it is judged');
assert.equal(fieldMotto(MONO_ONLY, 'kept'), 'kept', 'text typed while the page loads wins');
assert.equal(fieldMotto(undefined, ''), '');
// a draft that never passed does not replace the confirmed line on disk
assert.equal(mottoToStore(`hello${GALLEY_ONLY}`, 'hello'), 'hello');
assert.equal(mottoToStore('', 'hello'), '');
assert.equal(confirmedMotto(`hello${GALLEY_ONLY}`, 'hello', 'mono'), 'hello');

console.log(`ok · studio 0XF-103/104 · ${Object.keys(SERIES).length} series · ${INHERITED.length} inherited names rejected · whoami faces ${[...new Set(Object.values(SERIES).map((S) => S.whoFace))].join(', ')}`);
