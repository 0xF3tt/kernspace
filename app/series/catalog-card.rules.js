// Catalog Card's rules: the overlap checker's scene and collisions, the slot table and the word editor's slot pieces, the
// "Read the card" marks and the editor's geometry. app/series/index.js registers them with the renderer.
// The checker rebuilds, from a rendered sheet, a box for every text, every paper (card stock, in `pp` order) and every mark a text
// could touch (the header rule, the stamp box, the strike, the clip, the rivets, the slip's rules, the rod hole, the whoami box),
// then checks, for one preset in one format:
//   1. no two texts overlap
//   2. a text stays inside its own paper's inner box (the card's text column, its guide tab, the see-also card, the blank guide, the slip or
//      its date cell, the label holder, the whoami box); a header text (call number, entry, stamp) sits above the header line and a body
//      text below it; the definition takes two lines at most (by defLines and by the drawn count)
//   3. no paper drawn after a text's own covers it; the see-also card keeps 16px from a tab's shape, the main card 4
//   4. the strike runs through the struck word (it must be in the collation; checkCard holds it to a whole token) at strike-through height, and the pencil
//      is centred on it
//   5. the rod hole is centred on the card and 24px from every text but its caption, which is centred on it, a fixed gap below the ring
//   6. the stamp's text stays inside its box (their shared frame), the box stays 4px off the header line and inside the card's face
//   7. a tracing term stays inside its column and a numeral or term sits on its grid x (the grid comes from GEOMETRY, never from the words)
//   8. no text comes within 4px of a mark it does not own (the header rule, the stamp box, the strike, the clip, a rivet, the slip's rules,
//      the whoami box)
//   9. the whoami box keeps 16px from every paper and mark
//  10. everything stays on the canvas and out of the keep-clear zones: desktop and wide the menu bar (top 110px) and the Dock (1300x220,
//      bottom centre); phone the clock (y < 932) and the bottom 260px; on the phone the phrase and the pencil end above y 2215
// Every rule that judges one text is in broken(), which collisions() runs over every text and quickFits() over the one the editor changes,
// so the editor's fast path and the full checker cannot disagree. Every text is named by class and order (`call 2`, `def 1`, `date 3`,
// `num II.`), never by string; only the editable texts map to a slot by string. Boxes, tolerance and colors: app/boxes.js.
import { FORMATS, HANDLE } from '../render.js';
import { CLASSES, GEOMETRY, HEADS, defLines, render, stamp, view } from './catalog-card.js';
import { INK, PROBE, ROLE, TOL, attrs, classes, fail, family, glyphs, hits, hull, len, quad, reBox, transform, unesc, union, width, within } from '../boxes.js';
export { poolOf } from './cutting-mat.rules.js';

const ADV = 0.6, APART = 4, ROD = 24, WHO = 16, NOTIF = 2215, NUMERALS = ['I.', 'II.'];
const drawnRight = (s, handle) => s?.replaceAll('{handle}', handle || HANDLE);
const box = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 }), shrink = (b, d) => box(b.x0 + d, b.y0 + d, b.x1 - d, b.y1 - d);
const home = (b, name) => ({ ...b, name, q: quad(b.x0, b.y0, b.x1, b.y1) });   // an inner box a text must stay inside, named for the editor's messages

// the known ID shapes (a typo net: the source list is the real check), one list for call numbers and see-also IDs
export const ID = [/^A\d\d:2025$/, /^LLM\d\d:2026$/, /^API\d+:2023$/, /^CWE-\d+$/, /^CAPEC-\d+$/, /^TA\d{4}$/, /^T\d{4}(\.\d{3})?$/, /^M\d{4}$/, /^AML\.T\d{4}$/, /^MASWE-\d{4}$/, /^MASVS-[A-Z]+-\d$/,
  /^SP 800-\d+[A-Z]?(-\d+|r\d+)?$/, /^NIST IR \d+$/, /^FIPS \d+(-\d)?$/, /^RFC \d+$/, /^[A-Z]{2}\.[A-Z]{2}-\d\d$/, /^P[OSWR]\.\d+(\.\d+)?$/, /^[A-Z]{2}-\d+(\(\d+\))?$/, /^A\.[5-8]\.\d{1,2}$/,
  /^[A-Z]{3}-\d\d$/, /^V\d+\.\d+\.\d+$/, /^D3-[A-Z]+$/, /^WSTG-[A-Z]+-\d\d$/, /^[A-Z]{3}\d\d-[A-Z]+$/];
export const isId = (t) => ID.some((re) => re.test(t));
const seeParts = (s) => s.match(/^(\S.*) · (\S.*)$/);
// the fixed fields' limits: [fewest, most, characters each] (the editable ones are in LIMITS)
export const SCHEMA = { phrase: [1, 2, 18], drawer_label: [1, 1, 20], guide_tabs: [4, 4, 14], call_number: [3, 3, 12], main_entry: [1, 1, 20], definition: [1, 1, 110], collation: [1, 1, 44],
  correction_struck: [1, 1, 18], correction_new: [1, 1, 18], notes: [1, 2, 44], rod_invariant: [1, 1, 28], tracings_subject: [2, 4, 20], tracings_added: [1, 2, 20], see_also: [1, 2, 24],
  circulation_dates: [3, 5, 18], label: [1, 1, 42] };

// drawn string -> { key, name } for the editable and named texts, plus the facts of the preset the sheet cannot show (`facts`: the definition's
// line count by defLines, where the struck word sits in the collation). The phrase is one line on desktop and wide, phrase.0 and phrase.1 on the phone.
export function slotNames(p, fmt, handle = '') {
  const m = new Map(), put = (s, key, name = key) => s != null && !m.has(s) && m.set(s, { key, name }), v = view(p, fmt);
  if (fmt === 'phone') p.phrase.forEach((s, i) => put(s, `phrase.${i}`, `phrase[${i}]`)); else put(p.phrase.join(' '), 'phrase');
  v.tracings_subject.forEach((s, i) => put(s, `tracings_subject.${i}`, `subject ${i + 1}`));
  v.tracings_added.forEach((s, i) => put(s, `tracings_added.${i}`, `added ${NUMERALS[i]}`));
  v.see_also.forEach((s, i) => put(s, `see_also.${i}`, `see-also ${i + 1}`));
  put(p.data?.left, 'data.left', 'status line left'); put(drawnRight(v.right, handle), 'data.right', 'status line right'); put(p.label, 'label', 'side label');
  const at = p.collation.indexOf(p.correction_struck);
  return Object.assign(m, { facts: { defs: defLines(p, fmt).length, struck: at < 0 ? null : { at, n: len(p.correction_struck) } } });
}

