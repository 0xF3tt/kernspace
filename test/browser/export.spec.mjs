import { test, expect } from './fixtures.mjs';
import { changeSheet, formatLabel, pngInfo, saveDownload, sheetReady, slugName, svgSize } from './helpers.mjs';

test('downloads the desktop SVG and a PNG with the sheet dimensions @webkit', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await sheetReady(page, { format: 'desktop' });
  await expect(page.locator('#dl-svg')).toBeEnabled();
  const name = await slugName(page);

  const svg = await saveDownload(page, '#dl-svg');
  expect(svg.filename).toBe(`${name}.svg`);
  const text = svg.body.toString('utf8');
  expect(text).toContain('<svg');
  expect(text).toContain('</svg>');
  expect(svgSize(text)).toEqual({ width: 3840, height: 2160 });
  await expect(page.locator('#slip')).toContainText('Saved');

  const png = await saveDownload(page, '#dl-png');
  expect(png.filename).toBe(`${name}.png`);
  const info = pngInfo(png.body);
  expect(info).toMatchObject({ width: 3840, height: 2160, srgb: true });
  expect(info.bytes).toBeGreaterThan(8_000);
  await expect(page.locator('#dl-png')).toHaveAttribute('aria-label', 'Download PNG');
});

test('downloads a phone PNG at the phone dimensions', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await sheetReady(page, { format: 'desktop' });
  await changeSheet(page, () => formatLabel(page, 'phone').click(), { format: 'phone' });
  const name = await slugName(page);
  expect(name).toContain('1290x2796');
  const png = await saveDownload(page, '#dl-png');
  expect(png.filename).toBe(`${name}.png`);
  const info = pngInfo(png.body);
  expect(info).toMatchObject({ width: 1290, height: 2796, srgb: true });
  expect(info.bytes).toBeGreaterThan(4_000);
});

function zipNames(buf) {
  const names = [];
  let o = 0;
  while (o + 30 <= buf.length && buf.readUInt32LE(o) === 0x04034b50) {
    const nameLen = buf.readUInt16LE(o + 26);
    const extra = buf.readUInt16LE(o + 28);
    const size = buf.readUInt32LE(o + 18);
    names.push(buf.slice(o + 30, o + 30 + nameLen).toString('utf8'));
    o += 30 + nameLen + extra + size;
  }
  return names;
}

test('downloads a plain phone rotation pack as a readable ZIP', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await sheetReady(page, { format: 'desktop' });
  await changeSheet(page, () => formatLabel(page, 'phone').click(), { format: 'phone' });
  const pack = await saveDownload(page, '#dl-pack');
  expect(pack.filename).toMatch(/^kernspace_cutting-mat_purple-.*_1290x2796_15-volumes\.zip$/);
  const names = zipNames(pack.body);
  expect(names).toHaveLength(15);
  names.forEach((name, i) => {
    expect(name.startsWith(`${String(i + 1).padStart(2, '0')}_kernspace_cutting-mat_`)).toBe(true);
    expect(name.endsWith('_1290x2796.png')).toBe(true);
    expect(name.includes('film-') || name.includes('paper-')).toBe(false);
  });
  expect(pack.body.readUInt32LE(0)).toBe(0x04034b50);
});

test('cancels a rotation pack from the keyboard and saves nothing', async ({ page }) => {
  await page.goto('/');
  await sheetReady(page, { series: 'cutting-mat', vol: '01' });
  const stored = await page.evaluate(() => localStorage.getItem('ks-edits'));
  const url = page.url();
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await page.locator('#dl-pack').click();
  const cancel = page.locator('#dl-cancel');
  await expect(cancel).toBeVisible();
  await expect(cancel).toHaveAccessibleName('Cancel');
  await expect(page.locator('#pack-status')).toBeVisible();
  await expect(page.locator('#pack-status')).toHaveAttribute('aria-live', 'polite');
  await cancel.focus();
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(cancel).toBeHidden();
  await expect(page.locator('#dl-pack')).toBeVisible();
  await expect(page.locator('#dl-pack')).toHaveAttribute('aria-label', /Download all/);
  await expect(page.locator('#pack-status')).toBeHidden();
  await expect(page.locator('#slip')).toContainText('Nothing was saved');
  await expect(page.locator('#vol-name')).toHaveText('Design');
  await expect(page.locator('#sheet')).toHaveAttribute('data-format', 'desktop');
  expect(page.url()).toBe(url);
  expect(downloaded).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('ks-edits'))).toBe(stored);
});
