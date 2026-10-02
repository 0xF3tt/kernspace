// kernspace · the studio. Everything renders in the browser; nothing is uploaded.
// Data (presets, palettes, fonts, lexicons) loads from this site; the page builds its nodes with the DOM (strings
// become text, never markup) and sets styles through CSSOM, so the CSP needs no inline styles or scripts.
import { FORMATS, HANDLE, MOTTO, validHandle, validMotto } from './render.js';
import { SERIES } from './series/index.js';
import { DEFAULT, migrate } from './store.js';
import { advances, family, get, glyphs, hull, len, overlaps, prepare, slotRules, useMetrics } from './check.js';
import { FMTS, changedSlots, guard, linkedNote, options as wordOptions, plain, pool, put, same, slotsOf } from './words.js';

const PALS = ['purple', 'green', 'red', 'blue'];
const ROLES = ['dark', 'mid', 'light'];
const PRESET_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;    // ids become file paths and form values
const INKS = {
  purple: 'Spirit-duplicator inks: red and blue, both sides on one sheet.',
  green: 'The color computing lived in: screen, board and paper, never #00FF00.',
  red: 'Red as ink, not alarm: oxide, rubrics and the proofreader’s pencil.',
  blue: 'The defender’s drawing set, told through the blueprint.',
};
const NOTES = {
  aniline: 'The violet-black dye layer of a spirit-duplicator master.',
  indigo: 'The band Newton placed between blue and violet.',
  ditto: 'The copy off the drum: pale paper, violet type.',
  phosphor: 'The unlit faceplate of a monochrome CRT.',
  soldermask: 'The green lacquer on a circuit board.',
  greenbar: 'Continuous-form line-printer paper.',
  oxide: 'Iron oxide on tape and floppy media.',
  rubric: 'Rubricated headings in red ink.',
  redline: 'Paper marked up in red and blue pencil.',
  'iron-gall': 'Blue-black archival ink for ledgers.',
  cyanotype: 'Herschel’s 1842 blueprint process.',
  whiteprint: 'The diazo copy people marked up.',
};
const TOPIC = { appsec: 'AppSec', programming: 'Programming', pentest: 'Pentest', mobile: 'Mobile', web: 'Web', 'active-directory': 'Active Directory', 'red-team': 'Red team', 'blue-team': 'Blue team', crypto: 'Crypto', cloud: 'Cloud', reversing: 'Reversing', dfir: 'DFIR', 'ai-security': 'AI security', ctf: 'CTF', infosec: 'InfoSec' };
const TOTAL = Object.keys(TOPIC).length;       // volumes a full series holds
const FMT_NAME = { desktop: 'Desktop', wide: 'Wide', phone: 'Phone' };

// ---------- small DOM helpers

const $ = (s) => document.querySelector(s);
const SVG_NS = 'http://www.w3.org/2000/svg';
// element builder: class, dataset, style (CSSOM, so the CSP needs no inline styles), attributes, children
function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k === 'style') for (const [p, x] of Object.entries(v)) n.style.setProperty(p, x);
    else n.setAttribute(k, v === true ? '' : v);
  }
  n.append(...kids.flat().filter((x) => x != null && x !== false));
  return n;
}
// an icon or overlay drawn from a fixed SVG string (geometry only, never data)
function svg(markup, attrs = {}) {
  const s = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  s.innerHTML = markup;
  return s;
}
// replace a node's children, skipping the empty ones (replaceChildren would print "null")
const fill = (node, ...kids) => node.replaceChildren(...kids.flat().filter((x) => x != null && x !== false));
const pad2 = (v) => String(v).padStart(2, '0');
const nice = (slug) => slug.charAt(0).toUpperCase() + slug.slice(1).replace('-', ' ');
const volName = (e) => e.title.replace(/^Vol\. \d+ · /, '');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isNarrow = () => matchMedia('(max-width: 860px)').matches;   // the CSS breakpoint, so JS and CSS always agree
const blobUrl = (text) => URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
// point an <img> at a new blob URL and free the old one once the new one is showing
function swap(img, url) {
  const old = img.dataset.u;
  img.src = url;
  img.dataset.u = url;
  if (old) setTimeout(() => URL.revokeObjectURL(old), 1000);
}

// ---------- data

const data = { series: {}, palettes: {}, fonts: null, lex: {} };     // series[s] = { index, presets, skipped }; lexicons are shared
const lexLoads = {};
const lastVol = {};                                      // the volume each series was left on
const state = { series: DEFAULT, i: 0, ink: 'purple', role: 'mid', grain: false, format: 'desktop', view: 'sheet', handle: '', motto: '', mark: 'taint', edits: {}, ver: {} };
let S = SERIES[state.series];                       // the series on the stage: its renderer, slot table and marks
const D = () => data.series[state.series];
const E = (s = state.series) => (state.edits[s] ??= {});     // edited presets by id
const vkey = (id, s = state.series) => `${s}:${id}`;         // ids repeat across series: version counters, undo stacks, caches
const ver = (id) => state.ver[vkey(id)] ?? 0;
function useSeries(s) { state.series = s; S = SERIES[s]; state.mark = S.READ.mark; }
const asset = (p) => new URL(`../${p}`, import.meta.url);

