# Design

The design line of the site ([`index.html`](index.html), [`app/style.css`](app/style.css)). The sheets keep their own rules in [`series/`](series/) and [`palettes/`](palettes/).

## Idea

The page is a print-shop desk, in black and white so the sheets carry all the color. Sheets lie on a neutral grey tile, never on the page itself, and the interface marks them the way a designer marks a proof: a blue pencil for what is selected, a red pencil for what is wrong. Nothing on the page is there for decoration; every mark says something, like the marks on the sheets.

## Color

Every color is a token on `:root`. Dark is the default; light redefines the same tokens under `prefers-color-scheme: light` and again under `[data-theme="light"]`, so the toggle wins both ways. [`app/theme.js`](app/theme.js) applies a saved choice before first paint.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--desk` | `#000000` | `#FFFFFF` | Page ground |
| `--well` | `#1D1D1F` | `#F5F5F7` | The tile a sheet lies on: neutral grey, so no page color touches a sheet |
| `--raised` | `#1D1D1F` | `#FFFFFF` | Controls, keycaps, slips |
| `--hair` | `#424245` | `#D2D2D7` | Hairlines |
| `--control` | `#6E6E73` | `#86868B` | Input and track edges, 3:1 against the ground and the tile |
| `--ink` | `#F5F5F7` | `#1D1D1F` | Text; the one filled button |
| `--ink-2`, `--ink-3` | `#A1A1A6`, `#86868B` | `#424245`, `#6E6E73` | Secondary and tertiary text, 4.5:1 on the ground and the tile |
| `--pencil` | `#2997FF` | `#0066CC` | Annotation only: selection, focus, the marks in *Read the mat* / *Read the specimen* / *Read the galley* / *Read the card* |
| `--pencil-sheet` | `#8FD6E4` | same | Pencil drawn over a sheet, in both themes |
| `--rubric` | `#FF453A` | `#E30000` | Errors, and why a word doesn't fit |
| `--tape` | ink at 8% | ink at 6% | Hover wash |

Pencil never fills a button at rest, and rubric never decorates. Pencil and rubric are nearly the same brightness, so they are told apart by hue: after protan, deutan and tritan simulation they stay at least ΔE00 50 apart. The sheets keep their own palettes in both themes.

## Type

| Family | Role |
|---|---|
| **Newsreader** (`--voice`) | Headings, copy, controls. Headings at weight 400 with `text-wrap: balance` |
| **JetBrains Mono** (`--data`) | Data: file names, sizes, codes, counts, hex values. Ligatures off, tabular figures |

Scale, in px: 12 · 13 · 15 · 17 (body, line height 1.5) · 21 · 28 · 40 · 56. Prose and controls never go below 12. A *data* tier of 10 to 11.5 is allowed for numbers, IDs, counts, ruler ticks and tags only. Both families are served from [`fonts/`](fonts/README.md).

## Elements

