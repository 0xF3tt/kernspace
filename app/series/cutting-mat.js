// Cutting Mat: the self-healing mat on a designer's desk, read as a threat model.
// Port of render_desktop.py / render_phone.py: same grid, marks and copy, as one standalone SVG.
// Presets are data: series/cutting-mat/presets/index.json lists them, one <id>.json each.
import { FORMATS, HANDLE, esc, whoamiLines } from '../render.js';

const AUTHOR = '0xF3tt';                            // side signature: author credit, never the handle
const SANS = 'KNunito,Nunito,sans-serif', MONO_FAM = 'KMono,"JetBrains Mono",ui-monospace,monospace';
// vertical metrics per em (hhea = OS/2 typo in both files): place text where the old HTML boxes did
const NUNITO = { asc: 1.011, desc: 0.353 };
const MONO = { asc: 1.02, desc: 0.3, adv: 0.6 };

// geometry per format: U = cell, grid positions in cells (panels: [col0, col1, row0, row1]), the rest in px
const DESKTOP = {
  U: 80, X0: 240, Y0: 160, COLS: 42, ROWS: 22, ty: 7,
  sw: { minor: 1.5, half: 1, major: 2.5, ray: 2.5, tb: 4, diag: 3, frame: 3.5, panel: 2.5 },
  majorCols: [1, 6, 11, 16, 26, 31, 36, 41], majorRows: [9, 13],
  rays: [60, 30, 15], dash: '14 12', flowAt: [[60, 1640], [30, 3080], [15, 2860]], flowDy: -14,
  tb: [[17, 'ISB-01', 'right'], [5, 'ISB-02', 'right']],
  tag: { dash: '30 14', cw: 12.1, pad: 36, inset: 24, h: 40, rx: 6, sw: 2, dy: 7, halo: true },
  source: { p: 3, r: 11, dx: 30, dy: 26 },
  control: { s: 16, i: 6, sw: 3, dx: 34, dy: 46 },
  sink: { p: 20, r: 12, dx: 30, dy: 26 },
  ruler: { gap: 6, top: 22, bot: 20, side: 22, half: { top: 14, bot: 12, side: 14 }, sw: 2, swHalf: 1.5, hexY: 38, addrX: 36, numX: 36, every: 1 },
  panels: { phrase: [16, 26, 9, 13], para: [31, 41, 18, 21], side: [1, 3, 6, 16], term: [24, 32, 1, 4] },
  chip: { in: 8, hy: 30, hh: 20, hly: 84, vx: 30, vw: 20, vlx: 68, q: 22, qs: 36, qlx: 76 },
  note: { t: 12, sw: 2, dx: 14 },
  font: {
    r: { size: 19, ls: .02 }, t: { size: 20, halo: 10 }, phrase: { size: 92, lh: 1.12, ls: -.005 },
    para: { pad: 44, size: 21, lh: 33 }, term: { pad: 36, size: 19, lh: 30 }, side: { top: 30, gap: 34 },
    sig: { size: 28, ls: .02 }, vlab: { size: 18, ls: .12 }, data: { dy: 40, size: 20, ls: .04 },
  },
};

// 16:10 = desktop + 3 rows (bottom margin stays 240). Top marks keep their rows, bottom marks
// move 3, phrase and side panels 1. Rays still start bottom-left, so the sink climbs the diagonal
// to stay on row 2 (label on the left, clear of the terminal) and the 60°/30° labels move out past ISB-02.
// The terminal moves one column right: at col 24 its corner sits on the diagonal (col + row = 25).
const WIDE = {
  ...DESKTOP, ROWS: 25, majorRows: [10, 14],
  flowAt: [[60, 1920], [30, 3400], [15, 2860]],
  tb: [[20, 'ISB-01', 'right'], [5, 'ISB-02', 'right']],
  sink: { p: 23, r: 12, dx: -30, dy: -22, end: true },
  panels: { phrase: [16, 26, 10, 14], para: [31, 41, 21, 24], side: [1, 3, 7, 17], term: [25, 33, 1, 4] },
  // chips/notes: rows <= 8 keep, >= 14 move 3, rows 9-13 in between (keeps Break's square off the 60° ray)
  shift: r => Math.min(3, Math.max(0, Math.round((r - 8) / 2))),
};

