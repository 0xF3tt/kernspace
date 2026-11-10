import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from './fixtures.mjs';
import { ROOT, headersFor } from '../serve.mjs';
import { changeSheet, formatLabel, seriesLabel, sheetReady } from './helpers.mjs';

const saved = (blob) => JSON.stringify(blob);

test('boots the default studio @webkit', async ({ page }) => {
  await page.goto('/');
  await sheetReady(page, { series: 'cutting-mat', format: 'desktop', vol: '01' });
  await expect(page.locator('#vol-name')).toHaveText('Design');
  await expect(page.locator('#dl-png')).toBeEnabled();
  await expect(page.locator('#dl-svg')).toBeEnabled();
  await expect(page.locator('#sheet-img')).toHaveAttribute('alt', /Cutting Mat/);
});

test('opens a valid series, volume, ink, ground and format link @webkit', async ({ page }) => {
  await page.goto('/?series=specimen&vol=3&ink=blue&ground=light&format=wide');
  await sheetReady(page, { series: 'specimen', format: 'wide', vol: '03' });
  await expect(page.locator('#g-blue-light')).toBeChecked();
  await expect(page.locator('#sheet')).toHaveAttribute('data-ground', 'light');
  await expect(page.locator('#slug')).toContainText('3840x2400');
  await expect(page.locator('#sheet-img')).toHaveAttribute('alt', /Specimen/);
});

test('opens the default studio for an inherited series id and keeps a saved whoami @webkit', async ({ page }) => {
  await page.addInitScript((blob) => localStorage.setItem('ks-edits', blob), saved({
    v: 2, series: 'specimen', edits: {}, handle: 'ada', motto: 'set in mono',
  }));
  const errors = [];
  page.on('pageerror', (err) => errors.push(err));
  await page.goto('/?series=constructor');
  await sheetReady(page, { series: 'cutting-mat', vol: '01' });
  await expect(page.locator('#handle')).toHaveValue('ada');
  await expect(page.locator('#motto')).toHaveValue('set in mono');
  await expect(page.locator('#sheet-img')).toHaveAttribute('alt', /Cutting Mat/);
  expect(errors).toEqual([]);
});

test('opens the default studio for an unknown series id @webkit', async ({ page }) => {
  await page.goto('/?series=not-a-series&vol=4');
  await sheetReady(page, { series: 'cutting-mat', vol: '04' });
  await expect(page.locator('#vol-name')).toHaveText('Device');
  await expect(page.locator('#slip')).not.toContainText('could not be loaded');
});

test('a link that names no series does not restore the saved series', async ({ page }) => {
  await page.addInitScript((blob) => localStorage.setItem('ks-edits', blob), saved({
    v: 2, series: 'galley-proof', edits: {}, handle: '', motto: '',
  }));
  await page.goto('/?vol=5&ink=green');
  await sheetReady(page, { series: 'cutting-mat', vol: '05' });
  await expect(page.locator('#g-green-dark')).toBeChecked();
});

test('restores the saved series, whoami and theme', async ({ page }) => {
  await page.addInitScript((blob) => {
    localStorage.setItem('ks-theme', 'light');
    localStorage.setItem('ks-edits', blob);
  }, saved({ v: 2, series: 'specimen', edits: {}, handle: 'ada', motto: 'carefully' }));
  await page.goto('/');
  await sheetReady(page, { series: 'specimen' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#handle')).toHaveValue('ada');
  await expect(page.locator('#motto')).toHaveValue('carefully');
});

test('migrates a v1 saved blob onto Cutting Mat', async ({ page }) => {
  await page.addInitScript((blob) => localStorage.setItem('ks-edits', blob), saved({
    v: 1, edits: {}, handle: 'grace', motto: 'hopper',
  }));
  await page.goto('/');
  await sheetReady(page, { series: 'cutting-mat' });
  await expect(page.locator('#handle')).toHaveValue('grace');
  await expect(page.locator('#motto')).toHaveValue('hopper');
});

test('stays busy while a font request is delayed, then draws the sheet', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/fonts/nunito/Nunito-Variable.ttf', async (route) => {
    await gate;
    await route.continue();
  });
  const requested = page.waitForRequest('**/fonts/nunito/Nunito-Variable.ttf');
  await page.goto('/', { waitUntil: 'commit' });
  await requested;
  await page.waitForFunction(() => document.querySelector('#stage')?.getAttribute('aria-busy') === 'true');
  expect(await page.locator('#sheet-img').getAttribute('data-u')).toBeNull();
  release();
  await sheetReady(page, { series: 'cutting-mat' });
});

test('shows a recoverable error when palette requests fail', async ({ page }) => {
  await page.route('**/palettes/*.json', (route) => route.abort('failed'));
  await page.goto('/');
  await expect(page.locator('#slip')).toContainText('could not be loaded', { timeout: 20_000 });
  await expect(page.locator('#stage')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#sheet-img')).not.toHaveAttribute('data-u', /blob:/);
});

test('falls back to Cutting Mat when the linked series cannot be loaded', async ({ page }) => {
  await page.route('**/series/specimen/presets/**', (route) => route.abort('failed'));
  await page.goto('/?series=specimen');
  await sheetReady(page, { series: 'cutting-mat', vol: '01' });
  await expect(page.locator('#slip')).not.toContainText('could not be loaded');
});

test('switches series, volume and format', async ({ page }) => {
  await page.goto('/');
  await sheetReady(page, { series: 'cutting-mat', format: 'desktop' });
  await changeSheet(page, () => seriesLabel(page, 'specimen').click(), { series: 'specimen' });
  await expect(page).toHaveURL(/series=specimen/);
  await changeSheet(page, () => page.locator('#next').click(), { series: 'specimen', vol: '02' });
  await expect(page).toHaveURL(/vol=2/);
  await changeSheet(page, () => formatLabel(page, 'phone').click(), { series: 'specimen', format: 'phone' });
  await expect(page).toHaveURL(/format=phone/);
  await expect(page.locator('#slug')).toContainText('1290x2796');
});

test('serves the vercel.json CSP and blocks a foreign script @webkit', async ({ page }) => {
  const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  const csp = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
  const home = await page.request.get('/');
  expect(home.headers()['content-security-policy']).toBe(csp);
  expect(home.headers()['x-content-type-options']).toBe('nosniff');
  expect(home.headers()['cross-origin-resource-policy']).toBe('same-origin');
  const font = await page.request.get('/fonts/jetbrains-mono/JetBrainsMono-Variable.ttf');
  const expected = headersFor('/fonts/jetbrains-mono/JetBrainsMono-Variable.ttf');
  expect(font.headers()['cache-control']).toBe(expected['cache-control']);
  expect(font.headers()['cross-origin-resource-policy']).toBe('cross-origin');

  await page.goto('/');
  await sheetReady(page);
  const violation = await page.evaluate(() => new Promise((resolve) => {
    document.addEventListener('securitypolicyviolation', (ev) => {
      resolve({ directive: ev.violatedDirective, blocked: ev.blockedURI });
    }, { once: true });
    const script = document.createElement('script');
    script.src = 'https://example.com/kernspace-csp-probe.js';
    document.head.append(script);
  }));
  expect(violation.directive).toContain('script-src');
  expect(violation.blocked).toContain('example.com');
  await expect(page.locator('#sheet-img')).toHaveAttribute('data-u', /^blob:/);
});
