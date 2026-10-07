// Catalog Card: a library catalog card pulled up from its drawer, read as a security reference (series/catalog-card/README.md
// has the concept). One standalone SVG per preset; presets are data: series/catalog-card/presets/index.json lists them, one <id>.json each.
//
// Preset shape (limits in characters; the description is fixed per volume, the access points are the editable ones):
//   series:"catalog-card", topic, title, ground
//   phrase: 1-2 lines ≤18 · drawer_label ≤20 (<TOPIC> · AA–BB) · guide_tabs: 4 × ≤14, broad to narrow · call_number: 3 × ≤12 (framework IDs)
//   main_entry ≤20 · definition ≤110 (one sentence, two lines) · collation ≤44 (2-3 facts joined by " ; ")
//   correction_struck ≤18 (once in the collation) · correction_new ≤18 · notes: 1-2 × ≤44 · drafts: what rests on a draft source (not drawn)
//   rod_invariant ≤28 · tracings_subject: 2-4 × ≤20 · tracings_added: 1-2 × ≤20 · see_also: 1-2 × ≤24 ("NAME · ID")
//   circulation_dates: 3-5 × ≤18 · label ≤42 (vertical, fixed) · data: { left ≤44, right ≤44 ({handle} = the viewer's) }
//   phone: { definition, data: { right } } are the only overrides; every other phone subset is a rule (view)
import { FORMATS, HANDLE, esc, finish, whoamiLines } from '../render.js';

const SANS = 'KNunito,Nunito,sans-serif', MONO_FAM = 'KMono,"JetBrains Mono",ui-monospace,monospace';
const ADV = 0.6, CAP = 0.73, NUN = [0.713, 0.186];   // mono advance and cap height per em; Nunito's real ink above and below the baseline (no font metrics here)
const AUTHOR = '0xF3tt';                             // the cataloger's credit on the accession stamp: never the handle
const HEADS = ['SEE ALSO', 'DATE DUE'];
const ROLES = ['bg', 'minor', 'major', 'angle', 'frame', 'rule', 'diag', 'text', 'text2', 'data', 'tb', 'sink', 'chip1', 'chip2', 'chip3'];
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\))$/i;
const PRE = ' xml:space="preserve"';
const FONT_URL = /^data:[\w/+.-]+;base64,[A-Za-z0-9+/=]*$/;

