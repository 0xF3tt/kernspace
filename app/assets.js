// Presets, palettes, lexicons and the font files a series draws with.
// Caching and retry live here. Importing this module does not fetch anything and does not touch the DOM.
// `fontFile` uses FileReader when it is called, in the browser; the metrics callback runs in Node tests too.
import { advances, useMetrics } from './boxes.js';
import { PALS, PRESET_ID, ROLES } from './catalog.js';
import { FACES, faceMetrics } from './fonts.js';

const asset = (p) => new URL(`../${p}`, import.meta.url);

export async function fetchJSON(p) {
  const r = await fetch(asset(p));
  if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
  return r.json();
}

// one font file: its bytes (for the metrics the checker measures with) and a data: URL (an SVG shown as an
// image, or saved as a file, can't load outside fonts)
export async function fontFile(p) {
  const r = await fetch(asset(p));
  if (!r.ok) throw new Error(`font ${p}: HTTP ${r.status}`);
  const buf = await r.arrayBuffer();
  const url = await new Promise((ok, fail) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.onerror = () => fail(fr.error);
    fr.readAsDataURL(new Blob([buf], { type: 'font/ttf' }));
  });
  return { buf, url };
}

// well-formed, unique index entries, in file order
export function readIndex(list) {
  if (!Array.isArray(list)) throw new Error('presets index: not a list');
  const seen = new Set(), out = [];
  for (const e of list) {
    const ok = e && PRESET_ID.test(e.id) && !seen.has(e.id) && Number.isInteger(e.vol) && typeof e.title === 'string'
      && typeof e.topic === 'string' && PRESET_ID.test(e.topic) && ROLES.includes(e.ground);
    if (!ok) { console.warn('presets index: skipped entry', e); continue; }
    seen.add(e.id);
    out.push(e);
  }
  if (!out.length) throw new Error('presets index: no presets');
  return out;
}

/**
 * Loader bound to one `data` object. `seriesOf(id)` is the registry entry.
 * `fetchJSON` and `fontFile` default to the real ones; tests pass fakes.
 * A rejected load deletes its cache entry so the next call tries again.
 */
export function createAssets({ data, seriesOf, fetchJSON: getJSON = fetchJSON, fontFile: getFont = fontFile }) {
  const lexLoads = {};
  const loads = {};
  const faceLoads = {};

  async function loadPresets(s) {
    const dir = seriesOf(s).dir, d = { index: [], presets: {}, skipped: new Set() };
    const entries = readIndex(await getJSON(`${dir}/index.json`));
    const got = await Promise.allSettled(entries.map((e) => getJSON(`${dir}/${e.id}.json`)));
    d.index = entries.filter((e, i) => {
      const p = got[i].value;
      if (seriesOf(s).valid(p)) { d.presets[e.id] = p; return true; }
      console.error(`preset ${e.id}: skipped`, got[i].reason ?? 'malformed');
      d.skipped.add(e.id);
      return false;
    });
    if (!d.index.length) throw new Error('no preset could be loaded');
    data.series[s] = d;
    return d;
  }

  const loadOnce = (s) => (loads[s] ??= loadPresets(s).catch((e) => { delete loads[s]; throw e; }));
  const faceKeys = (R) => [...new Set([...R.fonts, R.whoFace])];   // the whoami face is loaded even if a series' list ever omits it
  const loadFaces = (keys) => Promise.all(keys.map((k) => (faceLoads[k] ??= getFont(FACES[k].file).then(({ buf, url }) => {
    useMetrics({ [k]: faceMetrics(k, buf, advances) });
    data.fonts = { ...data.fonts, [k]: url };
  }, (e) => { delete faceLoads[k]; throw e; }))));

  async function load(s) {
    const [, palettes] = await Promise.all([
      loadFaces(faceKeys(seriesOf(s))),
      Promise.all(PALS.map((p) => getJSON(`palettes/${p}.json`))),
      loadPresets(s),
    ]);
    PALS.forEach((p, i) => { data.palettes[p] = palettes[i]; });
  }

  function lexicon(topic) {
    lexLoads[topic] ??= getJSON(`topics/${topic}.json`).then((l) => { data.lex[topic] = l; return l; }, (e) => { delete lexLoads[topic]; throw e; });
    return lexLoads[topic];
  }

  return { loadPresets, loadOnce, loadFaces, load, lexicon, loads, faceKeys };
}
