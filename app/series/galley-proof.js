// Galley Proof: a real file set as a galley strip and read as a proof, marked with CMOS 18 proofreader's marks
// (series/galley-proof/README.md has the element map). One standalone SVG per preset; presets are data:
// series/galley-proof/presets/index.json lists them, one <id>.json each.
//
// Preset shape (limits in characters):
//   series:"galley-proof", topic, title, ground
//   phrase: 1-2 lines ≤18 · file ≤20 ([\w.-]+)                 the headline · the file under review
//   lines: 8-12 × ≤40                                          the file itself, set line for line (indent kept)
//   marks: 4-7 × { line, type, at?, to?, note ≤18, phone ≤14 (stet ≤10, tr/wf ≤12) } at most one per line; to ≤24
//     types: dele sub ins tr wf stet query space (`at` occurs once in its line; `to` for sub and ins; tr is never last)
//   errata: { line, throughout ≤36 }                           line = a `sub` mark the slip repeats · "for X read Y"
//   notes: 2-3 × ≤28 · label (vertical, fixed)
//   data: { left ≤44, right ≤44 ({handle} = the viewer's) } · phone: { data } overrides, like Cutting Mat's
import { FORMATS, HANDLE, esc, finish, whoamiLines } from '../render.js';

const SANS = 'KNunito,Nunito,sans-serif', MONO_FAM = 'KMono,"JetBrains Mono",ui-monospace,monospace';
const MONO = { asc: 1.02, desc: 0.3, adv: 0.6 };    // vertical metrics per em (hhea = OS/2 typo), as in cutting-mat.js
const ADV = MONO.adv;
const AUTHOR = '0xF3tt';                            // the proofreader's initials: author credit, never the handle

// geometry per format, px. Strip [x0, y0, x1, y1]; code lines sit at base + pitch × i; u = code px / 36 scales every mark.
// Margin items start at mar.x level with their line; the key (desktop and wide) sits right of them, two lines an entry. Keep-clear: top 110,
// bottom-centre 1300×220 (Dock); phone: y < 932 and the bottom 260.
const DESKTOP = {
  R: 3680, left: 160, strip: [300, 150, 1780, 1900], code: { x: 400, size: 48, base: 620, pitch: 88 }, gut: { x: 255, size: 32 },
  slug: { size: 30, base: 220, rule: 250 }, hl: { size: 112, x: 400, bases: [380, 500] }, foot: { rule: 1810, base: 1860, size: 30, end: 1120 },
  mar: { x: 1840, mt: 36, ml: 32, gl: 30 }, notes: { size: 30, bases: [300, 400, 500] },
  slip: { x: 1150, y: 1650, w: 820, h: 250, head: 30, body: 32, bases: [46, 92, 132, 182, 222] },
  key: { x: 2860, nx: 3010, head: 500, y: 620, dy: 176, size: 30, nsize: 36, gsize: 32, lh: 50 },
  who: { y: 1640, w: 820, size: 26, lh: 38, pad: 28 }, data: { y: 2000, size: 26 }, vl: { size: 24, ls: .12, top: 190 },
};
const WIDE = {
  ...DESKTOP, strip: [300, 150, 1780, 2130], code: { x: 400, size: 48, base: 640, pitch: 96 },
  slug: { size: 30, base: 225, rule: 255 }, hl: { size: 112, x: 400, bases: [390, 510] }, foot: { rule: 2040, base: 2090, size: 30, end: 1120 },
  slip: { ...DESKTOP.slip, y: 1770 },
  key: { ...DESKTOP.key, head: 510, y: 640, dy: 192 }, who: { ...DESKTOP.who, y: 1880 }, data: { y: 2240, size: 26 },
};
const PHONE = {
  R: 1200, left: 90, strip: [110, 960, 890, 2160], code: { x: 150, size: 30, base: 1290, pitch: 60 }, gut: { x: 96, size: 30 },
  slug: { size: 30, base: 1020, rule: 1040 }, hl: { size: 64, x: 150, bases: [1124, 1200] }, foot: { rule: 1990, base: 2030, size: 30, end: 810 },
  mar: { x: 930, mt: 30, ml: 30, gl: 30 }, notes: null,
  slip: { x: 330, y: 2070, w: 760, h: 250, head: 30, body: 30, bases: [48, 92, 130, 176, 214] },
  key: null, who: { y: 2340, w: 1110, size: 30, lh: 38, pad: 14 }, data: { y: 2525, size: 30 }, vl: null,
};
const SPECS = { desktop: DESKTOP, wide: WIDE, phone: PHONE };
const ROLES = ['bg', 'minor', 'major', 'angle', 'frame', 'rule', 'diag', 'text', 'text2', 'data', 'tb', 'sink', 'chip1', 'chip2', 'chip3'];
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\))$/i;
const FONT_URL = /^data:[\w/+.-]+;base64,[A-Za-z0-9+/=]*$/;
const PRE = ' xml:space="preserve"';
const KEY_HEAD = 'PROOF MARKS · CMOS 18';
// the key's name and gloss per mark type; the CWE ids name the weakness a mark corrects
const KEY = {
  dele: ['delete', 'remove what must not ship'], sub: ['replace', 'set the right value'], ins: ['insert', 'add the missing control'],
  tr: ['transpose', 'wrong order · CWE-696'], wf: ['wrong font', 'wrong type · CWE-843'], stet: ['let it stand', 'risk accepted, on record'],
  query: ['query', 'open question to the author'], space: ['insert space', 'keep apart · CWE-653'],
};
// margin glyphs in a 36-unit box (CMOS 18 fig. 2.6): the dele loop and the # for insert space
const LOOP = 'M0,0 H20 C30,0 34,-8 30,-14 C26,-20 17,-17 19,-10 C21,-3 31,-2 38,-9';
const HASH = 'M11,0 L15,-32 M21,0 L25,-32 M5,-11 H29 M7,-21 H31';
export { SPECS as GEOMETRY, AUTHOR, KEY, KEY_HEAD };

