// The word editor's logic, without the DOM: which words a sheet can take in each slot, and whether they fit.
// Options come from the volume's own lexicon (topics/<topic>.json). A term with a hint for the series (`mat` for
// Cutting Mat, `spec` for Specimen) is offered only in the slots it names, written as its `as` form; a term
// without one is offered by its word type. Every option is checked against the slot table and the overlap checker
// (app/check.js) in desktop, wide and phone. What is series-specific (which slots, which words, how a value is
// drawn and fitted, what stays fixed, how a failure reads) comes from the series' rules module.
import { family, get, len, overlaps, slotRules } from './check.js';
import { SERIES } from './series/index.js';

const ser = (p) => SERIES[p.series];

export const FMTS = ['desktop', 'wide', 'phone'];
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const plain = (v) => (Array.isArray(v) ? v.join(' ') : v);
const norm = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// the slots this preset draws, in reading order ('whoami' is the viewer's own box)
export const slotsOf = (p) => ser(p).slotsOf(p);
export const wrapPhrase = (q, max) => SERIES['cutting-mat'].wrapPhrase(q, max);   // Cutting Mat's phrase panel only

// withSlot, except that the shipped status line brings back its own shorter phone line
export const put = (p, key, v, shipped) => ser(p).put(p, key, v, shipped);

// every value a slot may take, before any fit check: the shipped words, the lexicon, and for the phrase its
// phrases and quotes plus the other volumes' phrases. It depends on the volume, not on the current edits.
export function pool({ entry, key, shipped, lexicon, index, presets }) {
  const S = ser(shipped), out = [], seen = new Set();
  const add = (value, o) => {
    const k = norm(plain(value)).replace(/[.!?]+$/, '');
    if (value == null || seen.has(k)) return;
    seen.add(k);
    out.push({ value, ...o });
  };
  add(get(shipped, key), { group: 'shipped', meaning: `The words ${entry.title.replace(/ · .*/, '')} shipped with.` });
  const terms = lexicon?.terms ?? [];
  if (S.poolOf?.(key, { entry, terms, index, presets, add })) return out;      // a slot with a pool of its own
  const { slot, types } = S.kindsOf(key), iconic = (t) => (t.fame === 'iconic' ? 0 : 1);
  const hinted = terms.filter((t) => t[S.hint]?.slots?.includes(slot)).sort((x, y) => iconic(x) - iconic(y));
  const typed = terms.filter((t) => !t[S.hint] && types.includes(t.type)).sort((x, y) => iconic(x) - iconic(y));
  for (const [group, list] of [['suggested', hinted], ['more', typed]]) for (const t of list) for (const o of S.offer(key, t, group === 'suggested', shipped))
    add(o.value, { group, code: o.code ?? (t.code && t.code !== t.text ? t.code : ''), meaning: o.meaning ?? t.meaning });
  return out;
}

// does a value fit this slot in each format? { desktop, wide, phone }: { ok, box } or { ok: false, box, hit }.
// prepared(fmt) is the caller's cached prepare(current, fmt).
export function fitsAll(current, key, value, shipped, prepared) {
  const S = ser(current), per = {};
  for (const f of FMTS) {
    let r = S.fits(current, f, key, value, shipped, prepared);                  // null: only the full checker can tell
    if (r === null) {
      const bad = overlaps(put(current, key, value, shipped), f, { handles: [''], mottos: [''] });
      r = bad.length ? { ok: false, hit: { what: 'full', name: bad[0] } } : { ok: true };
    }
    per[f] = r;
  }
  return per;
}
// a failed option, in the interface's words
export function reason(r, S) {
  if (r.where) return `Already on ${r.where}.`;
  if (r.rules.length) {
    const x = r.rules[0], m = x.match(/^(\d+)\/(\d+)$/);
    return m ? `${m[1]} characters; this slot holds ${m[2]}.` : x === 'glyph' ? 'The sheet’s font lacks one of its characters.' : 'Breaks the slot rules.';
  }
  const bad = FMTS.filter((f) => !r.per[f].ok);
  if (!bad.length) return '';
  const h = r.per[bad[0]].hit;
  const what = S.why(h);
  const names = { desktop: 'Desktop', wide: 'Wide', phone: 'Phone' };
  return `${what.charAt(0).toUpperCase()}${what.slice(1)} on ${bad.map((f) => names[f]).join(', ')}.`;
}

// the option rows for one slot of the current sheet: each with applied, rules, where (a clash with another
// slot's words), per-format fit, ok and why
export function options({ entry, key, shipped, current, lexicon, index, presets, prepared }) {
  const S = ser(shipped), a = family(key), now = get(current, key), used = S.usedStrings(current, key);
  const rows = pool({ entry, key, shipped, lexicon, index, presets }).map((r) => ({ ...r }));
  if (!rows.some((r) => same(r.value, now))) rows.splice(1, 0, { value: now, group: 'shipped', meaning: 'Your current words.' });
  for (const r of rows) {
    r.applied = same(r.value, now);
    // the shipped status line is longer than the phone's cap on purpose: it brings its own phone line back
    r.rules = a === 'data' && same(r.value, get(shipped, key)) ? [] : slotRules(current, key, r.value);
    r.where = r.applied ? undefined : [r.value].flat().map((l) => used.get(l)).find(Boolean);
    r.per = !r.rules.length && !r.where ? fitsAll(current, key, r.value, shipped, prepared) : null;
    r.ok = !r.rules.length && !r.where && FMTS.every((f) => r.per[f].ok);
    r.why = reason(r, S);
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
export function linkedNote({ key, before, after, shipped, entry, value }) {
  const S = ser(shipped), old = S.oldWord(before, key, shipped);
  if (len(old) < 3) return '';
  const re = new RegExp(`(^|[\\s·:()\\[\\],])${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[\\s·:()\\[\\],.])`, 'i'), where = S.elsewhere(after, key, re);
  let note = where.length ? `“${old}” also appears in ${where.join(', ')}. Those keep their words.` : '';
  const story = S.story(entry, old, plain(value));
  if (story) note += `${note ? ' ' : ''}${story}`;
  return note;
}
