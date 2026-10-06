// Lexicon lint, no browser needed:  node app/lexicon.test.mjs
// Checks every topics/<slug>.json against the rules in topics/README.md and CONTRIBUTING.md: shape, allowed values, limits, duplicates.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const file = path => new URL(`../${path}`, import.meta.url);
const json = path => JSON.parse(readFileSync(file(path), 'utf8'));
const len = s => [...s].length;                       // code points: "·" and "→" count once

const TYPES = ['id', 'term', 'framework', 'tool', 'artifact', 'status-line', 'filename', 'number', 'quote', 'snippet', 'phrase'];
const FAME = ['iconic', 'niche'], SERIES = ['cutting-mat', 'specimen', 'galley-proof', 'catalog-card'];
const KEYS = ['text', 'type', 'code', 'meaning', 'fame', 'reference', 'series', 'mat', 'spec', 'galley', 'card'];
const REQUIRED = ['text', 'type', 'code', 'meaning', 'fame', 'series'];          // `reference` may be empty or absent (status lines)
const GALLEY_SLOTS = ['note', 'status', 'errata'];                             // what a `galley` hint may name (the series' HINTS)
const CARD_SLOTS = ['subject', 'added', 'see', 'status'];                     // what a `card` hint may name
const SEE_FORM = /^\S.* · \S.*$/;                                              // a see-also reads NAME · ID
const TEXT_MAX = 38, MEANING_MAX = 120, CONTROL = /[\u0000-\u001F\u007F-\u009F]/, EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;

// every problem one term has
function problems(t) {
  const p = [], text = (k) => typeof t[k] === 'string' && t[k] === t[k].trim();
  for (const k of Object.keys(t)) if (!KEYS.includes(k)) p.push(`unknown key "${k}"`);
  for (const k of REQUIRED) if (!(k in t)) p.push(`missing "${k}"`);
  if (!text('text') || !len(t.text) || len(t.text) > TEXT_MAX) p.push(`text must be 1–${TEXT_MAX} characters, with no stray spaces`);
  if (!text('meaning') || !t.meaning) p.push('meaning must be a non-empty line, with no stray spaces');
  else if (len(t.meaning) > MEANING_MAX) p.push(`meaning is ${len(t.meaning)} characters, max ${MEANING_MAX}`);
  if (typeof t.code !== 'string') p.push('code must be a string (empty when there is none)');
  if ('reference' in t && typeof t.reference !== 'string') p.push('reference must be a string');
  if (!TYPES.includes(t.type)) p.push(`type "${t.type}" is not one of ${TYPES.join(', ')}`);
  if (!FAME.includes(t.fame)) p.push(`fame "${t.fame}" is not iconic or niche`);
  if (!Array.isArray(t.series) || !t.series.length || new Set(t.series).size !== t.series.length || t.series.some(s => !SERIES.includes(s))) p.push(`series must be a list of unique values from ${SERIES.join(', ')}`);
  for (const h of ['mat', 'spec', 'galley', 'card']) {
    if (!(h in t)) continue;
    const v = t[h], ok = v && typeof v === 'object' && Array.isArray(v.slots) && v.slots.every(s => typeof s === 'string')
      && Object.keys(v).every(k => k === 'slots' || k === 'as') && (!('as' in v) || typeof v.as === 'string');
    if (!ok) p.push(`${h} must be { "slots": [...], "as"?: "..." }`);
    else if (h === 'galley' && v.slots.some(x => !GALLEY_SLOTS.includes(x))) p.push(`galley.slots must be from ${GALLEY_SLOTS.join(', ')}`);
    else if (h === 'card') {
      if (v.slots.some(x => !CARD_SLOTS.includes(x))) p.push(`card.slots must be from ${CARD_SLOTS.join(', ')}`);
      if (v.slots.length && Array.isArray(t.series) && !t.series.includes('catalog-card')) p.push('a card hint needs catalog-card in series');
      if (v.slots.includes('see') && !SEE_FORM.test(v.as || t.text)) p.push('a see hint must read NAME · ID');
    }
  }
  const strings = JSON.stringify(t), values = [t.text, t.code, t.meaning, t.reference, t.mat?.as, t.spec?.as, t.galley?.as, t.card?.as, ...(Array.isArray(t.series) ? t.series : [])];
  if (values.some(v => typeof v === 'string' && CONTROL.test(v))) p.push('control character');
  if (EMAIL.test(strings)) p.push('looks like an email address: public terminology only');
  return p;
}

// ---------- every lexicon
const slugs = readdirSync(file('topics')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
const bad = []; let count = 0;
for (const slug of slugs) {
  const d = json(`topics/${slug}.json`);
  assert.equal(d.topic, slug, `topics/${slug}.json: "topic" must be "${slug}"`);
  assert.ok(Array.isArray(d.terms) && d.terms.length, `topics/${slug}.json: "terms" must be a non-empty list`);
  const seen = new Set();
  for (const t of d.terms) {
    count++;
    const ps = problems(t);
    const key = JSON.stringify([t.text, t.code, t.type]);
    if (seen.has(key)) ps.push('duplicate: same text, code and type as another term in this topic');
    seen.add(key);
    for (const x of ps) bad.push(`topics/${slug}.json "${t.text}": ${x}`);
  }
}
assert.deepEqual(bad, [], `\n${bad.join('\n')}\n`);

// ---------- the lint itself: each broken term must be caught
const ok = { text: 'Term', type: 'term', code: '', meaning: 'One line.', fame: 'niche', reference: '', series: ['specimen'] };
assert.deepEqual(problems(ok), [], 'a minimal valid term');
const broken = {
  'text too long': { ...ok, text: 'x'.repeat(TEXT_MAX + 1) }, 'empty text': { ...ok, text: '' }, 'stray space': { ...ok, text: ' Term' },
  'meaning too long': { ...ok, meaning: 'x'.repeat(MEANING_MAX + 1) }, 'unknown type': { ...ok, type: 'word' }, 'unknown fame': { ...ok, fame: 'famous' },
  'no series': { ...ok, series: [] }, 'unknown series': { ...ok, series: ['poster'] }, 'repeated series': { ...ok, series: ['specimen', 'specimen'] },
  'missing meaning': (({ meaning, ...r }) => r)(ok), 'unknown key': { ...ok, color: 'red' }, 'email': { ...ok, meaning: 'Mail me@example.com' },
  'control character': { ...ok, meaning: 'Line\nbreak' }, 'bad hint': { ...ok, mat: { slots: 'finding' } }, 'extra hint key': { ...ok, spec: { slots: [], wide: true } },
  'bad galley hint': { ...ok, galley: { slots: 'note' } }, 'unknown galley slot': { ...ok, galley: { slots: ['finding'] } },
  'bad card hint': { ...ok, series: ['catalog-card'], card: { slots: 'subject' } }, 'unknown card slot': { ...ok, series: ['catalog-card'], card: { slots: ['finding'] } },
  'card hint without the tag': { ...ok, card: { slots: ['subject'] } }, 'see hint without NAME · ID': { ...ok, series: ['catalog-card'], card: { slots: ['see'] } },
};
for (const [name, t] of Object.entries(broken)) assert.ok(problems(t).length, `the lint should catch: ${name}`);

console.log(`ok · ${slugs.length} lexicons, ${count} terms · shape, allowed values, limits and duplicates checked · lint catches ${Object.keys(broken).length} kinds of broken term`);
