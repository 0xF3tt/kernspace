// Browser regression entry point. From test/: npm ci && npx playwright install --with-deps chromium webkit && npm test
// See test/browser/README.md for the browser matrix, viewports, runtime budget and why there are no pixel baselines.
import { defineConfig, devices } from '@playwright/test';

const desktop = { width: 1280, height: 800 };
const narrow = { width: 390, height: 844 };

export default defineConfig({
  testDir: './browser',
  outputDir: './test-results',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node serve.mjs',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      grepInvert: /@narrow/,
      use: { ...devices['Desktop Chrome'], viewport: desktop },
    },
    {
      name: 'chromium-narrow',
      grep: /@narrow/,
      use: { ...devices['Desktop Chrome'], viewport: narrow },
    },
    {
      name: 'webkit',
      grep: /@webkit/,
      grepInvert: /@narrow/,
      use: { ...devices['Desktop Safari'], viewport: desktop },
    },
  ],
});
