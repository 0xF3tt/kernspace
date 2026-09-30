// The word editor's logic, without the DOM: which words a sheet can take in each slot, and whether they fit.
// Options come from the volume's own lexicon (topics/<topic>.json). A term with a `mat` hint is offered only in
// the slots it names, written as its `mat.as` form; a term without one is offered by its word type. Every
// option is checked against the slot table and the overlap checker (app/check.js) in desktop, wide and phone.
import { ANGLES, LIMITS, family, get, len, overlaps, quickFits, slotRules, withSlot } from './check.js';

export const FMTS = ['desktop', 'wide', 'phone'];
export const SLOTS = [
  ['phrase', 'Phrase'], ['source', 'Source'], ['controls.0', 'ISB-01 control'], ['controls.1', 'ISB-02 control'], ['sink', 'Sink'],
  ['flows.0', '60° flow'], ['flows.1', '30° flow'], ['flows.2', '15° flow'],
  ['findings.0', 'Finding 1'], ['findings.1', 'Finding 2'], ['findings.2', 'Finding 3'],
  ['notes.0', 'Note 1'], ['notes.1', 'Note 2'], ['notes.2', 'Note 3'], ['data.left', 'Status line'], ['whoami', '# whoami'],
];
export const LABEL = Object.fromEntries(SLOTS);
// the lexicon's `mat.slots` names, per slot family
const MAT = { source: 'source', sink: 'sink', controls: 'control', flows: 'flow', findings: 'finding', notes: 'note', data: 'status' };
// word types offered by type when a term has no `mat` hint
const TYPES = { source: ['term', 'artifact', 'filename'], sink: ['term', 'artifact', 'filename'], flows: ['term', 'artifact', 'filename'], controls: ['term', 'artifact', 'snippet'], findings: ['id', 'term'], notes: ['quote', 'term', 'number'], data: ['status-line'] };
// what stays fixed, and why
export const FIXED = { label: ['Side label', 'names the volume'], panel: ['Terminal panel', 'tells one story in its title and lines'], 'data.right': ['Prompt line', 'shows your handle and the volume’s side of the loop'] };
export const fixedOf = (key) => (key === 'label' ? FIXED.label : key?.startsWith('panel') ? FIXED.panel : key === 'data.right' ? FIXED['data.right'] : null);
export const nameOf = (key) => LABEL[key] ?? LABEL[family(key)] ?? fixedOf(key)?.[0] ?? 'another label';

export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const plain = (v) => (Array.isArray(v) ? v.join(' ') : v);
const norm = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const union = (a, b) => (a && b ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : a ?? b);

// the slots this preset draws, in reading order ('whoami' is the viewer's own box)
export const slotsOf = (p) => SLOTS.map(([k]) => k).filter((k) => k === 'whoami' || get(p, k) != null);

// the part of a slot the volume fixes: the flow's angle, the role before a source or sink ("actor · ")
export function lockOf(key, shipped) {
  const a = family(key), v = get(shipped, key);
  if (a === 'flows') return `${ANGLES[+key.split('.')[1]]}° · `;
  if ((a === 'source' || a === 'sink') && v.includes(' · ')) return v.slice(0, v.indexOf(' · ') + 3);
  return '';
}

// a phrase on one line, or split at a space into two: after punctuation first, then the most even split
export function wrapPhrase(q, max = LIMITS.phrase) {
  const t = q.trim();
  if (len(t) <= Math.min(max, 15)) return [t];
  const words = t.split(' '), cuts = [];
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    if (len(a) <= max && len(b) <= max) cuts.push({ a, b, punct: /[,;:.?!]$/.test(a), long: Math.max(len(a), len(b)) });
  }
  cuts.sort((x, y) => (y.punct - x.punct) || (x.long - y.long));
  return cuts.length ? [cuts[0].a, cuts[0].b] : len(t) <= max ? [t] : null;
}

// withSlot, except that the shipped status line brings back its own shorter phone line
export function put(p, key, v, shipped) {
  const q = withSlot(p, key, v), b = key.slice(5);
  if (key.startsWith('data.') && v === shipped.data?.[b] && shipped.phone?.data?.[b] != null) q.phone = { ...q.phone, data: { ...q.phone?.data, [b]: shipped.phone.data[b] } };
  return q;
}

