// kernspace · the studio. Everything renders in the browser; nothing is uploaded.
// This module composes the page. Loading, the address bar and saved-words shape, the word editor
// and the downloads live in their own modules. State and resource ownership: app/state.js.
// The series the editor and the stage call: app/series/index.js.
// A render ticket, a series-choice counter and an export snapshot are separate. They do not share
// a transition object; dropping one does not write the result of another.
import { createAssets, fetchJSON as json } from './assets.js';
import { PALS, ROLES, TOPIC } from './catalog.js';
import { $, blobUrl, fill, h, isNarrow, nameBtn, nice, pad2, reduced, releaseThumbs, setText, svg, swap, volName } from './dom.js';
import { createEditor } from './editor.js';
import { bindDownloads } from './export.js';
import { applyLink, linkQuery, readLink as readLinkParams } from './link.js';
import { createPersistence } from './persist.js';
import { FINISHES, FORMATS, validHandle } from './render.js';
import { SERIES, bootSeries, isSeries, seriesSwitch } from './series/index.js';
import { createState, versionKey } from './state.js';
import { DEFAULT } from './store.js';
import { confirmedMotto, mottoStatus } from './whoami.js';
import { changedSlots } from './words.js';

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
const TOTAL = Object.keys(TOPIC).length;       // volumes a full series holds

const data = { series: {}, palettes: {}, fonts: null, lex: {} };     // series[s] = { index, presets, skipped }; lexicons are shared
const lastVol = {};                                      // the volume each series was left on
const restores = {};
const state = createState();
let S = SERIES[state.series];                       // the series on the stage: its renderer, slot table and marks
const D = () => data.series[state.series];
const E = (s = state.series) => (state.edits[s] ??= {});     // edited presets by id
const vkey = (id, s = state.series) => versionKey(s, id);
const ver = (id) => state.ver[vkey(id)] ?? 0;
function useSeries(s) {
  if (!isSeries(s)) return;
  state.series = s; S = SERIES[s]; state.mark = S.READ.mark;
}
const { loadOnce, loadFaces, load: loadSeries, lexicon, loads, faceKeys } = createAssets({ data, seriesOf: (s) => SERIES[s] });
const load = () => loadSeries(state.series);

let sayTimer = 0;
function announce(msg) { clearTimeout(sayTimer); sayTimer = setTimeout(() => { $('#say').textContent = msg; }, 300); }
function readLink() { return readLinkParams(location.search); }
function useLink(link) { Object.assign(state, applyLink(state, D().index, link)); }
function writeLink() {
  const e = vol(), u = new URL(location.href);
  u.search = linkQuery({ series: state.series, index: state.i, vol: e.vol, ink: state.ink, role: state.role, format: state.format, volumeGround: e.ground });
  if (u.href !== location.href) try { history.replaceState(history.state, '', u); } catch {}
}
function invalidateCaches() {
  inkKey = '';
  thumbKeys.clear();
  editor.cache.clear();
}
function tellUndo(msg) {
  announce(msg);
  el.slip.replaceChildren(slipIcon(), h('span', {}, h('b', {}, msg)), h('button', { type: 'button', class: 'linkbtn', id: 'slip-undo' }, 'Undo'));
  el.slip.inert = false;
  el.slip.dataset.vol = vol().id;
  el.slip.classList.add('show');
  clearTimeout(slipTimer);
  slipTimer = setTimeout(hideSlip, 5200);
}
let persistence;
function persist() { persistence.persist(); }
let editor;


const vol = () => D().index[state.i];
const shipped = () => D().presets[vol().id];
const preset = () => E()[vol().id] ?? shipped();
function ground(ink, role) {
  const [slug, g] = Object.entries(data.palettes[ink].grounds).find(([, x]) => x.role === role);
  return { slug, colors: g.colors };
}
// a finish goes only on the stage's sheet and its downloads: thumbnails, the key, the Live cards and the editor's proof stay plain
const draw = (p, ink, role, format, fonts, R = S, texture = '') => R.render({ preset: p, colors: ground(ink, role).colors, format, handle: state.handle, motto: state.motto, fonts, texture });

