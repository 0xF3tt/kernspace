# Catalog Card

> Status: **live in the web app**: 15 presets listed in [`presets/index.json`](presets/index.json), rendered by [`app/series/catalog-card.js`](../../app/series/catalog-card.js) as pure SVG in three formats: `desktop` 3840×2160, `wide` 3840×2400 (16:10) and `phone` 1290×2796. Volumes carry the same numbers and names as Cutting Mat's.

## Design origin

The library catalog card: a standard 7.5 x 12.5 cm (3x5 in) card with a rod hole at the bottom, a call number top-left, a typed main entry, collation and notes, and numbered tracings at the bottom (arabic numerals for subject headings, roman for added entries). It is filed in drawers behind staggered guide-card tabs. References: Melvil Dewey's Library Bureau (1876), which standardized the card and cabinet; the Library of Congress printed-card distribution service (1901); and Paul Otlet and Henri La Fontaine's Répertoire Bibliographique Universel (1895), the index-card 'proto-web' of cross-references.

## Concept

Every security concept is catalogued like a book: classified by a real framework ID, defined in one typed sentence, cross-referenced, and corrected in pencil when the field's advice changes. The wallpaper shows one oversized card pulled up from a drawer, with the taxonomy visible as guide tabs behind it. Security appears as a body of knowledge you can look up, which is a calm, librarian-like alternative to the lone-hacker myth.

## Element map

| Element | Security meaning |
|---|---|
| Main card (large, off-center, rounded corners, a ruled header line in the `rule` ink) | One concept / technique / weakness / artifact entry |
| Call number (stacked lines, top-left) | Classification in a real framework: CWE, ATT&CK technique, OWASP category, MASVS control, CIS or NIST ID |
| Main entry heading | The concept's name |
| Typed body paragraph | One-sentence definition of the concept |
| Collation line (card style 'xii, 214 p. ; 24 cm') | Measurable facts: preconditions ; detections ; score or key size |
| Notes field | Governing standard or reference (RFC, NIST SP, OWASP cheat sheet) |
| Tracings, arabic numbered | Related concepts / weakness family (subject links) |
| Tracings, roman numbered | Mitigations and controls (added entries) |
| Pencil correction: typed word struck through, replacement written above | Deprecated guidance corrected, e.g. SHA-1 to SHA-256, 90-day rotation to breach-based rotation. Security advice has errata. |
| Rod hole (bottom center) with a tiny caption | The invariant: the one control that pins the entry in place; pull it and the concept falls out of the drawer |
| Guide cards with staggered tabs behind | Taxonomy path from parent category to child category (e.g. Injection > SQL > Blind) |
| Smaller 'see also' card peeking out | Cross-reference: the related or next technique in a chain |
| Circulation slip with stamped dates | Lifecycle timeline: reported, patched, disclosed, regressed |
| Brass drawer label holder | Topic and alphabetic range of the drawer |
| Accession stamp on the card back edge | kernspace ID + cataloger 0xF3tt |
| Nunito phrase on a blank guide card | The principle |

## Slots

What a topic preset has to provide. Limits are characters. Only the access points are editable in the word editor, and only to headings a `card` hint in the topic's lexicon vouches for; every other slot is the volume's description and stays fixed.