const PHONE = {
  U: 60, X0: 105, Y0: 280, COLS: 18, ROWS: 36, ty: 5,
  sw: { minor: 1.2, half: .8, major: 2, ray: 2, tb: 3, diag: 2.5, frame: 3, panel: 2 },
  majorCols: [3, 9, 15], majorRows: [11, 15, 27],
  rays: [75, 60, 30, 15], dash: '11 9', flowAt: [[60, 725], [30, 485], [15, 560]], flowDy: -11,
  tb: [[32, 'ISB-01', 'right'], [22, 'ISB-02', 'left']],      // tag on the side away from the crossing
  tag: { dash: '22 10', cw: 9.6, pad: 28, inset: 18, h: 32, rx: 5, sw: 1.8, dy: 6, halo: false },
  source: { p: 2, r: 9, dx: 24, dy: 22 },
  control: { s: 13, i: 5, sw: 2.5, dx: 26, dy: 38 },
  sink: { p: 16, r: 10, dx: -24, dy: -18, end: true },
  ruler: { gap: 5, top: 18, bot: 16, side: 16, half: { top: 11, bot: 10, side: 0 }, sw: 1.6, swHalf: 1.2, hexY: 28, addrX: 24, numX: 26, every: 2 },
  panels: { phrase: [3, 15, 11, 15], para: [9, 17, 27, 29], side: [1, 3, 23, 31], term: [3, 11, 16, 20] },
  chip: { in: 6, hy: 22, hh: 16, hly: 66, vx: 22, vw: 16, vlx: 52, q: 16, qs: 28, qlx: 58 },
  note: { t: 10, sw: 1.6, dx: 11 },
  font: {
    r: { size: 15, ls: 0 }, t: { size: 16, halo: 8 }, phrase: { size: 70, lh: 1.1, ls: 0 },
    para: { pad: 18, size: 14.5, lh: 25 }, term: { pad: 20, size: 14.5, lh: 25 }, side: { top: 22, gap: 24 },
    sig: { size: 21, ls: 0 }, vlab: { size: 13.5, ls: .1 }, data: { dy: 34, size: 15, ls: 0 },
  },
};

const SPECS = { desktop: DESKTOP, wide: WIDE, phone: PHONE };
const ROLES = ['bg', 'minor', 'major', 'angle', 'frame', 'rule', 'diag', 'text', 'text2', 'data', 'tb', 'sink', 'chip1', 'chip2', 'chip3'];
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\))$/i;
const FONT_URL = /^data:[\w/+.-]+;base64,[A-Za-z0-9+/=]*$/;
const PRE = ' xml:space="preserve"';

const n = v => +v.toFixed(2);                       // short, stable numbers
const rad = d => d * Math.PI / 180;
const hex = (v, w) => v.toString(16).toUpperCase().padStart(w, '0');
const ad = (m, size) => [Math.round(m.asc * size), Math.round(m.desc * size)];   // Blink rounds both

// baselines of `count` HTML lines (line-height lh) centered in [y0, y1]; half-leading floored like Blink
function stack(m, size, lh, count, y0, y1) {
  const [a, d] = ad(m, size), top = y0 + (y1 - y0 - count * lh) / 2, lead = Math.floor((lh - a - d) / 2);
  return Array.from({ length: count }, (_, i) => top + i * lh + lead + a);
}

// palette colors land in attributes and CSS: accept only plain hex / rgb() values
function checkColors(c) {
  for (const k of ROLES) if (!COLOR.test(c?.[k] ?? '')) throw new Error(`cutting-mat: bad color ${k}`);
  return c;
}

function formatKey(format) {
  if (typeof format === 'string') return format;
  return Object.keys(FORMATS).find(k => FORMATS[k].w === format?.w && FORMATS[k].h === format?.h);
}

