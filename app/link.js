// The address bar and the saved-words blob, as plain data.
// Importing this module does not start the app and does not read localStorage or the DOM.
import { FORMATS } from './render.js';
import { DEFAULT } from './store.js';
import { PALS, ROLES } from './catalog.js';

export const LINK_KEYS = ['series', 'vol', 'ink', 'ground', 'format'];

/** `location.search`, or any '?a=b' / 'a=b' string. Null when none of the studio keys are present. */
export function readLink(search) {
  const q = new URLSearchParams(String(search ?? '').replace(/^\?/, ''));
  return LINK_KEYS.some((k) => q.has(k)) ? Object.fromEntries(LINK_KEYS.map((k) => [k, q.get(k)])) : null;
}

/**
 * The next index, role, and any ink/ground/format the link names.
 * A missing or unknown volume leaves `state.i` alone. The volume's own ground is applied
 * first, then a ground in the link overrides it. Does not mutate `state`.
 */
export function applyLink(state, index, link) {
  const next = { i: state.i };
  const at = index.findIndex((e) => e.vol === Number(link?.vol));
  if (at > 0) next.i = at;
  next.role = index[next.i].ground;
  if (!link) return next;
  if (PALS.includes(link.ink)) next.ink = link.ink;
  if (ROLES.includes(link.ground)) next.role = link.ground;
  if (Object.hasOwn(FORMATS, link.format ?? '')) next.format = link.format;
  return next;
}

/** Search string for the current sheet, or '' at the defaults. Same keys, same order, as the studio has always written. */
export function linkQuery({ series, index, vol, ink, role, format, volumeGround }) {
  const q = new URLSearchParams();
  if (series !== DEFAULT) q.set('series', series);
  if (index) q.set('vol', String(vol));
  if (ink !== 'purple') q.set('ink', ink);
  if (role !== volumeGround) q.set('ground', role);
  if (format !== 'desktop') q.set('format', format);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/**
 * The v2 blob, or null when there is nothing worth storing (the key should be removed).
 * `unchecked` entries are copied first; checked diffs are added beside them.
 * `presetOf(series, id)` is the shipped preset. `changedSlots` and `get` are the word-editor helpers.
 */
export function storeRecord({ series, handle, motto, edits, unchecked, presetOf, changedSlots, get }) {
  const out = {};
  for (const [s, byId] of Object.entries(unchecked ?? {})) {
    if (byId && typeof byId === 'object' && Object.keys(byId).length) out[s] = { ...byId };
  }
  for (const [s, byId] of Object.entries(edits ?? {})) {
    for (const [id, preset] of Object.entries(byId)) {
      const diff = {};
      for (const k of changedSlots(preset, presetOf(s, id))) diff[k] = get(preset, k);
      if (Object.keys(diff).length) (out[s] ??= {})[id] = diff;
    }
  }
  if (Object.keys(out).length || handle || motto || series !== DEFAULT) return { v: 2, series, edits: out, handle, motto };
  return null;
}
