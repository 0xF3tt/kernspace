// The word editor: DOM rendering and event handlers. Stack transitions are app/history.js.
// Importing this module does not open the editor or touch the document.
import { FMT_NAME, TOPIC } from './catalog.js';
import { family, get, hull, prepare } from './check.js';
import { $, fill, h, isNarrow, nameBtn, pad2, reduced, volName } from './dom.js';
import { FACES } from './fonts.js';
import { commitStack, redoStack, undoStack } from './history.js';
import { FORMATS, HANDLE, MOTTO } from './render.js';
import { FMTS, guard, linkedNote, options as wordOptions, plain, put, same, slotsOf } from './words.js';

/**
 * Build the editor against an explicit dependency bag. `deps.series()` is the series
 * on stage (it changes). `deps.unchecked` is the persistence map of saved words that
 * could not be checked yet. Nothing here is read from a global store.
 */
export function createEditor(deps) {
  const { state, data, el } = deps;
  const S = () => deps.series();
  const vol = () => deps.vol();
  const preset = () => deps.preset();
  const shipped = () => deps.shipped();
  const D = () => deps.seriesData();
  const E = (s = state.series) => deps.edits(s);
  const ver = (id) => deps.ver(id);
  const vkey = (id, s = state.series) => deps.vkey(id, s);
  const ground = (ink, role) => deps.ground(ink, role);
  const update = () => deps.update();
  const persist = () => deps.persist();
  const tell = (title, sub, ok) => deps.tell(title, sub, ok);
  const announce = (msg) => deps.announce(msg);
  const setView = (v) => deps.setView(v);
  const lexicon = (topic) => deps.lexicon(topic);
  const ruler = (node, marks, axis) => deps.ruler(node, marks, axis);
  const insets = () => deps.insets();
  const syncClear = () => deps.syncClear();
  const unchecked = deps.unchecked;
  const tellUndo = (msg) => deps.tellUndo(msg);

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
    return { rows, lock: S().lockOf(key, shipped()), now: get(preset(), key), names };
  });
}

// one box per slot: its text plus the mark it belongs to, in sheet px
function slotBox(key, fmt = state.format) {
  const qs = S().slotQuads(prepared(fmt).s, preset(), key);
  return qs.length ? hull(qs.flat()) : null;
}
function hitAt(x, y, pad) {
  let best = null, far = Infinity, area = Infinity;   // under the point beats near it; ties go to the smallest box
  for (const key of [...slotsOf(preset()), ...Object.keys(S().FIXED)]) {
    const b = slotBox(key);
    if (!b) continue;
    const d = Math.max(b.x0 - x, x - b.x1, b.y0 - y, y - b.y1, 0), a = (b.x1 - b.x0) * (b.y1 - b.y0);
    if (d > pad || d > far || (d === far && a >= area)) continue;
    far = d; area = a; best = key;
  }
  return best;
}