const n = v => +v.toFixed(2);                       // short, stable numbers
const cp = s => [...s].length;
const pad2 = v => String(v).padStart(2, '0');
const volOf = p => +/\d+/.exec(p.title ?? '')?.[0];

// `N lines · C changes · Q queries · S stet`, groups with none left out; stet is invariant
export function tally(p) {
  const k = t => p.marks.filter(m => t.includes(m.type)).length, one = (v, w, pl = w + 's') => `${v} ${v === 1 ? w : pl}`;
  const changes = k(['dele', 'sub', 'ins', 'tr', 'wf', 'space']), queries = k(['query']), stet = k(['stet']);
  return [one(p.lines.length, 'line'), changes && one(changes, 'change'), queries && one(queries, 'query', 'queries'), stet && `${stet} stet`].filter(Boolean).join(' · ');
}

// the errata slip's four body lines: the sub mark at errata.line, then the editable "throughout" correction
export function slip(p, vol) {
  const m = p.marks.find(x => x.line === p.errata?.line && x.type === 'sub');
  return [`${p.file}, l. ${p.errata?.line}:`, `for ${m?.at} read ${m?.to}`, 'throughout:', p.errata?.throughout];
}

function checkColors(c) {
  for (const k of ROLES) if (!COLOR.test(c?.[k] ?? '')) throw new Error(`galley-proof: bad color ${k}`);
  return c;
}

function formatKey(format) {
  if (typeof format === 'string') return format;
  return Object.keys(FORMATS).find(k => FORMATS[k].w === format?.w && FORMATS[k].h === format?.h);
}

function style(g, fonts) {
  const face = (fam, url, wght) => {
    if (!url) return '';
    if (!FONT_URL.test(url)) throw new Error(`galley-proof: ${fam} must be a base64 data: URL`);
    return `@font-face{font-family:${fam};src:url("${url}") format("truetype");font-weight:${wght}}`;
  };
  const mono = (cls, size, wght) => `.${cls}{font-size:${size}px;font-weight:${wght}}`;
  const sans = (cls, size) => `.${cls}{font-family:${SANS};font-weight:300;font-size:${size}px}`;
  return face('KNunito', fonts.nunito, '200 1000') + face('KMono', fonts.jbm, '100 800')
    + `text{font-family:${MONO_FAM};font-weight:400;font-variant-ligatures:none}`     // no ligatures: !== and -- read as typed
    + mono('sl', g.slug.size, 500) + sans('hl', g.hl.size) + mono('gn', g.gut.size, 400) + mono('cd', g.code.size, 400)
    + mono('ty', g.foot.size, 300) + mono('mt', g.mar.mt, 400) + sans('ml', g.mar.ml) + mono('eh', g.slip.head, 500) + mono('eb', g.slip.body, 400)
    + mono('k', g.who.size, 400) + `.k,.cd,.eh,.eb,.mt{white-space:pre}` + mono('d', g.data.size, 300)
    + (g.notes ? mono('nt', g.notes.size, 400) + sans('gl', g.mar.gl) : '')
    + (g.key ? mono('kh', g.key.size, 500) + mono('kn', g.key.nsize, 500) + sans('kg', g.key.gsize) : '')
    + (g.vl ? `.vl{font-size:${g.vl.size}px;letter-spacing:${g.vl.ls}em;font-weight:300}` : '');
}