const TAGS = ['svg', 'title', 'style', 'rect', 'line', 'circle', 'path', 'text'];
const FAMILY = { phr: 'phrase', trs: 'tracings_subject', tra: 'tracings_added', see: 'see_also', d: 'data', vl: 'label' };   // the classes whose texts the editor can name by string
const MAIN = new Set(['call', 'entry', 'stamp', 'def', 'coll', 'pen', 'note', 'num', 'trs', 'tra', 'cap']);   // drawn on the main card
const HEADER = new Set(['call', 'entry', 'stamp']);
const role = (c) => (c === 'none' || c == null ? null : ROLE[c] ?? fail(`overlap checker: unknown color ${c}`));
const turn = (a) => a.transform?.match(/translate\((-?[\d.]+),(-?[\d.]+)\)/)?.slice(1).map(Number);

// every text, paper and mark of one rendered sheet, as named boxes. Papers are the `pp` elements, named by their order; marks by tag and role.
export function scene(svg, slots) {
  const head = svg.match(/<svg[^>]*width="(\d+)" height="(\d+)"/) ?? fail('overlap checker: sheet structure changed'), W = +head[1], H = +head[2];
  const fmt = Object.keys(FORMATS).find((k) => FORMATS[k].w === W && FORMATS[k].h === H) ?? fail(`overlap checker: no format of ${W}x${H}`), g = GEOMETRY[fmt];
  const css = classes(svg), body = svg.replace(/<defs>.*?<\/defs>/s, '');
  for (const [, tag] of body.matchAll(/<([a-zA-Z]+)/g)) if (!TAGS.includes(tag)) fail(`overlap checker: unknown element <${tag}>`);
  const els = [...body.slice(body.indexOf('</style>') + 8).matchAll(/<(rect|line|circle|path)\b([^>]*)\/>|<text\b([^>]*)>([^<]*)<\/text>/g)]
    .map((m) => (m[4] != null ? { tag: 'text', a: attrs(m[3]), str: unesc(m[4]) } : { tag: m[1], a: attrs(m[2]) }));
  const bg = els.shift();
  if (!(bg?.tag === 'rect' && bg.a.x === '0' && bg.a.y === '0' && +bg.a.width === W && !bg.a.stroke)) fail('overlap checker: sheet structure changed');

  // papers, in the renderer's fixed order: the walls, each guide (its path, then the plain card behind the next), then the see-also card, the main card,
  // the plain front card, the blank front guide, the drawer front, the label plate, the label holder and the slip
  const pp = els.filter((e) => e.a.class === 'pp'), rows = (pp.length - 10) / 2;
  if (rows !== 3 && rows !== 4) fail('overlap checker: sheet structure changed');
  const ids = [['wall', 'the drawer wall'], ['wall', 'the drawer wall'], ...Array.from({ length: rows }, (_, i) => [['guide', `guide card ${i + 1}`], ['plain', `guide card ${i + 1}`]]).flat(),
    ['see', 'the see-also card'], ['main', 'the main card'], ['front', 'the front card'], ['blank', 'the blank guide'], ['panel', 'the drawer front'], ['plate', 'the label plate'], ['holder', 'the label holder'], ['slip', 'the date due slip']];
  const tabs = [], papers = pp.map((e, order) => {
    const [kind, name] = ids[order], a = e.a, paper = { role: kind, name, order, r: null, parts: [] };
    if ((kind === 'guide' || kind === 'plain') !== (e.tag === 'path') || !['rect', 'path'].includes(e.tag)) fail('overlap checker: sheet structure changed');
    if (e.tag === 'rect') paper.r = box(+a.x, +a.y, +a.x + +a.width, +a.y + +a.height), paper.parts = [{ q: quad(paper.r.x0, paper.r.y0, paper.r.x1, paper.r.y1) }];
    else {   // absolute M L H V Q Z: a guide is its tab and its body, a plain card one rectangle
      const c = [...(a.d ?? '').matchAll(/([MLHVQZ])([^MLHVQZ]*)/g)].map((m) => [m[1], m[2].trim().split(/[ ,]+/).filter(Boolean).map(Number)]), of = (k) => c.filter((x) => x[0] === k).map((x) => x[1]);
      const [x0, bottom] = of('M')[0] ?? fail('overlap checker: sheet structure changed');
      if (kind === 'plain') paper.parts = [{ q: quad(x0, of('V')[0][0], of('H')[0][0], bottom) }];
      else {
        const tx = of('H')[0][0], [L1, L2] = of('L'), Q = of('Q'), tt = Q[1][1], top = Q[0][1], sl = L1[0] - tx;
        paper.parts = [{ q: quad(tx, tt, L2[0], top) }, { q: quad(x0, top, Q[3][2], bottom) }];
        tabs.push({ name: `the shape of tab ${tabs.length + 1}`, q: paper.parts[0].q, in: home(box(tx + sl + 4, tt + 4, L2[0] - sl - 4, top - 4), 'its guide tab') });
      }
    }
    return paper;
  });
  const P = (r) => papers.filter((x) => x.role === r)[0], at = (r) => P(r).order;

  // marks, by tag and role
  const marks = [], by = { rule: [], chip1: [], major: [], frame: [] }, circles = [], rects = [], paths = [];
  for (const { tag, a } of els.filter((e) => e.tag !== 'text' && e.a.class !== 'pp')) {
    const fill = role(a.fill), stroke = role(a.stroke);
    if (tag === 'rect' && a.transform && stroke === 'rule') rects.push({ stamp: true, a });
    else if (tag === 'rect' && fill === 'bg' && stroke === 'frame') rects.push({ a });
    else if (tag === 'line' && stroke in by) by[stroke].push(a);
    else if (tag === 'circle' && (fill === 'bg' || fill === 'frame')) circles.push({ fill, a });
    else if (tag === 'path' && fill === 'bg' && stroke === 'frame') paths.push(a);
    else fail(`overlap checker: unknown ${tag} ${a.fill}/${a.stroke}`);
  }
  const mark = (name, q, extra = {}) => { const m = { name, q, need: APART, ...extra }; marks.push(m); return m; };
  const lq = (a) => { const w = +a['stroke-width']; return quad(Math.min(a.x1, a.x2) - w / 2, Math.min(a.y1, a.y2) - w / 2, Math.max(+a.x1, +a.x2) + w / 2, Math.max(+a.y1, +a.y2) + w / 2); };
  const holes = circles.filter((c) => c.fill === 'bg'), rivets = circles.filter((c) => c.fill === 'frame'), stampBox = rects.filter((r) => r.stamp), whoBox = rects.filter((r) => !r.stamp);
  if (by.rule.length !== 1 || by.chip1.length > 1 || by.frame.length !== 2 || holes.length !== 1 || rivets.length !== 2 || paths.length !== 1 || stampBox.length !== 1 || whoBox.length !== 1) fail('overlap checker: sheet structure changed');
  const rule = mark('the header rule', lq(by.rule[0])), strike = by.chip1[0] ? mark('the strike-through', lq(by.chip1[0]), { owner: 'coll', raw: { x1: +by.chip1[0].x1, x2: +by.chip1[0].x2, y: +by.chip1[0].y1 } }) : null;
  by.major.forEach((a) => mark('the slip’s rules', lq(a)));
  {   // the clip: the hull of its jaw (the one path) and its two wires
    const w = +paths[0]['stroke-width'], pts = [...(paths[0].d ?? '').matchAll(/([MHLV])(-?[\d.]+)(?:,(-?[\d.]+))?/g)].reduce((acc, [, c, u, v]) => {
      const [px, py] = acc.at(-1) ?? [0, 0];
      return [...acc, c === 'H' ? [+u, py] : c === 'V' ? [px, +u] : [+u, +v]];
    }, []);
    for (const a of by.frame) pts.push([+a.x1, +a.y1], [+a.x2, +a.y2]);
    const b = hull(pts);
    mark('the clip', quad(b.x0 - w / 2, b.y0 - w / 2, b.x1 + w / 2, b.y1 + w / 2));
  }
  const h = holes[0].a, ro = +h.r + +h['stroke-width'] / 2, hole = mark('the rod hole', quad(+h.cx - ro, +h.cy - ro, +h.cx + ro, +h.cy + ro), { owner: 'cap', need: ROD, rod: true });
  rivets.forEach(({ a }) => mark('a rivet', quad(+a.cx - +a.r, +a.cy - +a.r, +a.cx + +a.r, +a.cy + +a.r)));
  const wa = whoBox[0].a, ws = +wa['stroke-width'], who = mark('the whoami box', quad(+wa.x - ws / 2, +wa.y - ws / 2, +wa.x + +wa.width + ws / 2, +wa.y + +wa.height + ws / 2), { owner: 'k' });
  const whoIn = home(box(+wa.x + ws / 2, +wa.y + ws / 2, +wa.x + +wa.width - ws / 2, +wa.y + +wa.height - ws / 2), 'the whoami box');
  const sa = stampBox[0].a, sd = +sa['stroke-width'];
  const stampMark = mark('the accession stamp', transform(quad(+sa.x - sd / 2, +sa.y - sd / 2, +sa.x + +sa.width + sd / 2, +sa.y + +sa.height + sd / 2), sa.transform), { owner: 'stamp', rot: true });
  const stampIn = box(+sa.x + sd / 2, +sa.y + sd / 2, +sa.x + +sa.width - sd / 2, +sa.y + +sa.height - sd / 2);

  // texts, by class and order
  const K = CLASSES(g), M = g.main, T = P('main').r, S = P('see').r, front = P('front').r, blank = P('blank').r, slip = P('slip').r, drawer = P('panel').r;
  const inMain = box(T.x0 + M.pad, T.y0 + 4, T.x1 - M.pad, front.y0 - 4), seeIn = box(S.x0 + g.see.pad, S.y0 + 4, S.x1 - g.see.pad, T.y0 - 4);
  const cx0 = M.x0 + M.pad, i1 = M.body === 'entry' ? cx0 + M.callMax * ADV * K.call[1] + M.gap : cx0, cw = ADV * K.trs[1], cols = M.tr.cols.map((c) => i1 + c * cw), nr = M.tr.bases.length;
  const texts = [], seen = {}, nPhr = els.filter((e) => e.tag === 'text' && e.a.class === 'phr').length, sf = slots?.facts ?? {};
  for (const { a, str, tag } of els) {
    if (tag !== 'text') continue;
    const k = a.class, { size, ls = 0, wght } = css[k] ?? fail(`overlap checker: unknown text class "${k}"`), face = css[k].face ?? 'mono', c = (seen[k] = (seen[k] ?? 0) + 1);
    if (!size) fail(`overlap checker: no font size for class "${k}"`);
    role(a.fill);
    const w = (width(face, str, wght) + len(str) * ls) * size, [up, down] = INK[face], ax = +(a.x ?? 0), y = +(a.y ?? 0), anchor = { middle: 0.5, end: 1 }[a['text-anchor']] ?? 0, x = ax - w * anchor;
    const o = turn(a) ?? [ax, y], s0 = FAMILY[k] ? slots?.get(str) : null, slot = s0 && family(s0.key) === FAMILY[k] ? s0 : null, num = k === 'num' ? str : null;
    const nm = {   // id, then the paper it is drawn on and the inner box it must stay in, with its name
      tab: [`tab ${c}`], seeh: ['see-also head', at('see'), seeIn, 'the see-also card'], see: [`see-also ${c}`, at('see'), seeIn, 'the see-also card'], call: [`call ${c}`], entry: ['entry'], stamp: ['stamp'],
      def: [`def ${c}`], coll: ['collation'], pen: ['pencil'], note: [`note ${c}`], num: [`num ${str}`], trs: [`subject ${c}`], tra: [`added ${NUMERALS[c - 1]}`], cap: ['caption'],
      phr: [nPhr > 1 ? `phrase ${c}` : 'phrase', at('blank'), box(blank.x0 + 4, blank.y0 + 4, blank.x1 - 4, drawer.y0 - 4), 'the blank guide'],
      lab: ['drawer label', at('holder'), shrink(P('holder').r, 4), 'the drawer label holder'], slh: ['slip head', at('slip'), shrink(slip, 4), 'the date due slip'],
      date: [`date ${c}`, at('slip'), g.slip.vertical ? shrink(slip, 4) : box(o[0] - 4, slip.y0 + 4, o[0] + g.slip.max * ADV * size + 16.4, slip.y1 - 4), g.slip.vertical ? 'the date due slip' : 'its date cell'],
      k: [`whoami line ${c}`, null, whoIn, 'the whoami box'], d: [c === 1 ? 'status line left' : 'status line right'], vl: ['side label'],
    }[k] ?? fail(`overlap checker: unknown text class "${k}"`);
    let [label, on, inner, where] = nm;
    if (k === 'tab') { const tb = papers.filter((x) => x.role === 'guide')[c - 1] ?? fail('overlap checker: sheet structure changed'); on = tb.order; inner = tabs[c - 1].in; where = 'its guide tab'; }
    if (MAIN.has(k)) { on = at('main'); inner = k === 'pen' ? box(T.x0 + 16, inMain.y0, T.x1 - 16, inMain.y1) : inMain; where = k === 'pen' ? 'the card' : 'the text column'; }   // the pencil may use the card's side padding (16px from its edge)
    const q = transform(quad(x, y - up * size, x + w, y + down * size), a.transform);   // first: it refuses a transform the boxes cannot read
    const t = {
      kind: k, str, slot: slot?.key, rot: +(a.transform?.match(/rotate\((-?[\d.]+)\)/)?.[1] ?? 0) % 90 !== 0, name: `${slot?.name ?? label} "${str}"`, on, home: inner ? home(inner, where) : null, q, ox: o[0], oy: o[1],
      at: { x: ax, y, k: anchor, tr: a.transform, size, ls, face, wght, ink: INK[face], pad: 0 },
    };
    if (k === 'stamp') { t.localIn = stampIn; t.local = quad(ax, y - up * size, ax + w, y + down * size); }
    if (k === 'trs' || k === 'tra' || num) {   // the tracing grid: the 1st indention and the columns come from GEOMETRY, never from the words
      const sub = k === 'trs' || (num && /^\d\.$/.test(str)), i = k === 'trs' || k === 'tra' ? c - 1 : sub ? +str[0] - 1 : NUMERALS.indexOf(str), col = sub ? Math.floor(i / nr) : cols.length - 1;
      t.grid = { x: cols[col] + (num ? 0 : (sub ? 3 : 4) * cw), end: num ? Infinity : sub ? (cols[col + 1] ?? cols.at(-1)) - 3 * cw : T.x1 - M.pad };
    }
    texts.push(t);
  }
  const coll = texts.find((t) => t.kind === 'coll'), pen = texts.find((t) => t.kind === 'pen'), cap = texts.find((t) => t.kind === 'cap');
  if (!coll || !cap || !!strike !== !!pen) fail('overlap checker: sheet structure changed');
  const nd = texts.filter((t) => t.kind === 'date').length, nr2 = marks.filter((m) => m.name === 'the slip’s rules').length;
  if (nr2 !== (g.slip.vertical ? nd : 2)) fail('overlap checker: sheet structure changed');
  return { W, H, g, texts, papers, marks, tabs, rule, strike, pen, coll, cap, hole, who, stamp: stampMark, facts: sf, front };
}

