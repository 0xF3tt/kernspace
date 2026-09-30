// The saved-words blob in localStorage ("ks-edits"), as the studio reads it.
// v2: { v: 2, series, edits: { [series]: { [id]: diff } }, handle, motto }. series is the last one viewed.
// v1 (Cutting Mat only): { v: 1, edits: { [id]: diff }, handle, motto }. It migrates into edits['cutting-mat'].
export const DEFAULT = 'cutting-mat';
const obj = (x) => !!x && typeof x === 'object';

// a parsed blob -> { series, edits, handle, motto } in the v2 shape, or null when it isn't one we can read
export function migrate(saved) {
  if (!obj(saved) || !obj(saved.edits)) return null;
  const { handle, motto } = saved;
  if (saved.v === 1) return { series: DEFAULT, edits: { [DEFAULT]: saved.edits }, handle, motto };
  if (saved.v === 2) return { series: typeof saved.series === 'string' ? saved.series : DEFAULT, edits: saved.edits, handle, motto };
  return null;
}