// a glyph template placed at (ox, oy) and scaled by s: absolute M L H V C only
const place = (d, ox, oy, s) => [...d.matchAll(/([MLHVC])([^MLHVC]*)/g)].map(([, c, a]) => {
  const v = a.trim().split(/[ ,]+/).map(Number);
  if (c === 'H') return `H${n(ox + v[0] * s)}`;
  if (c === 'V') return `V${n(oy + v[0] * s)}`;
  const pts = [];
  for (let i = 0; i < v.length; i += 2) pts.push(`${n(ox + v[i] * s)},${n(oy + v[i + 1] * s)}`);
  return c + pts.join(' ');
}).join(' ');

// an open ring, drawn like a pen: four cubic quadrants from the left, then a fifth that overlaps the start by about 20° and
// ends a little inside it. Starting on an axis keeps the control hull inside the ellipse's bounding box.
function ring(cx, cy, rx, ry) {
  const P = (t, k = 1) => [cx + rx * k * Math.cos(t), cy + ry * k * Math.sin(t)], D = (t, k = 1) => [-rx * k * Math.sin(t), ry * k * Math.cos(t)];
  const arc = (t0, t1, k = 1) => {
    const q = 4 / 3 * Math.tan((t1 - t0) / 4), [x0, y0] = P(t0), [dx0, dy0] = D(t0), [x1, y1] = P(t1, k), [dx1, dy1] = D(t1, k);
    return `C${n(x0 + q * dx0)},${n(y0 + q * dy0)} ${n(x1 - q * dx1)},${n(y1 - q * dy1)} ${n(x1)},${n(y1)}`;
  };
  const t = Math.PI, [sx, sy] = P(t);
  return `M${n(sx)},${n(sy)} ` + [0, 1, 2, 3].map(i => arc(t + i * t / 2, t + (i + 1) * t / 2)).join(' ') + ` ${arc(3 * t, 3 * t + .35, .94)}`;
}