const zones = (W, H, phone) => (phone
  ? [['the clock', 0, 0, W, 932], ['the bottom of the screen', 0, H - 260, W, H]]
  : [['the menu bar', 0, 0, W, 110], ['the Dock', (W - 1300) / 2, H - 220, (W + 1300) / 2, H]]
).map(([name, ...r]) => ({ name, q: quad(...r) }));
const around = (W, H, phone) => ({ W, H, phone, zs: zones(W, H, phone), canvas: box(0, 0, W, H) });

// how deep two convex quads overlap along their shallowest separating axis (<= 0: apart)
function depth(A, B) {
  let min = Infinity;
  for (const Q of [A, B]) for (let i = 0; i < 4; i++) {
    const [x1, y1] = Q[i], [x2, y2] = Q[(i + 1) % 4], nx = y1 - y2, ny = x2 - x1, l = Math.hypot(nx, ny);
    if (!l) continue;
    const a = A.map(([x, y]) => (x * nx + y * ny) / l), b = B.map(([x, y]) => (x * nx + y * ny) / l);
    min = Math.min(min, Math.min(Math.max(...a), Math.max(...b)) - Math.max(Math.min(...a), Math.min(...b)));
  }
  return min;
}
// the clear distance between two shapes (negative: they overlap)
const gap = (a, b, ra = false, rb = false) => {
  if (!ra && !rb) { const A = hull(a), B = hull(b); return Math.max(B.x0 - A.x1, A.x0 - B.x1, B.y0 - A.y1, A.y0 - B.y1); }
  return -depth(a, b);
};

