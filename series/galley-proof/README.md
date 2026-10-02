# Galley Proof

> Status: **live in the web app**: 15 presets listed in [`presets/index.json`](presets/index.json), rendered by [`app/series/galley-proof.js`](../../app/series/galley-proof.js) as pure SVG in three formats: `desktop` 3840×2160, `wide` 3840×2400 (16:10) and `phone` 1290×2796. Volumes carry the same numbers and names as Cutting Mat's.

## Design origin

The letterpress galley proof: a long single column of set type, pulled from the galley tray before it is made up into pages. The proofreader marks it in the margin, level with each line, and after publication the corrections go out on an errata slip tipped into the book ("for … read …"). The sheet follows one standard: the proofreaders' marks of *The Chicago Manual of Style*, which has printed a table of them since its first edition (1906); the marks here are those of the 18th edition (2024), figure 2.6. References: Linotype line-casting (Ottmar Mergenthaler, 1886), whose cast lines were called slugs; *The Chicago Manual of Style*, 18th ed., fig. 2.6 (proofreaders' marks) and fig. 2.7 (a marked proof); *ABC for Book Collectors* on errata slips and tipping in.

## Concept

Security review as proofreading. One real file (a workflow, a config, a policy, a detection rule, case notes) is set as a galley, line for line, and every finding gets the proofreader's mark whose meaning matches the fix: struck out for what must not ship, a caret where a control is missing, a transposition for a wrong order, *stet* for a risk accepted on record. The errata slip is the advisory. The piece celebrates close reading and review craft, the quiet half of security, instead of attack imagery.

## Element map

| Element | Security meaning |
|---|---|
| Galley strip with its head slug `GALLEY NN · <file>` | The file under review. The galley number is the volume's. |
| The proofreader's initials, `0xF3tt`, at the head (desktop and wide) | Sign-off: an author credit, never the viewer's handle. |
| Headline, set as the first lines of the galley | The principle the review enforces. |
| Gutter line numbers | Exact locations: every finding points at one line. |
| Proof marks in the text, in one coloured pen | Each finding marked where it sits: struck out, ringed, dotted, or a caret where something is missing. |
| The margin, level with each line | What to do about each finding: the new matter, a circled instruction, and a short gloss saying why. |
| Marks key (desktop and wide) | The marks this sheet uses, each with the weakness it stands for. |
| Errata slip, tipped over the strip's lower corner | The advisory: one correction repeated with its line (`file, l. N: for X read Y`) and one that holds throughout the file. |
| Tally at the galley's foot | The review in numbers: lines, changes, queries, *stet*. |
| Circled notes in the margin head (desktop and wide) | Remarks to the author that belong to no single line. |
| `# whoami` box | The viewer's handle and line. |
| Vertical side label `<TOPIC> GALLEY · VOL. NN · NAME` | Fixed series and volume index. |
| Bottom lines | A status line on the left; on the right the prompt, which starts with the viewer's handle. |

## Proof marks

| Type | In the text | In the margin | Meaning | Key |
|---|---|---|---|---|
| `dele` | struck through | the dele loop | remove: a wildcard, a secret, a legacy cipher, dead code | delete · remove what must not ship |
| `sub` | struck through | the new matter, uncircled | a wrong value set right | replace · set the right value |
| `ins` | a caret where it goes | the new matter, uncircled | a missing control added | insert · add the missing control |
| `tr` | an S-curve over two lines | circled *tr* | wrong order | transpose · wrong order · CWE-696 |
| `wf` | ringed | circled *wf* | wrong type or wrong context | wrong font · wrong type · CWE-843 |
| `stet` | struck, with dots under it | circled *stet* | a finding withdrawn on record: an accepted risk or a known false positive | let it stand · risk accepted, on record |
| `query` | nothing | the question, circled | an open question to the author | query · open question to the author |
| `space` | a caret | `#` | separate what must not touch | insert space · keep apart · CWE-653 |

Words go in the margin and only lines and symbols go in the text; instructions are circled and matter to be set is not, as in CMOS. Two uses are this series' own and are named so: fig. 2.6 has no mark for a query to the author, so a query is the question circled in the margin; and `tr` swaps two whole adjacent lines. The concept's leader lines are gone: CMOS sets each mark level with its line. A time-of-check/time-of-use bug is not a `tr`: its fix is a lock or an atomic operation, an insert.

## Slots

What a preset provides. Limits are characters (code points). No string may contain `<`, `>` or `&`.

