// Studio regression tests, no browser needed:  node app/studio.test.mjs
// 0XF-103: a series id is an own key. Inherited names and unknown slugs never open or switch the studio.
import assert from 'node:assert/strict';
import { SERIES, bootSeries, isSeries, seriesSwitch } from './series/index.js';
import { DEFAULT } from './store.js';

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

console.log(`ok · studio 0XF-103 · ${Object.keys(SERIES).length} series · ${INHERITED.length} inherited names rejected`);