async function json(p) {
  const r = await fetch(asset(p));
  if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
  return r.json();
}
// one font file: its bytes (for the metrics the checker measures with) and a data: URL (an SVG shown as an
// image, or saved as a file, can't load outside fonts)
async function fontFile(p) {
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
function readIndex(list) {
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
// a preset that fails to load leaves the strip instead of taking the studio down
async function loadPresets(s = state.series) {
  const dir = SERIES[s].dir, d = { index: [], presets: {}, skipped: new Set() };   // index.json lists the presets, in volume order
  const entries = readIndex(await json(`${dir}/index.json`));
  const got = await Promise.allSettled(entries.map((e) => json(`${dir}/${e.id}.json`)));
  d.index = entries.filter((e, i) => {
    const p = got[i].value;
    if (SERIES[s].valid(p)) { d.presets[e.id] = p; return true; }
    console.error(`preset ${e.id}: skipped`, got[i].reason ?? 'malformed');
    d.skipped.add(e.id);
    return false;
  });
  if (!d.index.length) throw new Error('no preset could be loaded');
  data.series[s] = d;
}
// a series' presets, fetched once (the boot series comes with the page); a failed fetch may be tried again
const loads = {}, restores = {};
const loadOnce = (s) => (loads[s] ??= loadPresets(s).catch((e) => { delete loads[s]; throw e; }));
async function load() {
  const [fonts, palettes] = await Promise.all([
    Promise.all(['fonts/nunito/Nunito-Variable.ttf', 'fonts/jetbrains-mono/JetBrainsMono-Variable.ttf'].map(fontFile)),
    Promise.all(PALS.map((p) => json(`palettes/${p}.json`))),
    loadPresets(),
  ]);
  PALS.forEach((p, i) => { data.palettes[p] = palettes[i]; });
  useMetrics({ nunito: Object.fromEntries([200, 300, 400, 600, 800].map((wght) => [wght, advances(fonts[0].buf, { wght })])), mono: advances(fonts[1].buf) });   // Cutting Mat's .ph draws at 300, Specimen at all five
  data.fonts = { nunito: fonts[0].url, jbm: fonts[1].url };
}
// a volume's lexicon, fetched once when the editor or a saved word needs it
function lexicon(topic) {
  lexLoads[topic] ??= json(`topics/${topic}.json`).then((l) => { data.lex[topic] = l; return l; }, (e) => { delete lexLoads[topic]; throw e; });
  return lexLoads[topic];
}

const vol = () => D().index[state.i];
const shipped = () => D().presets[vol().id];
const preset = () => E()[vol().id] ?? shipped();
function ground(ink, role) {
  const [slug, g] = Object.entries(data.palettes[ink].grounds).find(([, x]) => x.role === role);
  return { slug, colors: g.colors };
}
// the grain goes only on the sheet in the stage and its downloads: thumbnails and the editor's proof stay without it
const draw = (p, ink, role, format, fonts, R = S, grain = false) => R.render({ preset: p, colors: ground(ink, role).colors, format, handle: state.handle, motto: state.motto, fonts, grain });

// ---------- the page's fixed parts, built once the data is in

const el = {
  form: $('#form'), stage: $('#stage'), sheet: $('#sheet'), img: $('#sheet-img'), strip: $('#strip'), dd: $('#drawdown'),
  inks: $('#ink-rows'), legend: $('#legend'), slip: $('#slip'), handle: $('#handle'), motto: $('#motto'), who: $('#who'),
  whoNote: $('#who-note'), need: $('#need'), png: $('#dl-png'), svg: $('#dl-svg'), grain: $('#grain'),
};

function buildStrip() {
  el.strip.replaceChildren(h('legend', { class: 'sr' }, 'Volume'), ...D().index.map((e, i) => h('label', { class: 'pick frame' },
    h('input', { type: 'radio', name: 'volume', value: String(i), id: `vol-${e.id}`, checked: i === state.i }),
    h('span', { class: 'face bracket' }, h('img', { alt: '', width: 3840, height: 2160 })),
    h('span', { class: 'cap' }, h('span', { class: 'mono' }, pad2(e.vol)), volName(e)))));
}
// inks across, grounds down: one click picks both
function buildDrawdown() {
  const kids = [h('span'), ...PALS.map((p) => h('span', { class: 'dd-ink', dataset: { ink: p } }, data.palettes[p].name))];
  for (const r of ROLES) {
    kids.push(h('span', { class: 'dd-row', dataset: { row: r } }, nice(r), h('small', { hidden: true }, 'default')));
    for (const p of PALS) {
      const g = ground(p, r), c = g.colors;
      kids.push(h('label', { class: 'pick cell', title: nice(g.slug) },
        h('input', { type: 'radio', name: 'ground', value: `${p}:${r}`, id: `g-${p}-${r}`, 'aria-label': `${data.palettes[p].name} ink on ${nice(g.slug)}, ${r} ground` }),
        h('span', { class: 'chip bracket', style: { '--bg': c.bg, '--fg': c.text, '--tb': c.tb, '--c1': c.chip1 } })));
    }
  }
  el.dd.replaceChildren(...kids);
}
function buildInkRows() {
  el.inks.replaceChildren(...PALS.map((p) => h('div', { class: 'ink-row' },
    h('div', {}, h('h3', {}, data.palettes[p].name), h('p', {}, INKS[p])),
    h('div', { class: 'grounds' }, ROLES.map((r) => {
      const g = ground(p, r);
      return h('button', { type: 'button', class: 'gcard', dataset: { ink: p, role: r }, 'aria-pressed': 'false' },
        h('span', { class: 'face bracket' }, h('img', { alt: '', width: 3840, height: 2160 })),
        h('span', { class: 'colorbar', 'aria-hidden': 'true' }, S.BAR.map((k) => h('i', { style: { background: g.colors[k] } }))),
        h('span', { class: 'gmeta' }, h('b', {}, nice(g.slug)), h('span', { class: 'mono' }, `${r} ${g.colors.bg}`)),
        h('span', { class: 'gnote' }, NOTES[g.slug] ?? ''));
    })))));
}

// the series switch: one radio per registered series, each with its own glyph; the bracket slides to the checked one (.seg)
function buildSwitch() {
  const sw = $('#series-switch'), all = Object.entries(SERIES);
  sw.style.setProperty('--n', all.length);
  sw.replaceChildren(...all.map(([s, R]) => h('label', { title: R.name },
    h('input', { type: 'radio', name: 'series', value: s, id: `series-${s}` }),
    h('span', { class: 'opt' }, svg(R.glyph, { viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'aria-hidden': 'true' }), h('span', { class: 'name' }, R.name)))));
  syncSwitch();
}
const syncSwitch = () => document.querySelectorAll('input[name="series"]').forEach((r) => { r.checked = r.value === state.series; });
// everything on the page that names the series: the switch's count, "Read the …", the fixed list, the Series cards
function paintSeries() {
  const R = S.READ, n = D().index.length;
  syncSwitch();
  $('#series-count').textContent = n === TOTAL ? `${TOTAL} volumes` : `${n} of ${TOTAL} volumes`;
  $('#nav-read').textContent = R.nav;
  $('#read-title').textContent = R.title;
  $('#read-intro').textContent = R.intro;
  $('#legend-head').replaceChildren(...R.legendHead.map((t) => h('span', {}, t)));
  $('#fixed-ul').replaceChildren(...S.FIXED_LIST.map(([name, does]) => h('li', {}, h('b', {}, `${name}.`), ` ${does}`)));
  document.querySelectorAll('.sheetlet[data-series]').forEach((card) => {
    const on = card.dataset.series === state.series, b = card.querySelector('.use-series');
    card.toggleAttribute('data-current', on);
    b.textContent = on ? 'In the studio' : 'Use in the studio';
    if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });
}

// ---------- the studio

const thumbKeys = new Map();
function paintStrip() {
  el.strip.querySelectorAll('.frame').forEach((lab, i) => {
    const e = D().index[i], role = i === state.i ? state.role : e.ground, key = `${state.series}:${state.ink}:${role}:${ver(e.id)}:${state.handle}:${state.motto}`;
    lab.classList.toggle('edited', !!E()[e.id]);
    if (thumbKeys.get(i) === key) return;
    thumbKeys.set(i, key);
    swap(lab.querySelector('img'), blobUrl(draw(E()[e.id] ?? D().presets[e.id], state.ink, role, 'desktop', null)));
  });
}
let inkKey = '';
function paintInks() {
  el.inks.querySelectorAll('.gcard').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ink === state.ink && b.dataset.role === state.role)));
  const k = `${state.series}:${state.i}:${ver(vol().id)}:${state.handle}:${state.motto}`;
  if (inkKey === k) return;
  inkKey = k;
  el.inks.querySelectorAll('.gcard').forEach((b) => swap(b.querySelector('img'), blobUrl(draw(preset(), b.dataset.ink, b.dataset.role, 'desktop', null))));
}

// one stage height for every format, so switching never moves the page
function fit() {
  if (ed.on) return fitEdit();
  const { w, h: H0 } = FORMATS[state.format], ar = w / H0;
  const cs = getComputedStyle(el.stage), padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const avail = el.stage.clientWidth - padX, narrow = isNarrow();
  const stageH = Math.round(Math.min(avail / (16 / 9), narrow ? 420 : Math.max(360, innerHeight - 330)));
  const H = state.format === 'phone' ? stageH * (narrow ? 1.35 : 1) : stageH;
  el.form.style.setProperty('--stage-h', `${Math.round(H + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom))}px`);
  const sw = Math.min(avail, H * ar);
  el.sheet.style.setProperty('--w', `${sw}px`);
  el.sheet.style.setProperty('--h', `${sw / ar}px`);
}
function ruler(node, marks, axis) {
  node.replaceChildren(...marks.map(([at, label]) => h('span', { style: { [axis === 'x' ? 'left' : 'top']: `${at}%` } }, String(label))));
}
function rulers() {
  const { w, h: H } = FORMATS[state.format];
  const ticks = (n, parts) => Array.from({ length: parts + 1 }, (_, k) => [(k / parts) * 100, Math.round((n * k) / parts)]);
  ruler($('#ruler-x'), ticks(w, state.format === 'phone' ? 2 : 4), 'x');
  ruler($('#ruler-y'), ticks(H, 4), 'y');
}

// the sheet itself: drawn with fonts, swapped in once decoded; a later change drops an earlier render
let current = null, ticket = 0, drawing = Promise.resolve();
function fileName(e, g) {
  const { w, h: H } = FORMATS[state.format];
  return `kernspace_${state.series}_${e.id}${E()[e.id] ? '_edited' : ''}_${state.ink}-${g.slug}${state.grain ? '_grain' : ''}_${w}x${H}`;
}
async function drawSheet() {
  const t = ++ticket, e = vol(), g = ground(state.ink, state.role), { w, h: H } = FORMATS[state.format];
  const text = draw(preset(), state.ink, state.role, state.format, data.fonts, S, state.grain), name = fileName(e, g);
  const url = blobUrl(text), img = new Image();
  img.src = url;
  el.stage.setAttribute('aria-busy', 'true');
  try {
    await img.decode();
    if (t !== ticket) return URL.revokeObjectURL(url);
    current = { svg: text, name, w, h: H };
    swap(el.img, url);
    el.img.alt = `${S.name}, ${e.title}: ${data.palettes[state.ink].name} ink on the ${nice(g.slug)} ground${state.grain ? ', with film grain' : ''}, ${w} by ${H} pixels.`;
  } catch (err) {
    URL.revokeObjectURL(url);
    if (t === ticket) { current = null; tell('This sheet could not be drawn.', 'Try another ink or format.', false); console.error(err); }
  } finally {
    if (t === ticket) { el.stage.setAttribute('aria-busy', 'false'); syncDownloads(); }
  }
}

