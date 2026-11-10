// SVG and PNG downloads, and the rotation-pack ZIP.
// The canvas and its object URL belong to `rasterise`: the finally block revokes the URL and
// zeroes the canvas so the backing store can be released (WebKit caps total canvas memory).
// Importing this module does not start a download or touch the DOM.
import { FORMATS, srgbPNG, zip } from './render.js';
import { blobUrl, h, nameBtn, pad2 } from './dom.js';

const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export function saveBlob(blob, file, tell) {
  const a = h('a', { href: URL.createObjectURL(blob), download: file });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  tell('Saved', `${file} · ${kb(blob.size)}`);
}

// SVG text -> tagged sRGB PNG bytes, through a canvas (one sheet at a time)
export async function rasterise(text, w, H) {
  const src = blobUrl(text), cv = h('canvas', { width: w, height: H });
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    await new Promise((r) => setTimeout(r, 60));   // lets embedded fonts settle (Safari)
    const ctx = cv.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(img, 0, 0, w, H);
    const png = await new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('empty PNG'))), 'image/png'));
    return srgbPNG(new Uint8Array(await png.arrayBuffer()));   // tagged sRGB, see srgbPNG
  } finally { URL.revokeObjectURL(src); cv.width = cv.height = 0; }   // frees the backing store now: WebKit caps total canvas memory, and the pack draws 15
}

/**
 * Wire the three download controls. `deps.settled()` is the sheet currently on stage.
 * `deps.series()` is the active series module. The pack copies the controls it needs
 * at click time and draws from that snapshot.
 */
export function bindDownloads(deps) {
  const { el, state, data, tell, announce } = deps;
  const series = () => deps.series();
  const seriesData = () => deps.seriesData();
  const edits = (s) => deps.edits(s);

  el.svg.addEventListener('click', async () => {
    const snap = await deps.settled();
    if (snap) saveBlob(new Blob([snap.svg], { type: 'image/svg+xml' }), `${snap.name}.svg`, tell);
  });
  el.png.addEventListener('click', async () => {
    if (el.png.getAttribute('aria-busy') === 'true') return;
    el.png.setAttribute('aria-busy', 'true');
    nameBtn(el.png, 'Drawing PNG');
    try {
      const snap = await deps.settled();
      if (!snap) return;
      saveBlob(new Blob([await rasterise(snap.svg, snap.w, snap.h)], { type: 'image/png' }), `${snap.name}.png`, tell);
    } catch (err) {
      console.error(err);
      tell('The PNG could not be drawn in this browser.', 'Download the SVG instead: it holds the same sheet.', false);
    } finally {
      el.png.removeAttribute('aria-busy');
      nameBtn(el.png, 'Download PNG');
    }
  });
  // the rotation pack: every volume of the series in the selected ink and ground, one PNG each, for the OS's wallpaper rotation
  el.pack.addEventListener('click', async () => {
    if (el.pack.getAttribute('aria-busy') === 'true') return;
    const list = seriesData().index, n = list.length;
    el.pack.setAttribute('aria-busy', 'true');
    nameBtn(el.pack, 'Preparing the pack');
    try {
      const snap = await deps.settled();
      if (!snap) return;
      const R = series(), d = seriesData(), saved = { ...edits() }, { series: sid, ink, role, format, finish, handle, motto } = state;
      const g = deps.ground(ink, role), { w, h: H } = FORMATS[format], tail = `${ink}-${g.slug}${finish ? `_${finish}` : ''}_${w}x${H}`, files = [];
      announce(`Drawing ${n} sheets for the rotation pack.`);
      for (const [i, e] of d.index.entries()) {
        nameBtn(el.pack, `Drawing ${i + 1} of ${n}`);
        const text = R.render({ preset: saved[e.id] ?? d.presets[e.id], colors: g.colors, format, handle, motto, fonts: data.fonts, texture: finish });
        files.push({ name: `${pad2(e.vol)}_kernspace_${sid}_${e.id}${saved[e.id] ? '_edited' : ''}_${tail}.png`, bytes: await rasterise(text, w, H) });
      }
      announce(`${n} sheets drawn.`);
      saveBlob(new Blob([zip(files)], { type: 'application/zip' }), `kernspace_${sid}_${tail}_${n}-volumes.zip`, tell);
    } catch (err) {
      console.error(err);
      tell('The pack could not be drawn in this browser.', 'Download the sheets one by one instead.', false);
    } finally {
      el.pack.removeAttribute('aria-busy');
      nameBtn(el.pack, ...deps.packLabel());
    }
  });
}
