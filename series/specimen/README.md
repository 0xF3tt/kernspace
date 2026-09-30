# Specimen

> Status: **live in the web app**: 15 presets listed in [`presets/index.json`](presets/index.json), rendered by [`app/series/specimen.js`](../../app/series/specimen.js) as pure SVG in three formats: `desktop` 3840×2160, `wide` 3840×2400 (16:10) and `phone` 1290×2796. Volumes carry the same numbers and names as Cutting Mat's (Vol. 09 is *Key* in both).

## Design origin

The foundry type specimen sheet. It is a one-page inventory of a typeface: a hero glyph, a waterfall of sizes labelled in points, the full character set with code points, a test line, a small matrix of the family's weights and widths, and the foundry's info block. References: William Caslon's 'A Specimen' broadside (London, 1734); Giambattista Bodoni's Manuale Tipografico (Parma, 1818); and the numbered weight/width chart Adrian Frutiger drew for Univers (Deberny & Peignot, 1957), where two digits encode weight and width. Modern Unicode-era specimens add U+ code points under each glyph and show the .notdef 'tofu' box that appears when a font has no glyph for a character.

## Concept

The topic is shown as a typeface on a specimen sheet. The 'family' is the domain's core primitive (a TGT, a status code, a syscall table, an event), and the sheet lists everything that primitive can express: its vocabulary, who can read how much of it, its lookalikes and its test vector. Specimens are where typographers study how characters stay distinguishable, which is already a security question (confusables, unhandled input). The piece looks like museum-grade foundry print, not hacker imagery.

## Element map