function update() {
  const e = vol(), p = preset(), g = ground(state.ink, state.role);
  drawing = drawSheet();
  el.sheet.dataset.format = state.format;
  el.sheet.dataset.ground = state.role;
  el.sheet.style.setProperty('--lock', state.role === 'light' ? '#16122A' : '#fff');
  if (!ed.on && ed.hover) setHover(null);
  fit(); rulers();
  const { w, h: H } = FORMATS[state.format];
  $('#slug').replaceChildren(fileName(e, g), h('span', { class: 'dim' }, '.png'));
  $('#vol-no').textContent = `Vol. ${pad2(e.vol)}`;
  $('#vol-name').textContent = volName(e);
  const changed = changedSlots(p, shipped()).length;
  fill($('#vol-line'), `${TOPIC[e.topic] ?? e.topic}. `, h('em', {}, `“${S.lineOf(p)}”`),
    changed ? h('span', { class: 'tape tape-pencil' }, `${changed} ${changed === 1 ? 'word' : 'words'} changed`) : null);
  $('#findings').replaceChildren(...S.chipsOf(p, g.colors).map((c) => h('li', { class: 'tape', style: { '--c': c.color } }, h('i'), c.text)));
  $('#prev').disabled = state.i === 0;
  $('#next').disabled = state.i === D().index.length - 1;
  $('#ink-val').textContent = data.palettes[state.ink].name;
  el.dd.querySelectorAll('.dd-ink').forEach((s) => s.classList.toggle('on', s.dataset.ink === state.ink));
  el.dd.querySelectorAll('.dd-row small').forEach((s) => { s.hidden = s.parentElement.dataset.row !== e.ground; });
  $(`#g-${state.ink}-${state.role}`).checked = true;
  el.grain.checked = state.grain;          // also undoes a browser restoring the switch on reload: it starts off every visit
  $('#gr-name').textContent = nice(g.slug);
  $('#gr-hex').textContent = g.colors.bg;
  $('#gr-note').textContent = `${NOTES[g.slug] ?? ''} ${INKS[state.ink]}`;
  $(`#fmt-${state.format}`).checked = true;
  $(`#ef-${state.format}`).checked = true;
  const radio = el.strip.querySelector(`input[value="${state.i}"]`);
  if (radio) radio.checked = true;
  el.sheet.setAttribute('title', `${w} × ${H}`);
  paintStrip();
  // the sections below the studio redraw at once, or shortly after the last change while editing
  clearTimeout(belowTimer);
  if (ed.on) { belowTimer = setTimeout(paintBelow, 450); editRefresh(); } else paintBelow();
}
let belowTimer = 0;
function paintBelow() {
  const p = preset();
  swap($('#read-img'), blobUrl(draw(p, state.ink, state.role, 'desktop', data.fonts)));
  paintLegend();
  paintInks();
  paintLive();
}
// each Live card shows its series on the current ink and ground; a series still loading waits for its presets
function paintLive() {
  document.querySelectorAll('img[data-live]').forEach((img) => {
    const s = img.dataset.live, d = data.series[s];
    if (!d) return;
    const cur = s === state.series, e = cur ? vol() : d.index[Math.min(lastVol[s] ?? 0, d.index.length - 1)], p = cur ? preset() : E(s)[e.id] ?? d.presets[e.id];
    const k = `${e.id}:${state.ver[vkey(e.id, s)] ?? 0}:${state.ink}:${state.role}:${state.handle}:${state.motto}`;
    if (img.dataset.k === k) return;
    img.dataset.k = k;
    swap(img, blobUrl(draw(p, state.ink, state.role, 'desktop', null, SERIES[s])));
  });
}
function goVol(i, reveal) {
  if (i < 0 || i >= D().index.length) return;
  if (el.slip.dataset.vol) hideSlip();
  state.i = i;
  state.role = D().index[i].ground;          // each volume starts on its own ground
  update();
  if (ed.on && !data.lex[vol().topic]) {   // editing, and this volume's words aren't in yet
    const id = vol().id;
    lexicon(vol().topic).then(() => { if (ed.on && vol().id === id) { cache.clear(); editRefresh(); } },
      () => tell('The words for this volume could not be loaded.', 'Check your connection and try again.', false));
  }
  if (reveal) el.strip.querySelector(`input[value="${i}"]`)?.closest('label').scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// change series: load it once (its presets, then the words saved for it), leave the editor, land on the volume it was
// left on. Only the latest choice counts; a series that won't load leaves the studio as it was.
let choice = 0;
async function chooseSeries(s) {
  const t = ++choice;
  if (!SERIES[s] || s === state.series) { el.stage.setAttribute('aria-busy', 'false'); return syncSwitch(); }
  el.stage.setAttribute('aria-busy', 'true');
  let dropped = 0;
  try {
    await loadOnce(s);
    if (t === choice) dropped = await (restores[s] ??= restoreLate(s));
  } catch (err) {
    console.error(err);
    if (t !== choice) return;
    el.stage.setAttribute('aria-busy', 'false');
    syncSwitch();
    return tell('This series could not be loaded.', 'Check your connection and try again.', false);
  }
  if (t !== choice) return;
  restores[s] = Promise.resolve(0);          // the note below is said once
  closeEdit();
  hideSlip();
  lastVol[state.series] = state.i;
  useSeries(s);
  state.i = Math.min(lastVol[s] ?? 0, D().index.length - 1);
  state.role = vol().ground;
  inkKey = ''; thumbKeys.clear(); cache.clear();
  buildStrip(); buildInkRows(); paintSeries(); readWho();
  el.strip.scrollLeft = 0;
  update();
  persist();
  announce(`${S.name}, ${D().index.length} ${D().index.length === 1 ? 'volume' : 'volumes'}. ${vol().title}.`);
  if (Object.keys(unchecked[s] ?? {}).length) tell('Some saved words could not be checked.', 'They stay saved: reload the page to bring them back.', false);
  else if (dropped) tell(`${dropped} saved ${dropped === 1 ? 'word was' : 'words were'} left out.`, 'They are no longer in the lexicon or no longer fit. Your other words are back.', false);
}
// a series that was not loaded at start: its saved words come back the first time it is chosen
async function restoreLate(s) {
  const saved = unchecked[s];
  if (!saved) return 0;
  delete unchecked[s];
  try { return await restoreSeries(s, saved, whoFits()); } catch (err) { console.error(err); unchecked[s] = saved; delete restores[s]; return 0; }
}

// ---------- your whoami: handle and line, both needed to download

const ready = () => validHandle(state.handle) && el.handle.value.trim() === state.handle
  && validMotto(state.motto) && el.motto.value.trim() === state.motto && glyphs('mono', state.motto);
function syncDownloads() {
  const ok = ready() && !!current;
  el.png.disabled = el.svg.disabled = !ok;
  el.need.hidden = ready();
}
function readWho() {
  const hv = el.handle.value.trim(), mv = el.motto.value.trim();
  const hOk = !hv || validHandle(hv), mOk = !mv || (validMotto(mv) && glyphs('mono', mv));
  el.handle.setAttribute('aria-invalid', String(!hOk));
  el.motto.setAttribute('aria-invalid', String(!mOk));
  el.who.classList.toggle('bad', !hOk || !mOk);
  const msg = !hOk ? 'Your handle can use letters, digits, dots, dashes and underscores, up to 20.'
    : !mOk ? (validMotto(mv) ? 'Your line uses a character the sheet’s font doesn’t have.' : `Your line can be up to ${S.LIMITS.motto} characters.`)
    : S.READ.who;
  el.whoNote.classList.toggle('err', !hOk || !mOk);
  if (el.whoNote.textContent !== msg) el.whoNote.textContent = msg;   // live region: write only on change
  const next = { handle: hOk ? hv : state.handle, motto: mOk ? mv : state.motto };
  const changed = next.handle !== state.handle || next.motto !== state.motto;
  Object.assign(state, next);
  syncDownloads();
  syncWho();
  return changed;
}
let whoTimer = 0;
let booted = false;
function onWho() {
  if (!readWho() || !booted) return;
  clearTimeout(whoTimer);
  whoTimer = setTimeout(flushWho, 180);
}
function flushWho() { clearTimeout(whoTimer); whoTimer = 0; update(); persist(); }

// ---------- downloads

const slipIcon = () => svg('<path d="m4.5 10.5 3.5 3.5 7.5-8"/>', { viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
let slipTimer = 0;
function hideSlip() { clearTimeout(slipTimer); el.slip.classList.remove('show'); el.slip.inert = true; delete el.slip.dataset.vol; }
function tell(title, sub, ok = true) {
  announce(`${title} ${sub}`);
  el.slip.inert = false;
  delete el.slip.dataset.vol;
  fill(el.slip, ok ? slipIcon() : null, h('span', {}, h('b', {}, title), h('br'), h('span', { class: 'mono' }, sub)));
  el.slip.classList.add('show');
  clearTimeout(slipTimer);
  slipTimer = setTimeout(hideSlip, 4200);
}
const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
function save(blob, file) {
  const a = h('a', { href: URL.createObjectURL(blob), download: file });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  tell('Saved', `${file} · ${kb(blob.size)}`);
}
// the file matches the controls: a pending redraw finishes first
async function settled() {
  if (whoTimer) flushWho();
  for (let d; d !== drawing;) await (d = drawing);
  return ready() ? current : null;
}
el.svg.addEventListener('click', async () => {
  const snap = await settled();
  if (snap) save(new Blob([snap.svg], { type: 'image/svg+xml' }), `${snap.name}.svg`);
});
el.png.addEventListener('click', async () => {
  if (el.png.getAttribute('aria-busy') === 'true') return;
  const label = el.png.querySelector('span');
  el.png.setAttribute('aria-busy', 'true');
  label.textContent = 'Drawing PNG';
  let src = '';
  try {
    const snap = await settled();
    if (!snap) return;
    const img = new Image();
    img.src = src = blobUrl(snap.svg);
    await img.decode();
    await new Promise((r) => setTimeout(r, 60));   // lets embedded fonts settle (Safari)
    const cv = h('canvas', { width: snap.w, height: snap.h }), ctx = cv.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(img, 0, 0, snap.w, snap.h);
    save(await new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('empty PNG'))), 'image/png')), `${snap.name}.png`);
  } catch (err) {
    console.error(err);
    tell('The PNG could not be drawn in this browser.', 'Download the SVG instead: it holds the same sheet.', false);
  } finally {
    if (src) URL.revokeObjectURL(src);
    el.png.removeAttribute('aria-busy');
    label.textContent = 'Download PNG';
  }
});

