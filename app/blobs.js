// Object URLs owned by thumbnail <img data-u>. Replacing a container drops the nodes and
// leaves the URLs registered. Revoke the ones no live image still shows: the sheet, the
// read view, a preview, or a thumbnail outside the container.
export function blobUrlsToRevoke(removed, live) {
  const keep = new Set((live ?? []).filter((url) => typeof url === 'string' && url));
  const out = [];
  const seen = new Set();
  for (const url of removed ?? []) {
    if (typeof url !== 'string' || !url || keep.has(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}
