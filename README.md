# kernspace

[![Version](https://img.shields.io/github/v/tag/0xF3tt/kernspace?label=version&color=7556A5)](https://github.com/0xF3tt/kernspace/tags)
[![Tests](https://github.com/0xF3tt/kernspace/actions/workflows/ci.yml/badge.svg)](https://github.com/0xF3tt/kernspace/actions/workflows/ci.yml)
[![Live](https://img.shields.io/badge/live-kernspace.vercel.app-7556A5)](https://kernspace.vercel.app)
[![Code license: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/code-PolyForm_NC_1.0.0-7556A5)](LICENSE)
[![Assets license: CC BY-NC-SA 4.0](https://img.shields.io/badge/assets-CC_BY--NC--SA_4.0-7556A5)](LICENSE-ASSETS)
[![Dependencies: 0](https://img.shields.io/badge/dependencies-0-7556A5)](SECURITY.md)

*Privileged space, carefully kerned.*

![kernspace: a Cutting Mat and a Specimen wallpaper, side by side](art/og.png)

**Cybersecurity, typeset.** Original visual resources for the cybersecurity and geek community: wallpapers first, more later. Drawn with the tools of print. Every mark on a sheet stands for something real: a taint path, a trust boundary, a finding.

*Everything means something.*

A proposal, not a rule: a different way cyber could look.

> **Status:** 1.0.0-beta.7. A web app draws Cutting Mat, Specimen, Galley Proof and Catalog Card wallpapers in your browser: pick a series, a volume, an ink, one of its three grounds and a format, add a film grain or paper finish if you want, preview it on a screen, change the words from the volume's own lexicon, sign it in the `# whoami` box with a handle and a line of your own if you want, then download PNG or SVG. The address bar keeps the series, volume, ink, ground and format, so a link opens the same sheet. Nothing is uploaded, and your edits stay in your browser.

## How it works

Every piece is a combination of four things:

| Axis | What it is | Today |
|---|---|---|
| **Series** | A layout borrowed from graphic design, where each element carries a security meaning | `cutting-mat` · `specimen` · `galley-proof` · `catalog-card` (15 volumes each) |
| **Topic** (a volume) | A researched lexicon of one field's real vocabulary | 15 topics · 1,743 verified terms |
| **Palette** (an ink) | A color system with three grounds, contrast-checked (WCAG) and simulated for protan, deutan and tritan vision | `purple` · `green` · `red` · `blue` |
| **Format** | Output size | `desktop` 3840×2160 · `wide` 3840×2400 (16:10) · `phone` 1290×2796 |

Four series are on press.

| Series | Status | What it is |
|---|---|---|
| Cutting Mat | Live | A designer's cutting mat, read as a threat model: rulers, a taint path, trust boundaries and tape. |
| Specimen | Live | A foundry type specimen. The field's core primitive is set as a typeface, with the one unhandled case left as an empty box. |
| Galley Proof | Live | Security review as proofreading. Each finding gets the proofreader's mark that matches the fix; the advisory is an errata slip. |
| Catalog Card | Live | Every concept catalogued like a book: a call number from a real framework, one typed definition, corrections in pencil. |

## Layout

```
kernspace/
├── series/      one folder per series: concept, element map, slots, presets
├── topics/      one lexicon per topic
├── palettes/    purple · green · red · blue
├── fonts/       type catalog + bundled OFL fonts
├── index.html   the web app
└── app/         app logic + one renderer per series (pure SVG)
```

## Run

The app is plain HTML, CSS and ES modules: no build step, no dependencies, no third-party requests. Nothing leaves the browser: every wallpaper is drawn locally as SVG and turned into a PNG on a canvas.

Serve the repo root with any static server and open it:

```sh
python3 -m http.server 8000
```

Check the renderer, the word editor, the lexicons and the palettes (Node 20+, no installs):

```sh
node app/render.test.mjs
node app/words.test.mjs
node app/lexicon.test.mjs
node app/palette.test.mjs
```

The first renders every preset of every series in every palette, ground and format and runs each series' overlap checker (and checks that the checker fires on broken sheets); the second takes a sample of the words the editor offers for each series, applies them and runs the same checker on each result; the third lints every lexicon (shape, allowed values, length limits, duplicates) so a proposed term can be checked before review; the fourth lints every palette ground (WCAG contrast of text and marks, chip separation in CIEDE2000 under normal and color-blind vision, and lightness for Galley Proof's thin proof marks).

## Deploy

Vercel serves the repo root as a static site; [`vercel.json`](vercel.json) adds the security headers (a strict CSP with no inline code and no third-party origins, `nosniff`, `no-referrer`) and [`.vercelignore`](.vercelignore) leaves the research files out.

- **From GitHub:** import the repo in Vercel, framework preset *Other*, no build command, output directory `.` (the root).
- **From the CLI:** `vercel` for a preview, `vercel --prod` for production.

## Releases

Versions follow [SemVer](https://semver.org): `1.0.0-beta.N` while in beta, then `1.0.0-rc.N`, then `1.0.0`. The label on the site comes from [`version.json`](version.json), the only place it is written. To release: change it in a pull request, merge, then tag that commit with `v` + the version and push the tag. CI fails the tag if it doesn't match `version.json`. Release notes live in [GitHub Releases](https://github.com/0xF3tt/kernspace/releases).

```sh
git tag -s v1.0.0-beta.7 -m "1.0.0-beta.7" && git push origin v1.0.0-beta.7
```

## Palettes

Each ink comes from the history of print and computing, and each ground is a real material. All twelve are contrast-checked against WCAG and simulated for protan, deutan and tritan vision.

| Palette | Dark | Mid | Light | Story |
|---|---|---|---|---|
| `purple` | aniline | indigo | ditto | Spirit-duplicator inks; red + blue, both sides on one sheet |
| `green` | phosphor | soldermask | greenbar | CRT phosphor, circuit boards, line-printer paper |
| `red` | oxide | rubric | redline | Magnetic oxide, rubricated headings, the red pencil |
| `blue` | iron-gall | cyanotype | whiteprint | The blueprint's own chemistry |

## Roadmap

1. ~~Name, series concepts, palettes~~
2. ~~Topic lexicons (15)~~
3. ~~Web app (Beta 1): Cutting Mat, 3 presets, 4 palettes, 3 formats, custom handle~~
4. ~~Cutting Mat presets for all 15 topics~~
5. ~~Specimen series: renderer, series switch and all 15 topics~~
6. ~~Galley Proof series: renderer, proof marks from the Chicago Manual of Style and all 15 topics~~
7. ~~Catalog Card series: renderer, call numbers from real frameworks and all 15 topics~~
8. ~~Lint for lexicons in CI~~ · ~~lint for palettes~~ · lint for presets

## How it's made

Designed and directed by [0xF3tt](https://github.com/0xF3tt). Research and development assisted by AI. Images are rendered deterministically from code (pure SVG rendered in your browser and exported via canvas). No image is produced by an image-generation model.

## License

| What | License |
|---|---|
| Images, lexicons, palettes, series docs | [CC BY-NC-SA 4.0](LICENSE-ASSETS): share and remix with credit, no commercial use, remixes keep the same license |
| Code (`app/`, renderers, tests) | [PolyForm Noncommercial 1.0.0](LICENSE): free for noncommercial use |
| Fonts | Their own licenses; see the [font catalog](fonts/README.md) |

Because of the noncommercial terms, kernspace is *free for the community*, not "open source" in the OSI sense. Want to use something commercially (a conference, a CTF, merch)? Ask: exceptions are granted case by case.
