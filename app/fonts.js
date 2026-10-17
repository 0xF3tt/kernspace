// The bundled faces: one table for the renderers (the @font-face rules and font stacks they embed), the overlap checker
// (widths and ink boxes, app/boxes.js) and the studio (which files to load for a series). Each series draws with its own
// faces (`FONTS` in its renderer); JetBrains Mono, the house mono, sets the data on every sheet but Galley Proof's, which is
// set entirely in Adobe's Source family. fonts/README.md has the catalog.
//
// Per face, in em: asc/desc are the hhea line metrics (what Blink places HTML lines with), ink the glyph bounds above and
// below the baseline over ASCII plus · → ° (boxes.js covers the ink), xh and cap the OS/2 x-height and cap height. A
// monospaced face has one advance (`adv`), so the checker asks only whether a glyph exists at it; a proportional face is
// measured glyph by glyph at each weight in `measure`, plus `kern` em for kerning pairs and contextual alternates (the
// widest gain Chrome measured over the texts the lexicons and presets hold), and `fallback` em a character before its file has loaded. render.test.mjs reads every
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
  caslon: {
    name: 'Libre Caslon Text', file: 'fonts/libre-caslon-text/LibreCaslonText-Variable.ttf', family: 'KCaslon',
    stack: '"Libre Caslon Text",Georgia,serif', wght: [400, 700], measure: [400, 475, 550, 625, 700],
    asc: 0.97, desc: 0.26, ink: [0.87, 0.26], xh: 0.5245, cap: 0.7615, kern: 0.16, fallback: 0.65,
    license: 'SIL OFL 1.1, Copyright 2018 The Libre Caslon Text Project Authors',
  },
  sourceSerif: {
    name: 'Source Serif 4', file: 'fonts/source-serif-4/SourceSerif4-Regular.ttf', family: 'KSourceSerif',
    stack: '"Source Serif 4",Georgia,serif', wght: [400, 400], measure: [400],
    asc: 1.036, desc: 0.335, ink: [0.76, 0.25], xh: 0.475, cap: 0.67, kern: 0.06, fallback: 0.56,
    license: "SIL OFL 1.1, Copyright 2014-2023 Adobe, with Reserved Font Name 'Source'",
  },
  sourceCode: {
    name: 'Source Code Pro', file: 'fonts/source-code-pro/SourceCodePro-Variable.ttf', family: 'KSourceCode',
    stack: '"Source Code Pro",ui-monospace,monospace', wght: [200, 900], adv: 0.6,
    asc: 0.984, desc: 0.273, ink: [0.76, 0.26], xh: 0.478, cap: 0.66, kern: 0, fallback: 0.6,
    license: "SIL OFL 1.1, Copyright 2010, 2012 Adobe Systems Incorporated, with Reserved Font Name 'Source'",
  },
  // Handlee's OS/2 heights understate its letters (drawn x-height 0.493 em, capitals 0.708): the checker boxes its ink, not these
  handlee: {
    name: 'Handlee', file: 'fonts/handlee/Handlee-Regular.ttf', family: 'KHandlee',
    stack: 'Handlee,"Bradley Hand","Segoe Print",cursive', wght: [400, 400], measure: [400],
    asc: 0.934, desc: 0.401, ink: [0.81, 0.26], xh: 0.331, cap: 0.438, kern: 0.04, fallback: 0.5,
    license: 'SIL OFL 1.1, Copyright 2011 Joe Prince, Vissol Ltd., with Reserved Font Name "Handlee"',
  },
  ptMono: {
    name: 'PT Mono', file: 'fonts/pt-mono/PTMono-Regular.ttf', family: 'KPTMono',
    stack: '"PT Mono","Courier New",monospace', wght: [400, 400], adv: 0.6,
    asc: 0.885, desc: 0.235, ink: [0.8, 0.23], xh: 0.5, cap: 0.7, kern: 0, fallback: 0.6,
    license: 'SIL OFL 1.1, Copyright 2011 ParaType Ltd., with Reserved Font Names "PT Sans", "PT Serif", "PT Mono" and "ParaType"',
  },
  // no kerning table, so no kerning margin; its OS/2 heights also run low (drawn x-height 0.469 em, capitals 0.714)
  architects: {
    name: 'Architects Daughter', file: 'fonts/architects-daughter/ArchitectsDaughter-Regular.ttf', family: 'KArchitects',
    stack: '"Architects Daughter","Bradley Hand","Segoe Print",cursive', wght: [400, 400], measure: [400],
    asc: 0.986, desc: 0.403, ink: [0.99, 0.43], xh: 0.4287, cap: 0.6592, kern: 0, fallback: 0.52,
    license: 'SIL OFL 1.1, Copyright 2010 Kimberly Geswein',
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
