// Palette lint, no browser needed:  node app/palette.test.mjs
// Every ground of palettes/*.json: WCAG contrast of text and mark roles against bg, CIEDE2000 separation of the three
// chips (normal vision and Machado 2009 protan/deutan/tritan), lightness for Galley Proof's thin chip1 proof marks, and Catalog Card's
// paper ladder: every role drawn on a card against that card's solved paper.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEPTH, PAIRS as PAPER_PAIRS, paper } from './series/catalog-card.js';

const json = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const palettes = ['purple', 'green', 'red', 'blue'].map(slug => json(`palettes/${slug}.json`));

const TEXT = ['text', 'text2', 'data', 'rule', 'angle', 'tb', 'chip1'];   // every fill a text() call (or a label) takes in app/series/*.js
const MARK = ['frame', 'diag', 'sink', 'chip1', 'chip2', 'chip3'];        // strokes and fills that carry meaning; minor/major are decoration
const MIN = { text: 4.5, mark: 3, chip: 10, stops: 0.5 };
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const XYZ = [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]], WHITE = [0.95047, 1, 1.08883];

// colors: "#RRGGBB" or "rgba(r,g,b,a)", the latter composited over bg in code values (as the browser does)
function rgb(c, bg = [0, 0, 0]) {
  if (c[0] === '#') return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const [r, g, b, a] = c.match(/[\d.]+/g).map(Number);
  return [r, g, b].map((v, i) => v * a + bg[i] * (1 - a));
}
const lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const enc = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const mul = (m, v) => m.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const lum = c => mul(XYZ, c.map(lin))[1];
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const stops = (a, b) => Math.log2(ratio(a, b));          // the WCAG +0.05 is a 5% flare floor, so stops are of perceived step, not raw luminance
const sim = (m, c) => mul(m, c.map(lin)).map(v => enc(Math.min(1, Math.max(0, v))));   // Machado on linear sRGB, clamped, re-encoded

function lab(c) {
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116, [x, y, z] = mul(XYZ, c.map(lin)).map((v, i) => f(v / WHITE[i]));
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
// CIEDE2000, Sharma, Wu & Dalal (2005)
function de00([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, deg = 180 / Math.PI, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))), ap1 = (1 + G) * a1, ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2), hp = (b, a) => (b === 0 && a === 0 ? 0 : (Math.atan2(b, a) * deg + 360) % 360);
  const h1 = hp(b1, ap1), h2 = hp(b2, ap2), dL = L2 - L1, dC = Cp2 - Cp1, both = Cp1 * Cp2 !== 0;
  let dh = !both ? 0 : Math.abs(h2 - h1) <= 180 ? h2 - h1 : h2 - h1 > 180 ? h2 - h1 - 360 : h2 - h1 + 360;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh / 2 * rad), Lb = (L1 + L2) / 2, Cpb = (Cp1 + Cp2) / 2;
  const hb = !both ? h1 + h2 : Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.20 * Math.cos((4 * hb - 63) * rad);
  const SL = 1 + 0.015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cpb, SH = 1 + 0.015 * Cpb * T;
  const RT = -2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

const PAIRS = [[1, 2], [1, 3], [2, 3]];
const VISION = { normal: c => c, ...Object.fromEntries(Object.entries(MACHADO).map(([k, m]) => [k, c => sim(m, c)])) };
const worst = {};                                            // ground -> [lowest Machado chip dE00, "vision chipA-chipB"]

// every failure of one ground; fills `worst` when given a name
function problems(co, name) {
  const p = [], bg = rgb(co.bg), at = k => rgb(co[k], bg), strip = rgb(co.minor, bg);
  for (const k of TEXT) if (ratio(at(k), bg) < MIN.text) p.push(`${k} is ${ratio(at(k), bg).toFixed(2)}:1 on bg, text needs ${MIN.text}`);
  for (const k of MARK) if (ratio(at(k), bg) < MIN.mark) p.push(`${k} is ${ratio(at(k), bg).toFixed(2)}:1 on bg, marks need ${MIN.mark}`);
  for (const [v, f] of Object.entries(VISION)) for (const [i, j] of PAIRS) {
    const d = de00(lab(f(at(`chip${i}`))), lab(f(at(`chip${j}`))));
    if (d < MIN.chip) p.push(`chip${i}-chip${j} is dE00 ${d.toFixed(2)} under ${v}, needs ${MIN.chip}`);
    if (name && v !== 'normal' && d < (worst[name]?.[0] ?? 1e9)) worst[name] = [d, `${v} chip${i}-chip${j}`];
  }
  for (const [k, against] of [['text', at('text')], ['strip', strip], ['bg', bg]])   // Galley's chip1 proof marks are thinner than ~2.5 arcmin: seen by luminance, not hue
    if (stops(at('chip1'), against) < MIN.stops) p.push(`chip1 is ${stops(at('chip1'), against).toFixed(3)} stops from ${k}, thin proof marks need ${MIN.stops}`);
  return p;
}

let grounds = 0;
for (const pal of palettes) for (const [name, g] of Object.entries(pal.grounds)) {
  assert.deepEqual(problems(g.colors, name), [], `${pal.slug}/${name}`);
  grounds++;
}