// ---------- theme: follows the system until the viewer picks (theme.js applied a saved choice before paint)

const root = document.documentElement, themeBtn = $('#theme');
const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches);
const labelTheme = () => themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
labelTheme();
matchMedia('(prefers-color-scheme: light)').addEventListener('change', labelTheme);
themeBtn.addEventListener('click', () => {
  root.dataset.theme = isDark() ? 'light' : 'dark';
  try { localStorage.setItem('ks-theme', root.dataset.theme); } catch {}
  labelTheme();
});

// ---------- read the sheet: the series' marks over its desktop sheet (geometry and copy in its rules module)

let keyList = [];
function paintLegend() {
  keyList = S.marks(preset(), state.handle);
  el.legend.replaceChildren(...keyList.map((m) => h('li', {}, h('button', { type: 'button', dataset: { mark: m.id }, 'aria-current': String(m.id === state.mark) },
    svg(S.GLYPH[m.id], { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'aria-hidden': 'true' }),
    h('span', { class: 'term' }, m.term), h('span', { class: 'mean' }, m.mean)))));
  showMark();
}
function showMark() {
  const m = keyList.find((x) => x.id === state.mark) ?? keyList[0];
  state.mark = m.id;
  $('#read-marks').innerHTML = m.svg;
  $('#read-pins').replaceChildren(h('span', { class: 'pin', style: { left: `${m.pin[0] / 38.4}%`, top: `${m.pin[1] / 21.6}%` } }, m.term));
  $('#read-img').classList.add('dim');
  el.legend.querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.mark === state.mark)));
}
const pickMark = (ev) => {
  const b = ev.target.closest('button[data-mark]');
  if (!b) return;
  if (b.dataset.mark !== state.mark) { state.mark = b.dataset.mark; showMark(); }
  // stacked layout: the sheet sits above the key, so bring the mark into view
  const fig = $('.read-fig'), r = fig.getBoundingClientRect();
  if (ev.type === 'click' && (r.top < 0 || r.bottom > innerHeight)) fig.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
};

// ---------- the word editor

// the preview switch: off shows the sheet alone, on shows it on a screen
function setView(v) { state.view = v; el.stage.dataset.view = v; $('#view-screen').checked = v === 'screen'; }
const flips = [];
function flip() {
  const t = performance.now();
  flips.push(t);
  while (t - flips[0] > 3000) flips.shift();
  if (flips.length >= 5) { flips.length = 0; tell('Hello, friend.', 'eps1.0_hellofriend.mov'); }
}
const ed = { on: false, leaving: false, key: 'phrase', view: null, win: { w: 800, h: 450 }, anim: 0, overview: false, preview: null, active: -1, shown: [], query: '', showBad: false, linked: '', stacks: {}, opener: null, prevView: 'sheet', hover: '', opening: false };
const live = $('#live'), liveRoot = live.attachShadow({ mode: 'open' }), liveCss = new CSSStyleSheet(), ov = $('#ov'), pin = $('#sheet-pin'), list = $('#ep-list'), rail = $('#rail');
liveRoot.adoptedStyleSheets = [liveCss];         // the sheet's own rules, set through CSSOM: no inline <style>
const union = (a, b) => (a && b ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : a ?? b);
const norm = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// scenes and option lists, rebuilt after every edit
const cache = new Map();
const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
const tag = () => `${vkey(vol().id)}:${ver(vol().id)}`;
const prepared = (fmt) => memo(`${tag()}:prep:${fmt}`, () => prepare(preset(), fmt));
function options(key) {
  return memo(`${tag()}:opts:${key}`, () => {
    const e = vol(), T = TOPIC[e.topic] ?? e.topic;
    const rows = wordOptions({ entry: e, key, shipped: shipped(), current: preset(), lexicon: data.lex[e.topic], index: D().index, presets: D().presets, prepared });
    const suggested = rows.some((r) => r.group === 'suggested');
    const names = { shipped: 'As shipped', suggested: 'Suggested', more: suggested ? `More from ${T}` : `From ${T}`, lexicon: `From the ${T} lexicon`, volumes: 'Other volumes' };
    return { rows, lock: S.lockOf(key, shipped()), now: get(preset(), key), names };
  });
}

// one box per slot: its text plus the mark it belongs to, in sheet px
function slotBox(key, fmt = state.format) {
  const qs = S.slotQuads(prepared(fmt).s, preset(), key);
  return qs.length ? hull(qs.flat()) : null;
}
function hitAt(x, y, pad) {
  let best = null, area = Infinity;
  for (const key of [...slotsOf(preset()), ...Object.keys(S.FIXED)]) {
    const b = slotBox(key);
    if (!b || x < b.x0 - pad || x > b.x1 + pad || y < b.y0 - pad || y > b.y1 + pad) continue;
    const a = (b.x1 - b.x0) * (b.y1 - b.y0);
    if (a < area) { area = a; best = key; }
  }
  return best;
}

