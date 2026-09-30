# Specimen

> Status: **concept** — not rendered yet.

## Design origin

The foundry type specimen sheet. It is a one-page inventory of a typeface: a hero glyph, a waterfall of sizes labelled in points, the full character set with code points, a test line, a small matrix of the family's weights and widths, and the foundry's info block. References: William Caslon's 'A Specimen' broadside (London, 1734); Giambattista Bodoni's Manuale Tipografico (Parma, 1818); and the numbered weight/width chart Adrian Frutiger drew for Univers (Deberny & Peignot, 1957), where two digits encode weight and width. Modern Unicode-era specimens add U+ code points under each glyph and show the .notdef 'tofu' box that appears when a font has no glyph for a character.

## Concept

The topic is shown as a typeface on a specimen sheet. The 'family' is the domain's core primitive (a SID, a nonce, a token, an event), and the sheet lists everything that primitive can express: its vocabulary, who can read how much of it, its lookalikes and its test vector. Specimens are where typographers study how characters stay distinguishable, which is already a security question (confusables, unhandled input). The piece looks like museum-grade foundry print, not hacker imagery.

## Element map

| Element | Security meaning |
|---|---|
| Hero glyph (2–4 characters set very large, top-left) | The domain's core primitive or identifier, the smallest unit everything else is built from (SID, JWT, IV, IOC, opcode). |
| Family name + classification line under the hero | The asset under study and its category, e.g. 'ticket granting ticket · authentication artifact · Tier 0'. |
| Size waterfall: the same phrase at 5 decreasing sizes, every line clipped at the same hairline | Need-to-know and privilege. Each line is one role (anonymous → user → service → admin → system). The larger the type, the less of the sentence fits before the clip, so low-privilege roles see only a fragment and the smallest, most privileged line shows it all. It reads as information exposure by privilege level. |
| Point-size + role labels in the waterfall's left margin | Layer or tier IDs (Tier 0/1/2, ring 0–3, L7→L3) that name the principal reading each line. |
| Character-set grid (cells with a glyph and a code-point label beneath) | The domain's closed vocabulary with canonical IDs, e.g. HTTP status codes, Windows event IDs, well-known SIDs, opcodes, IAM verbs or tokenizer token IDs. The code-point label is the official identifier. |
| .notdef 'tofu' cell (the single empty outlined box in the grid, in the accent color) | The unhandled case: input the parser or allow-list has no rule for. This is the finding, e.g. an unexpected byte, an unknown event or an unmapped claim. |
| Confusables strip (kerning-pair style: two lookalike glyphs/words with their code points) | Homoglyphs and lookalike identifiers (Unicode UTS #39 confusables, IDN homographs, masquerading names): identical on screen, trusted differently. |
| Univers-style numbered matrix (small grid, two-digit cell numbers, one cell filled) | Risk rating as impact × likelihood. As in Frutiger's two-digit Univers numbering, the first digit is impact and the second is likelihood, and the filled cell is this piece's rating. |
| Test line (the specimen's pangram position) | A known-answer test vector. A pangram exercises every glyph; a KAT or canonical fixture checks that an implementation behaves correctly (e.g. sha256("abc") prefix, a harmless standard test request). |
| Foundry block (bottom-right) | Fixed author identity: '# whoami / 0xF3tt · somewhere exploring the purple colors.' It is the foundry that 'issued' the specimen. |
| Vertical side label 'SPECIMEN · VOL. 0N · <topic>' | Fixed series/volume index, the specimen number of the sheet. |
| Bottom status lines | Coverage summary of the vocabulary, e.g. 'charset 23/24 mapped · 1 .notdef' and the signature/arc line. |

## Slots

What a topic preset has to provide. Limits are characters.

| Slot | Word type | Count | Max |
|---|---|---|---|
| `hero_glyph` | id | 1-1 | 4 |
| `family_name` | term | 1-1 | 24 |
| `classification` | phrase | 1-1 | 36 |
| `waterfall_phrase` | phrase | 1-1 | 64 |
| `waterfall_roles` | term | 4-5 | 12 |
| `charset_glyph` | term | 12-24 | 6 |
| `charset_code` | id | 12-24 | 10 |
| `notdef_label` | status-line | 1-1 | 18 |
| `confusable_side` | term | 2-6 | 12 |
| `confusable_code` | id | 2-6 | 10 |
| `matrix_axes` | term | 2-2 | 12 |
| `matrix_rating` | status-line | 1-1 | 24 |
| `test_vector` | snippet | 1-1 | 44 |
| `specimen_notes` | phrase | 2-3 | 28 |
| `data_l_data_r` | status-line | 2-2 | 44 |

## Topic fit

Best: crypto, where primitives, IVs/nonces and known-answer tests are native and the test line is literally a KAT. ai-security, where a tokenizer vocabulary is a character set with integer IDs and Unicode confusables or invisible tag characters are a real injection vector. web (homograph domains, status codes as the charset), reversing (opcode table as charset, byte values as code points) and programming. Good: active-directory (well-known SIDs and event IDs, lookalike account names), blue-team (event IDs, the .notdef as an unparsed log field), mobile (permission set), infosec. Weakest: cloud, because IAM action names (service:Action) overflow the 6-character glyph cells and need abbreviation. pentest and red-team largely reuse web/AD vocabularies, so their grids risk duplicating those topics.

## Layout

**Desktop.** 3840×2160, 160px outer margin. Leave the top 110px empty (menu bar) and a bottom-centre band of about 1300×220px empty (Dock). Left 58%: hero glyph at about 760px cap height from y≈190, with family name and classification below in JetBrains Mono (34px). Then the waterfall: 5 Nunito lines (≈150/112/84/64/48px) clipped by a hairline at x≈2150, each preceded by a left-margin 'pt · role' label (JetBrains Mono 26px). Right 42%: a 6×4 character-set grid of ≈220px cells (glyph in Nunito 80px, code point in JetBrains Mono 24px) with the .notdef cell as the only accent outline. Below the grid: the confusables strip, then a 4×4 Univers-style matrix (≈64px cells, one filled) with its rating, then the test-vector line. data_l bottom-left, data_r bottom-right, both outside the Dock span. The foundry/whoami block sits bottom-right above data_r, and the side label runs vertically on the right edge. Minimum text 24px. For 16:10 (3456×2160), keep the structure but move the grid to 5 columns and the clip hairline to x≈1950.

**Phone.** 1290×2796. Leave y 0–932 completely empty (clock and widgets). Hero glyph at ≈400px from x=90, y≈990, with family and classification below it. Waterfall: 4 lines (≈120/90/66/48px), all clipped at x=1200, with each role label in small caps above its line instead of in a left margin. Character-set grid of 4×3 cells (≈260px) at y≈1720–2250, including the .notdef cell. One confusable pair and the matrix rating share a single line. The foundry/whoami block and one status line end by y≈2530, keeping the bottom 260px clear for the flashlight and camera buttons. Minimum text 30px.

## Risks

Lexicon load: each topic needs 12–24 real, short IDs, and weak lexicons will pad the grid with filler. Confusable pairs render identically by design, so without visible code points they read as a duplication bug. Font coverage: Nunito includes Cyrillic (U+0400–045F) but almost no Greek (e.g. it lacks U+03BF), so Greek confusables must be set in JetBrains Mono. A repeated phrase in the waterfall can feel static unless the role labels are prominent enough to carry the privilege meaning. Hero glyphs like '0x' or leetspeak drift toward hacker cliché, so prefer domain nouns (SID, IV, IOC, JWT). Risk of reading as a plain font poster if the security labels are too small.
