// Focused regressions for the studio bugs fixed on cursor/fix-studio-series-bugs-8e4d.
// 0XF-103 invalid series keys, 0XF-104 whoami versus the active face, 0XF-105 thumbnail blob URLs.
import { test, expect } from './fixtures.mjs';
import { changeSheet, seriesLabel, sheetReady } from './helpers.mjs';

test('rejects an inherited series id from the series switch @webkit', async ({ page }) => {
  await page.goto('/');
  await sheetReady(page, { series: 'cutting-mat', vol: '01' });
  await page.locator('#series-switch').evaluate((sw) => {
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'series';
    input.value = 'constructor';
    input.id = 'series-constructor';
    sw.append(input);
  });
  await page.locator('#series-constructor').click({ force: true });
  await expect(page.locator('input[name="series"][value="cutting-mat"]')).toBeChecked();
  await expect(page.locator('#stage')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#vol-name')).toHaveText('Design');
  await expect(page.locator('#slip')).not.toContainText('could not be loaded');
});

test('checks a whoami line against the face of the active series @webkit', async ({ page }) => {
  await page.goto('/');
  await sheetReady(page, { series: 'cutting-mat' });
  await page.locator('#motto').fill('₿');
  await expect(page.locator('#motto')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('#dl-png')).toBeEnabled();

  await changeSheet(page, () => seriesLabel(page, 'galley-proof').click(), { series: 'galley-proof' });
  await expect(page.locator('#motto')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#who-note')).toContainText(/font/);
  await expect(page.locator('#dl-png')).toBeDisabled();
  await expect(page.locator('#dl-svg')).toBeDisabled();

  await page.locator('#motto').fill('✓');
  await expect(page.locator('#motto')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('#who-note')).not.toHaveClass(/err/);
  await expect(page.locator('#dl-png')).toBeEnabled();
});

test('revokes thumbnail blob URLs when the series strip and ink rows are rebuilt @webkit', async ({ page }) => {
  await page.goto('/');
  await sheetReady(page, { series: 'cutting-mat' });
  const urls = await page.evaluate(() => [...document.querySelectorAll('#strip img[data-u], #ink-rows img[data-u]')].map((img) => img.dataset.u));
  expect(urls.length).toBeGreaterThan(15);
  expect(new Set(urls).size).toBe(urls.length);

  await changeSheet(page, () => seriesLabel(page, 'specimen').click(), { series: 'specimen' });
  const stillShown = await page.evaluate((list) => {
    const live = new Set([...document.querySelectorAll('img[data-u]')].map((img) => img.dataset.u));
    return list.filter((url) => live.has(url));
  }, urls);
  expect(stillShown).toEqual([]);

  const fetches = await page.evaluate(async (list) => Promise.all(list.map(async (url) => {
    try {
      const res = await fetch(url);
      return res.ok;
    } catch {
      return false;
    }
  })), urls);
  expect(fetches.every((ok) => ok === false)).toBe(true);
});