// the live proof: inline SVG in a shadow root, zoomed through its viewBox
const liveFonts = () => Promise.all(['300 16px KNunito', '16px KMono'].map((f) => document.fonts.load(f))).catch(() => {});
let liveQueued = 0;
function renderLive() {
  liveQueued = 0;
  if (!ed.on) return;
  const p = ed.preview ? put(preset(), ed.key, ed.preview.value, shipped()) : preset();
  const text = S.render({ preset: p, colors: ground(state.ink, state.role).colors, format: state.format, handle: state.handle, motto: state.motto, fonts: null });
  liveCss.replaceSync(text.match(/<style>(.*?)<\/style>/s)?.[1] ?? '');
  liveRoot.innerHTML = text.replace(/<style>.*?<\/style>/s, '').replace(/<title>.*?<\/title>/s, '');
  const s = liveRoot.firstElementChild;
  s.setAttribute('width', '100%');
  s.setAttribute('height', '100%');
  s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const cur = ed.key === 'whoami' ? `${state.handle || HANDLE} · ${state.motto || MOTTO}` : plain(get(preset(), ed.key));
  live.setAttribute('aria-label', `${FMT_NAME[state.format]} sheet, ${ed.overview ? 'whole sheet, editing' : 'zoomed to'} ${S.nameOf(ed.key)}: ${cur}${ed.preview ? `, previewing ${plain(ed.preview.value)}` : ''}`);
  applyView();
}
const queueLive = () => { if (!liveQueued) liveQueued = requestAnimationFrame(renderLive); };
function fitEdit() {
  const narrow = isNarrow(), cs = getComputedStyle(el.stage), vh = Math.round(window.visualViewport?.height ?? innerHeight);
  const pinned = narrow && vh >= 560;   // top bar + stage + rail + edit bar, and at least 180px of options
  const total = !narrow ? Math.max(460, innerHeight - 224) : pinned ? Math.max(160, Math.min(Math.round(vh * 0.38), vh - 373)) : 220;
  el.form.style.setProperty('--stage-h', `${total}px`);
  document.body.toggleAttribute('data-unpinned', narrow && !pinned);
  ed.win = {
    w: Math.max(120, el.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)),
    h: Math.max(120, total - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)),
  };
  el.sheet.style.setProperty('--w', `${ed.win.w}px`);
  el.sheet.style.setProperty('--h', `${ed.win.h}px`);
}
function fullView(fmt = state.format) {
  const { w: W, h: H } = FORMATS[fmt], s = Math.min(ed.win.w / W, ed.win.h / H), w = ed.win.w / s, hh = ed.win.h / s;
  return { x: (W - w) / 2, y: (H - hh) / 2, w, h: hh };
}
// zoom so the slot and every option that fits stay in frame, never below 14 CSS px text (12 on phones), never past 1:1
function viewFor(key, fmt = state.format) {
  const { w: W, h: H } = FORMATS[fmt], U = S.GEOM.U(fmt);
  let b = slotBox(key, fmt);
  if (!b) return fullView(fmt);
  if (key !== 'whoami') for (const r of options(key).rows) if (r.ok && r.per[fmt].box) b = union(b, r.per[fmt].box);
  b = { x0: b.x0 - U, y0: b.y0 - U, x1: b.x1 + U, y1: b.y1 + U };
  const px = S.GEOM.px(key, fmt);   // drawn text size
  const floor = (isNarrow() ? 12 : 14) / px, full = Math.min(ed.win.w / W, ed.win.h / H);
  const s = Math.max(full, Math.min(1, Math.max(floor, Math.min(ed.win.w / (b.x1 - b.x0), ed.win.h / (b.y1 - b.y0)))));
  const w = ed.win.w / s, hh = ed.win.h / s;
  const place = (lo, hi, size, lim) => (size >= lim ? (lim - size) / 2 : Math.min(Math.max(hi - lo > size ? lo : (lo + hi - size) / 2, 0), lim - size));
  return { x: place(b.x0, b.x1, w, W), y: place(b.y0, b.y1, hh, H), w, h: hh };
}
function moveView(to, done) {
  if (ed.hover) setHover(null);
  cancelAnimationFrame(ed.anim);
  const from = ed.view ?? to, t0 = performance.now(), D = reduced() ? 0 : 380, ease = (k) => 1 - (1 - k) ** 3;
  const step = (t) => {
    const k = D ? Math.max(0, Math.min(1, (t - t0) / D)) : 1, e = ease(k);   // a frame stamped before t0 must not overshoot backwards
    ed.view = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e };
    applyView();
    if (k < 1) ed.anim = requestAnimationFrame(step); else done?.();
  };
  ed.anim = requestAnimationFrame(step);
}
function applyView() {
  const v = ed.view;
  if (!v || !ed.on) return;
  const vb = `${v.x} ${v.y} ${v.w} ${v.h}`;
  liveRoot.firstElementChild?.setAttribute('viewBox', vb);
  ov.setAttribute('viewBox', vb);
  drawOverlay();
  const { w: W, h: H } = FORMATS[state.format];
  const ticks = (a0, span, lim) => {
    const st = [20, 40, 60, 80, 120, 160, 240, 320, 480, 640, 960].find((x) => span / x <= 6) ?? 1280, out = [];
    for (let t = Math.max(0, Math.ceil(a0 / st) * st); t <= Math.min(lim, a0 + span); t += st) out.push([((t - a0) / span) * 100, t]);
    return out;
  };
  ruler($('#ruler-x'), ticks(v.x, v.w, W), 'x');
  ruler($('#ruler-y'), ticks(v.y, v.h, H), 'y');
}
function brackets(b, s, cls) {
  const pad = 10 / s, l = 16 / s, x0 = b.x0 - pad, y0 = b.y0 - pad, x1 = b.x1 + pad, y1 = b.y1 + pad;
  return `<path class="${cls}" d="M${x0} ${y0 + l}V${y0}H${x0 + l}M${x1 - l} ${y0}H${x1}V${y0 + l}M${x1} ${y1 - l}V${y1}H${x1 - l}M${x0 + l} ${y1}H${x0}V${y1 - l}"/>`;
}
const rect = (b, cls) => `<rect class="${cls}" x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}"/>`;
function drawOverlay() {
  const v = ed.view;
  if (!v) return;
  const s = ed.win.w / v.w;
  let out = '';
  if (ed.overview) out += slotsOf(preset()).map((k) => { const b = slotBox(k); return b ? rect(b, 'ghost') : ''; }).join('');
  const per = ed.preview?.row.per?.[state.format], hit = per && !per.ok ? per.hit : null;
  if (hit?.box) out += rect(hit.box, hit.what === 'clock' ? 'clock' : 'obst');
  const box = ed.preview ? union(slotBox(ed.key), per?.box) : slotBox(ed.key);
  if (box && !ed.overview) out += brackets(box, s, ed.preview ? 'br dash' : 'br');
  if (ed.hover && ed.hover !== ed.key) { const b = slotBox(ed.hover); if (b) out += brackets(b, s, S.fixedOf(ed.hover) ? 'br fixed' : 'br dash'); }
  ov.innerHTML = out;
}

// pointing at the sheet: brackets and a pin; a click opens that word
const fine = () => matchMedia('(pointer: fine)').matches && !isNarrow();
function sheetPoint(ev) {
  const r = (ed.on ? live : el.img).getBoundingClientRect();
  if (ed.on) {
    const v = ed.view, s = Math.min(r.width / v.w, r.height / v.h);
    return { x: v.x + (ev.clientX - r.left - (r.width - v.w * s) / 2) / s, y: v.y + (ev.clientY - r.top - (r.height - v.h * s) / 2) / s, s, v };
  }
  const { w: W, h: H } = FORMATS[state.format], s = r.width / W;
  return { x: (ev.clientX - r.left) / s, y: (ev.clientY - r.top) / s, s, v: { x: 0, y: 0, w: W, h: H } };
}
function setHover(key, pt) {
  ed.hover = key ?? '';
  el.sheet.classList.toggle('can-edit', !!key && !S.fixedOf(key));
  if (!key || (ed.on && key === ed.key)) { pin.hidden = true; if (ed.on) drawOverlay(); else ov.replaceChildren(); return; }
  const b = slotBox(key), fx = S.fixedOf(key);
  if (ed.on) drawOverlay();
  else { ov.setAttribute('viewBox', `${pt.v.x} ${pt.v.y} ${pt.v.w} ${pt.v.h}`); ov.innerHTML = brackets(b, pt.s, fx ? 'br fixed' : 'br'); }
  pin.textContent = fx ? `${fx[0]}: fixed, it ${fx[1]}` : `${S.nameOf(key)} · change`;
  pin.classList.toggle('fixed', !!fx);
  pin.style.setProperty('left', `${((b.x0 + b.x1) / 2 - pt.v.x) * pt.s}px`);
  pin.style.setProperty('top', `${Math.max(14, (b.y0 - pt.v.y) * pt.s - 12)}px`);
  pin.hidden = false;
}