function style(c, F, fonts) {
  const face = (fam, url, wght) => {
    if (!url) return '';
    if (!FONT_URL.test(url)) throw new Error(`cutting-mat: ${fam} must be a base64 data: URL`);
    return `@font-face{font-family:${fam};src:url("${url}") format("truetype");font-weight:${wght}}`;
  };
  return face('KNunito', fonts.nunito, '200 1000') + face('KMono', fonts.jbm, '100 800')
    + `text{font-family:${MONO_FAM};font-variant-ligatures:none}`    // no ligatures: !== and -- read as typed
    + `.r{font-weight:300;font-size:${F.r.size}px;letter-spacing:${F.r.ls}em;fill:${c.rule}}`
    // halo labels: no letter-spacing. With it, WebKit (Safari, every iOS browser) paints glyph by glyph, and each
    // glyph's halo erases the right edge of the one before it (owner reads "cwner")
    + `.t{font-size:${F.t.size}px;letter-spacing:0;paint-order:stroke;stroke:${c.bg};stroke-width:${F.t.halo}px;stroke-linejoin:round}`
    + '.n{stroke-width:0}'
    + `.ph{font-family:${SANS};font-weight:300;font-size:${F.phrase.size}px;letter-spacing:${F.phrase.ls}em}`
    + `.w{font-size:${F.para.size}px}.k{font-size:${F.term.size}px}.w,.k{white-space:pre}`
    + `.sg{font-weight:500;font-size:${F.sig.size}px;letter-spacing:${F.sig.ls}em}`
    + `.vl{font-size:${F.vlab.size}px;letter-spacing:${F.vlab.ls}em}`
    + `.d{font-weight:300;font-size:${F.data.size}px;letter-spacing:${F.data.ls}em}`;
}