// the live proof: inline SVG in a shadow root, zoomed through its viewBox
const liveFonts = () => Promise.all(S().fonts.map((k) => document.fonts.load(`16px ${FACES[k].family}`))).catch(() => {});
let liveQueued = 0;
function renderLive() {
  liveQueued = 0;
  if (!ed.on) return;
  const p = ed.preview ? put(preset(), ed.key, ed.preview.value, shipped()) : preset();
  const text = S().render({ preset: p, colors: ground(state.ink, state.role).colors, format: state.format, handle: state.handle, motto: state.motto, fonts: null });
  liveCss.replaceSync(text.match(/<style>(.*?)<\/style>/s)?.[1] ?? '');
  liveRoot.innerHTML = text.replace(/<style>.*?<\/style>/s, '').replace(/<title>.*?<\/title>/s, '');
  const s = liveRoot.firstElementChild;
  s.setAttribute('width', '100%');
  s.setAttribute('height', '100%');
  s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const cur = ed.key === 'whoami' ? `${state.handle || HANDLE} · ${state.motto || MOTTO}` : plain(get(preset(), ed.key));
  live.setAttribute('aria-label', `${FMT_NAME[state.format]} sheet, ${ed.overview ? 'whole sheet, editing' : 'zoomed to'} ${S().nameOf(ed.key)}: ${cur}${ed.preview ? `, previewing ${plain(ed.preview.value)}` : ''}`);
  applyView();
}
const queueLive = () => { if (!liveQueued) liveQueued = requestAnimationFrame(renderLive); };
function fitEdit() {
  const narrow = isNarrow(), cs = getComputedStyle(el.stage), vh = Math.round(window.visualViewport?.height ?? innerHeight);
  const pinned = narrow && vh - insets() >= 560;   // top bar + stage + rail + edit bar, and at least 180px of options
  const total = !narrow ? Math.max(460, innerHeight - 224) : pinned ? Math.max(160, Math.min(Math.round(vh * 0.38), vh - 373 - Math.round(insets()))) : 220;
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
  const { w: W, h: H } = FORMATS[fmt], U = S().GEOM.U(fmt);
  let b = slotBox(key, fmt);
  if (!b) return fullView(fmt);
  if (key !== 'whoami') for (const r of options(key).rows) if (r.ok && r.per[fmt].box) b = union(b, r.per[fmt].box);
  b = { x0: b.x0 - U, y0: b.y0 - U, x1: b.x1 + U, y1: b.y1 + U };
  const px = S().GEOM.px(key, fmt);   // drawn text size
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
  if (ed.hover && ed.hover !== ed.key) { const b = slotBox(ed.hover); if (b) out += brackets(b, s, S().fixedOf(ed.hover) ? 'br fixed' : 'br dash'); }
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
  el.sheet.classList.toggle('can-edit', !!key && !S().fixedOf(key));
  if (!key || (ed.on && key === ed.key)) { pin.hidden = true; if (ed.on) drawOverlay(); else ov.replaceChildren(); return; }
  const b = slotBox(key), fx = S().fixedOf(key);
  if (ed.on) drawOverlay();
  else { ov.setAttribute('viewBox', `${pt.v.x} ${pt.v.y} ${pt.v.w} ${pt.v.h}`); ov.innerHTML = brackets(b, pt.s, fx ? 'br fixed' : 'br'); }
  pin.textContent = fx ? `${fx[0]}: fixed, it ${fx[1]}` : `${S().nameOf(key)} · change`;
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
  openSlot(keys.includes(key) ? key : keys[0], true);
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
function openSlot(key, first) {
  ed.leaving = false;
  ed.key = key; ed.preview = null; ed.query = ''; ed.showBad = false; ed.active = -1; ed.linked = ''; ed.overview = false;
  $('#ep-search').value = '';
  $('#whole').setAttribute('aria-pressed', 'false');
  buildRail(); renderPanel(); labels(); renderLive();
  list.scrollTop = 0;
  if (!first && isNarrow() && !document.body.hasAttribute('data-unpinned')) {   // the page scrolls, not the list: bring the new header back under the rail
    const dy = $('.ep-head').getBoundingClientRect().top - (parseFloat(getComputedStyle(rail).top) + rail.offsetHeight);   // sticky offsets, not the rail's live rect: a shortened container clamps that
    if (dy < 0) scrollBy({ top: dy - 8, behavior: 'instant' });
  }
  moveView(viewFor(key));
}
function stepSlot(d, say) {
  const keys = slotsOf(preset()), i = keys.indexOf(ed.key), k = keys[(i + d + keys.length) % keys.length];
  openSlot(k);
  if (say) announce(`${S().LABEL[k]}, ${keys.indexOf(k) + 1} of ${keys.length}: ${k === 'whoami' ? state.handle || HANDLE : plain(get(preset(), k))}`);
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
  $('#crumb').replaceChildren(h('span', {}, `Vol. ${pad2(e.vol)} · ${volName(e)}`), h('span', { 'aria-hidden': 'true' }, '›'), h('b', {}, S().LABEL[ed.key]));
  $('#eb-label').replaceChildren(`${S().LABEL[ed.key]} `, h('span', { class: 'mono' }, `${keys.indexOf(ed.key) + 1}/${keys.length}`));
}
function editRefresh() {
  if (ed.leaving) return;
  fitEdit(); buildRail(); renderPanel(); labels(); renderLive();
  moveView(ed.overview ? fullView() : viewFor(ed.key));
}
const refit = () => { if (!ed.on || ed.leaving) return; fitEdit(); cancelAnimationFrame(ed.anim); ed.view = ed.overview ? fullView() : viewFor(ed.key); applyView(); keepSearch(); };
const keepSearch = () => { const q = $('#ep-search'); if (isNarrow() && document.activeElement === q) q.scrollIntoView({ block: 'start' }); };   // typing on a phone: results stay above the keyboard

// the rail: every word on the sheet, in reading order; arrows move focus, Enter or Space opens
function buildRail() {
  const p = preset(), g = ground(state.ink, state.role).colors, keys = slotsOf(p), had = rail.contains(document.activeElement);
  rail.replaceChildren(...keys.map((k) => {
    const edited = k === 'whoami' ? !!(state.handle || state.motto) : !same(get(p, k), get(shipped(), k));
    const sw = S().swatch(k, g);
    return h('button', { type: 'button', role: 'tab', class: `rchip bracket${edited ? ' edited' : ''}`, dataset: { key: k }, id: `tab-${k.replace('.', '-')}`,
      'aria-selected': String(k === ed.key), tabindex: k === ed.key ? '0' : '-1', 'aria-controls': 'ep', 'aria-label': `${S().LABEL[k]}${edited ? ', edited' : ''}` },
    sw ? h('i', { class: `sw ${sw.cls}`, style: { '--c': sw.color } }) : null, h('span', {}, S().LABEL[k]));
  }));
  const on = rail.querySelector('[aria-selected="true"]');
  if (on && had) on.focus({ preventScroll: true });
  if (on) rail.scrollTo({ left: on.offsetLeft - rail.clientWidth / 2 + on.offsetWidth / 2, behavior: reduced() ? 'auto' : 'smooth' });
}

// the copy desk: one slot's options
function renderPanel() {
  const key = ed.key, who = key === 'whoami', st = ed.stacks[vkey(vol().id)], was = document.activeElement;
  $('#ep-title').textContent = S().LABEL[key];
  $('#undo').disabled = !st?.undo.length;
  $('#redo').disabled = !st?.redo.length;
  $('#restore').disabled = !E()[vol().id];
  syncClear();
  if (was?.disabled) (['#undo', '#redo'].map($).find((b) => b !== was && !b.disabled) ?? (list.hidden ? rail.querySelector('[aria-selected="true"]') : list)).focus();
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
  const now = a === 'data' ? preset().phone?.data?.[key.slice(5)] ?? o.now : o.now, max = a === 'data' ? S().phoneCap?.(preset(), key) ?? S().LIMITS.phone : S().limitOf(key);
  fill($('#ep-meta'),
    o.lock ? h('span', { class: 'tape tape-pencil', title: 'Set by the volume' }, o.lock.trim()) : null,
    h('span', {}, `${fits} ${fits === 1 ? 'option fits' : 'options fit'}`),
    h('span', { class: 'mono' }, a === 'phrase' ? `${S().LIMITS.phrase} per line` : Array.isArray(now) ? now.map((v, i) => `${len(v)}/${S().limitOf(key, i)}`).join(' · ')   // a pair: text, code
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
  tgl.querySelector('span').textContent = bad.length;   // the number is the data; the label is the name
  nameBtn(tgl, `${ed.showBad ? 'Hide' : 'Show'} ${bad.length} that won’t fit`);
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
    ? ed.key === 'phrase' ? h('span', { class: `ot ph v-${S().voice}`, id: `ot-${i}` }, r.value.flatMap((l, k) => (k ? [h('br'), l] : [l])))
      : h('span', { class: 'ot', id: `ot-${i}` }, r.value[0], ' ', h('span', { class: 'lk' }, r.value[1]))
    : h('span', { class: 'ot', id: `ot-${i}` }, lock && r.value.startsWith(lock) ? [h('span', { class: 'lk' }, lock), r.value.slice(lock.length)] : r.value);
  const fmts = r.per && !r.ok ? h('span', { class: 'fmts', 'aria-hidden': 'true' }, FMTS.map((f) => h('i', { class: `${f[0]}${r.per[f].ok ? '' : ' bad'}` }))) : null;
  return h('div', { role: 'option', class: 'orow', id: `opt-${i}`, dataset: { i: String(i) }, 'aria-selected': String(r.applied), 'aria-disabled': dis ? 'true' : null, 'aria-labelledby': `ot-${i}`, 'aria-describedby': `optd-${i}` },
    body,
    h('span', { class: 'on', 'aria-hidden': 'true' }, r.code ? h('span', { class: 'tape' }, r.code) : null, fmts, Array.isArray(r.value) ? null : h('span', { class: 'mono' }, String(len(r.value)))),
    h('span', { class: 'om', id: `optd-${i}` }, dis ? h('span', { class: 'why' }, r.why) : r.meaning ?? '', h('span', { class: 'sr' }, r.ok ? ' Fits desktop, wide and phone.' : '')));
}
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
  commit(next, `${S().LABEL[key]} changed`, before);
  ed.linked = linkedNote({ key, before, after: preset(), shipped: shipped(), entry: vol(), value: r.value });
  renderPanel();
}
function commit(next, msg, before = preset()) {
  commitStack(ed.stacks, vkey(vol().id), before, next, msg);
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
function undo() {
  const x = undoStack(ed.stacks, vkey(vol().id));
  if (!x) return;
  ed.linked = '';
  setPreset(x.before);
  tell('Undone', x.msg);
}
function redo() {
  const x = redoStack(ed.stacks, vkey(vol().id));
  if (!x) return;
  ed.linked = '';
  setPreset(x.after);
  tell('Redone', x.msg);
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

  function wire() {
    let hoverRaf = 0;
    el.sheet.addEventListener('pointermove', (ev) => {
      if (ev.pointerType !== 'mouse' || state.view !== 'sheet' || !fine() || !data.fonts) return;
      cancelAnimationFrame(hoverRaf);
      hoverRaf = requestAnimationFrame(() => { const pt = sheetPoint(ev), k = hitAt(pt.x, pt.y, 8 / pt.s); if (k !== ed.hover) setHover(k, pt); });
    });
    el.sheet.addEventListener('pointerleave', () => { cancelAnimationFrame(hoverRaf); if (ed.hover) setHover(null); });
    el.sheet.addEventListener('click', (ev) => {
      if (state.view !== 'sheet' || ev.target.closest('.ruler') || !data.fonts) return;
      const pt = sheetPoint(ev), key = hitAt(pt.x, pt.y, (fine() ? 8 : 44) / pt.s), fx = S().fixedOf(key);
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
    $('#ep-search').addEventListener('focus', keepSearch);
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
  }
  wire();

  return { ed, cache, enterEdit, exitEdit, closeEdit, editKeys, editRefresh, fitEdit, refit, setHover, slotBox, syncWho, openSlot, undo, liveFonts };
}