// preset: parsed presets/<slug>.json · colors: one palette ground · format: FORMATS key · grain: the film grain finish
export function render({ preset: p, colors, format = 'desktop', handle, motto, fonts, grain = false }) {
  const key = formatKey(format), g = SPECS[key];
  if (!g) throw new Error(`galley-proof: unknown format ${format}`);
  if (!p?.lines) throw new Error('galley-proof: preset must be a parsed preset object');
  const c = checkColors(colors?.colors ?? colors);
  const { w: W, h: H } = FORMATS[key], phone = key === 'phone', s = [], C = g.code, u = C.size / 36, vol = pad2(volOf(p));
  const [sx0, sy0, sx1, sy1] = g.strip, end = ' text-anchor="end"', mid = ' text-anchor="middle"';
  const line = (x1, y1, x2, y2, stroke, w) =>
    s.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${w}"/>`);
  const rect = (x, y, w, h, fill, more = '', stroke = '') =>
    s.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${phone ? 2.5 : 3}"` : ''}${more}/>`);
  const text = (x, y, str, cls, fill, more = '') => str != null &&
    s.push(`<text x="${n(x)}" y="${n(y)}" class="${cls}"${fill ? ` fill="${fill}"` : ''}${more}>${esc(str)}</text>`);
  const path = (d, w = 3 * u) => s.push(`<path d="${d}" fill="none" stroke="${c.chip1}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  const circled = (label, x, b, size) => {   // a circled marginal instruction; returns the ring's right edge
    const rx = cp(label) * .6 * size / 2 + 12 * u;   // 0.6 em per char is a conservative Nunito width: the ring is never short
    path(ring(x + rx, b - .37 * size, rx, .8 * size));
    text(x + rx, b, label, 'ml', c.chip1, mid);
    return x + 2 * rx;
  };
  // the margin glyph of a type (also the key's); sub and ins have none in the margin, the key shows a strike and a caret
  const glyph = (type, x, b) => {
    if (type === 'dele') { path(place(LOOP, x, b - 10 * u, u)); return x + 38 * u; }
    if (type === 'space') { path(place(HASH, x, b, u)); return x + 34 * u; }
    if (type === 'sub') { path(`M${n(x)},${n(b - 10 * u)} H${n(x + 30 * u)}`); return x + 30 * u; }
    if (type === 'ins') { path(`M${n(x + 3 * u)},${n(b - 4 * u)} L${n(x + 10 * u)},${n(b - 16 * u)} L${n(x + 17 * u)},${n(b - 4 * u)}`); return x + 17 * u; }
    return circled(type === 'query' ? '?' : type, x, b, g.mar.ml);
  };

  rect(0, 0, W, H, c.bg);
  rect(sx0, sy0, sx1 - sx0, sy1 - sy0, c.minor);
  // head slug, the proofreader's initials (an author credit, never the viewer's handle), the hairline under them
  text(C.x, g.slug.base, `GALLEY ${vol} · ${p.file}`, 'sl', c.text2);
  if (!phone) text(sx1 - 80, g.slug.base, AUTHOR, 'sl', c.text2, end);
  line(C.x, g.slug.rule, sx1 - 80, g.slug.rule, c.rule, 2);
  (p.phrase ?? []).forEach((ph, i) => text(g.hl.x, g.hl.bases[i], ph, 'hl', c.text));

  // the file, one row per line: gutter number, code (indent as an x offset), then its mark in the text and in the margin
  const gap = 24 * u, M = g.mar, used = [];
  p.lines.forEach((ln, i) => {
    const b = C.base + i * C.pitch, t = ln.trimStart(), x = C.x + (ln.length - t.length) * ADV * C.size, m = p.marks?.find(k => k.line === i + 1);
    text(g.gut.x, b, i + 1, 'gn', c.rule, end);
    text(x, b, t, 'cd', c.text, PRE);
    if (!m) return;
    if (!used.includes(m.type)) used.push(m.type);
    const at = m.at ?? '', at0 = cp(t.slice(0, Math.max(t.indexOf(at), 0))), x0 = x + at0 * ADV * C.size, x1 = x0 + cp(at) * ADV * C.size;
    // in the text: a strike (dele, sub, stet), a caret (ins, space), a ring (wf), an S-curve left of the code (tr)
    if (['dele', 'sub', 'stet'].includes(m.type)) path(`M${n(x0 - 4 * u)},${n(b - 10 * u)} H${n(x1 + 4 * u)}`);
    if (m.type === 'stet') {   // dots under the struck span, every 9u, centred
      const k = Math.floor((x1 - x0) / (9 * u)), dots = [];
      for (let j = 0; j <= k; j++) dots.push(`M${n(x0 + ((x1 - x0) - k * 9 * u) / 2 + j * 9 * u)},${n(b + 13 * u)}`);
      path(dots.map(d => `${d} L${d.slice(1)}`).join(' '), 4.5 * u);
    }
    if (m.type === 'ins' || m.type === 'space') {
      const q = [...t][at0 - 1] === ' ' ? x0 - .3 * C.size : x0;   // between two words: the middle of the space
      path(`M${n(q - 7 * u)},${n(b + 20.5 * u)} L${n(q)},${n(b + 6.5 * u)} L${n(q + 7 * u)},${n(b + 20.5 * u)}`);
    }
    if (m.type === 'wf') path(ring((x0 + x1) / 2, b - 12 * u, (x1 - x0) / 2 + 8 * u, 24 * u));
    if (m.type === 'tr') {
      const xl = C.x - 46 * u, xr = C.x - 5.5 * u, y0 = b - 28 * u, y1 = b + C.pitch + 8 * u, ym = (y0 + y1) / 2, xm = (xl + xr) / 2;
      path(`M${n(xr)},${n(y0)} C${n(xl)},${n(y0)} ${n(xl)},${n(ym)} ${n(xm)},${n(ym)} C${n(xr)},${n(ym)} ${n(xr)},${n(y1)} ${n(xl)},${n(y1)}`);
    }
    // in the margin, level with the line: symbol or matter, then the gloss (the phone draws its short form instead)
    let cx = M.x;
    if (m.type === 'query') return void circled(phone ? m.phone : m.note, cx, b, M.ml);
    if (m.type === 'sub' || m.type === 'ins') {
      const to = phone ? m.phone : m.to;
      text(cx, b, to, 'mt', c.text, PRE);
      cx += cp(to) * ADV * M.mt + gap;
    } else cx = glyph(m.type, cx, b) + gap;
    if (phone) m.type !== 'sub' && m.type !== 'ins' && text(cx, b, m.phone, 'mt', c.text, PRE);
    else text(cx, b, m.note, 'gl', c.text2);
  });

  // foot: hairline and the tally; the notes in the margin head
  line(C.x, g.foot.rule, g.foot.end, g.foot.rule, c.rule, 2);
  text(C.x, g.foot.base, tally(p), 'ty', c.text2);
  if (g.notes) (p.notes ?? []).forEach((note, i) => {
    const w = cp(note) * ADV * g.notes.size, rx = w / 2 + 60 * u, b = g.notes.bases[i];
    path(ring(M.x + rx, b - .3 * g.notes.size, rx, 1.2 * g.notes.size));
    text(M.x + 60 * u, b, note, 'nt', c.text);
  });

  // the errata slip, tipped in askew: inverse (text fill, bg ink), the paste strip on its left edge; every element carries the turn
  const S = g.slip, tf = ` transform="translate(${S.x},${S.y}) rotate(-1.5)"`;
  rect(0, 0, S.w, S.h, c.text, tf);
  rect(0, 0, 22, S.h, c.minor, tf);
  text(52, S.bases[0], `ERRATA · GALLEY ${vol}`, 'eh', c.bg, tf);
  slip(p, volOf(p)).forEach((l, i) => text(52, S.bases[i + 1], l, 'eb', c.bg, PRE + tf));

  // the key: the marks this sheet uses, in order of first use, each with its glyph, name and gloss (desktop and wide)
  if (g.key) {
    const K = g.key;
    text(K.x, K.head, KEY_HEAD, 'kh', c.rule);
    const dy = Math.min(K.dy, (g.who.y - 150 - K.y - K.lh) / Math.max(used.length - 1, 1));   // spread on the baseline grid, squeezed so the fullest key still clears the whoami box
    used.forEach((t, i) => {
      const b = K.y + i * dy;
      glyph(t, K.x, b);
      text(K.nx, b, KEY[t][0], 'kn', c.text);
      text(K.nx, b + K.lh, KEY[t][1], 'kg', c.text2);
    });
  }

  // the whoami box, then the status lines
  const Wm = g.who, wx = g.R - Wm.w, wl = whoamiLines(handle, motto), wh = wl.length * Wm.lh + 2 * Wm.pad - (Wm.lh - Wm.size) / 2;
  rect(wx, Wm.y, Wm.w, wh, c.bg, '', c.frame);
  wl.forEach((t, i) => text(wx + Wm.pad, Wm.y + Wm.pad + Wm.size * .8 + i * Wm.lh, t, 'k', i ? c.text2 : c.rule, PRE));
  const D = g.data, data = { ...p.data, ...(phone ? p.phone?.data : null) };
  text(g.left, D.y, data.left, 'd', c.data);
  text(g.R, D.y, data.right?.replaceAll('{handle}', handle || HANDLE), 'd', c.data, end);   // the prompt is the viewer's

  // side label reading bottom to top (desktop and wide)
  if (g.vl && p.label != null) {
    const V = g.vl, va = Math.round(MONO.asc * V.size), vd = Math.round(MONO.desc * V.size), len = cp(p.label) * (ADV + V.ls) * V.size;
    s.push(`<text transform="translate(${n(g.R + 60 + (va - vd) / 2)},${n(V.top + len)}) rotate(-90)" class="vl" fill="${c.text2}">${esc(p.label)}</text>`);
  }

  const oflNotice = '<!-- Embedded fonts: Nunito (SIL OFL 1.1, Copyright 2014 The Nunito Project Authors) and JetBrains Mono (SIL OFL 1.1, Copyright 2020 The JetBrains Mono Project Authors). See fonts/README.md -->';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<title>${esc(`kernspace · Galley Proof · ${p.title ?? ''}`)}</title>${oflNotice}<style>${style(g, fonts || {})}</style>`
    + finish(s.join(''), grain) + '</svg>';
}
