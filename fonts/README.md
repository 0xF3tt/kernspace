# Fonts

The type catalog for kernspace: what is in use, what is on deck, and what can never ship in this repo.

## Rules

- A font can be used in a published piece only if its license allows using it in images that are shared publicly.
- A font file can live in this repo only if its license allows redistribution. Today that means SIL Open Font License (OFL) fonts, always with their `OFL.txt` next to the files, embedded unmodified (several reserve their names, so a subset would need a new one).
- Licensed fonts are never committed. They go in `fonts/licensed/`, which git ignores.
- Each series sets its sheets in the type of its own trade, and JetBrains Mono sets the data on every sheet. A hand-drawn face appears only where a hand marks the sheet. [`app/fonts.js`](../app/fonts.js) lists every bundled face with the numbers the renderers and the overlap checker use; `node app/render.test.mjs` checks them against each file.
- Every character must exist in the font that draws it: no fallback glyph from another face.
- Renders turn ligatures off, so code like `!==` and `--` reads as typed.

## In use

Bundled in this repo. Every face is OFL 1.1 and every file came from [google/fonts](https://github.com/google/fonts), except Source Serif 4, which came from Adobe's own static release.

| Series | Faces | Why |
|---|---|---|
| Cutting Mat | **Nunito** for the phrase, **JetBrains Mono** for the rest | The first series and the site's image: round-ended monoline strokes, like a drafting pen's |
| Specimen | **Libre Caslon Display** for the hero, **Libre Caslon Text** for the family name, waterfall and charset, **JetBrains Mono** for codes, labels and the confusable pairs | The series borrows Caslon's 1734 broadside. The Display cut is drawn for large sizes. JetBrains Mono draws each homoglyph pair (a/а, o/ο) with identical outlines, which the specimen needs to show the trap |
| Galley Proof | **Source Serif 4** for the headline and the key, **Caveat** for the proofreader's marks and notes in the margin, **JetBrains Mono** for the file, slug, slip and data | The Chicago Manual of Style's 18th edition (2024), whose proofreader's marks the series uses, is set in Source Serif. Proofreaders mark the margin by hand |
| Catalog Card | **Xanh Mono** for everything typed on the cards, **Caveat** for the pencilled correction and the guide card's phrase, **JetBrains Mono** for the drawer label, stamps and data | The cards are typed. Xanh Mono is a monospaced serif with the narrow proportions of elite pitch (12 characters to the inch, against pica's 10); its 0.5 em advance set 1.2 times larger keeps each character's 0.6 em cell, and its 0.54 em x-height clears the series' 9.6′ reading rule. The `0xF3tt` stamp stays in JetBrains Mono for its dotted zero |

| Font | Files | License | Source | Notes |
|---|---|---|---|---|
| **Nunito** | variable, roman + italic | OFL 1.1 | [googlefonts/nunito](https://github.com/googlefonts/nunito) | Latin and Cyrillic, no Greek |
| **JetBrains Mono** | variable | OFL 1.1 | [JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono) | Dotted zero, so `0xF3tt` never reads as "O"; Latin, Greek and Cyrillic, homoglyph pairs drawn alike |
| **Libre Caslon Text** | variable, 400–700 | OFL 1.1 | [google/fonts librecaslontext](https://github.com/google/fonts/tree/main/ofl/librecaslontext) | Pablo Impallari's Caslon for text; it follows the mid-century Caslon revivals rather than the 1734 cuts. Latin only |
| **Libre Caslon Display** | static Regular | OFL 1.1 | [google/fonts librecaslondisplay](https://github.com/google/fonts/tree/main/ofl/librecaslondisplay) | High contrast, for the hero's sizes. Its `.notdef` is blank, which the specimen never shows: it draws its own tofu box |
| **Source Serif 4** | static Regular, Text optical size | OFL 1.1, Reserved Font Name "Source" | [adobe-fonts/source-serif](https://github.com/adobe-fonts/source-serif) | The static cut avoids the variable file's optical-size axis, which would change advances with the font size |
| **Xanh Mono** | static Regular | OFL 1.1 | [google/fonts xanhmono](https://github.com/google/fonts/tree/main/ofl/xanhmono) | Lam Bao and Duy Dao (Yellow Type), a monospaced serif. No → glyph, so typed text has no arrows |
| **Caveat** | variable, 400–700 | OFL 1.1 | [google/fonts caveat](https://github.com/google/fonts/tree/main/ofl/caveat) | Impallari Type's handwriting. Drawn at 500, with ligatures and contextual alternates off like every sheet text |
| **Newsreader** | variable, roman + italic | OFL 1.1 | [productiontype/Newsreader](https://github.com/productiontype/Newsreader) | The site's text face: headings, copy, controls. Not on the sheets |

## Candidates

Evaluated for the series and kept on file. All OFL unless noted.

| Font | Why it fits | Why not now |
|---|---|---|
| **EB Garamond** | Revived from the 1592 Egenolff-Berner specimen; full Greek and Cyrillic, small caps, every figure style | The site names Caslon's broadside as Specimen's origin. Its Greek ο is 19% narrower than its Latin o |
| **Courier Prime** | The reworked IBM Courier (1955), the canonical typed look | Its 0.451 em x-height needs 40 px for the card's 9.6′ rule, which breaks the card's grid; Xanh Mono reaches it in the same cells |
| **Routed Gothic** | A digitisation of the Leroy lettering templates, the drafting hand behind Cutting Mat (not on Google Fonts) | Cutting Mat keeps the house pair for now |
| **Old Standard TT** | The book face of the years the Chicago Manual first printed its marks | Source Serif 4's link to the Manual is documented; Old Standard has no Greek in the Google build |
| **Literata**, **Source Serif 4** (variable) | Full coverage and weights | Their optical-size axis changes advances with the size; the checker measures one instance |
| **IBM Plex Mono** | An alternative mono with an engineering pedigree | One data mono per sheet keeps the series together |
| **Onest**, **Bricolage Grotesque** | From the NEUST system: grotesques for names and titles | No series needs a grotesque yet |

Not OFL, so never bundled: Special Elite, Homemade Apple, Permanent Marker and Roboto Slab (Apache 2.0), Ubuntu Mono (UFL), osifont (GPLv3), TeX Gyre (GUST).

## Licensed

Never committed. Usable only after the license is bought and its terms are confirmed.

| Font | Designer | Style | License status |
|---|---|---|---|
| **Nuega** | Blankids Studio | Bold display slab serif. Regular, Outline and Texture, OTF and TTF | The free download on [freefonts.io](https://www.freefonts.io/nuega-font/) is **personal use only**. Paid licenses are sold by [Blankids Studio](https://blankidsfonts.com/product/nuega-bold-slab-serif-font/), from $19 (Standard) up to Webfont, Professional, Extended, Corporate and Broadcast. **Pending:** confirm which tier covers images shared publicly and rendering on a server (GitHub Actions). |

### What a licensed font means for this repo

- The file can't be in the public repo, so GitHub Actions can't render with it unless the file comes from a private place (an encrypted secret or private storage) **and** the license allows server use. Desktop licenses usually don't.
- Until that's settled, any piece that uses Nuega is rendered locally.