// every rule one text breaks: [verb, what it hit, the editor's kind of hit]; `others` are the texts to overlap-check
function broken(s, t, others, { phone, zs, canvas }) {
  const out = [], no = (verb, b, what) => out.push([verb, b, what]), tb = hull(t.q), K = t.kind, rule = hull(s.rule.q), none = { name: '' };
  for (const u of others) if (hits(t, u)) no('overlaps', u, 'text');                                                                // 1
  if (t.home && !within(t.q, t.home)) no('does not fit inside', t.home, 'home');                                                    // 2
  if (t.localIn && !within(t.local, t.localIn)) no('does not fit inside', { name: 'the stamp box' }, 'home');                       // 6
  if (HEADER.has(K) ? tb.y1 > rule.y0 + TOL : MAIN.has(K) && tb.y0 < rule.y1 - TOL) no('crosses the header line', none, 'home');
  if (t.on != null) for (const p of s.papers) if (p.order > t.on && p.parts.some((x) => hits(t, x))) no('is covered by', p, 'cover');   // 3
  for (const m of s.marks) {                                                                                                         // 5 and 8
    if (m.owner === K) continue;
    const d = gap(t.q, m.q, t.rot, m.rot);
    if (d < m.need) no(`comes within ${d.toFixed(1)} px of`, m, m.rod ? 'rod' : 'mark');
  }
  if (t.grid) {                                                                                                                      // 7
    if (Math.abs(t.at.x - t.grid.x) > 0.5) no('is off its grid', none, 'column');
    if (tb.x1 > t.grid.end + TOL) no('runs past its column', none, 'column');
  }
  if (!within(t.q, canvas)) no('leaves the canvas', none, 'edge');                                                                   // 10
  for (const z of zs) if (hits(t, z)) no('reaches', z, 'zone');
  if (phone && (K === 'phr' || K === 'pen') && tb.y1 > NOTIF) no('drops below the notification line', none, 'zone');
  return out;
}