// entering, moving and leaving
async function enterEdit(key) {
  if (ed.on) return openSlot(key);
  if (ed.opening) return;
  ed.opening = true;
  setHover(null);
  const s0 = state.series;
  try {
    // the volume can change while its words load: load until they match
    for (let t; t !== vol().topic;) { t = vol().topic; await Promise.all([lexicon(t), liveFonts()]); }
  } catch (err) {
    console.error(err);
    return tell('The words for this volume could not be loaded.', 'Check your connection and try again.', false);
  } finally { ed.opening = false; }
  if (state.series !== s0) return;   // the series changed while the words loaded
  cache.clear();
  ed.on = true; ed.opener = document.activeElement; ed.prevView = state.view; ed.overview = false; ed.preview = null;
  setView('sheet');
  document.body.dataset.editing = '';
  $(`#ef-${state.format}`).checked = true;
  fitEdit();
  ed.view = fullView();
  renderLive();
  $('#studio').scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
  const keys = slotsOf(preset());
  openSlot(keys.includes(key) ? key : keys[0]);
  rail.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
}
function exitEdit() {
  if (!ed.on || ed.leaving) return;
  ed.preview = null; ed.hover = ''; pin.hidden = true; ed.leaving = true;
  moveView(fullView(), () => {
    ed.leaving = false; ed.on = false;
    delete document.body.dataset.editing;
    document.body.removeAttribute('data-unpinned');
    setView(ed.prevView);
    ov.replaceChildren(); ov.removeAttribute('viewBox'); liveRoot.replaceChildren();
    update();
    const back = ed.opener && document.contains(ed.opener) && ed.opener !== document.body ? ed.opener : $('#edit-open');
    back.focus();
  });
}
// leave the editor at once, without the zoom out (a series switch changes the volumes under it)
function closeEdit() {
  if (!ed.on) return;
  cancelAnimationFrame(ed.anim);
  ed.on = ed.leaving = false; ed.preview = null; ed.hover = ''; pin.hidden = true;
  delete document.body.dataset.editing;
  document.body.removeAttribute('data-unpinned');
  setView(ed.prevView);
  ov.replaceChildren(); ov.removeAttribute('viewBox'); liveRoot.replaceChildren();
}
function openSlot(key) {
  ed.leaving = false;
  ed.key = key; ed.preview = null; ed.query = ''; ed.showBad = false; ed.active = -1; ed.linked = ''; ed.overview = false;
  $('#ep-search').value = '';
  $('#whole').setAttribute('aria-pressed', 'false');
  buildRail(); renderPanel(); labels(); renderLive();
  list.scrollTop = 0;
  moveView(viewFor(key));
}
function stepSlot(d, say) {
  const keys = slotsOf(preset()), i = keys.indexOf(ed.key), k = keys[(i + d + keys.length) % keys.length];
  openSlot(k);
  if (say) announce(`${S.LABEL[k]}, ${keys.indexOf(k) + 1} of ${keys.length}: ${k === 'whoami' ? state.handle || HANDLE : plain(get(preset(), k))}`);
}
function toggleOverview() {
  ed.leaving = false;
  ed.overview = !ed.overview; ed.preview = null;
  $('#whole').setAttribute('aria-pressed', String(ed.overview));
  queueLive();
  moveView(ed.overview ? fullView() : viewFor(ed.key));
}
function labels() {
  const keys = slotsOf(preset()), e = vol();
  $('#crumb').replaceChildren(h('span', {}, `Vol. ${pad2(e.vol)} · ${volName(e)}`), h('span', { 'aria-hidden': 'true' }, '›'), h('b', {}, S.LABEL[ed.key]));
  $('#eb-label').replaceChildren(`${S.LABEL[ed.key]} `, h('span', { class: 'mono' }, `${keys.indexOf(ed.key) + 1}/${keys.length}`));
}
function editRefresh() {
  if (ed.leaving) return;
  fitEdit(); buildRail(); renderPanel(); labels(); renderLive();
  moveView(ed.overview ? fullView() : viewFor(ed.key));
}
const refit = () => { if (!ed.on || ed.leaving) return; fitEdit(); cancelAnimationFrame(ed.anim); ed.view = ed.overview ? fullView() : viewFor(ed.key); applyView(); };

// the rail: every word on the sheet, in reading order; arrows move focus, Enter or Space opens
function buildRail() {
  const p = preset(), g = ground(state.ink, state.role).colors, keys = slotsOf(p), had = rail.contains(document.activeElement);
  rail.replaceChildren(...keys.map((k) => {
    const edited = k === 'whoami' ? !!(state.handle || state.motto) : !same(get(p, k), get(shipped(), k));
    const sw = S.swatch(k, g);
    return h('button', { type: 'button', role: 'tab', class: `rchip bracket${edited ? ' edited' : ''}`, dataset: { key: k }, id: `tab-${k.replace('.', '-')}`,
      'aria-selected': String(k === ed.key), tabindex: k === ed.key ? '0' : '-1', 'aria-controls': 'ep', 'aria-label': `${S.LABEL[k]}${edited ? ', edited' : ''}` },
    sw ? h('i', { class: `sw ${sw.cls}`, style: { '--c': sw.color } }) : null, h('span', {}, S.LABEL[k]));
  }));
  const on = rail.querySelector('[aria-selected="true"]');
  if (on && had) on.focus({ preventScroll: true });
  if (on) rail.scrollTo({ left: on.offsetLeft - rail.clientWidth / 2 + on.offsetWidth / 2, behavior: reduced() ? 'auto' : 'smooth' });
}

// the copy desk: one slot's options
function renderPanel() {
  const key = ed.key, who = key === 'whoami', st = ed.stacks[vkey(vol().id)], was = document.activeElement;
  $('#ep-title').textContent = S.LABEL[key];
  $('#undo').disabled = !st?.undo.length;
  $('#redo').disabled = !st?.redo.length;
  $('#restore').disabled = !E()[vol().id];
  if (was?.disabled) (['#undo', '#redo'].map($).find((b) => b !== was && !b.disabled) ?? list).focus();
  $('#ep-linked').hidden = !ed.linked;
  $('#ep-linked').textContent = ed.linked;
  $('#ep-who').hidden = !who;
  list.hidden = who;
  if (who) {
    $('#ep-meta').replaceChildren(h('span', {}, 'Drawn in the # whoami box and the prompt under the sheet. Not from the lexicon.'));
    $('#ep-search-wrap').hidden = true; $('#ep-bad').hidden = true; $('#ep-empty').hidden = true;
    for (const [a, b] of [['#handle-e', el.handle], ['#motto-e', el.motto]]) if ($(a).value !== b.value) $(a).value = b.value;
    syncWho();
    return;
  }
  const o = options(key), a = family(key), fits = o.rows.filter((r) => r.ok).length;
  const now = a === 'data' ? preset().phone?.data?.[key.slice(5)] ?? o.now : o.now, max = a === 'data' ? S.LIMITS.phone : S.limitOf(key);
  fill($('#ep-meta'),
    o.lock ? h('span', { class: 'tape tape-pencil', title: 'Set by the volume' }, o.lock.trim()) : null,
    h('span', {}, `${fits} ${fits === 1 ? 'option fits' : 'options fit'}`),
    h('span', { class: 'mono' }, a === 'phrase' ? `${S.LIMITS.phrase} per line` : Array.isArray(now) ? now.map((v, i) => `${len(v)}/${S.limitOf(key, i)}`).join(' · ')   // a pair: text, code
      : `${len(now)}/${max}${a === 'data' ? ' on the phone' : ''}`));
  $('#ep-search-wrap').hidden = !(o.rows.length > 12 && a !== 'phrase' && a !== 'data');
  paintList();
}
function paintList() {
  const o = options(ed.key), q = norm(ed.query.trim()), match = (r) => !q || r.search.includes(q);
  const good = o.rows.filter((r) => (r.ok || r.applied || r.where) && match(r));
  const bad = o.rows.filter((r) => !r.ok && !r.applied && !r.where && match(r));
  ed.shown = [];
  const groups = [];
  for (const g of ['shipped', 'suggested', 'more', 'lexicon', 'volumes']) {
    const rs = good.filter((r) => r.group === g);
    if (rs.length) groups.push(group(g, o.names[g], rs));
  }
  if (ed.showBad && bad.length) groups.push(group('bad', 'Won’t fit', bad));
  const empty = $('#ep-empty');
  empty.hidden = ed.shown.length > 0;
  empty.replaceChildren(...(ed.shown.length ? [] : q
    ? [`No ${TOPIC[vol().topic] ?? ''} word matches “${ed.query.trim()}”. `, h('button', { type: 'button', class: 'linkbtn', id: 'ep-clear' }, 'Clear the search'), ' or ',
      h('a', { class: 'linkbtn', href: $('#ep-propose').href, target: '_blank', rel: 'noopener noreferrer' }, 'propose a term'), '.']
    : [`No other ${family(ed.key) === 'data' ? 'status lines' : 'words'} in the ${TOPIC[vol().topic] ?? ''} lexicon fit here.`]));
  list.replaceChildren(...groups);
  $('#ep-count').textContent = q ? `${ed.shown.length} of ${o.rows.length}` : '';
  if (q) announce(ed.shown.length ? `${ed.shown.length} of ${o.rows.length} words` : `No word matches ${ed.query.trim()}`);
  const tgl = $('#ep-bad');
  tgl.hidden = !bad.length;
  tgl.setAttribute('aria-expanded', String(ed.showBad));
  tgl.querySelector('span').textContent = `${ed.showBad ? 'Hide' : 'Show'} ${bad.length} that won’t fit`;
  setActive(ed.active < ed.shown.length ? ed.active : -1, { preview: false, scroll: false });
  if (ed.active < 0) preview(null);
}
function group(id, title, rs) {
  return h('div', { role: 'group', 'aria-label': `${title}, ${rs.length} ${rs.length === 1 ? 'option' : 'options'}` },
    h('div', { class: 'og-h', id: `g-${id}`, 'aria-hidden': 'true' }, title, ' ', h('span', { class: 'mono' }, String(rs.length))),
    rs.map(row));
}
function row(r) {
  const i = ed.shown.push(r) - 1, lock = options(ed.key).lock, dis = !r.ok && !r.applied;
  const body = Array.isArray(r.value)   // the phrase's lines, or a pair (text, code)
    ? ed.key === 'phrase' ? h('span', { class: 'ot ph', id: `ot-${i}` }, r.value.flatMap((l, k) => (k ? [h('br'), l] : [l])))
      : h('span', { class: 'ot', id: `ot-${i}` }, r.value[0], ' ', h('span', { class: 'lk' }, r.value[1]))
    : h('span', { class: 'ot', id: `ot-${i}` }, lock && r.value.startsWith(lock) ? [h('span', { class: 'lk' }, lock), r.value.slice(lock.length)] : r.value);
  const fmts = r.per && !r.ok ? h('span', { class: 'fmts', 'aria-hidden': 'true' }, FMTS.map((f) => h('i', { class: `${f[0]}${r.per[f].ok ? '' : ' bad'}` }))) : null;
  return h('div', { role: 'option', class: 'orow', id: `opt-${i}`, dataset: { i: String(i) }, 'aria-selected': String(r.applied), 'aria-disabled': dis ? 'true' : null, 'aria-labelledby': `ot-${i}`, 'aria-describedby': `optd-${i}` },
    body,
    h('span', { class: 'on', 'aria-hidden': 'true' }, r.code ? h('span', { class: 'tape' }, r.code) : null, fmts, Array.isArray(r.value) ? null : h('span', { class: 'mono' }, String(len(r.value)))),
    h('span', { class: 'om', id: `optd-${i}` }, dis ? h('span', { class: 'why' }, r.why) : r.meaning ?? '', h('span', { class: 'sr' }, r.ok ? ' Fits desktop, wide and phone.' : '')));
}
let sayTimer = 0;
const announce = (msg) => { clearTimeout(sayTimer); sayTimer = setTimeout(() => { $('#say').textContent = msg; }, 300); };
function setActive(i, { preview: pv = true, scroll = true } = {}) {
  ed.active = i;
  list.querySelector('.orow.is-active')?.classList.remove('is-active');
  const node = i >= 0 ? $(`#opt-${i}`) : null;
  for (const owner of [list, $('#ep-search')]) node ? owner.setAttribute('aria-activedescendant', node.id) : owner.removeAttribute('aria-activedescendant');
  if (node) { node.classList.add('is-active'); if (scroll) node.scrollIntoView({ block: 'nearest' }); }
  if (pv) preview(node ? ed.shown[i] : null);
}
function preview(r) {
  const next = r && !r.where && !r.applied ? r : null;
  if ((ed.preview?.row ?? null) === next) return;
  if (!next) { if (ed.preview) { ed.preview = null; queueLive(); } return; }
  ed.preview = { row: next, value: next.value };
  queueLive();
  if (!next.ok) announce(next.why);
}

