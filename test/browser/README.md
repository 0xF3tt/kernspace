# Browser regression tests

The Node checks (`node app/*.test.mjs`) never open the studio. This suite runs it in Chromium and WebKit. It is development and CI tooling: the site stays plain ES modules with no production build and no runtime dependency. Install and run it from `test/`:

```sh
cd test
npm ci
npx playwright install --with-deps chromium webkit
npm test
```

CI runs that same entry point in the `browser` job. A failing test keeps a Playwright trace, a screenshot and a video under `test/test-results/` (uploaded from CI). The HTML report is `test/playwright-report/`.

`test/serve.mjs` is the only server these tests use. It serves the repo root and applies the header rules in [`vercel.json`](../../vercel.json) in order, so a later rule overrides the same header name. That is what turns the catch-all `Cross-Origin-Resource-Policy: same-origin` into `cross-origin` for files under `/fonts/`. `node test/headers.test.mjs` checks that mapping without a browser.

Tests wait on the studio's own signals: `#stage` leaving `aria-busy`, the sheet image decoding (`naturalWidth`), a new blob URL after a change, the editor shadow root containing an SVG, focus moving, and the browser download event. They do not sleep for a fixed time.

## Decisions

These are the choices for the open points on 0XF-106.

**Browsers.** CI launches Playwright Chromium and Playwright WebKit. Chromium runs every workflow below. WebKit runs the tests tagged `@webkit`: a valid and an invalid startup, the Content-Security-Policy check, the three bug regressions (invalid series keys, whoami against the active face, thumbnail blob URLs) and a real SVG plus PNG export. WebKit is in the matrix because PNG export waits 60ms for embedded fonts to settle on Safari. Firefox is not launched. The page is the same static modules there, and the engine-specific path this suite exists to catch is the WebKit one. Adding a third browser would repeat the same startup cost without covering a known divergence.

**Viewports.** Desktop projects use 1280×800, which is above the studio's 860px breakpoint. The `@narrow` project uses 390×844, which is below it. There is no separate tablet project.

**Runtime.** One worker. A desktop PNG is a 3840×2160 canvas, and overlapping rasters are not needed to cover the workflows. The suite is meant to finish in under 8 minutes once the browsers are installed. The CI job allows 20 minutes so the browser download has room. Full 15-volume rotation packs are not part of this suite.

**Visual baselines.** None. Font rasterisation differs between Chromium and WebKit, so a pixel snapshot would not be a stable assertion. Tests check behavior, focus, the address bar, filenames, SVG and PNG dimensions, the sRGB chunk and CSP violations. PNG byte length only has to clear a floor so an empty file fails. Failure screenshots are evidence, not baselines.

**CSP.** Asserting headers from a server that does not send them would not test the deployment policy. The test server reads `vercel.json`, and one test checks the response headers plus a `securitypolicyviolation` for a foreign script. The sheet image is a `blob:` URL, which the policy allows, and that image still decodes under the served policy.
