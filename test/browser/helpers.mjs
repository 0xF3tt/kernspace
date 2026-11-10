import { readFile } from 'node:fs/promises';

// The sheet is ready when the stage has finished this draw and the image has decoded.
// `after` is the previous blob URL, so a switch does not pass on the sheet that is already showing.
export async function sheetReady(page, { after = null, series = null, format = null, vol = null } = {}) {
  await page.waitForFunction(({ after, series, format, vol }) => {
    const stage = document.querySelector('#stage');
    const img = document.querySelector('#sheet-img');
    const sheet = document.querySelector('#sheet');
    const radio = document.querySelector('input[name="series"]:checked');
    const volNo = document.querySelector('#vol-no')?.textContent ?? '';
    const url = img?.dataset?.u ?? '';
    const ready = stage?.getAttribute('aria-busy') === 'false'
      && url.startsWith('blob:')
      && url !== after
      && img.complete
      && img.naturalWidth > 0
      && !!document.querySelector('#vol-name')?.textContent?.trim();
    if (!ready) return false;
    if (series && radio?.value !== series) return false;
    if (format && sheet?.dataset.format !== format) return false;
    if (vol && !volNo.includes(vol)) return false;
    return true;
  }, { after, series, format, vol }, { timeout: 45_000 });
}

export async function changeSheet(page, action, opts = {}) {
  const after = await page.locator('#sheet-img').getAttribute('data-u');
  await action();
  await sheetReady(page, { ...opts, after });
}

// The segmented radios are 1px and ignore pointer events; the label is the control.
export const seriesLabel = (page, id) => page.locator(`#series-switch label:has(#series-${id})`);
export const formatLabel = (page, id) => page.locator(`label:has(#fmt-${id})`);

// The word editor is open once its shadow root has painted the live sheet.
export async function editorReady(page) {
  await page.waitForFunction(() => {
    const live = document.querySelector('#live');
    return document.body.hasAttribute('data-editing')
      && !!live?.shadowRoot?.querySelector('svg')
      && !!document.querySelector('#rail [aria-selected="true"]');
  }, null, { timeout: 45_000 });
}

export async function slugName(page) {
  return page.locator('#slug').evaluate((el) => (el.childNodes[0]?.textContent ?? '').trim());
}

export async function saveDownload(page, selector) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 90_000 }),
    page.locator(selector).click(),
  ]);
  const path = await download.path();
  const body = await readFile(path);
  return { filename: download.suggestedFilename(), body };
}

export function pngInfo(buf) {
  if (buf.length < 33 || buf.toString('ascii', 1, 4) !== 'PNG') throw new Error('not a PNG');
  if (buf.toString('ascii', 12, 16) !== 'IHDR') throw new Error('missing IHDR');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  let srgb = false;
  for (let i = 8; i + 12 <= buf.length;) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    if (type === 'sRGB') srgb = true;
    if (type === 'IEND') break;
    if (len < 0 || i + 12 + len > buf.length) break;
    i += 12 + len;
  }
  return { width, height, srgb, bytes: buf.length };
}

export function svgSize(text) {
  const width = Number(text.match(/\bwidth="(\d+)"/)?.[1]);
  const height = Number(text.match(/\bheight="(\d+)"/)?.[1]);
  return { width, height };
}
