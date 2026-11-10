import { test, expect } from './fixtures.mjs';
import { changeSheet, editorReady, sheetReady } from './helpers.mjs';

async function openEditor(page) {
  await page.locator('#edit-open').click();
  await editorReady(page);
}

async function applyAnotherWord(page) {
  const before = await page.locator('#vol-line em').innerText();
  const option = page.locator('#ep-list [role="option"][aria-selected="false"]:not([aria-disabled="true"])').first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.locator('#vol-line em')).not.toHaveText(before);
  await expect(page.locator('#vol-line .tape')).toHaveText(/1 word changed/);
  await expect(page.locator('#undo')).toBeEnabled();
}

test('edits a word, undoes, redoes, and keeps the edit after reload', async ({ page }) => {
  await page.goto('/');
  await sheetReady(page, { series: 'cutting-mat' });
  await openEditor(page);
  const svg = await page.locator('#live').evaluate((el) => el.shadowRoot?.querySelector('svg')?.tagName);
  expect(svg).toBe('svg');
  await applyAnotherWord(page);
  await page.locator('#undo').click();
  await expect(page.locator('#vol-line .tape')).toHaveCount(0);
  await expect(page.locator('#redo')).toBeEnabled();
  await page.locator('#redo').click();
  await expect(page.locator('#vol-line .tape')).toHaveText(/1 word changed/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ks-edits')));
  expect(stored.v).toBe(2);
  expect(stored.series).toBe('cutting-mat');
  expect(stored.edits['cutting-mat'].appsec).toBeTruthy();

  await page.reload();
  await sheetReady(page, { series: 'cutting-mat' });
  await expect(page.locator('#vol-line .tape')).toHaveText(/1 word changed/);
  await expect(page.locator('.frame.edited')).toHaveCount(1);
});

test('keeps working when storage is inaccessible, and a reload drops the edit', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('denied', 'SecurityError'); },
    });
  });
  await page.goto('/');
  await sheetReady(page);
  await expect(page.locator('#ep-saved')).toHaveText(/blocks storage/);
  await openEditor(page);
  await applyAnotherWord(page);
  await page.reload();
  await sheetReady(page, { series: 'cutting-mat' });
  await expect(page.locator('#vol-line .tape')).toHaveCount(0);
});

test('enters and leaves the editor from the keyboard and restores focus', async ({ page }) => {
  await page.goto('/');
  await sheetReady(page);
  await page.locator('#edit-open').focus();
  await page.keyboard.press('Enter');
  await editorReady(page);
  await expect(page.locator('#rail [aria-selected="true"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.body.hasAttribute('data-editing'));
  await expect(page.locator('#edit-open')).toBeFocused();
  await expect(page.locator('#live')).toBeHidden();
});

test('opens and closes the editor on a narrow layout @narrow', async ({ page }) => {
  await page.goto('/');
  await sheetReady(page);
  expect(await page.evaluate(() => matchMedia('(max-width: 860px)').matches)).toBe(true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await openEditor(page);
  await expect(page.locator('#eb-done')).toBeVisible();
  await expect(page.locator('#rail [aria-selected="true"]')).toBeVisible();
  await page.locator('#eb-done').click();
  await page.waitForFunction(() => !document.body.hasAttribute('data-editing'));
  await expect(page.locator('#edit-open')).toBeVisible();
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('leaves the editor on the first frame and disables CSS animation', async ({ page }) => {
    await page.goto('/');
    await sheetReady(page);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#dl-png .dl')).animationName)).toBe('none');

    await openEditor(page);
    await page.evaluate(() => {
      window.__exitFrames = null;
      document.querySelector('#edit-done').addEventListener('click', () => {
        let frames = 0;
        const step = () => {
          frames += 1;
          if (!document.body.hasAttribute('data-editing')) window.__exitFrames = frames;
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, { once: true });
    });
    await page.locator('#edit-done').click();
    await page.waitForFunction(() => window.__exitFrames != null);
    const frames = await page.evaluate(() => window.__exitFrames);
    expect(frames).toBeLessThan(5);
    await expect(page.locator('#edit-open')).toBeFocused();
  });
});

test('moves to the next volume from the keyboard', async ({ page }) => {
  await page.goto('/');
  await sheetReady(page, { vol: '01' });
  await page.locator('#slug').click();
  await changeSheet(page, () => page.keyboard.press('ArrowRight'), { vol: '02' });
  await expect(page.locator('#vol-name')).toHaveText('Code');
});