// every rule broken on one sheet, as readable lines
export function collisions(s, W, H, phone) {
  const bad = [], ctx = around(W, H, phone), { canvas, zs } = ctx, f = s.facts, g = s.g;
  const say = (a, verb, b) => bad.push([a.name, verb, b?.name ?? b].filter(Boolean).join(' '));
  const edge = (e) => { if (!within(e.q, canvas)) say(e, 'leaves the canvas'); for (const z of zs) if (hits(e, z)) say(e, 'reaches', z); };
  s.texts.forEach((t, i) => { for (const [verb, b] of broken(s, t, s.texts.slice(i + 1), ctx)) say(t, verb, b); });
  const defs = Math.max(s.texts.filter((t) => t.kind === 'def').length, f.defs ?? 0);
  if (defs > 2) say({ name: 'the definition' }, `needs ${defs} lines`);                                                            // 2
  const { strike, pen, coll, cap, hole, stamp: sm, rule } = s, hh = hull(hole.q), M = s.papers.find((p) => p.role === 'main').r;
  if (f.struck === null) say({ name: 'the struck word' }, 'is not in the collation');                                               // 4
  else if (!strike) say({ name: 'the strike-through' }, 'is missing');
  else {
    const r = strike.raw, adv = ADV * coll.at.size, sx = (r.x1 + r.x2) / 2;
    if (Math.abs(r.y - (coll.at.y - 0.36 * coll.at.size)) > 2) say(strike, 'is not at the collation’s strike-through height');
    if (f.struck ? Math.abs(r.x1 - (coll.at.x + f.struck.at * adv - 6)) > 1 || Math.abs(r.x2 - (coll.at.x + (f.struck.at + f.struck.n) * adv + 6)) > 1
      : r.x1 + 6 < coll.at.x - 1 || r.x2 - 6 > hull(coll.q).x1 + 1) say(strike, 'does not run through the struck word');
    if (Math.abs(pen.ox - sx) > 1) say(pen, `is not centred on the struck word (${(pen.ox - sx).toFixed(1)} px)`);
  }
  if (Math.abs((hh.x0 + hh.x1) / 2 - (M.x0 + M.x1) / 2) > 1) say(hole, 'is not centred on the card');                                // 5
  if (Math.abs(cap.at.x - (hh.x0 + hh.x1) / 2) > 1) say(cap, 'is not centred on the rod hole');
  const cg = gap(cap.q, hole.q);
  if (Math.abs(cg - g.main.hole.capGap) > 1) say(cap, `is ${cg.toFixed(1)} px below the ring, not ${g.main.hole.capGap}`);
  for (const ts of s.tabs) for (const [role, d] of [['see', 16], ['main', APART]]) {                                                 // 3, tab shapes
    const p = s.papers.find((x) => x.role === role), c = Math.min(...p.parts.map((x) => gap(ts.q, x.q)));
    if (c < d) say(ts, `comes within ${c.toFixed(1)} px of`, p);
  }
  const sg = gap(sm.q, rule.q, true, false);                                                                                         // 6
  if (sg < APART) say(sm, `comes within ${sg.toFixed(1)} px of`, rule);
  if (!within(sm.q, shrink(box(M.x0, M.y0, M.x1, s.front.y0), 4))) say(sm, 'does not fit inside', { name: 'the main card' });
  const parts = s.papers.flatMap((p) => p.parts.map((x) => ({ name: p.name, q: x.q })));
  for (const x of [...s.marks.filter((m) => m !== s.who), ...parts]) {                                                              // 9
    const d = gap(s.who.q, x.q, false, !!x.rot);
    if (d < WHO) say(s.who, `comes within ${d.toFixed(1)} px of`, x);
  }
  for (const x of [...s.marks, ...parts]) edge(x);                                                                                  // 10
  return [...new Set(bad)];
}

// collisions() for one text: null when the slot has no single text of its own (the phone's phrase is two texts: phrase.0 and phrase.1 each
// have one; `phrase` has none there, and the full checker runs; a slot the format leaves undrawn has none either).
// Else { ok, box } or { ok: false, box, hit } naming the first rule.
export function quickFits(base, key, str) {
  const { s, W, H, phone } = base, i = s.texts.findIndex((x) => x.slot === key);
  if (i < 0 || s.texts.findIndex((x, j) => j > i && x.slot === key) >= 0) return null;
  const t = reBox(s.texts[i], str), tb = hull(t.q), first = broken(s, t, s.texts.filter((_, j) => j !== i), around(W, H, phone))[0];
  if (!first) return { ok: true, box: tb };
  const [, o, what] = first;
  return { ok: false, box: tb, hit: { what, name: o.name, slot: o.slot, box: o.q ? hull(o.q) : tb } };
}

// ---------- the slot table (series/catalog-card/README.md), one source for the test, the README and the editor

