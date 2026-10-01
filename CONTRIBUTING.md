# Contributing to kernspace

Thank you for your interest in contributing to kernspace!

## Inbound = Outbound Licensing
To keep licensing clear, clean, and consistent for everyone, kernspace operates under an **inbound = outbound** model:
- Any code contributions (JavaScript, tests, CI) you submit are licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).
- Any contributions to lexicons, presets, palettes, or documentation are licensed under [CC BY-NC-SA 4.0](LICENSE-ASSETS).

By opening a pull request or submitting content, you confirm that you have the right to contribute the material under these terms.

## Proposing Terms for Topics
We welcome contributions to existing topic lexicons (`topics/<topic>.json`):
1. **Verifiable sources:** Every canonical ID, number, or standard must cite an official reference (e.g. RFC, OWASP, MITRE CWE/ATT&CK, NIST).
2. **Series hints:** a term can say where it reads right on each series (`mat`, `spec`); see [`topics/README.md`](topics/README.md).
3. **Field lengths:** `text` is at most 38 characters and `meaning` at most 120. `node app/lexicon.test.mjs` enforces them, along with the allowed `type`, `fame` and `series` values, the shape of the hints and duplicates.
4. **No sensitive data:** Public terminology only. Never include real personal emails, internal hostnames, credentials, or private keys.
5. **Validation:** Always run the test suite locally before opening a pull request:
   ```sh
   node app/render.test.mjs
   node app/words.test.mjs
   node app/lexicon.test.mjs
   ```

## Reporting Issues
- **Security vulnerabilities:** Please do not open public issues. Use GitHub's [Private Vulnerability Reporting](https://github.com/0xF3tt/kernspace/security/advisories/new) as described in [SECURITY.md](SECURITY.md).
- **Bug reports & term corrections:** Open a regular GitHub issue using the issue templates.
