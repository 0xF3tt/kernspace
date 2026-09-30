# Security policy

kernspace is a static site: HTML, CSS and ES modules, no backend, no dependencies, no third-party requests. Wallpapers are drawn in your browser and never leave it.

## Reporting a vulnerability

Report privately through GitHub: **[Report a vulnerability](https://github.com/0xF3tt/kernspace/security/advisories/new)**. Please don't open a public issue for security problems. A machine-readable security policy (RFC 9116) is available at [/.well-known/security.txt](.well-known/security.txt).

Include what you found, where (file, URL or component), how to reproduce it, and the impact you expect. You'll get an answer within 7 days, and credit in the advisory if you want it.

## In scope

- The web app: anything that runs attacker-controlled input (the handle field, URL parameters, preset or palette data), injection into the generated SVG, or a way around the Content Security Policy in [`vercel.json`](vercel.json).
- The deployment configuration: security headers, files exposed that shouldn't be.
- The repository: leaked secrets, sensitive data in lexicons or presets (real people, hosts, IPs, credentials).

## Not in scope

- Wrong or outdated terms, IDs or meanings in a lexicon: open a normal issue.
- Missing headers or settings that don't lead to a concrete risk.
- Reports produced only by automated scanners, without a demonstrated impact.

## Supported versions

Only the latest deployment of `main` is supported.
