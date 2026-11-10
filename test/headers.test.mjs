// Header rules the browser server copies from vercel.json. No browser, no install.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, compileSource, headersFor } from './serve.mjs';

const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
const rules = vercel.headers.map((rule) => ({ test: compileSource(rule.source), headers: rule.headers }));
const csp = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;

const page = headersFor('/', rules);
assert.equal(page['content-security-policy'], csp);
assert.equal(page['x-content-type-options'], 'nosniff');
assert.equal(page['referrer-policy'], 'no-referrer');
assert.equal(page['cross-origin-opener-policy'], 'same-origin');
assert.equal(page['cross-origin-resource-policy'], 'same-origin');
assert.equal(page['permissions-policy'], 'camera=(), microphone=(), geolocation=()');

const script = headersFor('/app/main.js', rules);
assert.equal(script['content-security-policy'], csp);
assert.equal(script['cache-control'], undefined, 'app files do not take the font cache rule');

const font = headersFor('/fonts/jetbrains-mono/JetBrainsMono-Variable.ttf', rules);
assert.equal(font['content-security-policy'], csp, 'the catch-all still applies to fonts');
assert.equal(font['cache-control'], 'public, max-age=31536000, immutable');
assert.equal(font['cross-origin-resource-policy'], 'cross-origin', 'the font rule overrides the catch-all CORP');

assert.equal(compileSource('/fonts/(.*)').test('/fonts/nunito/Nunito-Variable.ttf'), true);
assert.equal(compileSource('/(.*)').test('/'), true);
assert.equal(compileSource('/fonts/(.*)').test('/app/main.js'), false);
assert.equal(existsSync(join(ROOT, 'app/main.js')), true, `repo root resolves to ${ROOT}`);
assert.equal(existsSync(join(ROOT, 'index.html')), true);

console.log('ok · vercel.json headers: catch-all, font override');
