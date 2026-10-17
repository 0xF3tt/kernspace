// Specimen: the foundry type specimen sheet, read as a threat model (series/specimen/README.md has the element map).
// One standalone SVG per preset; presets are data: series/specimen/presets/index.json lists them, one <id>.json each.
//
// Preset shape (limits in characters):
//   series:"specimen", topic, title, ground
//   hero ≤4 · family ≤24 · class ≤36                          the primitive, the asset, its category
//   waterfall: { phrase ≤64, roles: 5 × ≤12 }                 one phrase at 5 sizes, least to most privileged
//   charset: [{ glyph ≤6, code ≤10 }] × 11-23                 the closed vocabulary; .notdef closes the grid
//   notdef ≤18 · confusables: [[text ≤12, code ≤10] × 2]      the unhandled case · lookalikes with code points
//   matrix: { axes: [a ≤12, b ≤12], cell: [i, l] (1-4), rating ≤24 }   4×4, digits = impact, likelihood
//   test ≤44 (a known-answer test) · notes: 2-3 × ≤28 · label (vertical, fixed)
//   data: { left ≤44, right ≤44 ({handle} = the viewer's) } · phone: { data } overrides, like Cutting Mat's
import { FORMATS, HANDLE, esc, finish, whoamiLines } from '../render.js';
import { FACES, fontCSS, fontStack, notice } from '../fonts.js';

// The specimen is set in Caslon, as the broadside the series borrows from (William Caslon, 1734): the hero in Libre Caslon
// Display, cut for large sizes; the family name, the waterfall and the charset in Libre Caslon Text. JetBrains Mono sets
// the codes, labels and the house lines.
export const FONTS = ['caslonDisplay', 'caslon', 'mono'];
const SERIF = fontStack('caslon'), DISPLAY = fontStack('caslonDisplay'), MONO_FAM = fontStack('mono');
const MONO = FACES.mono;                            // vertical metrics per em (hhea = OS/2 typo), as in cutting-mat.js
const CASLON = { asc: FACES.caslon.ink[0], desc: FACES.caslon.ink[1] };   // ink above / below the baseline (boxes.js INK)
const WEIGHTS = [700, 625, 550, 475, 400];          // waterfall, anon → root: weight grows with exposure
const LEFT = 160, HERO_MAX = 1000;                  // hero px cap; 0.69 em cap height puts its top at y≈215

// Libre Caslon Display advances, per mille, for A-Z a-z 0-9: the hero is sized from them so that any hero
// (four wide capitals included, WWWW = 3.78 em) stays left of the waterfall hairline. Anything else counts 1.15 em.
// The overlap checker (app/boxes.js) adds 0.1 em of kerning margin to every Caslon Display line, so the size reserves it too.
const HERO_ADV = '658 615 676 704 614 554 703 731 321 330 656 583 871 734 734 568 734 614 551 665 665 658 945 715 612 587 391 467 406 472 423 263 403 453 229 218 457 223 652 462 476 472 467 315 344 268 443 446 619 460 452 388 622 344 510 516 509 499 512 432 525 511'
  .split(' ').map(Number);
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const heroEm = s => [...s].reduce((a, ch) => a + (CHARS.includes(ch) ? HERO_ADV[CHARS.indexOf(ch)] / 1000 : 1.15), 0);
export const heroSize = (s, room, max = HERO_MAX) => Math.floor(Math.min(max, room / (heroEm(s) + 0.1)));