| Key | Shape | Limit | Editable |
|---|---|---|---|
| `series`, `topic`, `title`, `ground` | copied from Cutting Mat's index entry for the topic | — | no |
| `phrase` | 1–2 lines, a phrase or quote of the topic | 18 per line | yes |
| `file` | `[\w.-]+`, a real file type; not the topic's Cutting Mat panel | 20 | no |
| `lines` | 8–12 lines in the file's own syntax; leading spaces are the indent; no line shared with the Cutting Mat panel | 40 | no |
| `marks` | 4–7 × `{ line, type, at?, to?, note, phone }`, at most one per line; `at` occurs once in its line; `to` for `sub` and `ins` only; `tr` never on the last line | `to` 24 · `note` 18 · `phone` 14 (stet 10, tr/wf 12) | no |
| `errata.line` | a line with a `sub` mark; the slip writes `for <at> read <to>` | 36 | no |
| `errata.throughout` | `for X read Y`, from one of the topic's `X → Y` terms | 36 | yes |
| `notes` | 2–3 circled remarks (not drawn on the phone) | 28 | yes |
| `label` | ends with `VOL. NN · NAME` | 40 | no |
| `data.left`, `data.right` | status lines; `data.right` may start with `{handle}` | 44; the phone keeps `data.left` to what fits beside its prompt with a 20-character handle | left yes |
| `phone.data` | a shortened form of `data` for the phone | 30 | follows `data` |

Computed, never stored: the slip's fixed lines, the key (the distinct types used, in order of first use) and the tally. Network names follow the project's rules: only loopback and RFC 5737 addresses, only the RFC 2606 domains (`example.com`, `.org`, `.net`), no email addresses.

Editable in the word editor: the headline, the notes, the throughout correction, the status line and the `# whoami` box. Fixed, and named in the editor's *Fixed on this sheet*: the head slug, the galley, the marking, the errata slip's line, the marks key, the tally, the side label and the prompt line. The galley is a real file and each mark sits on the one line its fix belongs to, so no word list can rewrite them.

The limits live in one place, `LIMITS` in [`app/series/galley-proof.rules.js`](../../app/series/galley-proof.rules.js), which the test and the editor share.

## Layout

**Desktop.** The strip runs from x 300 to 1780 and y 150 to 1900, filled with the `minor` tone and no frame. Inside it: the head slug (JetBrains Mono 30) with the initials and a hairline, the headline (Nunito 300, 112px), then up to 12 code lines (JetBrains Mono 48, 88px apart) with their numbers in the gutter outside the strip, and the tally at the foot. The margin starts at x 1840: each mark's matter (mono 36), circled label (Nunito 32) and gloss (Nunito 30), level with its line; the circled notes sit at its head. The key fills the right column from x 2860, two lines an entry, with the `# whoami` box under it. The errata slip (820×250, turned −1.5°, a paste strip on its left edge) is tipped over the strip's lower-right corner. Status lines run along the bottom, the side label up the right edge.

**Wide (16:10).** The same columns, 240px taller: code lines 96px apart, the slip lower.

**Phone.** The top 932px stay empty (lock-screen clock). The strip runs from x 110 to 890 and y 960 to 2160 with the slug, the headline (64px) and the code (30px); the margin keeps each mark's symbol and a plain-word phone form, with no gloss. The slip is tipped across the strip's lower edge, then the `# whoami` box and one status line, ending above the bottom 260px. The phone draws no key, notes or side label.

**Color.** No palette of its own. `minor`: the strip and the paste strip; `text`: code, headline, matter, notes and the slip's fill (the slip is inverse, with `bg` ink); `text2`: slug, glosses, tally, side label; `rule`: gutter, hairlines, key head; `chip1`: every mark, ring and circled label, the one coloured pen; `frame`: the whoami box; `data`: status lines. `major`, `angle`, `diag`, `tb`, `sink` and `chip3` are never drawn, so the strip never reads as Cutting Mat's terminal panel.

**Type.** Nunito 300 and JetBrains Mono (300, 400, 500) only; ligatures off.

## Presets

[`presets/index.json`](presets/index.json) is an ordered array of `{"id", "vol", "title", "topic", "ground"}` entries; `vol`, `title` and `ground` are copied from Cutting Mat's entry for the same topic.

