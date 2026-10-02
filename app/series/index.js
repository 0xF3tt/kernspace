// The series registry: each series' renderer with its rules (overlap checker, slot table, editor geometry).
// Callers pick one by `preset.series` (the checker, the word editor) or by the studio's current series (main.js).
import { render } from './cutting-mat.js';
import { render as renderSpecimen } from './specimen.js';
import { render as renderGalley } from './galley-proof.js';
import * as cuttingMat from './cutting-mat.rules.js';
import * as specimenRules from './specimen.rules.js';
import * as galleyRules from './galley-proof.rules.js';

export const SERIES = {
  'cutting-mat': {
    name: 'Cutting Mat', dir: 'series/cutting-mat/presets', hint: 'mat',     // hint: the lexicon key holding {slots, as}
    typed: ['cutting-mat', 'specimen'],   // the series whose terms it offers by word type when a term has no hint for it
    glyph: '<rect x="1.5" y="1.5" width="15" height="15"/><path d="M3 15 15 3"/><path d="M1.5 6.5h15M1.5 11.5h15" stroke-dasharray="2 2" opacity=".7"/>',   // the switch's icon: the taint path and two trust boundaries
    BAR: ['bg', 'major', 'angle', 'text', 'tb', 'chip1', 'chip2', 'chip3'],
    render, ...cuttingMat,
  },
  specimen: {
    name: 'Specimen', dir: 'series/specimen/presets', hint: 'spec', typed: ['cutting-mat', 'specimen'],
    glyph: '<path d="M3 13.5 9 2.5l6 11M5.2 9.5h7.6"/><path d="M1.5 16.5h15" stroke-width="1" opacity=".7"/>',   // a capital A over its baseline hairline
    BAR: ['bg', 'text', 'text2', 'rule', 'data', 'major', 'tb', 'chip1'],
    render: renderSpecimen, ...specimenRules,
  },
  'galley-proof': {
    name: 'Galley Proof', dir: 'series/galley-proof/presets', hint: 'galley', typed: ['galley-proof'],   // it offers by type only the terms written for it
    glyph: '<rect x="3.5" y="1.5" width="8" height="15"/><path d="M13.5 12h1.5c1.8 0 2.4-1.7 1.4-2.8s-3-.2-2.5 1.2 2.2 1.6 3.1.4" stroke-width="1.2"/>',   // a tall galley strip and a small dele loop beside it
    BAR: ['bg', 'minor', 'text', 'text2', 'rule', 'frame', 'data', 'chip1'],
    render: renderGalley, ...galleyRules,
  },
};