// paper: every card is `major` laid flat over `bg` at a step t, solved per ground for a fixed WCAG contrast with the ground (no gradient,
// no shadow). Roles drawn on a paper are held to their contrast on it by palette.test; the main card is the darkest paper on light grounds.
const rgb = h => { if (!/^#[0-9a-f]{6}$/i.test(h)) throw new Error(`catalog-card: bad color ${h}`); return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); };
const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
const lin = v => (v /= 255) <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const lum = h => rgb(h).map(lin).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const DEPTH = { guides: [1.05, 1.09, 1.13, 1.18], wall: 1.12, see: 1.20, slip: 1.25, front: 1.31, blank: 1.38, panel: 1.44, main: 1.50, metal: 1.58 };
const tOn = (c, want) => {   // t for a contrast of `want` with bg, 24 bisections, 3 decimals
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (ratio(mix(c.bg, c.major, m), c.bg) < want) lo = m; else hi = m; }
  return +((lo + hi) / 2).toFixed(3);
};
export function paper(c, depth = DEPTH) {
  for (const k of ['bg', 'major']) if (!/^#[0-9a-f]{6}$/i.test(c?.[k] ?? '')) throw new Error(`catalog-card: bad color ${k} (the paper ladder needs #RRGGBB)`);
  const step = t => mix(c.bg, c.major, tOn(c, t));
  return { guides: depth.guides.map(step), wall: step(depth.wall), see: step(depth.see), slip: step(depth.slip), front: step(depth.front), blank: step(depth.blank), panel: step(depth.panel), main: step(depth.main), metal: step(depth.metal) };
}
// each paper layer with the roles drawn on it and their kind: text (4.5:1), both (large text and a mark) or stroke (3:1). The numerals, heads and dates are
// text2; only the header line and the stamp are rule. palette.test holds each pair to its kind; render.test pins the role of every drawn text
const PAIRS = [
  ['guides[0]', 'text2', 'text'], ['guides[1]', 'text2', 'text'], ['guides[2]', 'text2', 'text'], ['guides[3]', 'text', 'text'],
  ['see', 'text', 'text'], ['see', 'text2', 'text'], ['blank', 'text', 'text'], ['slip', 'text2', 'text'],
  ['main', 'text', 'text'], ['main', 'text2', 'text'], ['main', 'rule', 'both'], ['main', 'chip1', 'both'], ['main', 'frame', 'stroke'],
];

// geometry per format, px. Main-card rows are offsets from the card top; the entry and the body start on a fixed indention and the tracings sit
// on a fixed grid, both set by the limits, never by the words (editing one tracing moves no other). Keep-clear: top 110, bottom-centre 1300×220
// (Dock); phone: y < 932 and the bottom 260; the phrase and the pencil end above the notification line (y 2215).
const DESKTOP = {
  key: 'desktop', L: 160, R: 3600,
  sw: { edge: 2, card: 4, rule: 4, strike: 5, hole: 4, plain: 1.5, frame: 3, holder: 2, stamp: 2, slipRule: 2, clip: 3, rivet: 4 },
  drawer: { x0: 150, x1: 2750, wall: 40, top: 196, panel: [1816, 1912] },
  guides: { x0: 240, x1: 2660, tabTop: 150, pitch: 88, tabH: 72, tabW: 400, tabX: [290, 690, 1090, 1490], r: 16, slant: 12, pad: 34 },
  see: { x0: 1970, x1: 2560, top: 300, pad: 34, bases: [56, 116, 170] },
  main: {
    x0: 290, x1: 2610, top: 512, r: 30, pad: 80, gap: 100, body: 'entry', indent: 2, callMax: 12,
    call: [100, 164, 228], entry: 164, stamp: { base: 100, padX: 14, padY: 12, rot: -1.5 },
    rule: 272, def: [344, 400], pencil: { base: 480, rot: -2 }, coll: 544, notes: [612, 668],
    tr: { bases: [742, 798], cols: [0, 26, 52], subjCols: 2 }, hole: { cy: 912, r: 80, capGap: 24 }, cover: 1078,
  },
  front: { h: 24 }, phrasePitch: 0,
  holder: { h: 64, pad: 44, plate: 18 },
  slip: { vertical: true, x: 2716, y: 660, w: 470, top: 116, pitch: 112, pad: 40, head: 76 },
  clip: { wb: 96, wt: 56, h: 56, arm: 64, at: .62 },   // D's V-handled clip: a jaw wide at the bottom, two wires splayed out
  who: { bottom: 1816, w: 800, lh: 38, pad: 28 }, data: { y: 2000 }, vl: { top: 190, ls: .12 },
};
const WIDE = {
  ...DESKTOP, key: 'wide',
  drawer: { ...DESKTOP.drawer, panel: [2056, 2152] },
  guides: { ...DESKTOP.guides, tabTop: 160, pitch: 100 },
  see: { ...DESKTOP.see, top: 320 },
  main: {
    ...DESKTOP.main, top: 558, def: [352, 412], pencil: { ...DESKTOP.main.pencil, base: 498 }, coll: 566, notes: [640, 700],
    tr: { ...DESKTOP.main.tr, bases: [782, 842] }, hole: { ...DESKTOP.main.hole, cy: 960 }, cover: 1132,
  },
  slip: { ...DESKTOP.slip, y: 720, pitch: 124 },
  who: { ...DESKTOP.who, bottom: 2056 }, data: { y: 2240 },
};
const PHONE = {
  key: 'phone', L: 90, R: 1200,
  sw: { edge: 2, card: 3, rule: 3, strike: 4, hole: 4, plain: 1.5, frame: 2.5, holder: 2, stamp: 2, slipRule: 2, clip: 3, rivet: 3.5 },
  drawer: { x0: 50, x1: 1240, wall: 26, top: 960, panel: [2154, 2320] },
  guides: { x0: 84, x1: 1206, tabTop: 955, pitch: 78, tabH: 64, tabW: 332, tabX: [96, 199, 302], r: 12, slant: 9, pad: 20 },
  see: { x0: 650, x1: 1174, top: 998, pad: 16, bases: [48, 100, 150] },
  main: {
    x0: 100, x1: 1190, top: 1188, r: 22, pad: 34, gap: 24, body: 'pad', indent: 2, callMax: 12,
    call: [64, 110, 156], entry: 156, stamp: { base: 62, padX: 12, padY: 12, rot: -1.5 },
    rule: 196, def: [254, 302], pencil: { base: 368, rot: -2 }, coll: 424, notes: [482],
    tr: { bases: [548, 596], cols: [0, 26], subjCols: 1 }, hole: { cy: 670, r: 40, capGap: 16 }, cover: 780,
  },
  front: { h: 14 }, phrasePitch: 80,
  holder: { h: 58, pad: 34, plate: 18, top: 16 },
  slip: { vertical: false, x: 60, y: 2246, w: 1170, h: 64, cols: [136, 503.2, 870.4], max: 16 },   // three ruled date cells, 16 characters each
  clip: { wb: 56, wt: 32, h: 38, arm: 40, at: 32 },
  who: { y: 2340, w: 1110, lh: 38, pad: 14 }, data: { y: 2525 }, vl: null,   // no side label on the phone
};
const GEOMETRY = { desktop: DESKTOP, wide: WIDE, phone: PHONE };

// one class per text kind: [family (m mono, n Nunito), size, weight, letter-spacing em]. The phrase is 136 on desktop and wide; on the phone
// 96 for one stored line, 72 for two. Scrutiny text (everything on the card but the glance tier) is at least 34; chrome is k, d and vl.
const CLASSES = (g, p) => {
  const ph = g.key === 'phone', b = ph ? 34 : 36;
  return {
    tab: ['m', ph ? 34 : 40, 500], seeh: ['m', 34, 500], see: ['m', b, 400], call: ['m', ph ? 38 : 54, 500], entry: ['m', ph ? 56 : 80, 500],
    stamp: ['m', 34, 500], def: ['m', b, 400], coll: ['m', b, 400], pen: ['n', ph ? 54 : 64, 300], note: ['m', b, 400], num: ['m', b, 600],
    trs: ['m', b, 400], tra: ['m', b, 400], cap: ['m', 34, 400], phr: ['n', ph ? (p?.phrase?.length === 2 ? 72 : 96) : 136, 300],
    lab: ['m', ph ? 34 : 40, 500], slh: ['m', 34, 500], date: ['m', b, 400], k: ['m', ph ? 30 : 26, 400], d: ['m', ph ? 30 : 26, 300],
    ...(g.vl ? { vl: ['m', 24, 300, g.vl.ls] } : {}),
  };
};
export { GEOMETRY, CLASSES, AUTHOR, HEADS, DEPTH, PAIRS };

const n = v => +v.toFixed(2);                        // short, stable numbers
const cp = s => [...s].length;
const ROTS = [-1.2, 0.9, -0.6, 1.3, -0.9];           // each drawn date is turned a little, as if stamped by hand
const tf = (x, y, a) => `translate(${n(x)},${n(y)}) rotate(${a})`;
const volOf = p => String(+/\d+/.exec(p.title ?? '')?.[0]).padStart(2, '0');
export const stamp = p => `KS-CC-${volOf(p)} · cat. ${AUTHOR}`;

// what a format draws: the phone's subsets are rules (never copies), so an edited tracing reaches every format
export const view = (p, fmt) => fmt !== 'phone' ? { ...p, def: p.definition, right: p.data?.right } : {
  ...p, guide_tabs: p.guide_tabs.slice(-3), tracings_subject: p.tracings_subject.slice(0, 2),
  notes: [p.notes.find(t => /\bdraft\b/.test(t)) ?? p.notes[0]],
  circulation_dates: p.circulation_dates.length > 3 ? [p.circulation_dates[0], p.circulation_dates[1], p.circulation_dates.at(-1)] : p.circulation_dates,
  def: p.phone?.definition ?? p.definition, right: p.phone?.data?.right ?? p.data.right,
};
// the body's columns: the 1st indention (the entry's x on desktop and wide, the call number's on the phone), the 2nd, and the line length in characters
const column = g => {
  const M = g.main, K = CLASSES(g), cx0 = M.x0 + M.pad, ex = cx0 + M.callMax * ADV * K.call[1] + M.gap, i1 = M.body === 'entry' ? ex : cx0, d = ADV * K.def[1];
  return { cx0, ex, i1, i2: i1 + M.indent * d, bmax: Math.floor((M.x1 - M.pad - i1) / d) };
};
// greedy wrap to `max` code points, the first line `indent` shorter (paragraph indention)
const wrap = (s, max, indent) => s.split(' ').reduce((ls, w) => {
  const last = ls[ls.length - 1], room = max - (ls.length === 1 ? indent : 0);
  if (last != null && cp(last) + 1 + cp(w) <= room) ls[ls.length - 1] = `${last} ${w}`; else ls.push(w);
  return ls;
}, []);
export const defLines = (p, fmt) => wrap(view(p, fmt).def, column(GEOMETRY[fmt]).bmax, GEOMETRY[fmt].main.indent);

function checkColors(c) {
  for (const k of ROLES) if (!COLOR.test(c?.[k] ?? '')) throw new Error(`catalog-card: bad color ${k}`);
  return c;
}

function formatKey(format) {
  if (typeof format === 'string') return format;
  return Object.keys(FORMATS).find(k => FORMATS[k].w === format?.w && FORMATS[k].h === format?.h);
}

function style(K, fonts) {
  const face = (fam, url, wght) => {
    if (!url) return '';
    if (!FONT_URL.test(url)) throw new Error(`catalog-card: ${fam} must be a base64 data: URL`);
    return `@font-face{font-family:${fam};src:url("${url}") format("truetype");font-weight:${wght}}`;
  };
  return face('KNunito', fonts.nunito, '200 1000') + face('KMono', fonts.jbm, '100 800')
    + `text{font-family:${MONO_FAM};font-weight:400;font-variant-ligatures:none;white-space:pre}`     // no ligatures: the IDs read as typed
    + Object.entries(K).map(([k, [fam, sz, wt, ls]]) => `.${k}{${fam === 'n' ? `font-family:${SANS};` : ''}font-size:${sz}px;font-weight:${wt}${ls ? `;letter-spacing:${ls}em` : ''}}`).join('');
}

// preset: parsed presets/<slug>.json · colors: one palette ground · format: FORMATS key · grain: the film grain finish
export function render({ preset: p, colors, format = 'desktop', handle, motto, fonts, grain = false }) {
  const key = formatKey(format), g = GEOMETRY[key];
  if (!g) throw new Error(`catalog-card: unknown format ${format}`);
  if (!p?.call_number) throw new Error('catalog-card: preset must be a parsed preset object');
  const c = checkColors(colors?.colors ?? colors), L = paper(c), P = view(p, key), K = CLASSES(g, p), sw = g.sw;
  const s = [], size = k => K[k][1], adv = k => (ADV + (K[k][3] ?? 0)) * size(k), ink = r => c[r] ?? r;
  const { w: CW, h: CH } = FORMATS[key], D = g.drawer, G = g.guides, M = g.main, bottom = D.panel[0], T = M.top, LABEL = 'text2';   // the numerals and heads are text2; the header line and the stamp stay rule
  const rect = (x, y, w, h, fill, stroke, wd, rx = 0) =>
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rx ? ` rx="${rx}"` : ''} fill="${ink(fill)}"${stroke ? ` stroke="${ink(stroke)}" stroke-width="${wd}"` : ''}/>`;
  const sheet = svg => s.push(svg.replace(/^<(\w+) /, '<$1 class="pp" '));   // a paper: drawn in order, in class "pp", its fill from the ladder
  const line = (x1, y1, x2, y2, stroke, wd, cap = '') =>
    s.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${ink(stroke)}" stroke-width="${wd}"${cap ? ` stroke-linecap="${cap}"` : ''}/>`);
  const text = (x, y, str, k, { fill = 'text', anchor = 'start', rot = 0, pre = '' } = {}) =>
    str != null && s.push(`<text${rot ? ` x="0" y="0" transform="${tf(x, y, rot)}"` : ` x="${n(x)}" y="${n(y)}"`} class="${k}" fill="${ink(fill)}"${pre}${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}>${esc(str)}</text>`);

  s.push(rect(0, 0, CW, CH, 'bg'));
  sheet(rect(D.x0, D.top, D.wall, bottom - D.top, L.wall, 'major', sw.edge));
  sheet(rect(D.x1 - D.wall, D.top, D.wall, bottom - D.top, L.wall, 'major', sw.edge));

  // guides, back to front: a body and a tab; the label sits on the tab's flat top; the plain card behind the next guide
  const tabs = P.guide_tabs, rows = tabs.length;
  const guidePath = (bodyTop, tx) => {
    const r = G.r, tt = bodyTop - G.tabH, tw = G.tabW, sl = G.slant;
    return `M${G.x0},${bottom} V${bodyTop + r} Q${G.x0},${bodyTop} ${G.x0 + r},${bodyTop} H${tx} L${tx + sl},${tt + r} Q${tx + sl},${tt} ${tx + sl + r},${tt}`
      + ` H${tx + tw - sl - r} Q${tx + tw - sl},${tt} ${tx + tw - sl},${tt + r} L${tx + tw},${bodyTop} H${G.x1 - r} Q${G.x1},${bodyTop} ${G.x1},${bodyTop + r} V${bottom} Z`;
  };
  tabs.forEach((label, i) => {
    const k = DEPTH.guides.length - rows + i, bodyTop = G.tabTop + G.tabH + i * G.pitch, tx = G.tabX[i], fill = L.guides[k];
    sheet(`<path d="${guidePath(bodyTop, tx)}" fill="${fill}" stroke="${c.angle}" stroke-width="${sw.edge}" stroke-linejoin="round"/>`);
    text(tx + G.slant + G.pad, bodyTop - G.tabH / 2 + 0.36 * size('tab'), label, 'tab', { fill: i === rows - 1 ? 'text' : 'text2' });
    const y = bodyTop + G.pitch / 2;
    sheet(`<path d="M${G.x0},${bottom} V${n(y)} H${G.x1} V${bottom} Z" fill="${fill}" stroke="${c.major}" stroke-width="${sw.plain}"/>`);
  });

  // the see-also card, half-raised behind the main card's top-right corner
  const S = g.see;
  sheet(rect(S.x0, S.top, S.x1 - S.x0, bottom - S.top, L.see, 'angle', sw.edge, 14));
  text(S.x0 + S.pad, S.top + S.bases[0], HEADS[0], 'seeh', { fill: LABEL });
  P.see_also.forEach((t, i) => text(S.x0 + S.pad, S.top + S.bases[i + 1], t, 'see'));

  // the main card: call number and entry, the stamp, the header line, the body (definition, collation, the pencilled correction, notes), tracings, rod hole
  sheet(rect(M.x0, T, M.x1 - M.x0, M.cover + 200, L.main, 'frame', sw.card, M.r));
  const { cx0, ex, i1, i2 } = column(g);
  P.call_number.forEach((t, i) => text(cx0, T + M.call[i], t, 'call'));
  text(ex, T + M.entry, P.main_entry, 'entry');
  {
    const A = M.stamp, str = stamp(p), w = cp(str) * adv('stamp'), bx1 = M.x1 - M.pad + A.padX, bx0 = bx1 - w - 2 * A.padX;
    const by0 = T + A.base - CAP * size('stamp') - A.padY, by1 = T + A.base + A.padY, cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2, t = tf(cx, cy, A.rot);
    s.push(`<rect x="${n(bx0 - cx)}" y="${n(by0 - cy)}" width="${n(bx1 - bx0)}" height="${n(by1 - by0)}" rx="4" fill="none" stroke="${c.rule}" stroke-width="${sw.stamp}" transform="${t}"/>`);
    s.push(`<text x="${n(bx0 + A.padX - cx)}" y="${n(by1 - A.padY - cy)}" transform="${t}" class="stamp" fill="${c.rule}">${esc(str)}</text>`);
  }
  line(M.x0 + 40, T + M.rule, M.x1 - 40, T + M.rule, 'rule', sw.rule);
  defLines(p, key).forEach((t, i) => text(i ? i1 : i2, T + M.def[0] + i * (M.def[1] - M.def[0]), t, 'def'));   // every line: a third one shows, and collides, for the checker
  const coll = P.collation, at = coll.indexOf(P.correction_struck), yb = T + M.coll;
  text(i2, yb, coll, 'coll');
  if (at >= 0) {   // the strike and the pencil above it are the sheet's one accent (a struck word the collation lacks is the checker's to report)
    const sx0 = i2 + cp(coll.slice(0, at)) * ADV * size('coll'), sx1 = sx0 + cp(P.correction_struck) * adv('coll'), sy = yb - 0.36 * size('coll');
    line(sx0 - 6, sy, sx1 + 6, sy, 'chip1', sw.strike, 'round');
    text((sx0 + sx1) / 2, T + M.pencil.base, P.correction_new, 'pen', { fill: 'chip1', anchor: 'middle', rot: M.pencil.rot });
  }
  P.notes.forEach((t, i) => text(i2, T + M.notes[i], t, 'note', { fill: 'text2' }));
  // tracings on the fixed grid: subject columns (arabic, a 3-character cell), then the added column (roman, 4)
  const cols = M.tr.cols.map(ch => i1 + ch * ADV * size('trs')), nr = M.tr.bases.length;
  P.tracings_subject.forEach((t, i) => {
    const x = cols[Math.floor(i / nr)], y = T + M.tr.bases[i % nr];
    text(x, y, `${i + 1}.`, 'num', { fill: LABEL });
    text(x + 3 * ADV * size('trs'), y, t, 'trs');
  });
  P.tracings_added.forEach((t, i) => {
    const x = cols.at(-1), y = T + M.tr.bases[i];
    text(x, y, ['I.', 'II.'][i], 'num', { fill: LABEL });
    text(x + 4 * ADV * size('tra'), y, t, 'tra');
  });
  const Ho = M.hole, hx = (M.x0 + M.x1) / 2, hy = T + Ho.cy, ro = Ho.r + sw.hole / 2;
  s.push(`<circle cx="${n(hx)}" cy="${n(hy)}" r="${Ho.r}" fill="${c.bg}" stroke="${c.frame}" stroke-width="${sw.hole}"/>`);
  text(hx, hy + ro + Ho.capGap + 0.87 * size('cap'), P.rod_invariant, 'cap', { fill: 'text2', anchor: 'middle' });

  // in front: a plain card, then the blank front guide with the phrase, centred optically on its visible face
  let y = T + M.cover;
  sheet(rect(G.x0, y, G.x1 - G.x0, bottom - y, L.front, 'angle', sw.edge, 12));
  y += g.front.h;
  sheet(rect(G.x0, y, G.x1 - G.x0, bottom - y + 40, L.blank, 'angle', sw.edge, 14));
  const ps = size('phr'), lines = key === 'phone' ? P.phrase : [P.phrase.join(' ')], pitch = lines.length > 1 ? g.phrasePitch : 0;
  const block = NUN[0] * ps + pitch * (lines.length - 1) + NUN[1] * ps, pb = y + (bottom - y - block) / 2 + NUN[0] * ps;
  lines.forEach((t, i) => text(cx0, pb + i * pitch, t, 'phr'));

  // the drawer front and the label holder: a plate (metal), the label card (the main card's paper), two rivets
  const [p0, p1] = D.panel, Hd = g.holder;
  sheet(rect(D.x0 - 10, p0, D.x1 - D.x0 + 20, p1 - p0, L.panel, 'frame', sw.frame, 10));
  const hw = 20 * adv('lab') + 2 * Hd.pad, mid = (D.x0 + D.x1) / 2, hy0 = Hd.top != null ? p0 + Hd.top : p0 + (p1 - p0 - Hd.h) / 2;   // sized for the 20-character limit, centred
  sheet(rect(mid - hw / 2 - Hd.plate, hy0 - 8, hw + 2 * Hd.plate, Hd.h + 16, L.metal, 'frame', sw.frame, 8));
  sheet(rect(mid - hw / 2, hy0, hw, Hd.h, L.main, 'frame', sw.holder, 3));
  for (const rx of [mid - hw / 2 - Hd.plate / 2, mid + hw / 2 + Hd.plate / 2]) s.push(`<circle cx="${n(rx)}" cy="${n(hy0 + Hd.h / 2)}" r="${sw.rivet}" fill="${c.frame}"/>`);
  text(mid, hy0 + Hd.h / 2 + 0.36 * size('lab'), P.drawer_label, 'lab', { anchor: 'middle' });

  // the circulation slip: a strip on the drawer's right wall (desktop, wide) or a row of three ruled cells (phone)
  const Sl = g.slip, dates = P.circulation_dates;
  let cx;
  if (Sl.vertical) {
    const h = Sl.top + dates.length * Sl.pitch + 10;
    sheet(rect(Sl.x, Sl.y, Sl.w, h, L.slip, 'angle', sw.edge, 6));
    text(Sl.x + Sl.pad, Sl.y + Sl.head, HEADS[1], 'slh', { fill: LABEL });
    dates.forEach((t, i) => {
      const yy = Sl.y + Sl.top + i * Sl.pitch;
      line(Sl.x + 16, yy, Sl.x + Sl.w - 16, yy, 'major', sw.slipRule);
      text(Sl.x + Sl.pad, yy + Sl.pitch / 2 + 0.36 * size('date'), t, 'date', { fill: 'text2', rot: ROTS[i] });
    });
    cx = Sl.x + Sl.w * g.clip.at;
  } else {
    sheet(rect(Sl.x, Sl.y, Sl.w, Sl.h, L.slip, 'angle', sw.edge, 6));
    const cell = Sl.max * adv('date');   // a rule in the middle of each gap between cells
    for (let i = 1; i < Sl.cols.length; i++) { const x = Sl.cols[i] - (Sl.cols[i] - (Sl.cols[i - 1] + cell)) / 2; line(x, Sl.y + 10, x, Sl.y + Sl.h - 10, 'major', sw.slipRule); }
    dates.forEach((t, i) => text(Sl.cols[i], Sl.y + Sl.h / 2 + 0.36 * size('date'), t, 'date', { fill: 'text2', rot: ROTS[i] }));
    cx = Sl.x + g.clip.at;
  }
  // the clip, seen from the front, centred on the slip's top edge: a black jaw (the ground's ink), wide at the bottom where it grips, and two wire
  // handles folded up and splayed outward as a V (D's clip). No loop over a body: that reads as a padlock.
  {
    const C = g.clip, y0 = Sl.y - C.h / 2, y1 = Sl.y + C.h / 2, lean = C.arm / 2;
    line(cx - C.wt / 2 + 8, y0 + 6, cx - C.wt / 2 - lean, y0 - C.arm, 'frame', sw.clip, 'round');
    line(cx + C.wt / 2 - 8, y0 + 6, cx + C.wt / 2 + lean, y0 - C.arm, 'frame', sw.clip, 'round');
    s.push(`<path d="M${n(cx - C.wt / 2)},${n(y0)} H${n(cx + C.wt / 2)} L${n(cx + C.wb / 2)},${n(y1)} H${n(cx - C.wb / 2)} Z" fill="${c.bg}" stroke="${c.frame}" stroke-width="${sw.clip}"/>`);
  }

  // chrome: the whoami box (desktop and wide grow upward from a fixed bottom), the status lines, the side label
  const Wm = g.who, wl = whoamiLines(handle, motto), sz = size('k'), wh = wl.length * Wm.lh + 2 * Wm.pad - (Wm.lh - sz) / 2, wx = g.R - Wm.w, wy = Wm.y ?? Wm.bottom - wh;
  s.push(rect(wx, wy, Wm.w, wh, 'bg', 'frame', sw.frame));
  wl.forEach((t, i) => text(wx + Wm.pad, wy + Wm.pad + sz * .8 + i * Wm.lh, t, 'k', { fill: i ? 'text2' : 'rule', pre: PRE }));
  text(g.L, g.data.y, P.data.left, 'd', { fill: 'data' });
  text(g.R, g.data.y, P.right.replaceAll('{handle}', handle || HANDLE), 'd', { fill: 'data', anchor: 'end' });   // the prompt is the viewer's
  if (g.vl && p.label != null) {   // reads bottom to top
    const V = g.vl, vs = size('vl'), va = Math.round(1.02 * vs), vd = Math.round(0.3 * vs), len = cp(p.label) * adv('vl');
    s.push(`<text x="0" y="0" transform="${tf(g.R + 60 + (va - vd) / 2, V.top + len, -90)}" class="vl" fill="${c.text2}">${esc(p.label)}</text>`);
  }

  const oflNotice = '<!-- Embedded fonts: Nunito (SIL OFL 1.1, Copyright 2014 The Nunito Project Authors) and JetBrains Mono (SIL OFL 1.1, Copyright 2020 The JetBrains Mono Project Authors). See fonts/README.md -->';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">`
    + `<title>${esc(`kernspace · Catalog Card · ${p.title ?? ''}`)}</title>${oflNotice}<style>${style(K, fonts || {})}</style>`
    + finish(s.join(''), grain) + '</svg>';
}
