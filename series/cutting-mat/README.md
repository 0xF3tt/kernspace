# Cutting Mat

> Status: **live in Beta 1** — presets listed in [`presets/index.json`](presets/index.json), rendered by [`app/series/cutting-mat.js`](../../app/series/cutting-mat.js) as pure SVG in three formats: `desktop` 3840×2160, `wide` 3840×2400 (16:10) and `phone` 1290×2796.

## Design origin

The self-healing cutting mat on every designer's desk: a printed grid with rulers on the edges, a 45° diagonal and angle lines for cutting, and bits of tape left behind from past jobs.

## Concept

The mat is read as a threat model. Every printed mark gets a real AppSec meaning, so the wallpaper is a small data-flow diagram you can study, not decoration.

## Element map

| Element | Security meaning |
|---|---|
| Rulers | Hex offsets on top, memory addresses on the left, line numbers on the right |
| Solid 45° diagonal | Taint path from a `source` dot to a `sink` dot |
| Two dashed horizontal lines | Trust boundaries, tagged `ISB-01` (lower) and `ISB-02` (upper) |
| Crossing points | One control per boundary, where the taint path crosses it |
| Dashed rays at 60°, 30°, 15° | Other data flows, each labeled |
| Colored tape | Findings: horizontal pill, vertical pill, square |
| Measurement ticks | Margin notes |
| Center panel | The phrase |
| Top panel | Terminal, code or threat-model snippet |
| Bottom-right panel | `# whoami` / `<handle> · <line>`: the viewer's handle and a line of their own |
| Bottom lines | Status line on the left; on the right the prompt, which starts with the viewer's handle |
| Side panel | The author's signature `0xF3tt` + vertical label |

## Slots

| Slot (preset key) | Word type | Count | Max chars (desktop / phone) |
|---|---|---|---|
| `phrase` | phrase | 1–2 lines | 18 per line, and each line must fit its panel |
| `label` | term, ends with `VOL. NN · NAME` | 0–1 | 40 |
| `source`, `sink` | term | 0–2 | 24 / 22 |
| `controls` | term | 0–2 | 14 |
| `flows` | term, prefixed `60° · `, `30° · `, `15° · ` in that order | 0–3 | 21 |
| `findings` | id / term | 0–3 | 20, the third (the square) 18 |
| `panel` | `title` + snippet `lines` (may be indented) | 0–1 | title 20 + up to 5 × 38 |
| `notes` | phrase | 0–3 | 26 |
| `data.left`, `data.right` | status-line | 0–2 | 40 / 44; phone 30 each, after `phone.data` merges over `data`. `data.right` may start with `{handle}`, which the app fills with the viewer's handle; the token counts as written |

Characters count as code points (`·` and `→` are one). Every character must exist in the font that draws it: JetBrains Mono for everything but the phrase, Nunito for the phrase.

Fixed on every sheet: `ISB-01` / `ISB-02` and the signature. The `# whoami` box takes the viewer's handle (≤ 20) and line (≤ 40); the app asks for both before it lets anyone download, and puts them on one line, or on two when together they pass 48.

The limits live in one place, `LIMITS` in [`app/check.js`](../../app/check.js), which the test and the app's word editor share.

## Presets

[`presets/index.json`](presets/index.json) is the list of presets: an ordered array with one `{"id", "vol", "title", "topic", "ground"}` entry per preset. The app reads it at start-up, uses it as the allow-list for the preset radio and builds the picker from it, in file order: one card per preset with a live thumbnail, the name and `NN · topic`. Each entry points to `presets/<id>.json`. Its `ground` is the preset's default: the app starts there and lets people switch to the palette's other two grounds.

To add a preset:

1. Write `presets/<id>.json`, where `id` is the topic slug. It holds `series: "cutting-mat"`, the same `topic`, `title` and `ground` as its index entry, the slots above, and a `layout`: three tape positions (`chips`: horizontal, vertical, square) and three note positions (`notes`), each a `[col, row]` grid cell, for `desktop` and `phone`. `wide` reuses `desktop`: rows up to 8 stay put, rows 9–13 move down 1–3, rows 14 and up move down 3.
2. Append its entry to `index.json`. `vol` continues the sequence (1, 2, 3…), `title` reads `Vol. NN · Name` with a name of 10 characters or fewer, and `ground` is `dark`, `mid` or `light`. One preset per topic.
3. Run `node app/render.test.mjs` and `node app/words.test.mjs`. The first checks the index (keys, order, unique ids, a lexicon for every topic, no unlisted preset files), then every preset (known keys only, the limits above, glyph coverage), renders it in every palette, ground and format, and runs the overlap checker.

The overlap checker ([`app/check.js`](../../app/check.js)) rebuilds a box for every text on each sheet (widths from the bundled fonts' own advances: JetBrains Mono at 0.6em per character, Nunito at the weight the sheet draws plus 0.1em for kerning; ink height from the fonts, label halos included, flows kept at their angle). It runs with no handle, a 7-character one and a 20-character one, and with the longest `# whoami` line, and fails with the slot and layout entry to move when:

- two texts overlap, or a text overlaps a tape, a control square, the source or sink dot or a note tick;
- a panel text does not fit its panel, or any other text runs under a panel or an ISB tag;
- a text on the mat leaves the frame, or a ruler or status line touches it;
- a label (flow, source, sink, control, finding, note) crosses an ISB line;
- a tape or note tick leaves the frame or lands on a panel, tag, control, dot or another tape or tick;
- on the phone, anything but the rulers reaches into the top third.

| Preset | Topic | Side of the loop | Story |
|---|---|---|---|
| Vol. 01 · Design | `appsec` | blue builds · `[TODO]` | Models an IDOR/BOLA (CWE-639) before it ships |
| Vol. 02 · Code | `programming` | purple learns · `[FIXED]` | `fixes #0001`: validate the key, check the owner, fail closed |
| Vol. 03 · Break | `pentest` | red breaks · `[FAIL]` | Swaps `?id=1337` and logs finding `0001` |

One bug runs through all three. Severity HIGH, CVSS 3.1 `7.1` (`AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N`).

## Layout rules

- Desktop keeps the menu bar and Dock zones clear.
- Phone keeps the top third clear for the lock-screen clock (enforced by the overlap checker) and puts the bottom lines above the flashlight and camera buttons.
- JetBrains Mono ligatures are off, so `!==` and `--` read as typed.
