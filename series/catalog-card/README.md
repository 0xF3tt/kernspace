# Catalog Card

> Status: **concept** — not rendered yet.

## Design origin

The library catalog card: a standard 7.5 x 12.5 cm (3x5 in) card with a rod hole at the bottom, a call number top-left, a typed main entry, collation and notes, and numbered tracings at the bottom (arabic numerals for subject headings, roman for added entries). It is filed in drawers behind staggered guide-card tabs. References: Melvil Dewey's Library Bureau (1876), which standardized the card and cabinet; the Library of Congress printed-card distribution service (1901); and Paul Otlet and Henri La Fontaine's Répertoire Bibliographique Universel (1895), the index-card 'proto-web' of cross-references.

## Concept

Every security concept is catalogued like a book: classified by a real framework ID, defined in one typed sentence, cross-referenced, and corrected in pencil when the field's advice changes. The wallpaper shows one oversized card pulled up from a drawer, with the taxonomy visible as guide tabs behind it. Security appears as a body of knowledge you can look up, which is a calm, librarian-like alternative to the lone-hacker myth.

## Element map

| Element | Security meaning |
|---|---|
| Main card (large, off-center, rounded corners, ruled red header line) | One concept / technique / weakness / artifact entry |
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

What a topic preset has to provide. Limits are characters.

| Slot | Word type | Count | Max |
|---|---|---|---|
| `drawer_label` | term | 1-1 | 20 |
| `guide_tabs` | term | 3-5 | 14 |
| `call_number` | id | 2-3 | 12 |
| `main_entry` | term | 1-1 | 26 |
| `definition` | phrase | 1-1 | 110 |
| `collation` | status-line | 1-1 | 44 |
| `notes` | phrase | 1-2 | 44 |
| `tracings_subject` | term | 2-4 | 22 |
| `tracings_added` | term | 1-2 | 22 |
| `correction_struck` | term | 1-1 | 18 |
| `correction_new` | term | 1-1 | 18 |
| `rod_invariant` | phrase | 1-1 | 28 |
| `see_also` | term | 1-2 | 24 |
| `circulation_dates` | status-line | 3-5 | 18 |
| `guide_phrase` | quote | 1-1 | 60 |

## Topic fit

Works for all 14, since every topic has a taxonomy. Strongest for infosec (frameworks), crypto (the struck-through correction suits algorithm deprecations), appsec (CWE), active-directory and red-team (ATT&CK IDs), mobile (MASVS), cloud (CIS benchmarks), ai-security (OWASP LLM Top 10 / MITRE ATLAS), and dfir (artifact cards: location, what it proves). Weakest for ctf, which lacks a canonical ID scheme, so ctf uses category codes such as 'PWN-02'. Programming works through language pitfalls or design patterns.

## Layout

**Desktop.** 3840x2160: the background is the drawer interior. Three guide cards with tabs rise at the left (x 180-1000, y 420-1700), and the blank front guide card carries the Nunito phrase. The main card, about 2250x1350 at 5:3, sits at x 900-3150, y 330-1680 with its rod hole at the bottom center. The see-also card peeks behind the top-right corner. The circulation slip is a narrow tall strip at x 3280-3620, y 480-1500. The brass drawer label sits top-left at y 110-200. Typed text is 34-40px mono, the heading 64px, the pencil correction Nunito in the accent color. The bottom 180px (Dock) and top 80px (menu bar) stay clear. For 16:10 (3456x2160), scale the card to 2000 wide and drop the circulation slip under the card's right edge.

**Phone.** 1290x2796: the top third (y 0-940) is empty drawer. Guide tabs peek at y 1000-1180. The main card, 1170x700, sits at x 60-1230, y 1180-1880 with the definition shortened to 80 chars and 2 subject tracings. The see-also card peeks from behind the top-right corner. The circulation slip turns into a horizontal date row at y 1940-2020. The Nunito phrase goes at y 2080-2300 and the drawer label with 0xF3tt at y 2340-2420. Nothing goes below 2540. Minimum text is 30px.

## Risks

It is text-heavy, so type hierarchy has to do the work: call number, heading, body and tracings must separate clearly. Without the rod hole, numbered tracings and call number it drifts toward a generic flashcard or notes UI. Sepia or aged-paper effects are forbidden (flat only). Framework IDs must be exact per topic, and a wrong CWE or ATT&CK number would undermine credibility. The pencil correction must model genuinely current guidance.