// characters per slot. data.left is also drawn on the phone, where the cap is 30 and less beside the prompt.
export const LIMITS = { phrase: 18, tracings_subject: 20, tracings_added: 20, see_also: 24, 'data.left': 44, 'data.right': 44, label: 42, phone: 30, handle: 20, motto: 40 };
export const limitOf = (key) => {
  const [a, b] = key.split('.');
  return LIMITS[a === 'data' ? `${a}.${b}` : a];
};
export const get = (p, key) => key.split('.').reduce((v, k) => v?.[k], p);
// an immutable copy with one slot replaced. The phone's subsets are rules, so no slot has a phone copy to keep in step.
export function withSlot(p, key, value) {
  const [a, b] = key.split('.'), q = { ...p };
  if (key === 'phrase') q.phrase = [...value];
  else if (a === 'data') q.data = { ...p.data, [b]: value };
  else q[a] = p[a].map((v, i) => (i === +b ? value : v));
  return q;
}
// the status line's room on the phone: the line left of the prompt, set with the longest handle, and a space between
const room = (p) => {
  const g = GEOMETRY.phone, right = view(p, 'phone').right.replaceAll('{handle}', 'x'.repeat(LIMITS.handle));
  return Math.floor((g.R - g.L) / (ADV * CLASSES(g).d[1]) - len(right) - 1);
};
// the phone's room for data.left, for the editor's counter (the other series fall back to LIMITS.phone)
export const phoneCap = (p, key) => (key === 'data.left' ? Math.min(limitOf(key), LIMITS.phone, room(p)) : undefined);
// why a value breaks the slot table (an empty list: it doesn't). Geometry is collisions()'s job.
export function slotRules(p, key, value) {
  const why = [], a = family(key), lines = a === 'phrase' ? value : [value];
  if (!Array.isArray(lines) || !lines.length || lines.length > (a === 'phrase' ? 2 : 1)) return ['one or two lines'];
  for (const s of lines) {
    if (typeof s !== 'string' || !s.trim()) return ['empty'];
    if (/[\u0000-\u001F\u007F-\u009F]/.test(s)) why.push('control character');
    if (s !== s.trim()) why.push('stray spaces');
    if (/[<>&]/.test(s)) why.push('<, > or &');
    const max = key === 'data.left' ? phoneCap(p, key) : limitOf(key);
    if (len(s) > max) why.push(`${len(s)}/${max}`);
    if (!glyphs(a === 'phrase' ? 'nunito' : 'mono', s)) why.push('glyph');
    if (a === 'see_also' && !isId(seeParts(s)?.[2])) why.push('NAME · ID');
  }
  return why;
}

// ---------- the word editor's slots (series/catalog-card/README.md)

export const SLOTS = [
  ['phrase', 'Guide card phrase'], ['tracings_subject.0', 'Subject 1'], ['tracings_subject.1', 'Subject 2'], ['tracings_subject.2', 'Subject 3'], ['tracings_subject.3', 'Subject 4'],
  ['tracings_added.0', 'Added entry I'], ['tracings_added.1', 'Added entry II'], ['see_also.0', 'See also 1'], ['see_also.1', 'See also 2'], ['data.left', 'Status line'], ['whoami', '# whoami'],
];
export const LABEL = Object.fromEntries(SLOTS);
// the lexicon's `card` slot names, per slot family: a heading is offered only through a hint (the phrase uses the phrase pool)
export const CARD = { tracings_subject: 'subject', tracings_added: 'added', see_also: 'see', data: 'status' };
export const HINTS = Object.values(CARD);
// word types offered by type: only the status line (a tracing or a see-also needs a hint, and a hero is never a heading)
export const TYPES = { phrase: [], tracings_subject: [], tracings_added: [], see_also: [], data: ['status-line'] };
// what stays fixed, and why
export const FIXED = {
  drawer_label: ['Drawer label', 'names the drawer: the topic and the letters it holds'],
  guide_tabs: ['Guide card path', 'traces the taxonomy from the field down to this entry'],
  call_number: ['Call number', 'shelves the entry by real framework IDs'],
  main_entry: ['Main entry', 'names the concept the card describes'],
  definition: ['Definition', 'defines the entry in one typed sentence'],
  collation: ['Collation', 'states the entry’s measurable facts'],
  correction: ['Pencil correction', 'strikes advice that changed and pencils in the current one'],
  notes: ['Note', 'cites the governing standard and its date'],
  rod_invariant: ['Rod hole', 'holds the one invariant that pins the entry in place'],
  circulation_dates: ['Date due slip', 'stamps the entry’s dated history'],
  stamp: ['Accession stamp', 'numbers the card and credits its cataloger'],
  label: ['Side label', 'names the volume'],
  'data.right': ['Prompt line', 'shows your handle and the volume’s side of the loop'],
};
export const fixedOf = (key) => FIXED[Object.keys(FIXED).find((k) => key?.startsWith(k))] ?? null;
export const nameOf = (key) => LABEL[key] ?? LABEL[family(key)] ?? fixedOf(key)?.[0] ?? 'another label';
// the editor's "Fixed on this sheet" list: name, then what it does
export const FIXED_LIST = Object.values(FIXED).map(([name, does]) => [name, `It ${does}.`]);

// the slots this preset draws, in reading order ('whoami' is the viewer's own box)
export const slotsOf = (p) => SLOTS.map(([k]) => k).filter((k) => k === 'whoami' || get(p, k) != null);
export const lockOf = () => '';                                // no slot has a part the volume fixes

// every other string on the sheet: a word may appear once, so an edit never equals a fixed one
export function usedStrings(p, key) {
  const m = new Map(), add = (v, where) => v != null && !m.has(v) && m.set(v, where);
  for (const k of slotsOf(p)) if (k !== key && k !== 'whoami') [get(p, k)].flat().forEach((v) => add(v, LABEL[k]));
  if (key !== 'phrase') add(p.phrase.join(' '), LABEL.phrase);
  ['desktop', 'phone'].forEach((f) => defLines(p, f).forEach((v) => add(v, 'the definition')));
  p.guide_tabs.forEach((v) => add(v, 'the guide cards')); p.call_number.forEach((v) => add(v, 'the call number')); add(p.main_entry, 'the main entry');
  add(p.collation, 'the collation'); add(p.correction_struck, 'the pencil correction'); add(p.correction_new, 'the pencil correction'); p.notes.forEach((v) => add(v, 'the notes'));
  add(p.rod_invariant, 'the rod hole'); p.circulation_dates.forEach((v) => add(v, 'the date due slip'));
  HEADS.forEach((v) => add(v, 'the card')); add(stamp(p), 'the accession stamp'); add(p.drawer_label, 'the drawer label');
  ['1.', '2.', '3.', '4.', ...NUMERALS].forEach((v) => add(v, 'the tracings'));
  add(p.label, 'the side label'); add(p.data?.right, 'the prompt line'); add(p.phone?.data?.right, 'the phone prompt line');
  return m;
}

// ---------- what the word editor asks of a series (app/words.js)