// applying, undo, redo
function apply(r) {
  if (!r || r.applied) return;
  if (!r.ok) { tell('This one can’t go here.', r.why, false); announce(r.why); return; }
  const before = preset(), next = put(before, ed.key, r.value, shipped());
  const bad = guard(next, state.handle, state.motto);
  if (bad.length) { tell('That word does not fit.', bad[0], false); return; }
  const key = ed.key;
  commit(next, `${S.LABEL[key]} changed`, before);
  ed.linked = linkedNote({ key, before, after: preset(), shipped: shipped(), entry: vol(), value: r.value });
  renderPanel();
}
function commit(next, msg, before = preset()) {
  const st = (ed.stacks[vkey(vol().id)] ??= { undo: [], redo: [] });
  st.undo.push({ before, after: next, msg });
  st.redo = [];
  setPreset(next);
  tellUndo(msg);
}
function setPreset(p) {
  const id = vol().id;
  if (same(p, D().presets[id])) delete E()[id]; else E()[id] = p;
  delete unchecked[state.series]?.[id];
  state.ver[vkey(id)] = ver(id) + 1;
  cache.clear();
  ed.preview = null; ed.active = -1;
  update();
  persist();
  if (ed.on && [list, $('#ep-search')].includes(document.activeElement)) setActive(ed.shown.findIndex((r) => r.applied), { preview: false });
}
function undo() { const st = ed.stacks[vkey(vol().id)], x = st?.undo.pop(); if (!x) return; st.redo.push(x); ed.linked = ''; setPreset(x.before); tell('Undone', x.msg); }
function redo() { const st = ed.stacks[vkey(vol().id)], x = st?.redo.pop(); if (!x) return; st.undo.push(x); ed.linked = ''; setPreset(x.after); tell('Redone', x.msg); }
function tellUndo(msg) {
  announce(msg);
  el.slip.replaceChildren(slipIcon(), h('span', {}, h('b', {}, msg)), h('button', { type: 'button', class: 'linkbtn', id: 'slip-undo' }, 'Undo'));
  el.slip.inert = false;
  el.slip.dataset.vol = vol().id;
  el.slip.classList.add('show');
  clearTimeout(slipTimer);
  slipTimer = setTimeout(hideSlip, 5200);
}

// list, search and editor keys
function listKeys(ev) {
  if (ev.target !== list && ev.target.id !== 'ep-search') return;
  const n = ed.shown.length, fromSearch = ev.target.id === 'ep-search';
  if (!fromSearch && ev.key.length === 1 && !' []'.includes(ev.key) && !ev.metaKey && !ev.ctrlKey && !ev.altKey && !$('#ep-search-wrap').hidden) { $('#ep-search').focus(); return; }
  const d = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 }[ev.key];
  if (d != null) { ev.preventDefault(); if (n) setActive(ed.active < 0 ? (d > 0 ? 0 : n - 1) : Math.max(0, Math.min(n - 1, ed.active + d))); return; }
  if (!fromSearch && (ev.key === 'Home' || ev.key === 'End')) { ev.preventDefault(); if (n) setActive(ev.key === 'Home' ? 0 : n - 1); return; }
  if (ev.key === 'Enter') { ev.preventDefault(); if (ed.active >= 0) apply(ed.shown[ed.active]); return; }
  if (ev.key === 'Escape') {
    if (fromSearch && ed.query) { ev.preventDefault(); ev.stopPropagation(); ev.target.value = ''; ed.query = ''; ed.active = -1; paintList(); return; }
    if (ed.active >= 0 || ed.preview) { ev.preventDefault(); ev.stopPropagation(); setActive(-1); }
  }
}
function syncWho() {
  $('#who-e').classList.toggle('bad', el.who.classList.contains('bad'));
  for (const [a, b] of [['#handle-e', el.handle], ['#motto-e', el.motto]]) $(a).setAttribute('aria-invalid', b.getAttribute('aria-invalid') ?? 'false');
  const note = $('#who-e-note');
  note.className = el.whoNote.className;
  if (note.textContent !== el.whoNote.textContent) note.textContent = el.whoNote.textContent;
}
function editKeys(ev) {
  if (ev.defaultPrevented) return;
  const t = ev.target, typing = t.matches?.('input[type="text"], input[type="search"], textarea'), mod = ev.metaKey || ev.ctrlKey;
  if (ev.key === 'Escape' && !mod && !ev.altKey) { ev.preventDefault(); exitEdit(); return; }
  if (t !== document.body && !t.closest?.('#studio')) return;
  if (mod && !ev.altKey && ev.key.toLowerCase() === 'z' && !typing) { ev.preventDefault(); (ev.shiftKey ? redo : undo)(); return; }
  if (mod || ev.altKey) return;
  if (typing) return;
  if (ev.key === ']' || ev.key === '[') { ev.preventDefault(); stepSlot(ev.key === ']' ? 1 : -1); return; }
  if ((ev.key === 'z' || ev.key === 'Z') && t !== list) { ev.preventDefault(); toggleOverview(); }
}

// ---------- saved words: this browser only; everything still works when storage is blocked

