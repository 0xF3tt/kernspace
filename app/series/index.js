// The series registry: each series' renderer with its rules (overlap checker, slot table, editor geometry).
// Callers pick one by `preset.series` (the checker, the word editor) or by the studio's current series (main.js).
import { render } from './cutting-mat.js';
import { render as renderSpecimen } from './specimen.js';
import * as cuttingMat from './cutting-mat.rules.js';
import * as specimenRules from './specimen.rules.js';

export const SERIES = {
  'cutting-mat': {
    name: 'Cutting Mat', dir: 'series/cutting-mat/presets', hint: 'mat',     // hint: the lexicon key holding {slots, as}
    BAR: ['bg', 'major', 'angle', 'text', 'tb', 'chip1', 'chip2', 'chip3'],
    render, ...cuttingMat,
  },
  specimen: {
    name: 'Specimen', dir: 'series/specimen/presets', hint: 'spec',
    BAR: ['bg', 'text', 'text2', 'rule', 'data', 'major', 'tb', 'chip1'],
    render: renderSpecimen, ...specimenRules,
  },
};
