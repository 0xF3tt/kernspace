import { test as base, expect } from '@playwright/test';

// A page error fails the test with the exception text. Traces and screenshots are kept by the Playwright config.
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err));
    await use(page);
    if (errors.length && testInfo.status !== testInfo.expectedStatus) return;
    expect(errors.map((err) => err.stack || err.message), 'uncaught page errors').toEqual([]);
  },
});

export { expect };
