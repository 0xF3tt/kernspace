# Fonts

The type catalog for kernspace: what is in use, what is on deck, and what can never ship in this repo.

## Rules

- A font can be used in a published piece only if its license allows using it in images that are shared publicly.
- A font file can live in this repo only if its license allows redistribution. Today that means SIL Open Font License (OFL) fonts, always with their `OFL.txt` next to the files.
- Licensed fonts are never committed. They go in `fonts/licensed/`, which git ignores.
- Renders turn ligatures off, so code like `!==` and `--` reads as typed.

## In use

Bundled in this repo.

| Font | Role | License | Source | Notes |
|---|---|---|---|---|
| **Nunito** (variable, roman + italic) | Voice: the phrase on each sheet | OFL 1.1 | [googlefonts/nunito](https://github.com/googlefonts/nunito) | Latin and Cyrillic; no Greek, so Greek lookalikes go in JetBrains Mono |
| **JetBrains Mono** (variable) | Data: labels, rulers, panels, IDs, the `0xF3tt` signature; data on the site | OFL 1.1 | [JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono) | Dotted zero, so `0xF3tt` never reads as "O"; Latin, Greek and Cyrillic |
| **Newsreader** (variable, roman + italic) | The site's text face: headings, copy, controls. Not on the sheets | OFL 1.1 | [productiontype/Newsreader](https://github.com/productiontype/Newsreader) | Served from this repo, so the site makes no third-party requests |

## Candidates

All OFL, confirmed in the [google/fonts](https://github.com/google/fonts) repository. None is bundled until a series adopts it.

| Font | Why it fits | Series |
|---|---|---|
| **Libre Caslon Text** | Caslon's 1734 broadside is where the type specimen starts | `specimen` |
| **Libre Bodoni** | Bodoni's *Manuale Tipografico* (1818), the other classic specimen | `specimen` |
| **Courier Prime** | Library catalog cards were typewritten | `catalog-card` |
| **EB Garamond** | A book face for the text on a galley proof | `galley-proof` (considered; the series ships in Nunito and JetBrains Mono, since the galley is code set line for line) |
| **IBM Plex Mono** | An alternative mono with an engineering pedigree | any |
| **Onest** | From the NEUST system: a quiet grotesque for names and titles | any |
| **Bricolage Grotesque** | From the NEUST system: a display grotesque with character | any |

## Licensed

Never committed. Usable only after the license is bought and its terms are confirmed.

| Font | Designer | Style | License status |
|---|---|---|---|
| **Nuega** | Blankids Studio | Bold display slab serif. Regular, Outline and Texture, OTF and TTF | The free download on [freefonts.io](https://www.freefonts.io/nuega-font/) is **personal use only**. Paid licenses are sold by [Blankids Studio](https://blankidsfonts.com/product/nuega-bold-slab-serif-font/), from $19 (Standard) up to Webfont, Professional, Extended, Corporate and Broadcast. **Pending:** confirm which tier covers images shared publicly and rendering on a server (GitHub Actions). |

### What a licensed font means for this repo

- The file can't be in the public repo, so GitHub Actions can't render with it unless the file comes from a private place (an encrypted secret or private storage) **and** the license allows server use. Desktop licenses usually don't.
- Until that's settled, any piece that uses Nuega is rendered locally.
