// Saved words: what is stored, and how a saved diff is checked back onto a preset.
// Importing this module does not read localStorage. `createPersistence` does, once, when the page starts.
import { family, get, overlaps, slotRules } from './check.js';
import { $ } from './dom.js';
import { storeRecord } from './link.js';
import { SERIES } from './series/index.js';
import { migrate } from './store.js';
import { fieldMotto, mottoToStore } from './whoami.js';
import { validHandle } from './render.js';
import { changedSlots, FMTS, pool, put, same, slotsOf } from './words.js';

const STORE = 'ks-edits';

export function createPersistence(deps) {
  const { state, data, el } = deps;
  const canStore = (() => { try { localStorage.setItem('ks-probe', '1'); localStorage.removeItem('ks-probe'); return true; } catch { return false; } })();
  const unchecked = {};   // saved words that could not be checked this time, by series and id
  const E = (s = state.series) => (state.edits[s] ??= {});
  const vkey = (id, s = state.series) => deps.vkey(id, s);
  const lexicon = (topic) => deps.lexicon(topic);
  const readWho = () => deps.readWho();
  const update = () => deps.update();
  const tell = (title, sub, ok) => deps.tell(title, sub, ok);

// every saved word: changed slots of each edited volume plus the unchecked ones
function savedCount() {
  let words = 0, vols = 0;
  for (const [s, byId] of Object.entries(state.edits)) for (const [id, p] of Object.entries(byId)) { const n = changedSlots(p, data.series[s].presets[id]).length; if (n) { words += n; vols++; } }
  for (const byId of Object.values(unchecked)) for (const slots of Object.values(byId)) { const n = Object.keys(slots).length; if (n) { words += n; vols++; } }
  return { words, vols };
}
const syncClear = () => { $('#clear-saved').disabled = !savedCount().words; };
function clearSaved() {
  const { words, vols } = savedCount();
  if (!words || !confirm(`Clear ${words} saved word${words === 1 ? '' : 's'} in ${vols} volume${vols === 1 ? '' : 's'}? Your whoami stays.`)) return;
  for (const [s, byId] of Object.entries(state.edits)) for (const id of Object.keys(byId)) state.ver[vkey(id, s)] = (state.ver[vkey(id, s)] ?? 0) + 1;
  for (const k of Object.keys(state.edits)) delete state.edits[k];
  for (const k of Object.keys(unchecked)) delete unchecked[k];
  const ed = deps.editor().ed;
  ed.stacks = {}; ed.linked = ''; ed.preview = null; ed.active = -1;
  deps.invalidateCaches();
  update(); persist(); syncClear();
  if (ed.on) deps.editor().editRefresh();
  tell('Saved words cleared', `${words} word${words === 1 ? '' : 's'} in ${vols} volume${vols === 1 ? '' : 's'}`);
}
function persist() {
  if (!canStore) return;
  try {
    const motto = mottoToStore(el.motto.value, state.motto);
    const record = storeRecord({
      series: state.series, handle: state.handle, motto, edits: state.edits, unchecked,
      presetOf: (s, id) => data.series[s].presets[id], changedSlots, get,
    });
    if (record) localStorage.setItem(STORE, JSON.stringify(record));
    else localStorage.removeItem(STORE);
  } catch {}
}
function readSaved() {
  try { return canStore ? migrate(JSON.parse(localStorage.getItem(STORE) ?? 'null')) : null; } catch { return null; }
}
// a saved word comes back only if the editor would offer it today: from the lexicon, within the slot rules,
// not repeating another word on the sheet, clear of every mark. Returns how many were left out.
async function restoreSaved(saved) {
  if (!saved) return 0;
  // what the viewer typed while the page loaded wins over what was saved
  if (typeof saved.handle === 'string' && validHandle(saved.handle) && !el.handle.value.trim()) { state.handle = saved.handle; el.handle.value = saved.handle; }
  const mottoField = fieldMotto(saved.motto, el.motto.value);   // show it even when this series cannot draw it
  if (el.motto.value !== mottoField) el.motto.value = mottoField;
  readWho();   // confirm it against this series before saved words are checked against the box
  const fits = whoFits();
  let dropped = 0;
  for (const [s, byId] of Object.entries(saved.edits)) {
    if (!byId || typeof byId !== 'object') continue;
    if (data.series[s]) dropped += await restoreSeries(s, byId, fits); else unchecked[s] = { ...byId };
  }
  return dropped;
}
// does a sheet clear every mark with the viewer's own whoami box?
function whoFits() {
  const who = { handles: [...new Set(['', state.handle])], mottos: [...new Set(['', state.motto])] };
  return (q) => FMTS.every((f) => !guardOne(q, f, who));
}
// one series' saved words, back onto its presets. Returns how many were left out.
async function restoreSeries(s, saved, fits) {
  fits ??= whoFits();
  const R = SERIES[s], { index, presets, skipped } = data.series[s];
  let dropped = 0;
  for (const [id, slots] of Object.entries(saved)) {
    const e = index.find((x) => x.id === id), s0 = presets[id];
    if (!slots || typeof slots !== 'object') continue;
    if (!e) { if (skipped.has(id)) (unchecked[s] ??= {})[id] = slots; continue; }
    let lex = null;
    try { lex = await lexicon(e.topic); } catch { (unchecked[s] ??= {})[id] = slots; continue; }
    let p = s0, kept = [];
    for (const [key, value] of Object.entries(slots)) {
      const ok = slotsOf(s0).includes(key) && key !== 'whoami'
        && pool({ entry: e, key, shipped: s0, lexicon: lex, index, presets }).some((r) => same(r.value, value))
        && !breaksRules(p, key, value, s0);
      if (ok) { p = put(p, key, value, s0); kept.push([key, value]); } else dropped++;
    }
    // no word twice, judged on the whole sheet (a later slot may have given its word away), and clear of every
    // mark. A dropped word gives its slot back the shipped one, so check again; each pass only drops, so it ends.
    for (;;) {
      const dup = kept.filter(([key, value]) => [value].flat().some((l) => R.usedStrings(p, key).has(l)));
      if (dup.length) {
        dropped += dup.length;
        kept = kept.filter((x) => !dup.includes(x));
        p = kept.reduce((q, [key, value]) => put(q, key, value, s0), s0);
        continue;
      }
      if (fits(p)) break;
      p = s0;   // rare: something no longer fits, so find it one word at a time
      kept = kept.filter(([key, value]) => { const q = put(p, key, value, s0); if (!fits(q)) { dropped++; return false; } p = q; return true; });
    }
    if (!same(p, s0)) { E(s)[id] = p; state.ver[vkey(id, s)] = 1; }
  }
  return dropped;
}
const guardOne = (q, f, who) => overlaps(q, f, who).length > 0;
// the slot rules, except for the shipped status line (longer than the phone's cap on purpose: it brings its own phone line)
const breaksRules = (p, key, value, s0) => (family(key) === 'data' && same(value, get(s0, key)) ? [] : slotRules(p, key, value)).length > 0;

  function wire() { $('#clear-saved').addEventListener('click', clearSaved); }
  wire();
  return { unchecked, canStore, persist, readSaved, restoreSaved, restoreSeries, syncClear, savedCount };
}