| Vol. | Topic | File | Marks | Throughout |
|---|---|---|---|---|
| 01 · Design | `appsec` | `ci.yml` (GitHub Actions) | sub, query, stet, dele | for A06:2021 read A03:2025 |
| 02 · Code | `programming` | `reset.py` | sub, stet, query, tr | for random read secrets |
| 03 · Break | `pentest` | `findings.md` (a report finding under QA) | sub, query, dele, ins | for Temporal read Threat |
| 04 · Device | `mobile` | `Vault.kt` (Android Keystore) | sub, dele, query, stet | for Keymaster read KeyMint |
| 05 · Origin | `web` | `site.conf` (nginx) | sub, dele, stet, ins, query | for X-XSS-Protection read CSP |
| 06 · Forest | `active-directory` | `GptTmpl.inf` (Group Policy) | query, sub, stet, ins | for legacy LAPS read Windows LAPS |
| 07 · Emulate | `red-team` | `layer.json` (ATT&CK Navigator) | sub, query, dele, stet | for T1070.001 read T1685.005 |
| 08 · Detect | `blue-team` | `log_cleared.yml` (Sigma) | sub, ins, query, stet | for sigmac read pySigma |
| 09 · Key | `crypto` | `sshd_config` | sub, ins, dele, query, stet | for Kyber read ML-KEM |
| 10 · Posture | `cloud` | `bucket-policy.json` (S3) | sub, dele, query, stet | for 2008-10-17 read 2012-10-17 |
| 11 · Unpack | `reversing` | `upx.yar` (YARA) | dele, query, wf, stet, sub | for YARA read YARA-X |
| 12 · Evidence | `dfir` | `case-notes.md` | query, sub, stet | for SP 800-61 Rev. 2 read Rev. 3 |
| 13 · Prompt | `ai-security` | `tools.json` (an MCP tool) | query, sub, dele | for LLM06:2025 read LLM03:2026 |
| 14 · Capture | `ctf` | `challenge.yml` (ctfcli) | query, sub, stet, dele | for value read initial |
| 15 · Trust | `infosec` | `security.txt` (RFC 9116) | sub, stet, query, dele, ins | for responsible disclosure read CVD |

To add a preset:

1. Write `presets/<id>.json`, where `id` is the topic slug, with the slots above. The file and every line must be real syntax for its file type, and every value, default, ID and version must match its official source (fetch it, don't recall it). Use each mark only where its meaning is exact: `stet` needs a reason a reader can check, `wf` a real type or context confusion, `tr` a real ordering bug. Keep it defensive: a file under review and its fixes, never a payload or a step-by-step technique.
2. Append its entry to `index.json`, in volume order.
3. Give the topic's lexicon ([`topics/<id>.json`](../../topics/README.md)) `galley` hints (`note`, `status`, `errata`; the `as` of an errata hint is the sheet form, `for X read Y`) so that every editable slot offers at least two other words that fit. Galley Proof offers by word type only terms tagged `galley-proof`.
4. Run `node app/render.test.mjs`, `node app/words.test.mjs` and `node app/lexicon.test.mjs`.

## The overlap checker

[`app/series/galley-proof.rules.js`](../../app/series/galley-proof.rules.js) rebuilds a box for every text and mark on a rendered sheet (widths from the bundled fonts, paths bounded by their points plus half the stroke, the slip tested in its own turned frame) and runs with no handle, a 7-character and a 20-character one and the longest `# whoami` line. Texts are named by class and order, never by string, because the key repeats words from the margin. It fails, naming the text and the rule, when:

- two texts overlap;
- a slug, headline, code or tally text leaves the strip, a slip text leaves the slip, or a whoami line leaves its box;
- an in-text mark leaves its row band or touches another line;
- a margin item is not level with its line, starts too close to the strip, runs into another margin item or a note, or crosses into the key column;
- the slip covers a code line, a gutter number, a mark, a margin item or the tally, or misses the strip;
- a key entry, whoami line or side label enters the margin, a key glyph touches a key text, or a note falls below the first code line;
- anything leaves the canvas or reaches a keep-clear zone: desktop and wide the menu bar (top 110px) and the Dock (bottom-centre 1300×220); phone the clock (y < 932) and the bottom 260px.

## Design notes

- dfir reviews an examiner's notes, never the evidence: evidence lines take only *stet* or a query, and the one `sub` corrects the examiner's own wording.
- ctf's `type: standard → dynamic` follows ctfcli's challenge spec, which asks for `dynamic` when `extra:` holds `initial`, `decay` and `minimum`. CTFd 3.8.1 also scores dynamically under `standard`, and the dynamic plugin is supported until CTFd 4.0; this is the one fix in the series that may age.
- infosec's `security.txt` carries a dated `Expires`: the galley reviews a file at a moment, like any dated document. Its mark corrects the field's spelling.
- The headline, notes and status lines reuse the topics' own words; the errata's `X → Y` corrections are lexicon terms with their sources.