// geometry per format, px. Left column: hero, family, class, waterfall (labels at lx, text at x, clipped at `clip`), notes.
// Right column: charset grid, confusables, matrix, test, whoami box. Keep-clear: top 110, bottom-centre 1300×220 (Dock);
// phone: y < 932 and the bottom 260.
const DESKTOP = {
  R: 3580, clip: 2150, chars: 23, mx: true,
  hero: { x: LEFT, base: 905 }, fam: { size: 84, base: 1010 }, cls: { size: 34, base: 1070 },
  wf: { lx: LEFT, x: 540, sizes: [150, 112, 84, 64, 48], top: 1150, gap: 18, label: 26, inline: true },
  grid: { x: 2320, y: 190, cols: 6, cw: 210, ch: 196, glyph: 46, code: 24, gy: 108, cy: 162 },
  conf: { y: 1090, size: 44, code: 24, dy: 50 }, mat: { y: 1265, cell: 64, cap: 24, num: 24, rate: 30 },
  test: { y: 1620, size: 30 }, note: { x: LEFT, y: 1810, dy: 55, size: 26 }, who: { y: 1690, w: 860, size: 26, lh: 38, pad: 28 },
  data: { y: 2000, size: 26 }, vl: { size: 24, ls: .12, top: 190 }, sw: { grid: 2.5, tb: 4, hair: 2.5, guide: 1.5, frame: 3 },
};
// 16:10 = the same structure, 240px taller: a 5-column grid, the hairline at x≈1950, the right column moves down
const WIDE = {
  ...DESKTOP, clip: 1950,
  fam: { size: 84, base: 1030 }, cls: { size: 34, base: 1095 }, wf: { ...DESKTOP.wf, sizes: [150, 112, 84, 64, 46], top: 1200 },
  grid: { x: 2100, y: 190, cols: 5, cw: 296, ch: 196, glyph: 64, code: 24, gy: 112, cy: 166 },
  conf: { ...DESKTOP.conf, y: 1290 }, mat: { ...DESKTOP.mat, y: 1470 }, test: { y: 1830, size: 30 },
  note: { ...DESKTOP.note, y: 1900 }, who: { ...DESKTOP.who, y: 1930 }, data: { ...DESKTOP.data, y: 2240 },
};
// phone: 4 waterfall lines with the role above each, a 4×3 grid (11 glyphs + .notdef), no matrix, test or notes:
// the rating shares a line with the first confusable pair
// (the smallest line is 36: a 64-character phrase in Caslon at 400, up to 29.5 em, must end before the hairline at x=1200;
// wide's is 46 for the same phrase before its hairline at x=1950)
const PHONE = {
  R: 1200, clip: 1200, chars: 11, mx: false,
  hero: { x: 90, base: 1240 }, fam: { size: 56, base: 1310 }, cls: { size: 30, base: 1352 },
  wf: { lx: 90, x: 90, sizes: [104, 80, 58, 36], top: 1385, gap: 10, label: 30, inline: false, drop: 2 },
  grid: { x: 90, y: 1895, cols: 4, cw: 277.5, ch: 130, glyph: 60, code: 30, gy: 62, cy: 112 },
  conf: { y: 2330, size: 30, code: 30, dx: 210 }, rate: { size: 30 },
  who: { y: 2350, w: 1110, size: 30, lh: 38, pad: 14 },
  data: { y: 2525, size: 30 }, vl: null, sw: { grid: 2, tb: 3.5, hair: 2, guide: 1.2, frame: 2.5 },
};
const SPECS = { desktop: DESKTOP, wide: WIDE, phone: PHONE };
const ROLES = ['bg', 'minor', 'major', 'angle', 'frame', 'rule', 'diag', 'text', 'text2', 'data', 'tb', 'sink', 'chip1', 'chip2', 'chip3'];
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\))$/i;
const PRE = ' xml:space="preserve"';
export { SPECS as GEOMETRY, WEIGHTS };

const n = v => +v.toFixed(2);                       // short, stable numbers
const ad = (m, size) => [Math.round(m.asc * size), Math.round(m.desc * size)];   // Blink rounds both

function checkColors(c) {
  for (const k of ROLES) if (!COLOR.test(c?.[k] ?? '')) throw new Error(`specimen: bad color ${k}`);
  return c;
}

function formatKey(format) {
  if (typeof format === 'string') return format;
  return Object.keys(FORMATS).find(k => FORMATS[k].w === format?.w && FORMATS[k].h === format?.h);
}

function style(c, g, hero, fonts) {
  const serif = (cls, size, wght) => `.${cls}{font-family:${SERIF};font-weight:${wght};font-size:${size}px}`;
  return fontCSS(fonts, FONTS, 'specimen')
    + `text{font-family:${MONO_FAM};font-weight:400;font-variant-ligatures:none}`     // no ligatures: !== and -- read as typed
    + `.h{font-family:${DISPLAY};font-weight:400;font-size:${hero}px}` + serif('fn', g.fam.size, 400) + serif('g', g.grid.glyph, 400)
    + g.wf.sizes.map((s, i) => serif(`w${i}`, s, WEIGHTS[i + (g.wf.drop && i >= g.wf.drop ? 1 : 0)])).join('')
    + `.cl{font-size:${g.cls.size}px}.lb{font-size:${g.wf.label}px;font-weight:300}.cp{font-size:${g.grid.code}px;font-weight:300}`
    + `.cf{font-size:${g.conf.size}px}.k{font-size:${g.who.size}px}.k,.pt{white-space:pre}.d{font-size:${g.data.size}px;font-weight:300}`
    + (g.mx ? `.mx{font-size:${g.mat.num}px;font-weight:300}.mc{font-size:${g.mat.cap}px;font-weight:300}.rt{font-size:${g.mat.rate}px}`
      + `.ts{font-size:${g.test.size}px}.nt{font-size:${g.note.size}px;font-weight:300}` : `.rt{font-size:${g.rate.size}px}`)
    + (g.vl ? `.vl{font-size:${g.vl.size}px;letter-spacing:${g.vl.ls}em;font-weight:300}` : '');
}

