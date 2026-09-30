# Galley Proof

> Status: **concept** — not rendered yet.

## Design origin

The letterpress galley proof: a long single column of set type, pulled from the galley tray before it is made up into pages. The proofreader marks it with standard correction symbols in the margin: delete (the dele loop), caret insert, transpose, 'stet' (let it stand), 'wf' (wrong font), '#' (insert space), '¶' (new paragraph) and 'Qy' (query to author). A galley number sits at the head. After publication, corrections go out on a printed errata slip tipped into the book ('p. 42, l. 7: for … read …'). References: Linotype line-casting (Ottmar Mergenthaler, 1886), whose cast lines were called slugs; the proofreaders' marks tables of The Chicago Manual of Style (in print since 1906); and British Standard BS 5261 proof-correction marks (1976, revised as BS 5261-2:2005).

## Concept

Security review as proofreading. The text under review (code, config, IAM policy, detection rule, ACL, system prompt) is set as a long galley. Each issue gets the real proofreader's symbol whose meaning matches the fix: transpose for an ordering bug, wrong-font for type or context confusion, stet for an accepted risk. A tipped-in errata slip is the advisory. The piece celebrates close reading and review craft, the quiet half of security, instead of attack imagery.

## Element map

| Element | Security meaning |
|---|---|
| Galley strip with its head slug ('GALLEY 07 · <file>') | The artifact under review. The galley number is the review or change ID. |
| Gutter line numbers | Exact locations (file:line, offset, rule line, event number), so every finding is traceable. |
| Delete mark (strike-through + dele loop in the margin) | Remove: dead code, a wildcard permission, a hard-coded secret, an exposed service, a legacy cipher. |
| Caret insert (^ in the text, inserted words in the margin) | Add a missing control: validation, an authorization check, an MFA condition, a security header, a least-privilege scope. |
| Transpose mark ('tr' + S-curve swap) | Ordering bug: check-then-use / TOCTOU (CWE-367), validate-before-canonicalize, logging before redaction. |
| Wrong-font mark ('wf', circled) | Type or context confusion: CWE-843, output encoded for the wrong context, data treated as instructions (prompt injection). |
| Stet (dotted underline + 'stet') | Accepted risk or known false positive: left as is, deliberately and on record. |
| Query ('Qy?' circled) | An open question to the author: an unanswered threat-model question or missing context. |
| Insert-space mark ('#') | Separation: isolate tenants, segments or privileges that should not touch. |
| New-paragraph mark ('¶') | A new trust context: split a function, role or boundary in two. |
| Leader lines from text to margin | Traceability from each finding to its exact location. |
| Marks key (legend) in the side column | A taxonomy that maps each symbol to a weakness class or control family (e.g. 'tr · CWE-367'). |
| Errata slip tipped over the galley ('for … read …') | The security advisory or patch notice: location plus old → new is a diff hunk, with an advisory ID. |
| Headline as the first set line (Nunito display) | The principle the review enforces. |
| Proofreader's initials and date at the galley head | Reviewer sign-off: the fixed '0xF3tt' signature and the whoami line. |
| Tally line at the galley foot | Review summary: counts of changes, queries and accepted risks. |

## Slots

What a topic preset has to provide. Limits are characters.

| Slot | Word type | Count | Max |
|---|---|---|---|
| `headline` | phrase | 1-1 | 44 |
| `galley_file` | filename | 1-1 | 20 |
| `galley_lines` | snippet | 8-14 | 44 |
| `mark_type` | term | 4-7 | 4 |
| `mark_line` | number | 4-7 | 3 |
| `mark_note` | phrase | 4-7 | 18 |
| `legend_entries` | term | 4-6 | 22 |
| `errata_id` | id | 1-1 | 14 |
| `errata_lines` | snippet | 2-3 | 40 |
| `tally` | status-line | 1-1 | 40 |
| `data_l_data_r` | status-line | 2-2 | 44 |

## Topic fit

Best: appsec, programming and web, where code review is the native act; cloud (IAM/IaC policy review: delete a wildcard, insert a condition); ai-security (system-prompt and tool-spec review, with 'wf' as instructions-versus-data confusion); blue-team (detection-rule tuning, with stet as a known false positive); active-directory (ACL/GPO review line by line). Good: crypto (config review: delete a legacy cipher, insert an AEAD mode), mobile (manifest/entitlement review), reversing (annotated disassembly), infosec (policy text review). Weakest: dfir, because evidence must never be edited, so only Qy, stet and leader-line annotations are allowed; that is a meaningful rule but makes a thinner piece. ctf, pentest and red-team review rather than break here, so the galley becomes a report QA pass.

## Layout

**Desktop.** Galley strip ≈1650px wide at x 520–2170, y 170–1930 in a flat paper tone. The menu bar stays clear, and the Dock band only overlaps empty lower margin. Head slug in JetBrains Mono 28px, then the headline as the first set line in Nunito ~96px, then 10–12 code lines in JetBrains Mono ~36px with 1.9 line height, gutter numbers at x≈450. Right margin x 2230–3000: each proof mark drawn as an SVG path (not a font glyph) level with its line, with the circled note beside it and a thin leader line back into the text. Errata slip (≈760×300, lighter flat tone, 1.5° tilt, narrow paste strip along its top edge) tipped over the galley's lower-right corner. Far-right column x 3100–3680: marks key, tally and whoami. data_l bottom-left, data_r bottom-right, both outside the Dock span. For 16:10, move the galley to x 420–1920, the margin to 2700 and the key column to 2780–3300.

**Phone.** Leave y 0–932 empty. Headline in Nunito ~92px across the full width at y≈980. Galley strip at x 80–990, y 1180–2440, with 8 lines of at most 30 characters at ~34px plus gutter numbers. The right margin (x 1010–1230) holds 4 marks with one- or two-word notes. The errata slip (≈640×220) is tipped across the galley's lower edge at y≈2250, and the tally is the single status line at y≈2500. The key is omitted. Keep the bottom 260px clear and text at least 30px.

## Risks

Text-heavy: code at wallpaper distance becomes grey texture, so cap the line count and keep generous leading. Proofreader's marks are unfamiliar to many viewers; the desktop key carries the meaning, but the phone has none. Visual kinship with the cutting mat's terminal panel (both show code): the paper strip and margin marks must dominate, with no window chrome or shell prompts. Keep galley and errata lines defensive (fixes, configs, rules), never working payloads, and avoid '<', '>' and '&' in copy. Draw the marks as SVG paths: the '¶' glyph exists in both fonts, but the dele loop, caret and transpose curve do not.
