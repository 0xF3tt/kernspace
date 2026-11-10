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