export const story = () => '';                          // no volume tells a story across sheets
// the words a term offers a slot, as { value, code?, meaning? }: hinted (its `as` form) or by type. A see-also's value already
// carries its ID, so it shows no code beside it.
export const offer = (key, t, hinted) => [{ value: hinted ? t.card.as || t.text : t.text, ...(family(key) === 'see_also' ? { code: '' } : {}) }];
export const kindsOf = (key) => ({ slot: CARD[family(key)], types: TYPES[family(key)] });
export const put = withSlot;
// does a value fit this slot in one format? The phrase is one line on desktop and wide, line by line on the phone while the line count stays
export function fits(current, f, key, value, shipped, prepared) {
  if (key === 'phrase') {
    if (f !== 'phone') return quickFits(prepared(f), 'phrase', value.join(' '));
    if (value.length !== current.phrase.length) return null;   // the class size changes with the line count
    let b = null;
    for (const [i, line] of value.entries()) {
      const r = quickFits(prepared(f), `phrase.${i}`, line);
      if (!r?.ok) return r;
      b = union(b, r.box);
    }
    return { ok: true, box: b };
  }
  return quickFits(prepared(f), key, value);
}
// a failed fit in the interface's words (h: the hit of quickFits, or { what: 'full', name } from the full checker)
export function why(h) {
  const l = h.what === 'full' ? h.name : '', m = (re) => l.match(re)?.[1], quick = (w) => h.what === w;
  const w = m(/^the whoami box comes within -?[\d.]+ px of (.+)$/);
  if (w) return `pushes the whoami box into ${w}`;
  const [kind, name] = h.what !== 'full' ? [h.what, h.name]
    : /px of the rod hole$/.test(l) ? ['rod'] : /comes within -?[\d.]+ px of /.test(l) ? ['mark', m(/ px of (.+)$/)] : / overlaps /.test(l) ? ['text', m(/ overlaps (.+)$/)]
    : /does not fit inside /.test(l) ? ['home', m(/ does not fit inside (.+)$/)] : /crosses the header line$/.test(l) ? ['home', ''] : / is covered by /.test(l) ? ['cover', m(/ is covered by (.+)$/)]
    : /runs past its column$|is off its grid$/.test(l) ? ['column'] : /drops below the notification line$/.test(l) ? ['zone', ''] : / reaches /.test(l) ? ['zone', m(/ reaches (.+)$/)]
    : /leaves the canvas$/.test(l) ? ['edge'] : [''];
  return kind === 'text' ? `runs into ${quick('text') && h.slot ? nameOf(h.slot) : name}`
    : kind === 'home' ? (name ? `is too wide for ${name}` : 'crosses the header rule') : kind === 'cover' ? `slips under ${name}`
    : kind === 'column' ? 'is too long for its column' : kind === 'rod' ? 'crowds the rod hole' : kind === 'mark' ? `runs into ${name}`
    : kind === 'zone' ? (name ? `reaches ${name}` : 'sinks under the notifications') : kind === 'edge' ? 'runs off the sheet' : 'collides with another mark';
}
// the word a change replaced, for the note about where it lives on (the phrase: none)
export const oldWord = (p, key) => (key === 'phrase' ? '' : String(get(p, key)).trim());
// where else on the sheet a word appears, by name
export function elsewhere(p, key, re) {
  const where = new Set(), has = (v) => v != null && re.test(v);
  for (const k of slotsOf(p)) if (k !== key && k !== 'whoami' && [get(p, k)].flat().some(has)) where.add(LABEL[k]);
  if ([p.definition, p.collation, ...p.notes].some(has)) where.add('the card');
  if (p.guide_tabs.some(has)) where.add('the guide cards');
  if (p.call_number.some(has)) where.add('the call number');
  if (p.circulation_dates.some(has)) where.add('the date due slip');
  if (has(p.label)) where.add('the side label');
  return [...where];
}

// ---------- the studio: geometry, copy and the "Read the card" key

// the series' words in the studio: the "Read the …" section (mark: the key line shown first)
export const READ = {
  nav: 'Read the card', title: 'Read the card.', mark: 'correction', legendHead: ['', 'On the card', 'In the body of knowledge'],
  intro: 'A library catalog card pulled from its drawer, read as a security reference. Pick a line from the key to find its mark on the sheet.',
  who: 'Your handle goes in the whoami box and in the prompt under the sheet; your line follows it. The accession stamp stays 0xF3tt.',
};
// the volume's line under its name: the phrase, in quotes
export const lineOf = (p) => p.phrase.join(' ');
// a parsed preset file the studio can draw (the strip skips the ones that aren't)
const isList = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
export const valid = (p) => !!p && typeof p === 'object' && isList(p.phrase) && ['drawer_label', 'main_entry', 'definition', 'collation', 'correction_struck', 'correction_new', 'rod_invariant', 'label'].every((k) => typeof p[k] === 'string')
  && ['guide_tabs', 'call_number', 'notes', 'drafts', 'tracings_subject', 'tracings_added', 'see_also', 'circulation_dates'].every((k) => isList(p[k])) && !!p.data && typeof p.data === 'object';
// the tags under the sheet's title: the correction, then the invariant, in the colors the sheet draws them in
export const chipsOf = (p, colors) => [{ text: `${p.correction_struck} → ${p.correction_new}`, color: colors.chip1 }, { text: p.rod_invariant, color: colors.text2 }];
export const swatch = () => null;
// the editor's zoom: U is the margin around a slot in sheet px, px(key, fmt) the drawn text size (both from GEOMETRY)
export const GEOM = {
  U: (fmt) => GEOMETRY[fmt].main.def[1] - GEOMETRY[fmt].main.def[0],
  px(key, fmt) {
    const K = CLASSES(GEOMETRY[fmt]);
    return { phrase: fmt === 'phone' ? 72 : 136, tracings_subject: K.trs[1], tracings_added: K.tra[1], see_also: K.see[1], data: K.d[1], whoami: K.k[1] }[family(key)] ?? K.trs[1];
  },
};
const slotOf = (s, key) => s.texts.filter((t) => t.slot === key || t.slot?.startsWith(`${key}.`));
// one box per slot and per fixed key, as quads, in sheet px (s: the prepared scene). A fixed key's box is what it covers; the phone has none for what it leaves undrawn.
export function slotQuads(s, p, key) {
  const T = (...k) => s.texts.filter((t) => k.includes(t.kind)).map((t) => t.q);
  if (key === 'whoami') return [s.who.q];
  return {
    drawer_label: () => T('lab'), guide_tabs: () => T('tab'), call_number: () => T('call'), main_entry: () => T('entry'), definition: () => T('def'), collation: () => T('coll'),
    correction: () => [...T('pen'), ...(s.strike ? [s.strike.q] : [])], notes: () => T('note'), rod_invariant: () => [...T('cap'), s.hole.q],
    circulation_dates: () => s.papers.find((x) => x.role === 'slip').parts.map((x) => x.q), stamp: () => [s.stamp.q],
  }[key]?.() ?? slotOf(s, key).map((t) => t.q);
}