// every other string on the sheet: the checker maps texts by string, so a word may appear once
export function usedStrings(p, key) {
  const m = new Map(), add = (v, where) => v != null && !m.has(v) && m.set(v, where);
  for (const k of slotsOf(p)) if (k !== key && k !== 'whoami' && k !== 'phrase') add(get(p, k), LABEL[k]);
  if (key !== 'phrase') p.phrase.forEach((v) => add(v, 'the phrase'));
  add(p.label, 'the side label'); add(p.panel?.title, 'the terminal panel');
  p.panel?.lines?.forEach((v) => add(v, 'the terminal panel'));
  for (const [k, v] of Object.entries(p.phone?.data ?? {})) if (key !== `data.${k}`) add(v, 'the phone status line');
  return m;
}

// every value a slot may take, before any fit check: the shipped words, the lexicon, and for the phrase its
// phrases and quotes plus the other volumes' phrases. It depends on the volume, not on the current edits.
export function pool({ entry, key, shipped, lexicon, index, presets }) {
  const a = family(key), lock = lockOf(key, shipped), out = [], seen = new Set();
  const add = (value, o) => {
    const k = norm(plain(value)).replace(/[.!?]+$/, '');
    if (value == null || seen.has(k)) return;
    seen.add(k);
    out.push({ value, ...o });
  };
  add(get(shipped, key), { group: 'shipped', meaning: `The words ${entry.title.replace(/ · .*/, '')} shipped with.` });
  const terms = lexicon?.terms ?? [];
  if (a === 'phrase') {
    for (const t of terms) if (t.type === 'phrase' || t.type === 'quote') {
      const w = wrapPhrase(t.text);
      if (w) add(w, { group: 'lexicon', meaning: t.meaning, reference: t.reference });
    }
    for (const x of index) if (x.id !== entry.id && presets[x.id]) add(presets[x.id].phrase, { group: 'volumes', meaning: `From ${x.title}.` });
    return out;
  }
  const slot = MAT[a], iconic = (t) => (t.fame === 'iconic' ? 0 : 1);
  const hinted = terms.filter((t) => t.mat?.slots?.includes(slot)).sort((x, y) => iconic(x) - iconic(y));
  const typed = terms.filter((t) => !t.mat && TYPES[a].includes(t.type)).sort((x, y) => iconic(x) - iconic(y));
  for (const [group, list] of [['suggested', hinted], ['more', typed]]) for (const t of list) {
    const text = group === 'suggested' ? t.mat.as || t.text : t.text;
    add(lock + text, { group, code: t.code && t.code !== t.text ? t.code : '', meaning: t.meaning });
    if (a === 'findings' && t.type === 'id' && t.code && t.code !== t.text) add(t.code, { group, meaning: `${t.text}: ${t.meaning}` });
  }
  return out;
}

// does a value fit this slot in each format? { desktop, wide, phone }: { ok, box } or { ok: false, box, hit }.
// prepared(fmt) is the caller's cached prepare(current, fmt).
export function fitsAll(current, key, value, shipped, prepared) {
  const per = {};
  for (const f of FMTS) {
    const drawn = f === 'phone' && key.startsWith('data.') ? put(current, key, value, shipped).phone?.data?.[key.slice(5)] ?? value : value;
    let r = key === 'phrase' ? phraseFits(current, f, value, prepared) : quickFits(prepared(f), key, drawn);
    if (r === null) {
      const bad = overlaps(put(current, key, value, shipped), f, { handles: [''], mottos: [''] });
      r = bad.length ? { ok: false, hit: { what: 'full', name: bad[0] } } : { ok: true };
    }
    per[f] = r;
  }
  return per;
}
// the phrase line by line, on a scene prepared with the same number of lines (a one-line phrase sits lower)
function phraseFits(current, f, value, prepared) {
  if (value.length !== current.phrase.length) return null;
  let box = null;
  for (const [i, line] of value.entries()) {
    const r = quickFits(prepared(f), `phrase.${i}`, line);
    if (!r?.ok) return r;
    box = union(box, r.box);
  }
  return { ok: true, box };
}

