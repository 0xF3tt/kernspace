// The overlap checker and the slot rules, shared by the test (node app/render.test.mjs) and the word editor.
// A rendered sheet is rebuilt into boxes (app/boxes.js) and judged by its series' rules (app/series/<series>.rules.js,
// which lists what is checked); this file dispatches on `preset.series` and keeps the exports its callers use.
import { FORMATS } from './render.js';
import { PROBE } from './boxes.js';
import { SERIES } from './series/index.js';

export { advances, family, glyphs, hull, len, useMetrics, PROBE } from './boxes.js';
export const { ANGLES, LIMITS } = SERIES['cutting-mat'];       // the slot table of the series the test covers
export const HANDLES = ['', 'abcdefg', 'x'.repeat(20)];     // default, longest two-line box, three lines
export const MOTTOS = ['', 'x'.repeat(40)];                  // default, longest

// all collisions of one preset in one format, deduplicated across the whoami boxes checked
export function overlaps(p, fmt, { handles = HANDLES, mottos = MOTTOS } = {}) {
  const S = SERIES[p.series], { w, h } = FORMATS[fmt], out = new Set();
  for (const handle of handles) for (const motto of mottos) {
    const svg = S.render({ preset: p, colors: PROBE, format: fmt, handle, motto, fonts: null });
    for (const b of S.collisions(S.scene(svg, S.slotNames(p, fmt, handle)), w, h, fmt === 'phone')) out.add(b);
  }
  return [...out];
}

// ---------- the editor's fast path: one scene per preset and format, then only the changed text is re-boxed

export function prepare(p, fmt) {
  const S = SERIES[p.series], { w, h } = FORMATS[fmt];
  const s = S.scene(S.render({ preset: p, colors: PROBE, format: fmt, handle: '', fonts: null }), S.slotNames(p, fmt));
  return { s, W: w, H: h, phone: fmt === 'phone', series: p.series };
}
export const quickFits = (base, key, str) => SERIES[base.series].quickFits(base, key, str);

// ---------- the slot table, one source for the test, the README and the editor
export const get = (p, key) => SERIES[p.series].get(p, key);
export const withSlot = (p, key, value) => SERIES[p.series].withSlot(p, key, value);
export const slotRules = (p, key, value) => SERIES[p.series].slotRules(p, key, value);