// ---------- the page's fixed parts, built once the data is in

const el = {
  form: $('#form'), stage: $('#stage'), sheet: $('#sheet'), img: $('#sheet-img'), strip: $('#strip'), dd: $('#drawdown'),
  inks: $('#ink-rows'), legend: $('#legend'), slip: $('#slip'), handle: $('#handle'), motto: $('#motto'), who: $('#who'),
  whoNote: $('#who-note'), need: $('#need'), png: $('#dl-png'), svg: $('#dl-svg'), pack: $('#dl-pack'), loupe: $('#loupe'),
};

function buildStrip() {
  releaseThumbs(el.strip);
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
  releaseThumbs(el.inks);
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
  sw.replaceChildren(...all.map(([s, R]) => h('label', { dataset: { tip: R.name } },
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
    nameBtn(b, on ? `${SERIES[card.dataset.series].name} is in the studio` : `Use ${SERIES[card.dataset.series].name} in the studio`, on ? 'In the studio' : 'Use in the studio');
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

// the notch and home-bar insets in px: env() can't be read directly, so a hidden probe carries them as padding
const probe = h('div', { 'aria-hidden': 'true', style: { position: 'fixed', visibility: 'hidden', 'pointer-events': 'none', height: '100svh', 'box-sizing': 'border-box', 'padding-block': 'env(safe-area-inset-top, 0px) env(safe-area-inset-bottom, 0px)' } });
document.body.append(probe);
const insets = () => { const cs = getComputedStyle(probe); return parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom); };
const insetTop = () => parseFloat(getComputedStyle(probe).paddingTop);

// one stage height for every format, so switching never moves the page
function fit() {
  if (editor.ed.on) return editor.fitEdit();
  const { w, h: H0 } = FORMATS[state.format], ar = w / H0;
  const cs = getComputedStyle(el.stage), padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const avail = el.stage.clientWidth - padX, narrow = isNarrow();
  const stageH = Math.round(narrow ? Math.min(avail / (16 / 9), 420) * 1.35 : Math.min(avail / (16 / 9), Math.max(360, innerHeight - 330)));   // narrow: the phone's taller well for all, letterboxing desktop and wide
  const room = narrow ? Math.max(120, probe.offsetHeight - 60 - insetTop() - $('.acts').offsetHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) : Infinity;   // short screens: header and download bar leave this much
  const H = Math.min(room, stageH);
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
function fileName(e, g = ground(state.ink, state.role)) {
  const { w, h: H } = FORMATS[state.format];
  return `kernspace_${state.series}_${e.id}${E()[e.id] ? '_edited' : ''}_${state.ink}-${g.slug}${state.finish ? `_${state.finish}` : ''}_${w}x${H}`;
}
async function drawSheet() {
  const t = ++ticket, e = vol(), g = ground(state.ink, state.role), { w, h: H } = FORMATS[state.format];
  const text = draw(preset(), state.ink, state.role, state.format, data.fonts, S, state.finish), name = fileName(e, g);
  const url = blobUrl(text), img = new Image();
  img.src = url;
  el.stage.setAttribute('aria-busy', 'true');
  if (state.finish) el.loupe.setAttribute('aria-busy', 'true');   // the crop shows the sheet before this one until it redraws
  try {
    await img.decode();
    if (t !== ticket) return URL.revokeObjectURL(url);
    current = { svg: text, name, w, h: H, t, img, format: state.format, finish: state.finish };   // the image, for the crop at full size
    swap(el.img, url);
    el.img.alt = `${S.name}, ${e.title}: ${data.palettes[state.ink].name} ink on the ${nice(g.slug)} ground${state.finish ? `, ${FINISHES[state.finish].alt}` : ''}, ${w} by ${H} pixels.`;
  } catch (err) {
    URL.revokeObjectURL(url);
    if (t === ticket) { current = null; tell('This sheet could not be drawn.', 'Try another ink or format.', false); console.error(err); }
  } finally {
    if (t === ticket) { el.stage.setAttribute('aria-busy', 'false'); syncDownloads(); queueLoupe(); }
  }
}

function update() {
  const e = vol(), p = preset(), g = ground(state.ink, state.role);
  drawing = drawSheet();
  el.sheet.dataset.format = state.format;
  el.sheet.dataset.ground = state.role;
  el.sheet.style.setProperty('--lock', state.role === 'light' ? '#16122A' : '#fff');
  if (!editor.ed.on && editor.ed.hover) editor.setHover(null);
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
  syncFinish();
  setText('#gr-name', nice(g.slug));         // a live region: rewriting the same words would read them out again
  setText('#gr-hex', g.colors.bg);
  setText('#gr-note', `${NOTES[g.slug] ?? ''} ${INKS[state.ink]}`);
  $(`#fmt-${state.format}`).checked = true;
  $(`#ef-${state.format}`).checked = true;
  const radio = el.strip.querySelector(`input[value="${state.i}"]`);
  if (radio) radio.checked = true;
  el.sheet.setAttribute('title', `${w} × ${H}`);
  paintStrip();
  writeLink();
  // the sections below the studio redraw at once, or shortly after the last change while editing
  clearTimeout(belowTimer);
  if (editor.ed.on) { belowTimer = setTimeout(paintBelow, 450); editor.editRefresh(); } else paintBelow();
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
  if (editor.ed.on && !data.lex[vol().topic]) {   // editing, and this volume's words aren't in yet
    const id = vol().id;
    lexicon(vol().topic).then(() => { if (editor.ed.on && vol().id === id) { editor.cache.clear(); editor.editRefresh(); } },
      () => tell('The words for this volume could not be loaded.', 'Check your connection and try again.', false));
  }
  if (reveal) el.strip.querySelector(`input[value="${i}"]`)?.closest('label').scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// change series: load it once (its presets, then the words saved for it), leave the editor, land on the volume it was
// left on. Only the latest choice counts; a series that won't load leaves the studio as it was.
let choice = 0;
async function chooseSeries(s) {
  const t = ++choice;
  if (seriesSwitch(state.series, s) === state.series) { el.stage.setAttribute('aria-busy', 'false'); return syncSwitch(); }
  el.stage.setAttribute('aria-busy', 'true');
  let dropped = 0;
  try {
    await Promise.all([loadOnce(s), loadFaces(faceKeys(SERIES[s]))]);
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
  editor.closeEdit();
  hideSlip();
  lastVol[state.series] = state.i;
  useSeries(s);
  state.i = Math.min(lastVol[s] ?? 0, D().index.length - 1);
  state.role = vol().ground;
  inkKey = ''; thumbKeys.clear(); editor.cache.clear();
  buildStrip(); buildInkRows(); paintSeries(); readWho();
  if (el.pack.getAttribute('aria-busy') !== 'true') nameBtn(el.pack, ...packLabel());   // the real count
  el.strip.scrollLeft = 0;
  update();
  persist();
  announce(`${S.name}, ${D().index.length} ${D().index.length === 1 ? 'volume' : 'volumes'}. ${vol().title}.`);
  if (Object.keys(persistence.unchecked[s] ?? {}).length) tell('Some saved words could not be checked.', 'They stay saved: reload the page to bring them back.', false);
  else if (dropped) tell(`${dropped} saved ${dropped === 1 ? 'word was' : 'words were'} left out.`, 'They are no longer in the lexicon or no longer fit. Your other words are back.', false);
}
// a series that was not loaded at start: its saved words come back the first time it is chosen
async function restoreLate(s) {
  const saved = persistence.unchecked[s];
  if (!saved) return 0;
  delete persistence.unchecked[s];
  try { return await persistence.restoreSeries(s, saved); } catch (err) { console.error(err); persistence.unchecked[s] = saved; delete restores[s]; return 0; }
}

// ---------- your whoami: handle and line, optional. Empty, the sheet keeps the shipped box; typed, it must print

// readWho only takes a valid value into state, so a field matches state when it is empty or valid
const ready = () => el.handle.value.trim() === state.handle && el.motto.value.trim() === state.motto;
function syncDownloads() {
  const ok = ready() && !!current;
  el.png.disabled = el.svg.disabled = el.pack.disabled = !ok;
  // a hidden need line would still be read out through aria-describedby
  for (const b of [el.png, el.svg, el.pack]) if (ready()) b.removeAttribute('aria-describedby'); else b.setAttribute('aria-describedby', 'need');
  const was = el.need.hidden;
  el.need.hidden = ready();
  if (was !== el.need.hidden) fit();   // the bar changes height with the need line, and the stage cap counts it
}
function readWho() {
  const hv = el.handle.value.trim(), mv = el.motto.value.trim();
  const hOk = !hv || validHandle(hv);
  const status = mottoStatus(mv, S.whoFace);   // the face this series draws the box in, not the house mono
  const badMotto = status === 'glyph' || status === 'length';
  el.handle.setAttribute('aria-invalid', String(!hOk));
  el.motto.setAttribute('aria-invalid', String(badMotto));
  const bad = !hOk || badMotto;
  el.who.classList.toggle('bad', bad);
  const msg = !hOk ? 'Your handle can use letters, digits, dots, dashes and underscores, up to 20.'
    : status === 'glyph' ? 'Your line uses a character the sheet’s font doesn’t have.'
    : status === 'length' ? `Your line can be up to ${S.LIMITS.motto} characters.`
    : status === 'pending' ? 'The sheet’s font is still loading.'
    : S.READ.who;
  el.whoNote.classList.toggle('err', bad);
  if (el.whoNote.textContent !== msg) el.whoNote.textContent = msg;   // live region: write only on change
  const next = { handle: hOk ? hv : state.handle, motto: confirmedMotto(el.motto.value, state.motto, S.whoFace) };
  const changed = next.handle !== state.handle || next.motto !== state.motto;
  Object.assign(state, next);
  syncDownloads();
  editor.syncWho();
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
async function settled() {
  if (whoTimer) flushWho();
  for (let d; d !== drawing;) await (d = drawing);
  return ready() ? current : null;
}
const packLabel = () => ['Download all volumes, ZIP', `Download all ${D().index.length} volumes (ZIP)`];

// ---------- the finish: none, or one film grain or paper over the whole sheet (FINISHES in render.js)

const FAMILIES = [...new Set(Object.values(FINISHES).map((f) => f.family))];
const stocks = Object.create(null);           // the stock last picked in each family, this visit only
// an option in either group, described by the note under the picker
const finishOpt = (name, value, label) => h('label', {}, h('input', { type: 'radio', name, value, 'aria-describedby': 'finish-note' }), h('span', { class: 'opt' }, h('span', { class: 'name' }, label)));
const noteOf = (f) => [h('span', {}, f.note), h('span', {}, `The PNG grows to ${f.png}.`)];
// None and the families; under them the chosen family's stocks. Two segmented groups, one bracket sliding in each
function buildFinish() {
  const fam = $('#finish-family');
  fam.style.setProperty('--n', FAMILIES.length + 1);
  fam.replaceChildren(finishOpt('family', '', 'None'), ...FAMILIES.map((f) => finishOpt('family', f, f)));
  // every finish's note, stacked unseen in the note's own cell: the note is as tall as the longest at any width, so moving
  // between stocks or families never moves what is below
  $('#finish-size').replaceChildren(...Object.values(FINISHES).map((f) => h('span', {}, ...noteOf(f))));
  syncFinish();
}
// a stock is itself; a family brings back the stock last picked in it this visit, or else its first; anything else is none
function pickFinish(t) {
  if (t.name === 'stock') state.finish = Object.hasOwn(FINISHES, t.value) ? (stocks[FINISHES[t.value].family] = t.value) : '';
  else state.finish = FAMILIES.includes(t.value) ? (stocks[t.value] ?? Object.keys(FINISHES).find((k) => FINISHES[k].family === t.value)) : '';
}
// the picker, its note and the crop follow state, which also undoes a browser restoring the radios on reload: every visit starts at none
const NONE_NOTE = $('#finish-note').textContent;
let noted = '';
function syncFinish() {
  const f = FINISHES[state.finish], fam = f?.family ?? '', box = $('#finish-stock');
  document.querySelectorAll('input[name="family"]').forEach((r) => { r.checked = r.value === fam; });
  if (f && box.dataset.family !== fam) {     // the chosen family's stocks
    const keys = Object.keys(FINISHES).filter((k) => FINISHES[k].family === fam);
    box.dataset.family = fam;
    box.setAttribute('aria-label', `${fam} stock`);
    box.style.setProperty('--n', keys.length);
    box.replaceChildren(...keys.map((k) => finishOpt('stock', k, FINISHES[k].label)));
    // new names under the bracket: it lands on the stock the family brings back, never slides from the old family's column
    box.classList.add('fresh');
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.remove('fresh')));
  }
  box.querySelectorAll('input').forEach((r) => { r.checked = r.value === state.finish; });
  if (noted === state.finish) return;        // the note is a live region: write only on change
  noted = state.finish;
  box.hidden = $('#finish-size').hidden = !f;
  fill($('#finish-note'), f ? noteOf(f) : NONE_NOTE);
  // the crop, dimmed until it shows this finish; at none it is emptied, so the next finish never opens on an old sheet
  const cv = el.loupe.querySelector('canvas');
  el.loupe.hidden = !f;
  el.loupe.setAttribute('aria-busy', 'true');
  cv.setAttribute('aria-label', 'The whoami box at full size');
  if (!f) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); loupeAt = ''; }
}
// At full size. The stage draws the sheet at a fifth to a half of its pixels, and the finish with it at that scale, which
// is not the export's texture. While a finish is on, a crop of the export itself: the sheet's SVG image drawn unscaled on a
// canvas, as the PNG is, one sheet pixel to each screen pixel, from just left of the whoami box (small type on flat ground
// in every series and format). It waits for the sheet to settle and for the crop to be on screen, and a newer sheet drops
// it. A canvas drawn without the graphics card rasterises the whole 4K filter on the main thread (1–2 s), so after a
// slow draw it waits for a longer pause: browsing sheets doesn't stall on every step.
let loupeTimer = 0, loupeSlow = false, loupeSeen = false, loupeAt = '';
const queueLoupe = () => { clearTimeout(loupeTimer); loupeTimer = setTimeout(paintLoupe, loupeSlow ? 1200 : 160); };
function paintLoupe() {
  const c = current, cv = el.loupe.querySelector('canvas');
  if (!c?.finish || c.t !== ticket || el.loupe.hidden || !loupeSeen || editor.ed.on) return;
  const r = devicePixelRatio || 1, w = Math.round(cv.clientWidth * r), H = Math.round(cv.clientHeight * r), at = `${c.t} ${w}x${H}`;
  if (!w || !H || at === loupeAt) return;   // already showing this sheet at this size
  if (cv.width !== w || cv.height !== H) { cv.width = w; cv.height = H; }
  const b = editor.slotBox('whoami', c.format) ?? { x0: c.w / 2, y0: c.h / 2, y1: c.h / 2 };
  const x = w >= c.w ? (c.w - w) / 2 : Math.min(Math.max(b.x0 - 40, 0), c.w - w), y = Math.min(Math.max((b.y0 + b.y1 - H) / 2, 0), c.h - H);
  const ctx = cv.getContext('2d'), t0 = performance.now();
  ctx.clearRect(0, 0, w, H);
  ctx.drawImage(c.img, -Math.round(x), -Math.round(y), c.w, c.h);
  requestAnimationFrame(() => setTimeout(() => { loupeSlow = performance.now() - t0 > 400; }));   // slow when the frame that shows it waited for the raster
  loupeAt = at;
  cv.setAttribute('aria-label', `The whoami box at full size, ${FINISHES[c.finish].alt}.`);
  el.loupe.setAttribute('aria-busy', 'false');
}
new IntersectionObserver(([e]) => { loupeSeen = e.isIntersecting; if (loupeSeen) queueLoupe(); }).observe(el.loupe);

// ---------- theme: follows the system until the viewer picks (theme.js applied a saved choice before paint)

const root = document.documentElement, themeBtn = $('#theme');
const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches);
const labelTheme = () => nameBtn(themeBtn, isDark() ? 'Switch to light theme' : 'Switch to dark theme');
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
  if (ev.type === 'click' && getComputedStyle(fig).position !== 'sticky' && (r.top < 0 || r.bottom > innerHeight)) fig.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
};

// ---------- the word editor

// the preview switch: off shows the sheet alone, on shows it on a screen
function setView(v) { state.view = v; el.stage.dataset.view = v; $('#view-screen').checked = v === 'screen'; $('.hint-touch').hidden = v !== 'sheet'; }   // a tap only opens the editor on the sheet
const flips = [];
function flip() {
  const t = performance.now();
  flips.push(t);
  while (t - flips[0] > 3000) flips.shift();
  if (flips.length >= 5) { flips.length = 0; tell('Hello, friend.', 'eps1.0_hellofriend.mov'); }
}

// the editor, the saved words and the downloads. Wired once the nodes exist; none of them run at import of their modules.
const deps = {
  state, data, el,
  series: () => S, vol, preset, shipped, seriesData: D, edits: E, ver, vkey, ground, lexicon,
  update, tell, announce, setView, ruler, insets, readWho, tellUndo, packLabel, settled,
  syncClear: () => persistence.syncClear(),
  editor: () => editor,
  invalidateCaches,
  persist: () => persistence.persist(),
};
persistence = createPersistence(deps);
deps.unchecked = persistence.unchecked;
editor = createEditor(deps);
bindDownloads(deps);


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
    } else if (t.name === 'family' || t.name === 'stock') {
      // the file name under the stage takes the finish's key and can wrap anew, and the browser's scroll anchoring then
      // moves the inspector under the pointer (two columns, 861 to 1071px): keep the picked option where it was
      const lab = t.closest('label'), y = lab.getBoundingClientRect().top;
      pickFinish(t);
      syncFinish();
      if (booted) update();                  // before the data is in, start() draws with it
      const r = lab.getBoundingClientRect();
      if (r.height && r.top !== y) scrollBy({ top: r.top - y, behavior: 'instant' });
    } else if (t.name === 'format' || t.name === 'eformat') {
      if (Object.hasOwn(FORMATS, t.value)) { state.format = t.value; update(); }
    } else if (t.name === 'view') {
      setView(t.checked ? 'screen' : 'sheet');
      flip();
      if (editor.ed.hover && !editor.ed.on) editor.setHover(null);
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
    const kb = !ev.detail && isNarrow();   // keyboard on a phone: stay at the card, so the focus ring is on screen
    if (!kb) $('#studio').scrollIntoView({ block: 'start' });
    $(`#g-${state.ink}-${state.role}`)?.focus({ preventScroll: !kb });
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
    if (editor.ed.on) return editor.editKeys(ev);
    if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const t = ev.target, typing = t.matches?.('input[type="text"], textarea') || (t.matches?.('input[type="radio"]') && t.name !== 'volume');
    if (typing || (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') || t.name === 'volume') return;   // native radio arrows move volumes
    ev.preventDefault();
    goVol(state.i + (ev.key === 'ArrowRight' ? 1 : -1), true);
  });
  el.slip.addEventListener('click', (ev) => {
    if (!ev.target.closest('#slip-undo')) return;
    if (el.slip.dataset.vol !== vol().id) return hideSlip();
    if (editor.ed.on) $('#undo').focus();
    editor.undo();
  });

  addEventListener('resize', () => { fit(); editor.refit(); queueLoupe(); });
  // a change of pixel ratio alone (the window moved to another screen) fires no resize, and the crop must stay 1:1
  const ratio = () => matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', () => { queueLoupe(); ratio(); }, { once: true });
  ratio();
  window.visualViewport?.addEventListener('resize', editor.refit);
}

