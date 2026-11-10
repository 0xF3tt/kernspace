// The modules split out of the studio. They load in Node: no DOM, and importing them does not start the app.
import assert from 'node:assert/strict';
import { createAssets, readIndex } from './assets.js';
import { commitStack, redoStack, undoStack } from './history.js';
import { applyLink, linkQuery, readLink, storeRecord } from './link.js';
import { createState, versionKey } from './state.js';
import { DEFAULT, migrate } from './store.js';

assert.equal(typeof document, 'undefined');
await import('./dom.js');
await import('./editor.js');
await import('./export.js');
await import('./persist.js');

assert.equal(createState().series, DEFAULT);
assert.equal(createState().mark, 'taint');
assert.equal(versionKey('specimen', 'web'), 'specimen:web');
assert.equal(migrate({ v: 1, edits: { appsec: { phrase: ['A'] } }, handle: 'ada', motto: '' }).series, DEFAULT);

assert.equal(readLink(''), null);
assert.equal(readLink('?other=1'), null);
assert.deepEqual(readLink('?series=constructor&vol=4'), { series: 'constructor', vol: '4', ink: null, ground: null, format: null });

const index = [
  { vol: 1, ground: 'mid' },
  { vol: 2, ground: 'light' },
  { vol: 3, ground: 'dark' },
];
const untouched = { i: 0, role: 'mid', ink: 'purple', format: 'desktop' };
assert.deepEqual(applyLink(untouched, index, { vol: '3', ink: 'blue', ground: 'light', format: 'wide' }), {
  i: 2, role: 'light', ink: 'blue', format: 'wide',
});
assert.equal(untouched.i, 0, 'applyLink does not mutate the state it was given');
assert.deepEqual(applyLink({ i: 1 }, index, null), { i: 1, role: 'light' });

assert.equal(linkQuery({ series: DEFAULT, index: 0, vol: 1, ink: 'purple', role: 'mid', format: 'desktop', volumeGround: 'mid' }), '');
assert.equal(
  linkQuery({ series: 'specimen', index: 2, vol: 3, ink: 'blue', role: 'light', format: 'wide', volumeGround: 'dark' }),
  '?series=specimen&vol=3&ink=blue&ground=light&format=wide',
);

assert.equal(storeRecord({
  series: DEFAULT, handle: '', motto: '', edits: {}, unchecked: {},
  presetOf: () => ({}), changedSlots: () => [], get: () => undefined,
}), null);
const stored = storeRecord({
  series: 'specimen', handle: 'ada', motto: '',
  edits: { 'cutting-mat': { appsec: { phrase: ['Secure', 'by hand.'] } } },
  unchecked: { specimen: { web: { source: 'kept' } } },
  presetOf: () => ({ phrase: ['Secure', 'by design.'] }),
  changedSlots: (preset, shipped) => (preset.phrase?.[1] === shipped.phrase?.[1] ? [] : ['phrase']),
  get: (preset, key) => preset[key],
});
assert.equal(stored.v, 2);
assert.equal(stored.series, 'specimen');
assert.equal(stored.handle, 'ada');
assert.deepEqual(stored.edits.specimen.web, { source: 'kept' });
assert.deepEqual(stored.edits['cutting-mat'].appsec.phrase, ['Secure', 'by hand.']);

const stacks = {};
commitStack(stacks, 'cutting-mat:appsec', { n: 1 }, { n: 2 }, 'Phrase changed');
assert.equal(undoStack(stacks, 'nope'), null);
assert.deepEqual(undoStack(stacks, 'cutting-mat:appsec').before, { n: 1 });
assert.equal(stacks['cutting-mat:appsec'].undo.length, 0);
assert.deepEqual(redoStack(stacks, 'cutting-mat:appsec').after, { n: 2 });
assert.equal(stacks['cutting-mat:appsec'].redo.length, 0);
commitStack(stacks, 'cutting-mat:appsec', { n: 2 }, { n: 3 }, 'again');
assert.equal(stacks['cutting-mat:appsec'].redo.length, 0, 'a new edit drops the redo stack');

const warned = [];
const warn = console.warn;
console.warn = (...a) => warned.push(a.join(' '));
const entries = readIndex([
  { id: 'appsec', vol: 1, title: 'Vol. 01 · Design', topic: 'appsec', ground: 'mid' },
  { id: 'nope', vol: 1.2, title: 'x', topic: 'appsec', ground: 'mid' },
  { id: 'appsec', vol: 9, title: 'dup', topic: 'appsec', ground: 'dark' },
]);
console.warn = warn;
assert.deepEqual(entries.map((e) => e.id), ['appsec']);
assert.equal(warned.length, 2);
assert.throws(() => readIndex(null), /not a list/);
assert.throws(() => readIndex([]), /no presets/);

let fails = 1;
const data = { series: {}, palettes: {}, fonts: null, lex: {} };
const assets = createAssets({
  data,
  seriesOf: () => ({ dir: 'series/x/presets', valid: (p) => !!p?.ok, fonts: ['mono'], whoFace: 'mono' }),
  fetchJSON: async (p) => {
    if (p.endsWith('index.json')) return [{ id: 'a', vol: 1, title: 'T', topic: 'a', ground: 'mid' }];
    if (fails) { fails -= 1; throw new Error('offline'); }
    return { ok: true };
  },
  fontFile: async () => { throw new Error('fontFile is not part of this retry'); },
});
await assert.rejects(() => assets.loadOnce('cutting-mat'), /no preset could be loaded/);
const loaded = await assets.loadOnce('cutting-mat');
assert.equal(loaded.presets.a.ok, true);
assert.equal(await assets.loadOnce('cutting-mat'), loaded, 'a loaded series is not fetched again');
assert.equal(fails, 0);

console.log('ok · studio modules load without the DOM');