// preset: parsed presets/<slug>.json · colors: one palette ground · format: FORMATS key
export function render({ preset: p, colors, format = 'desktop', handle, motto, fonts }) {
  const key = formatKey(format), g = SPECS[key];
  if (!g) throw new Error(`cutting-mat: unknown format ${format}`);
  if (!p?.layout) throw new Error('cutting-mat: preset must be a parsed preset object');
  const c = checkColors(colors?.colors ?? colors);
  const { w: W, h: H } = FORMATS[key], { U, X0, Y0, COLS, ROWS, sw, ty } = g, F = g.font;
  const X1 = X0 + COLS * U, Y1 = Y0 + ROWS * U, ox = X0, oy = Y1;
  const gx = u => X0 + u * U, gy = r => Y0 + r * U;
  const lay = p.layout[key === 'phone' ? 'phone' : 'desktop'], shift = g.shift ?? (() => 0);
  const at = ([col, row]) => [gx(col), gy(row + shift(row))];
  const box = k => { const [c0, c1, r0, r1] = g.panels[k]; return [gx(c0), gy(r0), gx(c1), gy(r1)]; };
  const s = [];
  const line = (x1, y1, x2, y2, stroke, w, more = '') =>
    s.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${w}"${more}/>`);
  const rect = (x, y, w, h, fill, more = '') =>
    s.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${more}/>`);
  const dot = (x, y, r, fill) => s.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="${fill}"/>`);
  const text = (x, y, str, cls, fill, more = '') => str != null &&
    s.push(`<text x="${n(x)}" y="${n(y)}" class="${cls}"${fill ? ` fill="${fill}"` : ''}${more}>${esc(str)}</text>`);

  // minor grid + half units, then the major grid
  for (let i = 1; i < COLS; i++) line(gx(i), Y0, gx(i), Y1, c.minor, sw.minor);
  for (let j = 1; j < ROWS; j++) line(X0, gy(j), X1, gy(j), c.minor, sw.minor);
  for (let i = 0; i < COLS; i++) line(gx(i) + U / 2, Y0, gx(i) + U / 2, Y1, c.minor, sw.half, ' opacity=".35"');
  for (let j = 0; j < ROWS; j++) line(X0, gy(j) + U / 2, X1, gy(j) + U / 2, c.minor, sw.half, ' opacity=".35"');
  for (const i of g.majorCols) line(gx(i), Y0, gx(i), Y1, c.major, sw.major);
  for (const j of g.majorRows) line(X0, gy(j), X1, gy(j), c.major, sw.major);

  // other flows: dashed angle lines from the origin (source), labeled at distance d
  const ray = deg => {
    const t = Math.tan(rad(deg)), xt = ox + (Y1 - Y0) / t;
    return xt <= X1 ? [xt, Y0] : [X1, oy - (X1 - ox) * t];
  };
  for (const deg of g.rays) line(ox, oy, ...ray(deg), c.angle, sw.ray, ` stroke-dasharray="${g.dash}"`);
  g.flowAt.forEach(([deg, d], i) => p.flows?.[i] != null && s.push(
    `<text transform="translate(${Math.round(ox + d * Math.cos(rad(deg)))},${Math.round(oy - d * Math.sin(rad(deg)))}) rotate(${-deg})"`
    + ` y="${g.flowDy}" class="t" fill="${c.angle}">${esc(p.flows[i])}</text>`));

  // trust boundaries
  const T = g.tag;
  for (const [row, lab, side] of g.tb) {
    const y = gy(row), w = lab.length * T.cw + T.pad, x = side === 'right' ? X1 - T.inset - w : X0 + T.inset;
    line(X0, y, X1, y, c.tb, sw.tb, ` stroke-dasharray="${T.dash}"`);
    rect(x, y - T.h / 2, w, T.h, c.bg, ` rx="${T.rx}" stroke="${c.tb}" stroke-width="${T.sw}"`);
    text(x + w / 2, y + T.dy, lab, T.halo ? 't' : 't n', c.tb, ' text-anchor="middle"');
  }

  // taint path: the 45° diagonal from source to sink, one control per boundary crossing
  line(ox, oy, ...ray(45), c.diag, sw.diag);
  const S = g.source, sp = S.p * U;
  dot(ox + sp, oy - sp, S.r, c.diag);
  text(ox + sp + S.dx, oy - sp + S.dy, p.source, 't', c.text2);
  const K = g.control;
  g.tb.forEach(([row], i) => {
    if (p.controls?.[i] == null) return;
    const y = gy(row), x = ox + (oy - y);
    rect(x - K.s, y - K.s, 2 * K.s, 2 * K.s, c.bg, ` stroke="${c.diag}" stroke-width="${K.sw}"`);
    rect(x - K.i, y - K.i, 2 * K.i, 2 * K.i, c.diag);
    text(x + K.dx, y + K.dy, p.controls[i], 't', c.text2);
  });
  const Z = g.sink, zx = ox + Z.p * U, zy = oy - Z.p * U;
  dot(zx, zy, Z.r, c.sink);
  text(zx + Z.dx, zy + Z.dy, p.sink, 't', c.text2, Z.end ? ' text-anchor="end"' : '');

  // frame + rulers: hex offsets on top, addresses on the left, line numbers on the right
  rect(X0, Y0, X1 - X0, Y1 - Y0, 'none', ` stroke="${c.frame}" stroke-width="${sw.frame}"`);
  const R = g.ruler, hf = R.half;
  for (let i = 0; i <= COLS; i++) {
    const x = gx(i);
    line(x, Y0 - R.top, x, Y0 - R.gap, c.rule, R.sw);
    text(x, Y0 - R.hexY, hex(i, 2), 'r', null, ' text-anchor="middle"');
    line(x, Y1 + R.gap, x, Y1 + R.bot, c.rule, R.sw);
  }
  for (let i = 0; i < COLS; i++) {
    const x = gx(i) + U / 2;
    line(x, Y0 - hf.top, x, Y0 - R.gap, c.rule, R.swHalf);
    line(x, Y1 + R.gap, x, Y1 + hf.bot, c.rule, R.swHalf);
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = gy(r);
    line(X0 - R.side, y, X0 - R.gap, y, c.rule, R.sw);
    line(X1 + R.gap, y, X1 + R.side, y, c.rule, R.sw);
    if (r % R.every === 0) text(X0 - R.addrX, y + ty, `0x${hex(r * 16, 4)}`, 'r', null, ' text-anchor="end"');
  }
  for (let r = 0; r < ROWS; r++) {
    const y = gy(r) + U / 2;
    if (hf.side) {
      line(X0 - hf.side, y, X0 - R.gap, y, c.rule, R.swHalf);
      line(X1 + R.gap, y, X1 + hf.side, y, c.rule, R.swHalf);
    }
    text(X1 + R.numX, y + ty, r + 1, 'r');
  }

  // cut-out panels: phrase, whoami box, side, terminal
  for (const k of ['phrase', 'para', 'side', 'term']) {
    const [a, b, x1, y1] = box(k);
    rect(a, b, x1 - a, y1 - b, c.bg, ` stroke="${c.major}" stroke-width="${sw.panel}"`);
  }

  // findings: three bits of tape (horizontal, vertical, square)
  const C = g.chip, f = p.findings ?? [], [[hx, hy], [vx, vy], [qx, qy]] = lay.chips.map(at);
  rect(hx + C.in, hy + C.hy, 2 * U - 2 * C.in, C.hh, c.chip1, ` rx="${C.hh / 2}"`);
  text(hx + C.in, hy + C.hly, f[0], 't', c.text2);
  rect(vx + C.vx, vy + C.in, C.vw, 2 * U - 2 * C.in, c.chip2, ` rx="${C.vw / 2}"`);
  text(vx + C.vlx, vy + U + ty, f[1], 't', c.text2);
  rect(qx + C.q, qy + C.q, C.qs, C.qs, c.chip3);
  text(qx + C.qlx, qy + U / 2 + ty, f[2], 't', c.text2);

  // margin notes, each with a measurement tick
  const N = g.note;
  lay.notes.forEach((pos, i) => {
    if (p.notes?.[i] == null) return;
    const [x, y] = at(pos);
    line(x, y - N.t, x, y + N.t, c.rule, N.sw);
    text(x + N.dx, y + ty, p.notes[i], 't', c.rule);
  });

  // side panel: signature, then the label reading bottom to top
  const [sx0, sy0, sx1] = box('side'), cx = (sx0 + sx1) / 2, top = sy0 + F.side.top;
  const [sa, sd] = ad(MONO, F.sig.size), [va, vd] = ad(MONO, F.vlab.size);
  text(cx, top + sa, AUTHOR, 'sg', c.text, ' text-anchor="middle"');
  if (p.label != null) {
    const len = [...p.label].length * (MONO.adv + F.vlab.ls) * F.vlab.size, y = top + sa + sd + F.side.gap + len;
    s.push(`<text transform="translate(${n(cx + (va - vd) / 2)},${n(y)}) rotate(-90)" class="vl" fill="${c.text2}">${esc(p.label)}</text>`);
  }

  // phrase: two lines centered in their panel
  const [bx0, by0, bx1, by1] = box('phrase'), PH = F.phrase, phrase = [].concat(p.phrase ?? []);
  stack(NUNITO, PH.size, PH.size * PH.lh, phrase.length, by0, by1)
    .forEach((y, i) => text((bx0 + bx1) / 2, y, phrase[i], 'ph', c.text, ' text-anchor="middle"'));

  // whoami box and terminal panel: first line in the rule color, the rest in text2
  const block = (k, P, lines) => {
    const [x0, y0, , y1] = box(k);
    stack(MONO, P.size, P.lh, lines.length, y0, y1)
      .forEach((y, i) => text(x0 + P.pad, y, lines[i], k === 'para' ? 'w' : 'k', i ? c.text2 : c.rule, PRE));
  };
  block('para', F.para, whoamiLines(handle, motto));
  block('term', F.term, p.panel ? [p.panel.title, ...(p.panel.lines ?? [])] : []);

  // status lines under the frame (phone overrides merge key by key, like PHONE_OVERRIDES)
  const D = F.data, data = { ...p.data, ...(key === 'phone' ? p.phone?.data : null) }, dy = Y1 + D.dy + ad(MONO, D.size)[0];
  text(X0, dy, data.left, 'd', c.data);
  text(X1, dy, data.right?.replaceAll('{handle}', handle || HANDLE), 'd', c.data, ' text-anchor="end"');   // the prompt is the viewer's

  const oflNotice = '<!-- Embedded fonts: Nunito (SIL OFL 1.1, Copyright 2014 The Nunito Project Authors) and JetBrains Mono (SIL OFL 1.1, Copyright 2020 The JetBrains Mono Project Authors). See fonts/README.md -->';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<title>${esc(`kernspace · Cutting Mat · ${p.title ?? ''}`)}</title>${oflNotice}<style>${style(c, F, fonts || {})}</style>`
    + `<rect width="${W}" height="${H}" fill="${c.bg}"/>${s.join('')}</svg>`;
}
