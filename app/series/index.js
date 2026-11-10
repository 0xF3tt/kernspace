// The series registry: each series' renderer and the faces it draws with (app/fonts.js), with its rules (overlap checker,
// slot table, editor geometry).
// Callers pick one by `preset.series` (the checker, the word editor) or by the studio's current series (main.js).
// A series id is an own key. SERIES is a normal object, so a truthiness check would accept inherited names.
import { DEFAULT } from '../store.js';
import { render, FONTS as matFonts, WHO as matWho } from './cutting-mat.js';
import { render as renderSpecimen, FONTS as specimenFonts, WHO as specimenWho } from './specimen.js';
import { render as renderGalley, FONTS as galleyFonts, WHO as galleyWho } from './galley-proof.js';
import { render as renderCard, FONTS as cardFonts, WHO as cardWho } from './catalog-card.js';
import * as cuttingMat from './cutting-mat.rules.js';
import * as specimenRules from './specimen.rules.js';
import * as galleyRules from './galley-proof.rules.js';
import * as cardRules from './catalog-card.rules.js';

/**
 * What the studio asks of a series. The value in {@link SERIES} is the renderer
 * (`render`, `fonts`, `whoFace`) spread together with that series' rules module.
 * The word editor and the stage call this surface; the overlap tests call the
 * rules directly. Preset ids, URL keys and saved diffs are not part of it.
 *
 * @typedef {Object} SeriesContract
 * @property {string} name
 * @property {string} dir Preset directory, relative to the site root.
 * @property {string} hint Lexicon key holding `{slots, as}` for this series.
 * @property {string[]} typed Series whose unhinted terms may be offered by word type.
 * @property {string} glyph Switch icon. Geometry only, never data.
 * @property {string[]} BAR Palette keys drawn in an ink-row swatch.
 * @property {(sheet: {preset: object, colors: object, format?: string, handle?: string, motto?: string, fonts?: object|null, texture?: string}) => string} render SVG for one sheet.
 * @property {string[]} fonts Face keys embedded in the sheet.
 * @property {string} voice Face key of the phrase.
 * @property {string} whoFace Face key of the whoami box. A line is checked against this face.
 * @property {(preset: object) => boolean} valid
 * @property {(preset: object) => string} lineOf The volume's line, under the sheet.
 * @property {(preset: object, colors: object) => {text: string, color: string}[]} chipsOf
 * @property {(preset: object, handle: string) => {id: string, term: string, mean: string, pin: number[], svg: string}[]} marks
 * @property {Record<string, string>} GLYPH Icon for a mark id.
 * @property {{nav: string, title: string, intro: string, who: string, mark: string, legendHead: string[]}} READ
 * @property {[string, string][]} FIXED_LIST Name and what it does, for "Fixed on this sheet".
 * @property {(key: string) => [string, string]|null} fixedOf A slot a click cannot change.
 * @property {(preset: object) => string[]} slotsOf Editable slots, in reading order.
 * @property {(scene: object, preset: object, key: string) => number[][][]} slotQuads Boxes in sheet pixels.
 * @property {{U: function(string): number, px: function(string, string): number}} GEOM
 * @property {Record<string, string>} LABEL
 * @property {(key: string) => string} nameOf
 * @property {(key: string, colors: object) => {cls: string, color: string}|null|undefined} swatch
 * @property {(key: string, shipped: object) => string} lockOf
 * @property {(key: string, index?: number) => number} limitOf
 * @property {{motto: number, phrase: number}} LIMITS
 * @property {(preset: object, key: string) => number|undefined} [phoneCap]
 * @property {(preset: object, key: string) => Set<string>} usedStrings Strings already on the sheet, for the duplicate check.
 */

export const SERIES = {
  'cutting-mat': {
    name: 'Cutting Mat', dir: 'series/cutting-mat/presets', hint: 'mat',     // hint: the lexicon key holding {slots, as}
    typed: ['cutting-mat', 'specimen'],   // the series whose terms it offers by word type when a term has no hint for it
    glyph: '<rect x="1.5" y="1.5" width="15" height="15"/><path d="M3 15 15 3"/><path d="M1.5 6.5h15M1.5 11.5h15" stroke-dasharray="2 2" opacity=".7"/>',   // the switch's icon: the taint path and two trust boundaries
    BAR: ['bg', 'major', 'angle', 'text', 'tb', 'chip1', 'chip2', 'chip3'],
    render, fonts: matFonts, voice: 'nunito', ...cuttingMat, whoFace: matWho,    // voice: the phrase slot · whoFace: the whoami box
  },
  specimen: {
    name: 'Specimen', dir: 'series/specimen/presets', hint: 'spec', typed: ['cutting-mat', 'specimen'],
    glyph: '<path d="M3 13.5 9 2.5l6 11M5.2 9.5h7.6"/><path d="M1.5 16.5h15" stroke-width="1" opacity=".7"/>',   // a capital A over its baseline hairline
    BAR: ['bg', 'text', 'text2', 'rule', 'data', 'major', 'tb', 'chip1'],
    render: renderSpecimen, fonts: specimenFonts, voice: 'caslon', ...specimenRules, whoFace: specimenWho,
  },
  'galley-proof': {
    name: 'Galley Proof', dir: 'series/galley-proof/presets', hint: 'galley', typed: ['galley-proof'],   // it offers by type only the terms written for it
    glyph: '<rect x="3.5" y="1.5" width="8" height="15"/><path d="M13.5 12h1.5c1.8 0 2.4-1.7 1.4-2.8s-3-.2-2.5 1.2 2.2 1.6 3.1.4" stroke-width="1.2"/>',   // a tall galley strip and a small dele loop beside it
    BAR: ['bg', 'minor', 'text', 'text2', 'rule', 'frame', 'data', 'chip1'],
    render: renderGalley, fonts: galleyFonts, voice: 'sourceSerif', ...galleyRules, whoFace: galleyWho,
  },
  'catalog-card': {
    name: 'Catalog Card', dir: 'series/catalog-card/presets', hint: 'card', typed: ['catalog-card'],   // by type it offers only the status lines written for it; every heading needs a hint
    glyph: '<path d="M3 4.5V2.5h5v2"/><rect x="1.5" y="4.5" width="15" height="11" rx="1"/><path d="M3.5 8h11"/><circle cx="9" cy="12.8" r="1.3"/>',   // a card with its header rule and rod hole, a guide tab behind
    BAR: ['bg', 'major', 'angle', 'frame', 'rule', 'text', 'text2', 'chip1'],
    render: renderCard, fonts: cardFonts, voice: 'architects', ...cardRules, whoFace: cardWho,
  },
};

export const isSeries = (id) => typeof id === 'string' && Object.hasOwn(SERIES, id);

// The series a visit opens. A link wins over the series saved in this browser; an id that is not a series
// opens the default, and a link that names no series does not fall through to the saved one.
export function bootSeries(link, saved) {
  const requested = link ? link.series ?? DEFAULT : saved;
  return isSeries(requested) ? requested : DEFAULT;
}

// The series a switch may land on. An id that is not a series leaves the current one where it is.
export const seriesSwitch = (current, requested) => (isSeries(requested) ? requested : current);
