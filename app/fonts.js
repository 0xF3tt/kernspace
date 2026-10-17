// The bundled faces: one table for the renderers (the @font-face rules and font stacks they embed), the overlap checker
// (widths and ink boxes, app/boxes.js) and the studio (which files to load for a series). Each series draws with its own
// faces (`FONTS` in its renderer); JetBrains Mono, the house mono, signs every sheet. fonts/README.md has the catalog.
//
// Per face, in em: asc/desc are the hhea line metrics (what Blink places HTML lines with), ink the glyph bounds above and
// below the baseline over ASCII plus · → ° (boxes.js covers the ink), xh and cap the OS/2 x-height and cap height. A
// monospaced face has one advance (`adv`), so the checker asks only whether a glyph exists at it; a proportional face is
// measured glyph by glyph at each weight in `measure`, plus `kern` em for kerning pairs (the widest gain over the texts
// the lexicons and presets hold), and `fallback` em a character before its file has loaded. render.test.mjs reads every
// file and checks these numbers against it.
export const FACES = {
  mono: {
    name: 'JetBrains Mono', file: 'fonts/jetbrains-mono/JetBrainsMono-Variable.ttf', family: 'KMono',
    stack: '"JetBrains Mono",ui-monospace,monospace', wght: [100, 800], adv: 0.6,
    asc: 1.02, desc: 0.3, ink: [0.87, 0.18], xh: 0.55, cap: 0.73, kern: 0, fallback: 0.6,
    license: 'SIL OFL 1.1, Copyright 2020 The JetBrains Mono Project Authors',
  },
  nunito: {
    name: 'Nunito', file: 'fonts/nunito/Nunito-Variable.ttf', family: 'KNunito',
    stack: 'Nunito,sans-serif', wght: [200, 1000], measure: [200, 300, 400, 600, 800],
    asc: 1.011, desc: 0.353, ink: [0.83, 0.2], xh: 0.484, cap: 0.705, kern: 0.1, fallback: 0.56,
    license: 'SIL OFL 1.1, Copyright 2014 The Nunito Project Authors',
  },
};

const FONT_URL = /^data:[\w/+.-]+;base64,[A-Za-z0-9+/=]*$/;

// the CSS font-family list for a face: its embedded name first, then the installed family, then the generic
export const fontStack = (key) => `${FACES[key].family},${FACES[key].stack}`;

// @font-face rules for the faces a sheet uses; a face whose file hasn't loaded yet (first paint) is left out
export function fontCSS(fonts, keys, who) {
  return keys.map((k) => {
    const url = fonts?.[k], F = FACES[k];
    if (!url) return '';
    if (!FONT_URL.test(url)) throw new Error(`${who}: ${F.family} must be a base64 data: URL`);
    return `@font-face{font-family:${F.family};src:url("${url}") format("truetype");font-weight:${F.wght.join(' ')}}`;
  }).join('');
}

// the license notice a sheet carries for the faces it embeds
export const notice = (keys) =>
  `<!-- Embedded fonts: ${keys.map((k) => `${FACES[k].name} (${FACES[k].license})`).join(' and ')}. See fonts/README.md -->`;

// what useMetrics() takes for one face, from its file's bytes: one advance map for a monospaced face, one per weight otherwise
export const faceMetrics = (key, bytes, advances) => (FACES[key].adv ? advances(bytes)
  : Object.fromEntries(FACES[key].measure.map((wght) => [wght, advances(bytes, { wght })])));