// preset: parsed presets/<slug>.json · colors: one palette ground · format: FORMATS key · texture: a FINISHES key (a film grain or a paper), or none
export function render({ preset: p, colors, format = 'desktop', handle, motto, fonts, texture = '' }) {
  const key = formatKey(format), g = SPECS[key];
  if (!g) throw new Error(`specimen: unknown format ${format}`);
  if (!p?.waterfall) throw new Error('specimen: preset must be a parsed preset object');
  const c = checkColors(colors?.colors ?? colors);
  const { w: W, h: H } = FORMATS[key], phone = key === 'phone', s = [];
  const line = (x1, y1, x2, y2, stroke, w, more = '') =>
    s.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${w}"${more}/>`);
  const rect = (x, y, w, h, fill, more = '') =>
    s.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${more}/>`);
  const text = (x, y, str, cls, fill, more = '') => str != null &&
    s.push(`<text x="${n(x)}" y="${n(y)}" class="${cls}"${fill ? ` fill="${fill}"` : ''}${more}>${esc(str)}</text>`);
  const mid = ' text-anchor="middle"';

  // hero: as large as the column allows, on one baseline
  const hero = heroSize(p.hero, g.clip - g.hero.x - 40, phone ? 400 : HERO_MAX);
  text(g.hero.x, g.hero.base, p.hero, 'h', c.text);
  line(g.hero.x, g.hero.base, g.clip, g.hero.base, c.minor, g.sw.guide);
  text(g.hero.x, g.fam.base, p.family, 'fn', c.text);
  text(g.hero.x, g.cls.base, p.class, 'cl', c.text2);

  // waterfall: one phrase, five principals; every line is clipped at the hairline, so the larger the type the less shows
  const F = g.wf, roles = p.waterfall.roles, lines = F.sizes.map((size, i) => [size, i + (F.drop && i >= F.drop ? 1 : 0)]);
  let top = F.top, wfTop = top, wfEnd = top;
  lines.forEach(([size, r], i) => {
    const lab = F.inline ? top + CASLON.asc * size : top + F.label * .8, base = F.inline ? lab : lab + 12 + CASLON.asc * size;
    const pt = `${size} pt · ${roles[r]}`;
    F.inline ? text(F.lx, base, pt, 'lb', c.rule, PRE) : text(F.lx, lab, pt, 'lb', c.rule, PRE);
    s.push(`<text x="${n(F.x)}" y="${n(base)}" class="wf w${i}" fill="${c.text2}" clip-path="url(#wf)"${PRE}>${esc(p.waterfall.phrase)}</text>`);
    line(g.hero.x, base + 2, g.clip, base + 2, c.minor, g.sw.guide);
    top = base + CASLON.desc * size + F.gap; wfEnd = base + CASLON.desc * size;
  });
  line(g.clip, wfTop - 10, g.clip, wfEnd + 10, c.major, g.sw.hair);      // the clip hairline

  // notes: margin adages with a tick, desktop and wide only
  if (g.mx) (p.notes ?? []).forEach((note, i) => {
    const y = g.note.y + i * g.note.dy;
    line(g.note.x, y - 16, g.note.x, y + 6, c.rule, 2);
    text(g.note.x + 20, y, note, 'nt', c.rule);
  });

  // charset grid: the closed vocabulary, one cell per entry, then the single .notdef cell in the accent
  const G = g.grid, cells = (p.charset ?? []).slice(0, g.chars);
  cells.forEach(({ glyph, code }, i) => {
    const x = G.x + (i % G.cols) * G.cw, y = G.y + Math.floor(i / G.cols) * G.ch;
    rect(x, y, G.cw, G.ch, 'none', ` stroke="${c.major}" stroke-width="${g.sw.grid}"`);
    text(x + G.cw / 2, y + G.gy, glyph, 'g', c.text, mid);
    text(x + G.cw / 2, y + G.cy, code, 'cp', c.text2, mid);
  });
  {
    const i = cells.length, x = G.x + (i % G.cols) * G.cw, y = G.y + Math.floor(i / G.cols) * G.ch, tw = G.glyph * .6, th = G.glyph * .8;
    rect(x + 3, y + 3, G.cw - 6, G.ch - 6, 'none', ` stroke="${c.tb}" stroke-width="${g.sw.tb}"`);
    rect(x + (G.cw - tw) / 2, y + G.gy - th * .85, tw, th, 'none', ` stroke="${c.tb}" stroke-width="${g.sw.tb - 1}"`);   // the tofu box
    text(x + G.cw / 2, y + G.cy, p.notdef, 'cp', c.tb, mid);
  }
  const rows = Math.ceil((cells.length + 1) / G.cols), gridEnd = G.y + rows * G.ch;

  // confusables (kerning-pair style) and the risk matrix; the phone folds both into one line
  const [c0, c1] = p.confusables ?? [], K = g.conf;
  if (g.mx) {
    [c0, c1].forEach((cf, i) => {
      if (!cf) return;
      const x = G.x + i * (G.cols * G.cw / 2);
      text(x, K.y, cf[0], 'cf', c.text, PRE); text(x, K.y + K.dy, cf[1], 'cp', c.text2);
    });
    const M = g.mat, [ax, ay] = p.matrix.axes, [ci, cl] = p.matrix.cell, q = M.cell;
    text(G.x, M.y - 14, `${ax} × ${ay}`, 'mc', c.rule);
    for (let i = 1; i <= 4; i++) for (let l = 1; l <= 4; l++) {
      const x = G.x + (l - 1) * q, y = M.y + (i - 1) * q, on = i === ci && l === cl;
      rect(x, y, q, q, on ? c.chip1 : 'none', ` stroke="${c.major}" stroke-width="${g.sw.grid}"`);
      text(x + q / 2, y + q / 2 + M.num * .35, `${i}${l}`, 'mx', on ? c.bg : c.text2, mid);
    }
    rect(G.x, M.y, 4 * q, 4 * q, 'none', ` stroke="${c.frame}" stroke-width="${g.sw.frame}"`);
    text(G.x + 4 * q + 60, M.y + 2 * q + M.rate * .35, p.matrix.rating, 'rt', c.text);
    text(G.x, g.test.y, p.test, 'ts', c.text2, PRE);
  } else if (c0) {
    text(g.hero.x, K.y, c0[0], 'cf', c.text, PRE); text(g.hero.x + K.dx, K.y, c0[1], 'cf', c.text2);
    text(g.R, K.y, p.matrix.rating, 'rt', c.text, ' text-anchor="end"');
  }

  // foundry block: the whoami box, then the status lines
  const Wm = g.who, wx = g.R - Wm.w, wl = whoamiLines(handle, motto), wh = wl.length * Wm.lh + 2 * Wm.pad - (Wm.lh - Wm.size) / 2;
  rect(wx, Wm.y, Wm.w, wh, c.bg, ` stroke="${c.frame}" stroke-width="${g.sw.frame}"`);
  wl.forEach((t, i) => text(wx + Wm.pad, Wm.y + Wm.pad + Wm.size * .8 + i * Wm.lh, t, 'k', i ? c.text2 : c.rule, PRE));
  const D = g.data, data = { ...p.data, ...(phone ? p.phone?.data : null) };
  text(g.hero.x, D.y, data.left, 'd', c.data);
  text(g.R, D.y, data.right?.replaceAll('{handle}', handle || HANDLE), 'd', c.data, ' text-anchor="end"');   // the prompt is the viewer's

  // side label reading bottom to top (desktop and wide)
  if (g.vl && p.label != null) {
    const V = g.vl, [va, vd] = ad(MONO, V.size), len = [...p.label].length * (MONO.adv + V.ls) * V.size;
    s.push(`<text transform="translate(${n(g.R + 60 + (va - vd) / 2)},${n(V.top + len)}) rotate(-90)" class="vl" fill="${c.text2}">${esc(p.label)}</text>`);
  }

  const clip = `<defs><clipPath id="wf"><rect x="0" y="${n(wfTop - 20)}" width="${g.clip}" height="${n(wfEnd - wfTop + 40)}"/></clipPath></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<title>${esc(`kernspace · Specimen · ${p.title ?? ''}`)}</title>${notice(FONTS)}<style>${style(c, g, hero, fonts || {})}</style>`
    + finish(`<rect width="${W}" height="${H}" fill="${c.bg}"/>${clip}${s.join('')}`, texture) + '</svg>';
}
