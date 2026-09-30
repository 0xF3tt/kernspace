# Design

The design line of the site ([`index.html`](index.html), [`app/style.css`](app/style.css)). The sheets keep their own rules in [`series/`](series/) and [`palettes/`](palettes/).

## Idea

The page is a print-shop desk. Sheets lie in a well on the desk, and the interface marks them the way a designer marks a proof: non-photo-blue pencil for what is selected, red pencil for what is wrong. Nothing on the page is there for decoration; every mark says something, like the marks on the sheets.

## Color

Every color is a token on `:root`. Dark is the default; light redefines the same tokens under `prefers-color-scheme: light` and again under `[data-theme="light"]`, so the toggle wins both ways. [`app/theme.js`](app/theme.js) applies a saved choice before first paint.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--desk` | `#0E0C15` | `#F4F3F8` | Page ground |
| `--well` | `#0A0911` | `#EAE8F1` | The stage a sheet lies on |
| `--raised` | `#17141F` | `#FFFFFF` | Controls, keycaps, slips |
| `--hair` | `#262233` | `#DDD9E7` | Hairlines |
| `--control` | `#6A6383` | `#8E88A6` | Input and track edges, 3:1 against the ground |
| `--ink` | `#EDEAF6` | `#16122A` | Text; the one filled button |
| `--ink-2`, `--ink-3` | `#ADA7C2`, `#948EAB` | `#4A445F`, `#686280` | Secondary and tertiary text |
| `--pencil` | `#7FCBDA` | `#1A6B80` | Annotation only: selection, focus, the marks in *Read the mat* / *Read the specimen* |
| `--pencil-sheet` | `#8FD6E4` | same | Pencil drawn over a sheet, in both themes |
| `--rubric` | `#F2939C` | `#B42A2A` | Errors, and why a word doesn't fit |
| `--tape` | ink at 8% | ink at 6% | Hover wash |

Pencil never fills a button at rest, and rubric never decorates. The sheets keep their own palettes in both themes.

## Type

| Family | Role |
|---|---|
| **Newsreader** (`--voice`) | Headings, copy, controls. Headings at weight 400 with `text-wrap: balance` |
| **JetBrains Mono** (`--data`) | Data: file names, sizes, codes, counts, hex values. Ligatures off, tabular figures |

Scale, in px: 12 · 13 · 15 · 17 (body, line height 1.5) · 21 · 28 · 40 · 56. Both families are served from [`fonts/`](fonts/README.md).

## Elements

- **Registration brackets.** The one selection mark, drawn in pencil at the four corners: the current volume, ground, slot and option. A selection is never a filled block. Among peers in a segmented group (series, format) one bracket slides to the chosen option, and a hover previews it faintly on the others; anything else draws its own.
- **The series switch.** The stage bar names each series as a radio option with a glyph drawn from its own marks (the mat's taint path and boundaries, the specimen's A over its baseline), and one bracket slides to the selected one. At 560px and below the names hide and the glyphs stay at 44px, with the name kept as the accessible label and the tooltip. The Live cards in *Series* use the same brackets for the series in the studio; each card's button switches to it.
- **The preview switch.** One plain switch with no visible label (*On screen* is its accessible name and its tooltip): off shows the sheet alone, on shows it on a menu bar and dock or a lock screen. The track is a ruler and the sheet slides along it; on takes the pencil wash and ring, like a pressed icon button. The word editor turns it off while it is open and restores it after.
- **The stage.** The sheet in its well, with rulers in sheet pixels along the top and left. In the word editor the rulers follow the zoom.
- **One filled button per screen.** *Download PNG*, in ink. Every other button is outlined.
- **The slip.** The only toast: bottom center, one line of what happened, an undo when there is one.
- **The copy desk.** The word editor's panel: the slot's name, how many options fit, then *As shipped*, *Suggested*, more words from the topic, the rest of its lexicon and *Other volumes*. Words that won't fit wait behind *Show N that won't fit*, each with its reason in rubric. Under the list, *Propose a term* opens the lexicon form on GitHub, and a search with no match offers it too.

## Layout

Content runs to 1440px with a 32px gutter (16px on phones). Breakpoints at 1180, 860 and 560px.

- **Wide:** the stage on the left, the inspector (344px) on the right.
- **1180px and below:** the inspector narrows to 312px; *Read the mat* (or *Read the specimen*) stacks, and picking a line from its key scrolls the sheet into view.
- **860px and below:** one column. Downloads sit in a bar pinned to the bottom. In the word editor the stage, the slot rail and the edit bar stay pinned while the options scroll.

## Motion

One orchestrated moment: the zoom to a slot in the word editor (380ms, ease-out cubic). Otherwise only answers to an action: brackets settle in or slide to the next option (300ms), the theme cross-fades. `prefers-reduced-motion` turns all of it off.

## Words

Sentence case and plain verbs. An action keeps its name through the flow: *Download PNG* is followed by *Saved*. An error says what failed and what to do next (*The PNG could not be drawn in this browser. Download the SVG instead*). Marks on a sheet are named for what they show, and the key in *Read the mat* (*Read the specimen* on a Specimen sheet) says what each one means in the threat model. The section's name and intro come from the series.

## Rules

- **Strict CSP.** No inline styles or scripts: styles go through the CSSOM (`style.setProperty`) and the editor's live proof uses a constructed stylesheet in a shadow root. No third-party requests.
- **Accessible by default.** Every control works from the keyboard with a visible pencil focus ring; touch targets are 44px on phones; `forced-colors` keeps selection and focus visible.
- **Every word is checked.** The editor offers only words that pass the same checks as the shipped presets: `node app/words.test.mjs` applies a sample of them and runs the renderer's overlap checker on each.
