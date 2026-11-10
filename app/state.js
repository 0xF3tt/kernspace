// Studio state shape, and who owns the resources around it.
// Importing this module does not start the app and does not touch the DOM.
import { DEFAULT } from './store.js';

/**
 * The selection on the stage, plus edits that have already been checked.
 * The composition module (`app/main.js`) creates this object and passes it to the
 * loader, the editor and the exporter. Nothing else replaces it.
 *
 * `edits[series][presetId]` is a full preset, not the stored diff. `ver` counts
 * changes so thumbnails and live cards can see that a sheet moved. The undo stacks
 * are not in here: the editor owns them (`app/history.js`) and they are not saved.
 *
 * @typedef {Object} StudioState
 * @property {string} series Series id. `useSeries` is the only writer.
 * @property {number} i Index into the loaded preset list.
 * @property {string} ink Palette id.
 * @property {string} role Ground role: dark, mid or light.
 * @property {string} finish A FINISHES key, or '' for none. Never saved, never linked.
 * @property {string} format desktop, wide or phone.
 * @property {'sheet'|'screen'} view
 * @property {string} handle Confirmed whoami handle. The field may hold more.
 * @property {string} motto Confirmed whoami line. The field may hold a line this face cannot draw.
 * @property {string} mark Id of the mark shown in Read the sheet.
 * @property {Record<string, Record<string, object>>} edits
 * @property {Record<string, number>} ver
 */

/**
 * One visit's state. `mark` starts as Cutting Mat's taint mark; `useSeries` replaces it
 * from the series that actually opens.
 * @returns {StudioState}
 */
export function createState(series = DEFAULT) {
  return {
    series, i: 0, ink: 'purple', role: 'mid', finish: '', format: 'desktop', view: 'sheet',
    handle: '', motto: '', mark: 'taint', edits: {}, ver: {},
  };
}

/** Version-counter key. Preset ids repeat across series, so the series is part of the key. */
export const versionKey = (series, id) => `${series}:${id}`;

/**
 * Resource ownership
 *
 * - `data` (presets, palettes, font data URLs, lexicons) is filled by `app/assets.js`.
 *   A failed fetch drops its cache entry so the next attempt can try again. The page
 *   does not copy those objects.
 * - The image that shows a blob URL owns it (`img` dataset `u`). `swap` revokes the
 *   previous URL once no live image still shows it. `releaseThumbs` revokes the URLs
 *   in a container that is about to be thrown away.
 * - `rasterise` (`app/export.js`) owns the object URL and the canvas for that one
 *   sheet. The `finally` revokes the URL and sets the canvas size to 0, which releases
 *   the backing store. The rotation pack holds PNG bytes only until the ZIP blob is
 *   built, then drops them.
 * - localStorage `ks-edits` is the serialized diff (`app/link.js` `storeRecord`), not
 *   the live `state.edits` object. `ks-theme` is the theme toggle, written by the page.
 *
 * Overlapping work does not share a transition object. A render ticket drops a stale
 * sheet. A choice counter drops a stale series switch. An export copies the controls
 * it needs when the click starts, so a later switch does not change that file.
 * Superseding one of these does not write the result of another.
 */