const STORE = 'ks-edits';
const canStore = (() => { try { localStorage.setItem('ks-probe', '1'); localStorage.removeItem('ks-probe'); return true; } catch { return false; } })();
// saved words that could not be checked this time, by series and id: a volume whose fetch failed (kept until that
// volume is edited) or a series that is not loaded (kept as saved)
const unchecked = {};
function persist() {
  if (!canStore) return;
  const edits = {};
  for (const [s, byId] of Object.entries(unchecked)) if (Object.keys(byId).length) edits[s] = { ...byId };
  for (const [s, byId] of Object.entries(state.edits)) for (const [id, p] of Object.entries(byId)) {
    const s0 = data.series[s].presets[id], diff = {};
    for (const k of changedSlots(p, s0)) diff[k] = get(p, k);
    if (Object.keys(diff).length) (edits[s] ??= {})[id] = diff;
  }
  try {
    if (Object.keys(edits).length || state.handle || state.motto || state.series !== DEFAULT) localStorage.setItem(STORE, JSON.stringify({ v: 2, series: state.series, edits, handle: state.handle, motto: state.motto }));
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
  if (typeof saved.motto === 'string' && validMotto(saved.motto) && glyphs('mono', saved.motto) && !el.motto.value.trim()) { state.motto = saved.motto; el.motto.value = saved.motto; }
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

// ---------- wiring and start

function wire() {
  el.form.addEventListener('submit', (ev) => ev.preventDefault());
  el.form.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.name === 'volume') goVol(+t.value, true);
    else if (t.name === 'series') chooseSeries(t.value);
    else if (t.name === 'ground') {
      const [ink, role] = t.value.split(':');
      if (PALS.includes(ink) && ROLES.includes(role)) { state.ink = ink; state.role = role; update(); }
    } else if (t.name === 'grain') {
      state.grain = t.checked;
      if (booted) update();                  // before the data is in, start() draws with it
    } else if (t.name === 'format' || t.name === 'eformat') {
      if (Object.hasOwn(FORMATS, t.value)) { state.format = t.value; update(); }
    } else if (t.name === 'view') {
      setView(t.checked ? 'screen' : 'sheet');
      flip();
      if (ed.hover && !ed.on) setHover(null);
    }
  });
  for (const [id, d, other] of [['#prev', -1, '#next'], ['#next', 1, '#prev']]) {
    $(id).addEventListener('click', (ev) => { goVol(state.i + d, true); if (ev.currentTarget.disabled) $(other).focus(); });
  }
  el.handle.addEventListener('input', onWho);
  el.motto.addEventListener('input', onWho);
  for (const [a, b] of [['#handle-e', el.handle], ['#motto-e', el.motto]]) $(a).addEventListener('input', (ev) => { b.value = ev.target.value; onWho(); });
  el.inks.addEventListener('click', (ev) => {
    const b = ev.target.closest('.gcard');
    if (!b) return;
    state.ink = b.dataset.ink; state.role = b.dataset.role;
    update();
    $('#studio').scrollIntoView({ block: 'start' });
    $(`#g-${state.ink}-${state.role}`)?.focus({ preventScroll: true });
  });
  $('#series').addEventListener('click', async (ev) => {      // a Live card: use that series in the studio
    const b = ev.target.closest('.use-series');
    if (!b) return;
    await chooseSeries(b.dataset.use);
    if (b.dataset.use !== state.series) return;
    $('#studio').scrollIntoView({ block: 'start' });
    $(`#series-${state.series}`)?.focus({ preventScroll: true });
  });
  el.legend.addEventListener('pointerover', pickMark);
  el.legend.addEventListener('focusin', pickMark);
  el.legend.addEventListener('click', pickMark);
  document.addEventListener('keydown', (ev) => {
    if (ed.on) return editKeys(ev);
    if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const t = ev.target, typing = t.matches?.('input[type="text"], textarea') || (t.matches?.('input[type="radio"]') && t.name !== 'volume');
    if (typing || (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') || t.name === 'volume') return;   // native radio arrows move volumes
    ev.preventDefault();
    goVol(state.i + (ev.key === 'ArrowRight' ? 1 : -1), true);
  });
  let hoverRaf = 0;
  el.sheet.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse' || state.view !== 'sheet' || !fine() || !data.fonts) return;
    cancelAnimationFrame(hoverRaf);
    hoverRaf = requestAnimationFrame(() => { const pt = sheetPoint(ev), k = hitAt(pt.x, pt.y, 8 / pt.s); if (k !== ed.hover) setHover(k, pt); });
  });
  el.sheet.addEventListener('pointerleave', () => { cancelAnimationFrame(hoverRaf); if (ed.hover) setHover(null); });
  el.sheet.addEventListener('click', (ev) => {
    if (state.view !== 'sheet' || ev.target.closest('.ruler') || !data.fonts) return;
    const pt = sheetPoint(ev), key = hitAt(pt.x, pt.y, (fine() ? 8 : 44) / pt.s), fx = S.fixedOf(key);
    if (fx) { tell(`The ${fx[0].toLowerCase()} is fixed`, `It ${fx[1]}.`, false); return; }
    if (!ed.on) { if (key) enterEdit(key); return; }
    if (key && (key !== ed.key || ed.overview)) openSlot(key);
  });
  rail.addEventListener('click', (ev) => { const b = ev.target.closest('.rchip'); if (b && b.dataset.key !== ed.key) openSlot(b.dataset.key); });
  rail.addEventListener('keydown', (ev) => {
    const tabs = [...rail.querySelectorAll('[role="tab"]')], n = tabs.length, i = tabs.indexOf(ev.target.closest('[role="tab"]'));
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: n - 1 }[ev.key];
    if (to == null || i < 0) return;
    ev.preventDefault(); ev.stopPropagation();
    const t = tabs[(to + n) % n];
    for (const x of tabs) x.tabIndex = x === t ? 0 : -1;
    t.focus();
    t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  list.addEventListener('keydown', listKeys);
  $('#ep-search').addEventListener('keydown', listKeys);
  $('#ep-search').addEventListener('input', (ev) => { ed.query = ev.target.value; ed.active = -1; paintList(); });
  list.addEventListener('focus', () => { if (list.matches(':focus-visible') && ed.active < 0 && ed.shown.length) setActive(Math.max(0, ed.shown.findIndex((r) => r.applied))); });
  list.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    const node = ev.target.closest('.orow');
    if (node && +node.dataset.i !== ed.active) setActive(+node.dataset.i, { scroll: false });
  });
  list.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse' && ed.active >= 0) setActive(-1); });
  list.addEventListener('click', (ev) => { const node = ev.target.closest('.orow'); if (node) apply(ed.shown[+node.dataset.i]); });
  $('#ep-empty').addEventListener('click', (ev) => { if (ev.target.closest('#ep-clear')) { $('#ep-search').value = ''; ed.query = ''; paintList(); $('#ep-search').focus(); } });
  $('#ep-bad').addEventListener('click', () => { ed.showBad = !ed.showBad; paintList(); });
  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);
  $('#restore').addEventListener('click', () => { if (E()[vol().id]) { ed.linked = ''; commit(D().presets[vol().id], 'All words restored'); } });
  $('#edit-open').addEventListener('click', () => enterEdit());
  $('#edit-done').addEventListener('click', exitEdit);
  $('#eb-done').addEventListener('click', exitEdit);
  $('#eb-prev').addEventListener('click', () => stepSlot(-1, true));
  $('#eb-next').addEventListener('click', () => stepSlot(1, true));
  $('#whole').addEventListener('click', toggleOverview);
  el.slip.addEventListener('click', (ev) => {
    if (!ev.target.closest('#slip-undo')) return;
    if (el.slip.dataset.vol !== vol().id) return hideSlip();
    if (ed.on) $('#undo').focus();
    undo();
  });
  addEventListener('resize', () => { fit(); refit(); });
  window.visualViewport?.addEventListener('resize', refit);
}

async function start() {
  wire();
  // the release label lives in version.json only; a failed fetch leaves it blank, the studio doesn't need it
  json('version.json').then((v) => document.querySelectorAll('[data-version]').forEach((n) => { n.textContent = v.version; }), () => {});
  $('#ep-saved').textContent = canStore ? 'Saved in this browser only.' : 'This browser blocks storage, so your words last until you reload.';
  el.stage.setAttribute('aria-busy', 'true');
  const saved = readSaved();
  if (SERIES[saved?.series]) useSeries(saved.series);        // the last series viewed
  const boot = () => load().then(() => true, (err) => { console.error(err); return false; });
  let ok = await boot();
  if (!ok && state.series !== DEFAULT) { useSeries(DEFAULT); ok = await boot(); }   // the saved series would not load: start on the first
  if (!ok) {
    el.stage.setAttribute('aria-busy', 'false');
    return tell('The wallpaper data could not be loaded.', 'Check your connection and reload the page.', false);
  }
  loads[state.series] = restores[state.series] = Promise.resolve(0);
  state.role = D().index[0].ground;
  buildSwitch(); buildStrip(); buildDrawdown(); buildInkRows(); paintSeries();
  const dropped = await restoreSaved(saved);
  booted = true;
  readWho();
  update();
  if (Object.keys(unchecked[state.series] ?? {}).length) tell('Some saved words could not be checked.', 'They stay saved: reload the page to bring them back.', false);
  else if (dropped) tell(`${dropped} saved ${dropped === 1 ? 'word was' : 'words were'} left out.`, 'They are no longer in the lexicon or no longer fit. Your other words are back.', false);
  if (canStore) persist();
  (window.requestIdleCallback ?? ((f) => setTimeout(f, 1200)))(() => {
    liveFonts(); lexicon(vol().topic).catch(() => {});
    for (const s of Object.keys(SERIES)) loadOnce(s).then(paintLive, () => {});      // the other series' card, and a quick switch
  });
}

start();