| Element | Security meaning |
|---|---|
| Hero (2–4 capitals set very large, top-left) | The domain's core primitive or identifier, the smallest unit everything else is built from (IND, TGT, SOP, OEP, MFT). |
| Family name + classification line under the hero | The asset under study and its category, e.g. 'Ticket-Granting Ticket · Kerberos · krbtgt · tier 0'. |
| Size waterfall: the same phrase at 5 decreasing sizes, every line clipped at the same hairline | Need-to-know and privilege. Each line is one role, least to most privileged. The larger the type, the less of the sentence fits before the clip, so the low-privilege roles see a fragment and the smallest line, the most privileged, reads the whole sentence. Weight grows with exposure too: 800 for the anonymous line down to 200 for the last. |
| `<pt> pt · <role>` labels in the waterfall's left margin | The principal reading each line. The point size is the size drawn. |
| Character-set grid (cells with a glyph and a code beneath) | The domain's closed vocabulary with its official identifiers: HTTP status codes, well-known SIDs, Windows event IDs, opcodes, ATLAS techniques, CSF categories… The code is the ID from the registry. |
| `.notdef` 'tofu' cell (the single outlined box that closes the grid, in the accent color) | The unhandled case: a real reserved, unassigned or unhandled value of that vocabulary (`GREASE 0x0A0A`, `0x06 #UD x64`, `S-1-5-8 Proxy`). This is the finding. |
| Confusables strip (two lookalike pairs with their code points) | Homoglyphs and lookalike identifiers (Unicode UTS #39 confusables, IDN homographs): identical on screen, trusted differently. |
| Numbered matrix (4×4, two-digit cell numbers, one cell filled) | Risk rating as impact × likelihood. As in Frutiger's Univers numbering, the first digit is the first axis and the second digit the second; the filled cell is this piece's rating. |
| Test line | A known-answer test or canonical fixture, computed, never guessed (a SHA-256 prefix, an RFC 6238 TOTP value, the WebSocket accept key, a FILETIME epoch). |
| Margin notes | Adages from the field, each on a tick. |
| Foundry block | The viewer's `# whoami` box: their handle and a line of their own. |
| Vertical side label `<TOPIC> SPECIMEN · VOL. NN · NAME` | Fixed series and volume index. |
| Bottom lines | A status line on the left; on the right the prompt, which starts with the viewer's handle. |

## Slots

What a preset provides. Limits are characters (code points: `·` and `→` count once). Every character must exist in the font that draws it: Nunito for the hero, family, waterfall and charset glyphs; JetBrains Mono for everything else (so Greek and Cyrillic confusables are set in mono).

| Slot (preset key) | Word type | Count | Max chars |
|---|---|---|---|
| `hero` | id | 1 | 4, capitals and digits (no `Q`: the checker judges the ink box of a 1000px hero) |
| `family` | term | 1 | 24 |
| `class` | phrase | 1 | 36 |
| `waterfall.phrase` | phrase | 1 | 64; the first (largest) line must be cut by the hairline and the last must show it whole |
| `waterfall.roles` | term | 5 | 12 each, least to most privileged |
| `charset` | `{glyph, code}` | 11–23 (aim for 18–23) | glyph 6, code 10; the `.notdef` cell is added after the last one |
| `notdef` | status-line | 1 | 18, but text over about 13 touches the cell edge |
| `confusables` | `[text, code]` | 2 pairs | text 12, code 10 |
| `matrix` | `axes` (2 × ≤12), `cell` `[i, l]` (1–4), `rating` | 1 | rating 24, and it starts with the two digits of the filled cell (`42 · …`) |
| `test` | snippet | 1 | 44 |
| `notes` | phrase | 2–3 | 28 |
| `label` | fixed, ends with `VOL. NN · NAME` | 1 | 40 |
| `data.left`, `data.right` | status-line | 2 | 44; phone 30 each, after `phone.data` merges over `data`. `data.right` may start with `{handle}`, which the app fills with the viewer's handle |

Editable in the word editor: `hero`, `family`, `class`, `waterfall.phrase`, `notdef`, `confusables.0/1`, `matrix.rating`, `test`, `notes.0–2`, `data.left` and the `# whoami` box. Fixed, and named in the editor's *Fixed on this sheet*: the character set, the waterfall roles, the matrix axes and filled cell, the side label and `data.right`, because they are the domain's canonical vocabulary and identifiers.

The `# whoami` box takes the viewer's handle (≤ 20) and line (≤ 40); the app asks for both before it lets anyone download.

The limits live in one place, `LIMITS` in [`app/series/specimen.rules.js`](../../app/series/specimen.rules.js), which the test and the word editor share.

## Layout

**Desktop.** 3840×2160, 160px outer margin. Left column: the hero (Nunito 800, as large as fits left of the hairline, up to 1000px), the family name (Nunito 300, 84px) and the classification (JetBrains Mono, 34px); then the waterfall, five Nunito lines at 150/112/84/64/48px and weights 800/600/400/300/200, clipped by a hairline at x=2150, each with its `pt · role` label (JetBrains Mono, 26px) in the left margin; the margin notes below. Right column: a 6-column grid of 210×196px cells (glyph in Nunito 300, code in mono 24px) closed by the `.notdef` cell, then the confusables, the 4×4 matrix (64px cells) with its rating, the test line and the whoami box. Status lines run along the bottom, and the side label runs up the right edge.

**Wide (16:10).** The same structure 240px taller: a 5-column grid and the hairline at x=1950.

**Phone.** The top 932px stay empty (lock-screen clock and widgets). The hero (at most 400px), the family and classification, then four waterfall lines at 110/84/62/42px (weights 800/600/300/200; the middle role is dropped) with each role in small caps above its line, all clipped at x=1200; a 4×3 grid (11 glyphs and the `.notdef` cell); one confusable pair and the matrix rating on a single line; the whoami box; one status line, ending by y≈2525 so the bottom 260px stay clear of the flashlight and camera buttons. The phone draws no matrix, test line or notes.

**Color.** No palette of its own: the 15 roles of the four palettes carry the sheet. `text`: hero, family and grid glyphs; `text2`: the waterfall and the code points; `rule`: the `pt · role` labels and notes; `data`: status lines; `major`: grid cells and the clip hairline; `minor`: faint guides; `frame`: the whoami box and the matrix outline; `chip1`: the filled matrix cell; `tb`: the `.notdef` cell, the only accent, kept at text-grade contrast (4.5:1).

**Type.** Nunito (variable, 200–800) and JetBrains Mono only; ligatures off. The waterfall weights and the hero's 800 are what the checker measures with: it keeps a Nunito width table for each of 200, 300, 400, 600 and 800.

## Presets

[`presets/index.json`](presets/index.json) is an ordered array of `{"id", "vol", "title", "topic", "ground"}` entries, the same shape as Cutting Mat's. `vol`, `title` and `ground` are copied from Cutting Mat's entry for the same topic: every series names and numbers its volumes alike.

| Vol. | Topic | Hero | Character set (official source) |
|---|---|---|---|
| 01 · Design | `appsec` | DFD | 2025 CWE Top 25 |
| 02 · Code | `programming` | NULL | Linux `errno` values |
| 03 · Break | `pentest` | CVSS | IANA service names and ports |
| 04 · Device | `mobile` | TEE | Android versions and API levels |
| 05 · Origin | `web` | SOP | HTTP status codes (RFC 9110 sections) |
| 06 · Forest | `active-directory` | TGT | Well-known SIDs and RIDs |
| 07 · Emulate | `red-team` | TTP | MITRE ATT&CK groups |
| 08 · Detect | `blue-team` | SOC | Windows Security event IDs |
| 09 · Key | `crypto` | IND | TLS registries: cipher suites, groups, signature schemes |
| 10 · Posture | `cloud` | CSPM | Cloud Controls Matrix v4 domains |
| 11 · Unpack | `reversing` | OEP | x86 one-byte opcodes |
| 12 · Evidence | `dfir` | MFT | NTFS attribute types |
| 13 · Prompt | `ai-security` | LLM | MITRE ATLAS technique IDs |
| 14 · Capture | `ctf` | PWN | Linux x86-64 system calls |
| 15 · Trust | `infosec` | CIA | NIST CSF 2.0 categories |

To add a preset:

1. Write `presets/<id>.json`, where `id` is the topic slug. It holds `series: "specimen"`, the same `topic`, `title` and `ground` as its index entry, and the slots above. Every ID and number must match its official source (fetch it, don't recall it); the test line must be computed; the `.notdef` value and the confusables' code points must be real. `data` and `notes` may reuse the topic's Cutting Mat values. `phone.data` shortens a status line for the phone.
2. Append its entry to `index.json`, in volume order.
3. Give the topic's lexicon ([`topics/<id>.json`](../../topics/README.md)) `spec` hints (`hero`, `family`, `class`, `phrase`, `notdef`, `confusable`, `rating`, `test`, `note`, `status`) so that every editable slot offers at least two other words that fit; the test checks it.
4. Run `node app/render.test.mjs` and `node app/words.test.mjs`. The first checks the index (keys, order, unique ids, the volume, title and ground Cutting Mat gives the topic), every preset (known keys, the limits above, glyph coverage, no duplicate glyphs or codes) and renders it in every palette, ground and format; the second applies a sample of the words the editor offers on each sheet.

## The overlap checker

[`app/series/specimen.rules.js`](../../app/series/specimen.rules.js) rebuilds a box for every text on a rendered sheet (widths from the bundled fonts' own advances at the weight the class draws; ink height from the fonts) and for the shapes a text could hide behind, and runs with no handle, a 7-character one and a 20-character one and with the longest `# whoami` line. It fails, naming the text and the rule, when:

- two texts overlap, or a text overlaps a grid cell, the matrix or the whoami box it doesn't belong to;
- a text leaves its cell (a charset glyph or code, the `.notdef` label), its column or its box, or the canvas;
- the hero, family, class, notes or a role label reach the clip hairline, or a role label runs into its line;
- the first waterfall line is not cut by the hairline, or the last one is;
- desktop and wide: anything in the top 110px (menu bar) or in the bottom-centre 1300×220 band (Dock);
- phone: anything above y=932 (clock) or in the bottom 260px.

## Design notes

Weak lexicons pad a grid with filler, so a vocabulary that cannot fill 18 cells says so instead: Cloud Controls Matrix has exactly 17 domains, NTFS attribute types 17, and those grids stop early. Confusable pairs render identically by design, so their code points are always visible. Nunito has almost no Greek, which is why the confusables are set in mono. A repeated phrase in the waterfall can feel static unless the role labels carry the privilege meaning, so the labels stay legible at every size. Hero words are domain nouns (SID, IV, IOC, JWT), not leetspeak.
