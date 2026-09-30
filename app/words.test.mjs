// Word editor test, no browser needed:  node app/words.test.mjs
// Every word the editor offers as fitting must pass the renderer's own checks once it is on the sheet: the slot
// table and the full overlap checker in every format, with the longest handle and whoami line. The fast path
// the editor uses (quickFits) must agree with the full checker.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FORMATS } from './render.js';
import { LIMITS, advances, get, overlaps, prepare, slotRules, useMetrics } from './check.js';
import { FMTS, options, put, slotsOf, wrapPhrase } from './words.js';

const file = (path) => new URL(`../${path}`, import.meta.url);
const json = (path) => JSON.parse(readFileSync(file(path), 'utf8'));
useMetrics({
  mono: advances(readFileSync(file('fonts/jetbrains-mono/JetBrainsMono-Variable.ttf'))),
  nunito: advances(readFileSync(file('fonts/nunito/Nunito-Variable.ttf')), { wght: 300 }),
});
const index = json('series/cutting-mat/presets/index.json');
const presets = Object.fromEntries(index.map((e) => [e.id, json(`series/cutting-mat/presets/${e.id}.json`)]));
const lexicons = Object.fromEntries(index.map((e) => [e.topic, json(`topics/${e.topic}.json`)]));
const LONG = { handles: ['x'.repeat(LIMITS.handle)], mottos: ['y'.repeat(LIMITS.motto)] };   // the default box is covered below

// the lexicons' optional editor fields
const MAT_SLOTS = ['source', 'sink', 'control', 'flow', 'finding', 'note', 'status'];
for (const [topic, lex] of Object.entries(lexicons)) lex.terms.forEach((t, i) => {
  const at = `topics/${topic}.json terms[${i}] "${t.text}"`;
  if (t.type === 'phrase') assert.ok(wrapPhrase(t.text), `${at}: a phrase must fit two lines of ${LIMITS.phrase} characters`);
  if (t.mat == null) return;
  assert.ok(t.mat && typeof t.mat === 'object' && !Array.isArray(t.mat), `${at}: mat is an object`);
  assert.deepEqual(Object.keys(t.mat).filter((k) => !['slots', 'as'].includes(k)), [], `${at}: mat holds only slots and as`);
  assert.ok(Array.isArray(t.mat.slots) && t.mat.slots.every((s) => MAT_SLOTS.includes(s)), `${at}: mat.slots from ${MAT_SLOTS.join(', ')}`);
  if ('as' in t.mat) assert.ok(typeof t.mat.as === 'string' && t.mat.as.trim() === t.mat.as && t.mat.as, `${at}: mat.as is the sheet form`);
});

// a fixed pseudo-random order, so the sample is the same on every run
let seed = 20260929;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (list, n) => { const l = [...list], out = []; while (l.length && out.length < n) out.push(...l.splice(Math.floor(rnd() * l.length), 1)); return out; };

let offered = 0, checked = 0, agreed = 0;
for (const e of index) {
  const shipped = presets[e.id], cache = {}, prepared = (f) => (cache[f] ??= prepare(shipped, f));
  for (const key of slotsOf(shipped)) {
    if (key === 'whoami') continue;
    const rows = options({ entry: e, key, shipped, current: shipped, lexicon: lexicons[e.topic], index, presets, prepared });
    assert.ok(same(rows[0].value, get(shipped, key)) && rows[0].applied, `${e.id} ${key}: the shipped words come first and are in use`);
    const ok = rows.filter((r) => r.ok && !r.applied);
    offered += ok.length;
    // accepted words pass the whole test, with the longest whoami box
    for (const r of pick(ok, 2)) {
      const next = put(shipped, key, r.value, shipped), where = `${e.id} ${key} = ${JSON.stringify(r.value)}`;
      assert.deepEqual(slotRules(next, key, get(next, key)), [], `${where}: slot rules`);
      for (const f of FMTS) assert.deepEqual(overlaps(next, f, LONG), [], `${where} on ${f}`);
      checked++;
    }
    // the fast path agrees with the full checker, on words it accepted and words it turned down for their fit
    for (const r of pick(rows.filter((x) => x.per && !x.applied), 2)) for (const f of FMTS) {
      const full = overlaps(put(shipped, key, r.value, shipped), f, { handles: [''], mottos: [''] }).length === 0;
      assert.equal(r.per[f].ok, full, `${e.id} ${key} = ${JSON.stringify(r.value)} on ${f}: editor says ${r.per[f].ok}, checker says ${full}`);
      agreed++;
    }
  }
}
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// phrases wrap at a space, after punctuation first
assert.deepEqual(wrapPhrase('Assume breach.'), ['Assume breach.']);
assert.deepEqual(wrapPhrase('Never trust, always verify.'), ['Never trust,', 'always verify.']);
assert.equal(wrapPhrase('x'.repeat(LIMITS.phrase + 1)), null);

console.log(`ok · ${offered} fitting words offered · ${checked} applied and checked in ${Object.keys(FORMATS).length} formats · ${agreed} fast-path verdicts match the checker`);