- **Registration brackets.** The one selection mark, drawn in pencil at the four corners: the current volume, ground, slot and option. A selection is never a filled block. Among peers in a segmented group (series, format, finish) one bracket slides to the chosen option, and a hover previews it faintly on the others; anything else draws its own.
- **The series switch.** The stage bar names each series as a radio option with a glyph drawn from its own marks (the mat's taint path and boundaries, the specimen's A over its baseline, the galley's strip and dele loop, the card's face with its header rule, rod hole and a guide tab behind), and one bracket slides to the selected one. At 690px and below, and from 861 to 1060px (where the inspector leaves the bar 453 to 650px), the names hide and the glyphs stay at 44px (four names need 550px of bar plus the tools; the count of volumes hides to 1200px for the same reason), with the name kept as the accessible label and the tooltip. The Live cards in *Series* use the same brackets for the series in the studio; each card's button switches to it.
- **The preview switch.** One plain switch with no visible label (*On screen* is its accessible name and its tooltip): off shows the sheet alone, on shows it on a menu bar, dock and desktop icons, or a lock screen with a notification. The track is a ruler and the sheet slides along it; on takes the pencil wash and ring, like a pressed icon button. The word editor turns it off while it is open and restores it after.
- **The finish picker.** The last row of *Ink and ground*, on the drawdown's grid: *Finish* in its 44px name column, then two segmented groups with one bracket sliding in each. The first picks *None*, *Film* or *Paper*. Under it the chosen family's stocks sit in a bare group with no well, so the family leads, on the same column edges: *35 mm*, *65 mm* and *35 mm fast*, or *Tooth*, *Riso* and *Card*. At *None* the stocks hide. A family brings back the stock last picked in it during the visit, or else its first, and the bracket lands on that stock without sliding over the new names. Picking never moves the picker from under the pointer, even when the file name under the stage wraps anew. At 400px and below *Finish* goes above the groups, so *35 mm fast* keeps one line inside its bracket. The note under the picker gives one line on what the finish imitates, naming its stock (so the stock a family brings back is announced), and one on what the PNG and a pack of 15 grow to; at *None* it offers film grain or paper. The note's cell is as tall as the longest finish's note at any width, so moving between stocks or families never moves what is below. It is a polite live region, written only when the finish changes, and it describes every option in both groups. Every visit starts at *None*: the finish is never saved and never in the link. One finish at a time goes on the stage and in every download (PNG, SVG and the pack). The file names carry its key (`_film-35mm`, `_paper-riso`), and the sheet's alt text names it. It never goes on the thumbnails, the ground cards in *Inks*, the sheet in *Read the mat*, the Live cards, the word editor's proof (which is read before the finish goes on) or the site's social image. The finishes are one table, `FINISHES` in [`app/render.js`](app/render.js), and the picker is built from it. On the darkest grounds Riso and Card clip some of their mottle at black: up to about 6% of the flat ground's channel values, on phosphor (under 4% on iron gall).
- **At full size.** The stage draws a sheet at a fifth to a half of its pixels, and its finish at that scale, which is not the texture of the export. So while a finish is on, a crop of the export sits under the note, captioned *At full size*: the stage's own sheet image, drawn unscaled on a canvas as the PNG is, one sheet pixel to each screen pixel, at any pixel ratio. It frames the whoami box, from just left of it and centred on its height, which gives small type on flat ground in every series and format. It redraws shortly after the sheet settles, only while it is on screen; after a slow draw (a canvas without the graphics card takes 1 to 2s for the 4K filter) it waits for a longer pause. A newer sheet drops it. It dims, after a beat (with reduced motion too, as a step), while it shows an older sheet than the stage, and at *None* it is emptied, so a finish never opens on an old sheet. It reads as an image named for its finish and takes no focus.
- **The stage.** The sheet in its well, with rulers in sheet pixels along the top and left. In the word editor the rulers follow the zoom.
- **One filled button per screen.** *Download PNG*, in ink, as an icon with no text. Every other button is outlined or bare.
- **Icon-only buttons and the tooltip.** Every command is a stroke icon (round caps, 1.5 to 1.7) with its name in `aria-label` and the same words in `data-tip`; a CSS tooltip reads it on a fine pointer's hover and on keyboard focus, and on a touch or pen long-press (about 500ms, which shows the tip without firing the control); a plain tap never shows it. It opens below the control (above in the download bar) so it stays in the viewport. Shortcuts go in the tip (*Undo (⌘Z)*), and no control carries a `title`. Targets are 44px at 860px and below. A number that is data, like the count behind *Show N that won't fit*, stays as a small badge. Text stays for content (word tabs, grounds, options) and for links inside a sentence.
- **The slip.** The only toast: bottom center, one line of what happened, an undo when there is one.
- **The copy desk.** The word editor's panel: the slot's name, how many options fit, then *As shipped*, *Suggested*, more words from the topic, the rest of its lexicon and *Other volumes*. Words that won't fit wait behind *Show N that won't fit*, each with its reason in rubric. Under the list, *Propose a term* opens the lexicon form on GitHub, and a search with no match offers it too.

## Layout

Content runs to 1440px with a 32px gutter (16px on phones). Breakpoints at 1180, 860 and 560px, plus the series switch's own at 690 and 1060px, and 400px, where the version tag hides and *Finish* goes above its picker.

- **Wide:** the stage on the left, the inspector (344px) on the right.
- **1180px and below:** the inspector narrows to 312px; *Read the mat* (or the specimen's, the galley's or the card's key) stacks, and picking a line from its key scrolls the sheet into view. On a narrow, tall screen the sheet sticks under the header instead and the key scrolls beneath it, so picking never moves the page.
- **860px and below:** one column. Downloads sit in a bar pinned to the bottom. In the word editor the stage, the slot rail and the edit bar stay pinned while the options scroll.

## Motion

One orchestrated moment: the zoom to a slot in the word editor (380ms, ease-out cubic). Otherwise only answers to an action: brackets settle in or slide to the next option (300ms), the theme cross-fades. `prefers-reduced-motion` turns all of it off.

## Words

Sentence case and plain verbs. An action keeps its name through the flow: *Download PNG* (its tooltip and accessible name) is followed by *Saved*. An error says what failed and what to do next (*The PNG could not be drawn in this browser. Download the SVG instead*). Marks on a sheet are named for what they show, and the key in *Read the mat* (*Read the specimen* on a Specimen sheet, *Read the galley* on a Galley Proof sheet, *Read the card* on a Catalog Card sheet) says what each one means in the threat model or the review. The section's name and intro come from the series.

## Rules

- **Strict CSP.** No inline styles or scripts: styles go through the CSSOM (`style.setProperty`) and the editor's live proof uses a constructed stylesheet in a shadow root. No third-party requests.
- **Accessible by default.** Every control works from the keyboard with a visible pencil focus ring; touch targets are 44px on phones; `forced-colors` keeps selection and focus visible.
- **Every word is checked.** The editor offers only words that pass the same checks as the shipped presets: `node app/words.test.mjs` applies a sample of them and runs the renderer's overlap checker on each.