// ---------- touch tooltips: a long-press on a [data-tip] control shows its tip and does not fire the control; mouse keeps the hover tip

{
  let timer = 0, held, x0, y0, shown, hideT, eat = false, down = false;   // down: a finger or pen is on the screen
  const hideTip = () => { clearTimeout(hideT); shown?.classList.remove('tip-on'); shown = null; };
  const tipOf = (ev) => ev.target.closest?.('[data-tip]');
  addEventListener('pointerdown', (ev) => {
    down = ev.pointerType !== 'mouse';
    if (!down) return;
    hideTip(); eat = false; held = tipOf(ev); x0 = ev.clientX; y0 = ev.clientY;
    if (held) timer = setTimeout(show, 500);
  }, true);
  function show() { clearTimeout(timer); timer = 0; shown = held; shown.classList.add('tip-on'); eat = true; hideT = setTimeout(hideTip, 1500); }
  addEventListener('pointermove', (ev) => { if (timer && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) { clearTimeout(timer); timer = 0; } }, true);
  const lift = () => { clearTimeout(timer); timer = 0; if (eat) setTimeout(() => { eat = false; }, 400); };   // no click follows a drag-off: don't eat the next tap
  addEventListener('pointerup', (ev) => { down = false; lift(ev); }, true);
  addEventListener('pointercancel', lift, true);
  addEventListener('click', (ev) => { if (eat) { eat = false; ev.preventDefault(); ev.stopPropagation(); } }, true);
  // Android's own long-press can beat the timer (and cancel the pointer): take it as the signal
  addEventListener('contextmenu', (ev) => { if (down && held && tipOf(ev) === held) { ev.preventDefault(); if (!shown) show(); } }, true);
}