// Catalog Card: the papers are solved from bg and major (paper()), so each role is held to its contrast on the paper it is drawn on. text and text2
// are text (4.5:1); the header line and the stamp (rule) are 34 px and a stroke, WCAG large text and a mark (3:1); the numerals, heads and dates are text2.
const PAPER = { text: 4.5, both: 3, stroke: 3 };   // by the pair's kind (PAIRS' third column)
const pick = (P, layer) => layer.startsWith('guides[') ? P.guides[+layer[7]] : P[layer];
const EDGES = ['guides[0]', 'guides[1]', 'guides[2]', 'guides[3]', 'see', 'front', 'blank', 'slip'];   // the papers drawn with an `angle` edge
let tightest = [1e9, ''], edge = [1e9, ''];
function paperProblems(co, name, depth = DEPTH) {
  const p = [], bg = rgb(co.bg), P = paper(co, depth), at = k => rgb(co[k], bg), main = rgb(P.main);
  for (const [layer, role, kind] of PAPER_PAIRS) {
    const paperRgb = rgb(pick(P, layer)), r = ratio(rgb(co[role], paperRgb), paperRgb);   // a translucent role lies over the paper, not the ground
    if (r < PAPER[kind]) p.push(`${role} is ${r.toFixed(2)}:1 on ${layer}, needs ${PAPER[kind]}`);
    if (name && role === 'rule' && r < tightest[0]) tightest = [r, `${name} rule on ${layer}`];
  }
  for (const [k, against] of [['text', at('text')], ['the main card', main]])
    if (stops(at('chip1'), against) < MIN.stops) p.push(`chip1 is ${stops(at('chip1'), against).toFixed(3)} stops from ${k}, the pencil needs ${MIN.stops}`);
  for (const layer of EDGES) { const r = ratio(at('angle'), rgb(pick(P, layer))); if (name && r < edge[0]) edge = [r, `${name} ${layer}`]; }   // reported: a weak edge reads as tone
  return p;
}
let papers = 0;
for (const pal of palettes) for (const [name, g] of Object.entries(pal.grounds)) { assert.deepEqual(paperProblems(g.colors, name), [], `${pal.slug}/${name} papers`); papers++; }

// spot checks against a Python reference (the palette stories quote the same numbers, some to one decimal)
const near = (a, b, why) => assert.ok(Math.abs(a - b) <= 0.05, `${why}: ${a} vs ${b}`);
const sm = palettes[1].grounds.soldermask.colors, sbg = rgb(sm.bg), chip = (c, k) => lab(rgb(c[k], rgb(c.bg)));
near(worst.aniline[0], 10.034, 'aniline worst Machado pair'); assert.equal(worst.aniline[1], 'protan chip1-chip2');
near(worst['iron-gall'][0], 15.549, 'iron-gall worst Machado pair');
near(de00(chip(sm, 'chip1'), chip(sm, 'chip2')), 26.6, 'soldermask chip1-chip2'); near(de00(chip(sm, 'chip2'), chip(sm, 'chip3')), 24.0, 'soldermask chip2-chip3');
near(stops(rgb(sm.chip1, sbg), rgb(sm.text, sbg)), 0.635, 'soldermask chip1 vs text stops');

// the lint must fire on broken grounds (soldermask chip1 before it was lifted, a muddy chip, a dim text role)
const broken = {
  'soldermask chip1 back to #F0CD74 (thin marks too close to the text)': { ...sm, chip1: '#F0CD74' },
  'chip2 copied from chip1 (no separation)': { ...sm, chip2: sm.chip1 },
  'text2 dimmed to bg': { ...sm, text2: sm.minor },
  'sink nearly bg': { ...sm, sink: sm.major },
};
assert.ok(problems(broken[Object.keys(broken)[0]]).some(m => /stops from text/.test(m)), 'the old soldermask chip1 must fail the thin-stroke check');
for (const [name, co] of Object.entries(broken)) assert.ok(problems(co).length, `the lint should catch: ${name}`);
assert.ok(paperProblems(palettes[0].grounds.ditto.colors, '', { ...DEPTH, main: 2 }).some(m => /^rule is .* on main/.test(m)), 'a deeper main card (target 2.0, nearer major) must drop rule below 3:1 on ditto');
assert.ok(tightest[0] >= 3 && tightest[0] < 3.1, `the tightest rule margin is ditto's, ${tightest}`);

console.log(`ok · ${grounds} grounds · text ${MIN.text}:1 (${TEXT.join(', ')}), marks ${MIN.mark}:1 (${MARK.join(', ')}) · chips dE00 ≥ ${MIN.chip} in normal, protan, deutan and tritan vision · chip1 ≥ ${MIN.stops} stops from text, strip and bg · lint catches ${Object.keys(broken).length} kinds of broken ground · ${papers} paper ladders: text and text2 ≥ ${PAPER.text}:1, rule (header line, stamp) ≥ ${PAPER.both}:1 (tightest ${tightest[1]} ${tightest[0].toFixed(2)}), chip1 ≥ ${PAPER.both}:1 and ≥ ${MIN.stops} stops from text and card, frame ≥ ${PAPER.stroke}:1 · angle edge weakest ${edge[1]} ${edge[0].toFixed(2)}:1 (reported)`);