// a failed option, in the interface's words
export function reason(r) {
  if (r.where) return `Already on ${r.where}.`;
  if (r.rules.length) {
    const x = r.rules[0], m = x.match(/^(\d+)\/(\d+)$/);
    return m ? `${m[1]} characters; this slot holds ${m[2]}.` : x === 'glyph' ? 'The sheet’s font lacks one of its characters.' : 'Breaks the slot rules.';
  }
  const bad = FMTS.filter((f) => !r.per[f].ok);
  if (!bad.length) return '';
  const h = r.per[bad[0]].hit;
  const what = h.what === 'text' ? `runs into ${h.slot ? nameOf(h.slot) : 'a ruler'}`
    : h.what === 'shape' ? `runs into ${h.name}` : h.what === 'edge' ? `crosses ${h.name}`
    : h.what === 'clock' ? 'reaches the lock-screen clock' : h.what === 'home' ? 'is too long for its panel'
    : /does not fit inside its panel/.test(h.name) ? 'is too wide for the phrase panel' : 'collides with another mark';
  const names = { desktop: 'Desktop', wide: 'Wide', phone: 'Phone' };
  return `${what.charAt(0).toUpperCase()}${what.slice(1)} on ${bad.map((f) => names[f]).join(', ')}.`;
}

// the option rows for one slot of the current sheet: each with applied, rules, where (a clash with another
// slot's words), per-format fit, ok and why
export function options({ entry, key, shipped, current, lexicon, index, presets, prepared }) {
  const a = family(key), now = get(current, key), used = usedStrings(current, key);
  const rows = pool({ entry, key, shipped, lexicon, index, presets }).map((r) => ({ ...r }));
  if (!rows.some((r) => same(r.value, now))) rows.splice(1, 0, { value: now, group: 'shipped', meaning: 'Your current words.' });
  for (const r of rows) {
    r.applied = same(r.value, now);
    // the shipped status line is longer than the phone's cap on purpose: it brings its own phone line back
    r.rules = a === 'data' && same(r.value, get(shipped, key)) ? [] : slotRules(current, key, r.value);
    r.where = r.applied ? undefined : [r.value].flat().map((l) => used.get(l)).find(Boolean);
    r.per = !r.rules.length && !r.where ? fitsAll(current, key, r.value, shipped, prepared) : null;
    r.ok = !r.rules.length && !r.where && FMTS.every((f) => r.per[f].ok);
    r.why = reason(r);
    r.search = norm(`${plain(r.value)} ${r.code ?? ''} ${r.meaning ?? ''}`);
  }
  return rows;
}

// the full guard before a word is applied: every format, with the viewer's whoami box
export const guard = (next, handle = '', motto = '') =>
  FMTS.flatMap((f) => overlaps(next, f, { handles: [...new Set(['', handle])], mottos: [...new Set(['', motto])] }));

// the edited slots of a sheet, compared with how it shipped
export const changedSlots = (current, shipped) => slotsOf(shipped).filter((k) => k !== 'whoami' && !same(get(current, k), get(shipped, k)));

// the old word may live on elsewhere on the sheet: say where, change nothing
const STORY = /CWE-639|CWE-862|BOLA|IDOR|API1:2023|A01:2025|#0001/;
export function linkedNote({ key, before, after, shipped, entry, value }) {
  if (key === 'phrase') return '';
  const old = String(get(before, key)).slice(lockOf(key, shipped).length).trim();
  if (len(old) < 3) return '';
  const re = new RegExp(`(^|[\\s·:()\\[\\],])${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[\\s·:()\\[\\],.])`, 'i'), where = new Set();
  for (const k of slotsOf(after)) if (k !== key && k !== 'whoami' && k !== 'phrase' && re.test(get(after, k))) where.add(LABEL[k]);
  if ([after.panel?.title, ...(after.panel?.lines ?? [])].some((v) => v && re.test(v))) where.add('the terminal panel');
  let note = where.size ? `“${old}” also appears in ${[...where].join(', ')}. Those keep their words.` : '';
  if (entry.vol <= 3 && (STORY.test(old) || STORY.test(plain(value)))) note += `${note ? ' ' : ''}Vols 01 to 03 tell one bug story, and the other two still tell it as shipped.`;
  return note;
}