| Slot | Word type | Count | Max | Editable |
|---|---|---|---|---|
| `phrase` | quote | 1-2 lines | 18 each | yes |
| `drawer_label` | term | 1 | 20 | no |
| `guide_tabs` | term | 4 | 14 | no |
| `call_number` | id | 3 | 12 | no |
| `main_entry` | term | 1 | 20 | no |
| `definition` | phrase | 1 | 110 | no |
| `collation` | status-line | 1 | 44 | no |
| `correction_struck`, `correction_new` | term | 1 each | 18 | no |
| `notes` | phrase | 1-2 | 44 | no |
| `rod_invariant` | phrase | 1 | 28 | no |
| `tracings_subject` | term | 2-4 | 20 | yes (a `subject` hint) |
| `tracings_added` | term | 1-2 | 20 | yes (an `added` hint) |
| `see_also` | term | 1-2 | 24 (`NAME · ID`) | yes (a `see` hint) |
| `circulation_dates` | status-line | 3-5 | 18 | no |
| `data.left` (status line) | status-line | 1 | 44, and the phone's cap | yes |
| whoami | | | | yes (the viewer's own) |

## The 15 cards

One entry per volume. The correction is the field's advice that changed, with its date in the card's notes and slip.

| Volume | Main entry | Call numbers | Pencil correction |
|---|---|---|---|
| 01 · Design | Secure by default | `A07:2025`, `CWE-1392`, `PW.9` | ~~opt-in~~ opt-out |
| 02 · Code | Buffer overflow | `CWE-787`, `CWE-120`, `STR31-C` | ~~gets~~ fgets |
| 03 · Break | Penetration testing | `ID.IM-02`, `CA-8`, `SP 800-115` | ~~Azure pre-approval~~ ROE only |
| 04 · Device | Device attestation | `TA0029`, `T1404`, `M1002` | ~~SafetyNet~~ Play Integrity |
| 05 · Origin | SameSite attribute | `CWE-284`, `CWE-923`, `CWE-1275` | ~~None~~ Lax |
| 06 · Forest | Kerberoasting | `T1558.003`, `CWE-327`, `M1041` | ~~RC4 allowed~~ AES-SHA1 only |
| 07 · Emulate | Purple teaming | `CA-8(2)`, `ID.IM-02`, `A09:2025` | ~~optional~~ mandatory |
| 08 · Detect | Detection strategy | `DE.AE-02`, `SI-4`, `AU-6` | ~~Data source~~ Data component |
| 09 · Key | Key encapsulation | `A04:2025`, `CWE-327`, `SP 800-227` | ~~RSA-2048~~ ML-KEM-768 |
| 10 · Posture | Pod security | `A02:2025`, `CWE-250`, `T1611` | ~~PodSecurityPolicy~~ PodSecurity |
| 11 · Unpack | Sandbox evasion | `T1497`, `TA0005`, `TA0007` | ~~Time Based Evasion~~ Time Based Checks |
| 12 · Evidence | MailItemsAccessed | `T1114.002`, `AU-11`, `RS.AN-08` | ~~90 days~~ 180 days |
| 13 · Prompt | Pickle model files | `LLM04:2026`, `CWE-502`, `AML.T0018` | ~~False~~ True |
| 14 · Capture | Path traversal | `CWE-22`, `CAPEC-126`, `A01:2025` | ~~fully_trusted~~ data |
| 15 · Trust | TLP | `ID.RA-02`, `AC-21`, `SP 800-150` | ~~WHITE~~ CLEAR |

## Topic fit

Works for all 15, since every topic has a taxonomy. Strongest for infosec (frameworks), crypto (the struck-through correction suits algorithm deprecations), appsec (CWE), active-directory and red-team (ATT&CK IDs), mobile (MASVS), cloud (CIS benchmarks), ai-security (OWASP LLM Top 10 / MITRE ATLAS), and dfir (artifact cards: location, what it proves). Weakest for ctf, which lacks a canonical ID scheme, so ctf takes real CWE and CAPEC IDs. Programming works through language pitfalls or design patterns.

## Layout

**Desktop.** 3840x2160: the background is the drawer interior. Three guide cards with tabs rise at the left (x 180-1000, y 420-1700), and the blank front guide card carries the Nunito phrase. The main card, about 2250x1350 at 5:3, sits at x 900-3150, y 330-1680 with its rod hole at the bottom center. The see-also card peeks behind the top-right corner. The circulation slip is a narrow tall strip at x 3280-3620, y 480-1500. The brass drawer label sits top-left at y 110-200. Typed text is 34-40px mono, the heading 64px, the pencil correction Nunito in the accent color. Keep-clear as in the other series: the top 110px (menu bar) and a bottom-centre 1300x220 box (Dock). For 16:10 (3840x2400) the geometry is the same, 240px taller, as in the other series.

**Phone.** 1290x2796: the top third (y 0-940) is empty drawer. Guide tabs peek at y 1000-1180. The main card, 1170x700, sits at x 60-1230, y 1180-1880 with the definition shortened to 80 chars and 2 subject tracings. The see-also card peeks from behind the top-right corner. The circulation slip turns into a horizontal date row at y 1940-2020. The Nunito phrase goes at y 2080-2300 and the drawer label with 0xF3tt at y 2340-2420; check both against the lock-screen notifications (see Perception rules). Nothing goes below 2540. Minimum text on the card is 34px; the phone's chrome (the whoami box and the status line) is 30px, as on the other series.

## Perception rules

Set before the first render. The sheet is seen at the size of a 13″ laptop at 50 cm (one sheet pixel ≈ 0.54′) or a phone at 36 cm (≈ 0.53′), and mostly from the corner of the eye, around windows.

- **Two tiers of text.** *Glance* items (the phrase, the main entry, the call number) must read from the corner of the eye: large, few, well apart. Crowding, not size, limits reading away from the centre, so give each glance item room. *Scrutiny* items (body, collation, notes, tracings, slip dates) are read by looking straight at them: x-height at least 0.16° (9.6′). For JetBrains Mono (x-height 0.55 em) that is 34px on every format, hence the phone minimum above.
- **Strokes that carry meaning** (the card edge, the header rule, the strike-through, the rod hole) are at least 2px, about 1′. Thinner lines read as tone, not as marks.
- **Flat.** The card stands off the drawer by overlap and a lightness step, never by a shadow. A soft shadow needs a gradient, which bands in an 8-bit PNG; a hard shadow with no penumbra reads as a stain. If a depth cue is needed, use a flat, darker copy of the card's outline offset down and to the right, in any ink. No sepia, aging, paper texture or wear: wear with no use behind it is a false mark.
- **Exaggerate only what makes it a catalog card.** The rod hole, the stacked call number, the numbered tracings and the ruled header line are what tell it apart from a sticky note or a notes app. Draw those a little larger and crisper than life and leave the rest plain. No global contrast or saturation boost: it raises everything and singles out nothing.
- **One accent.** `chip1` draws only the struck-through word and the pencilled correction above it, so they are the sheet's one pop-out. Like every thin stroke over type, the strike needs a lightness step of at least half a stop from the typed text, and `node app/palette.test.mjs` holds it to that on every ground. Every other mark on the card is drawn in the ground's other inks.
- **Mind what covers the sheet.** Desktop icons fill the right edge on macOS and the left edge on Windows, so only tertiary content goes there (the circulation slip is tertiary; the correction and the phrase are not). On the phone, lock-screen notifications stack up from the bottom: the phrase and the correction stay above the collapsed notification stack (y 2215). An expanded list (from y 1750) covers the phone's lower card, as it covers the lower part of any sheet.

## Risks

It is text-heavy, so type hierarchy has to do the work: call number, heading, body and tracings must separate clearly. Without the rod hole, numbered tracings and call number it drifts toward a generic flashcard or notes UI. Sepia or aged-paper effects are forbidden (flat only; see Perception rules). Framework IDs must be exact per topic, and a wrong CWE or ATT&CK number would undermine credibility. The pencil correction must model genuinely current guidance.
