# Topics

Each topic is a lexicon: a researched, verified list of the words people in that field actually use, from the famous ones everybody knows to the niche ones only insiders recognize. Series presets pick their words from here.

## Rules

- **Public vocabulary only.** Names, IDs, frameworks, concepts, artifacts, tool names, culture. No commands, payloads or step-by-step techniques.
- **Exact or out.** Every ID, number and name must match its official source.
- **Nothing sensitive.** No real people, emails, hosts, domains or IPs (only loopback and RFC 5737 ranges), no secrets, not even fake-looking ones.
- **One home per term.** A term lives in the topic whose scope fits it best.
- **Versions that last.** Tools and fast-moving benchmarks go without release numbers (`Ghidra`, not `Ghidra 12.1.4`). A version stays only when it is part of a standard's name (`TLS 1.3`, `OAuth 2.0`, `CVSS v4.0`) or when it is the point of the term (`CSF 1.1 → CSF 2.0`).
- **English.**

## The 15 topics

| Slug | Name | Scope | Not here |
|---|---|---|---|
| `programming` | Programming | Developer culture: languages, tooling, git, idioms, errors, magic numbers, secure-coding habits | Vulnerability classes → `appsec` |
| `appsec` | AppSec | Secure SDLC, threat modeling, OWASP Top 10 / ASVS / SAMM, CWE, SAST/DAST/SCA, SBOM, secure design principles | Web-specific attacks → `web` |
| `pentest` | Pentesting | Engagement lifecycle: scoping, rules of engagement, methodology (PTES, OSSTMM), recon, enumeration, findings, CVSS, reporting, certifications culture | Web → `web`, AD → `active-directory`, adversary emulation → `red-team` |
| `mobile` | Mobile Security | OWASP MASVS / MASTG, Android and iOS platform security: sandbox, permissions, Keystore/Keychain, code signing, pinning, root/jailbreak detection | |
| `active-directory` | Active Directory | Kerberos, NTLM, domains, forests, trusts, tiering model, GPO, well-known SIDs/RIDs, named attack techniques as concepts | Generic Windows logging → `blue-team` |
| `red-team` | Red Team | Adversary emulation, MITRE ATT&CK tactics, C2 concepts, OPSEC, TTPs, kill chain, emulation plans | Methodology of a pentest → `pentest` |
| `blue-team` | Blue Team | SOC, detection engineering, SIEM, EDR, Sigma/YARA as rule formats, Windows event IDs, threat hunting, D3FEND, Pyramid of Pain | Post-incident forensics → `dfir` |
| `web` | Web Security | HTTP, the browser security model (SOP, CORS, CSP, cookies), web vulnerability classes, OWASP API Security Top 10 | |
| `crypto` | Cryptography | Primitives, algorithms, modes, protocols (TLS), KDFs, post-quantum, famous breaks, crypto culture | Cryptocurrency |
| `infosec` | InfoSec | Shared culture and fundamentals: CIA triad, principles, history, zines, conferences, frameworks (NIST CSF, ISO 27001), jargon | Anything that belongs to a specific topic |
| `ctf` | CTF | Formats, categories, flags, scoreboards, first blood, writeups, platforms and competitions by name | |
| `cloud` | Cloud Security | Shared responsibility, IAM, metadata service, misconfigurations, CSPM/CNAPP, Kubernetes security, IaC scanning, CIS benchmarks | |
| `reversing` | Reversing & Malware | Disassembly, decompilation, PE/ELF/Mach-O, packers, obfuscation, anti-analysis, sandboxes, YARA, historic malware by public name, tools by name | Incident handling → `dfir` |
| `dfir` | DFIR | Incident response lifecycle, forensic artifacts, order of volatility, chain of custody, timelines, memory forensics, triage | Live detection → `blue-team` |
| `ai-security` | AI Security | OWASP Top 10 for LLM Applications, MITRE ATLAS, prompt injection, data poisoning, model supply chain, guardrails, agentic risks, NIST AI RMF | |

## Term format

Each topic file (`<slug>.json`) holds a list of terms:

| Field | What it is |
|---|---|
| `text` | The string as it appears on a sheet, ≤ 38 characters |
| `type` | `id` · `term` · `framework` · `tool` · `artifact` · `status-line` · `filename` · `number` · `quote` · `snippet` · `phrase` (a short maxim for the center of a sheet: two lines of 18 characters at most) |
| `code` | Canonical identifier when there is one (`CWE-639`, `T1558.003`, `4769`) |
| `meaning` | One line: what it is |
| `fame` | `iconic` (everyone in the field knows it) or `niche` (insiders recognize it) |
| `reference` | Official source for IDs and numbers |
| `series` | Which series it suits: `cutting-mat`, `specimen`, `galley-proof`, `catalog-card` |
| `mat` | Optional. Where the term reads right on a Cutting Mat: `slots` (any of `source`, `sink`, `control`, `flow`, `finding`, `note`, `status`) and `as`, the form it takes there when that differs from `text` |
| `spec` | Optional. The same for a Specimen sheet: `slots` (any of `hero`, `family`, `class`, `phrase`, `notdef`, `confusable`, `rating`, `test`, `note`, `status`) and `as`, the sheet form when it differs from `text` (a test line, say, or a hero shortened to 4 characters). A confusable pair takes its second half from `code` |
| `galley` | Optional. The same for a Galley Proof sheet: `slots` (any of `note`, `status`, `errata`) and `as`, the sheet form when it differs from `text`: an erratum is `for X read Y`, so an `X → Y` term carries `"as": "for Kyber read ML-KEM"` (36 characters at most) |

The word editor offers a term with a hint for the series on the sheet first, under *Suggested*, in its `as` form; terms without one are offered by `type` further down (a hero, a waterfall phrase, a confusable pair, a rating and an erratum are offered only through a hint). `node app/words.test.mjs` checks every `mat`, `spec` and `galley` hint and every `phrase`.

Offering by type follows the `typed` list of each series (`app/series/index.js`): a series offers by type only the terms tagged for one of the series in its list. Cutting Mat and Specimen share theirs (`cutting-mat` and `specimen`); Galley Proof offers only `galley-proof` terms. A term tagged only for series that are not built yet (`catalog-card`) is never offered by type. So an empty hint is needed only to keep a term out of a series that would otherwise offer it by type: a term written for Cutting Mat alone carries `"spec": {"slots": []}`, and a status line too long for a phone prompt beside a 20-character handle carries an empty hint for that series too.

## Trademarks and References

All product names, logos, framework names, acronyms, and trademarks referenced in these lexicons (such as MITRE ATT&CK®, CWE™, OWASP®, NIST, Microsoft®, and others) are the property of their respective owners. Their inclusion here is strictly for identification, reference, and educational purposes (nominative fair use) within the cybersecurity community. All term summaries and meanings are original, independent descriptions licensed under [CC BY-NC-SA 4.0](../LICENSE-ASSETS).