// the key's icons: 24×24 strokes, one per mark
export const GLYPH = {
  tabs: '<path d="M3 21v-5h6v-5h6V6h6v15z"/>',
  call: '<path d="M5 6h8M5 11h10M5 16h6"/>',
  entry: '<path d="M6 6v12M18 6v12M6 12h12"/>',
  stamp: '<rect x="4" y="7" width="16" height="10" rx="1.5"/><path d="M8 12h8"/>',
  definition: '<path d="M9 7h10M5 12h14M5 17h14"/>',
  collation: '<path d="M3 12h5M10 12h4M16 12h5M12 8v8"/>',
  correction: '<path d="M3 17h11M15 12l5-5 2 2-5 5-3 1z"/>',
  notes: '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M7 10h10M7 14h6"/>',
  tracings: '<path d="M4 7h2M9 7h10M4 12h2M9 12h8M4 17h2M9 17h6"/>',
  rod: '<circle cx="12" cy="10" r="4"/><path d="M8 19h8"/>',
  see: '<rect x="9" y="3" width="12" height="12" rx="1"/><rect x="3" y="9" width="12" height="12" rx="1"/>',
  slip: '<rect x="7" y="3" width="10" height="18" rx="1"/><path d="M9 8h6M9 12h6M9 16h6"/>',
  holder: '<rect x="3" y="7" width="18" height="10" rx="1"/><rect x="8" y="10" width="8" height="4"/>',
  phrase: '<path d="M5 8h14M5 16h9" stroke-width="2.5"/>',
  whoami: '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M7 10h3M7 13h10"/>',
  side: '<path d="M9 4v16M13 18V9M17 18v-6"/>',
  status: '<path d="M3 17h8M14 17h7M3 6h18"/>',
};

// read the card: the desktop sheet's boxes, from the prepared scene
export function marks(p, handle) {
  const { w: W, h: H } = FORMATS.desktop, s = scene(render({ preset: p, colors: PROBE, format: 'desktop', handle, motto: '', fonts: null }), slotNames(p, 'desktop', handle));
  const the = (list, k = 18) => {
    const b = hull(list.flatMap((x) => x.q));
    return { x0: Math.max(0, b.x0 - k), y0: Math.max(0, b.y0 - k), x1: Math.min(W, b.x1 + k), y1: Math.min(H, b.y1 + k) };
  };
  const R = (b) => `<rect class="mk" x="${Math.round(b.x0)}" y="${Math.round(b.y0)}" width="${Math.round(b.x1 - b.x0)}" height="${Math.round(b.y1 - b.y0)}" rx="10"/>`;
  const above = (b) => [Math.round((b.x0 + b.x1) / 2), Math.max(60, Math.round(b.y0 - 46))];
  const N = (...k) => s.texts.filter((t) => k.includes(t.kind)), paper = (r) => ({ q: s.papers.find((x) => x.role === r).parts.flatMap((x) => x.q) });
  const tabs = N('tab').map((t) => the([t])), subj = the(N('num', 'trs').filter((t) => t.kind === 'trs' || /^\d/.test(t.str))), add = the(N('tra').concat(N('num').filter((t) => /^I/.test(t.str))));
  const one = (id, term, mean, b, pin = above(b), svg = R(b)) => ({ id, term, mean, svg, pin });
  const tab = tabs.length ? hull(tabs.flatMap((b) => quad(b.x0, b.y0, b.x1, b.y1))) : null;
  return [
    one('tabs', 'The guide cards', `The taxonomy, from the field down to this entry: ${p.guide_tabs.join(' › ')}.`, tab, above(tab), tabs.map(R).join('')),
    one('call', 'The call number', 'Where the entry is shelved, in real frameworks, each line documented from the one above.', the(N('call'))),
    one('entry', 'The main entry', 'The concept the card describes.', the(N('entry'))),
    one('stamp', 'The accession stamp', 'The card’s number in kernspace, and its cataloger.', the([s.stamp], 10)),
    one('definition', 'The typed definition', 'One sentence, typed once.', the(N('def'))),
    one('collation', 'The collation', 'The entry’s measurable facts, set like a book’s pages and size.', the(N('coll'))),
    one('correction', 'The pencil correction', `Advice that changed: ${p.correction_struck} struck through, ${p.correction_new} pencilled above it.`, the([...N('pen'), s.strike].filter(Boolean), 14)),
    one('notes', 'Notes', 'The governing standard, and when it was set.', the(N('note')), above(the(N('note'))), N('note').map((t) => R(the([t]))).join('')),
    one('tracings', 'Tracings', 'Headings to look it up under: arabic numerals for related subjects, roman for the controls.', subj, above(subj), R(subj) + R(add)),
    one('rod', 'The rod hole', `The invariant that pins the entry in the drawer: ${p.rod_invariant}.`, the([s.hole, ...N('cap')])),
    one('see', 'The see-also card', 'The next cards to pull.', the([...N('seeh', 'see')])),
    one('slip', 'The date due slip', 'The entry’s history, stamped one date at a time.', the([paper('slip')], 6)),
    one('holder', 'The drawer label', 'The drawer: its topic and the letters it holds.', the([paper('holder')], 6)),
    one('phrase', 'The blank front guide', `The principle behind the drawer: “${p.phrase.join(' ')}”`, the(N('phr'))),
    one('whoami', 'The # whoami box', 'Your handle and your line.', the([s.who], 6)),
    ((b) => one('side', 'The vertical side label', `The series and volume index, fixed: ${p.label}.`, b, [Math.round(b.x0 - 260), Math.round((b.y0 + b.y1) / 2)]))(the(N('vl'))),
    ((b) => one('status', 'Lines under the sheet', `A status line (${p.data.left}) and your prompt.`, b, [Math.round(W / 2), Math.min(H - 50, Math.round(b.y1 + 46))], R(the(N('d').slice(0, 1))) + R(the(N('d').slice(1)))))(the(N('d'))),
  ];
}