async function start() {
  wire();
  buildFinish();
  // the release label lives in version.json only; a failed fetch leaves it blank, the studio doesn't need it
  json('version.json').then((v) => document.querySelectorAll('[data-version]').forEach((n) => { n.textContent = v.version; }), () => {});
  $('#ep-saved').textContent = persistence.canStore ? 'Saved in this browser only.' : 'This browser blocks storage, so your words last until you reload.';
  el.stage.setAttribute('aria-busy', 'true');
  const saved = persistence.readSaved(), link = readLink();
  const first = bootSeries(link, saved?.series);   // the linked series, else the last one viewed; an id that is not a series opens the default
  if (first !== state.series) useSeries(first);
  const boot = () => load().then(() => true, (err) => { console.error(err); return false; });
  let ok = await boot();
  if (!ok && state.series !== DEFAULT) { useSeries(DEFAULT); ok = await boot(); }   // the saved series would not load: start on the first
  if (!ok) {
    el.stage.setAttribute('aria-busy', 'false');
    return tell('The wallpaper data could not be loaded.', 'Check your connection and reload the page.', false);
  }
  loads[state.series] = restores[state.series] = Promise.resolve(0);
  useLink(link);
  buildSwitch(); buildStrip(); buildDrawdown(); buildInkRows(); paintSeries();
  nameBtn(el.pack, ...packLabel());   // the real count from first paint
  const dropped = await persistence.restoreSaved(saved);
  booted = true;
  readWho();
  update();
  // a linked volume further along: bring it into the strip without moving the page
  const lab = state.i && el.strip.querySelector(`input[value="${state.i}"]`)?.closest('label');
  if (lab) el.strip.scrollLeft += lab.getBoundingClientRect().left - el.strip.getBoundingClientRect().left;
  if (Object.keys(persistence.unchecked[state.series] ?? {}).length) tell('Some saved words could not be checked.', 'They stay saved: reload the page to bring them back.', false);
  else if (dropped) tell(`${dropped} saved ${dropped === 1 ? 'word was' : 'words were'} left out.`, 'They are no longer in the lexicon or no longer fit. Your other words are back.', false);
  if (persistence.canStore) persist();
  (window.requestIdleCallback ?? ((f) => setTimeout(f, 1200)))(() => {
    editor.liveFonts(); lexicon(vol().topic).catch(() => {});
    for (const s of Object.keys(SERIES)) loadOnce(s).then(paintLive, () => {});      // the other series' card, and a quick switch
  });
}

start();