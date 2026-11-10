// Static server for browser tests. It applies the header rules in vercel.json the way the
// deployment does: every matching rule is applied, and a later rule wins when the header name repeats
// (the font rule replaces Cross-Origin-Resource-Policy with cross-origin). The studio has no build step;
// this file is dev/CI only and is not imported by the site.
import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// `new URL('..')` keeps a trailing slash, and fileURLToPath keeps it. A ROOT of
// `/repo/` would make `/repo/app/main.js` fail the prefix check (`/repo/` + sep).
export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const VERCEL = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// vercel.json `source` patterns: a `*` is one path segment, and `(.*)` is the rest.
export function compileSource(source) {
  let re = '';
  for (let i = 0; i < source.length; i++) {
    if (source.startsWith('(.*)', i)) { re += '(.*)'; i += 3; continue; }
    const ch = source[i];
    if (ch === '*') { re += '[^/]*'; continue; }
    re += /[.+?^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
  }
  return new RegExp(`^${re}$`);
}

const RULES = VERCEL.headers.map((rule) => ({ test: compileSource(rule.source), headers: rule.headers }));

// Header map for a request path. Keys are lower-case. Later matching rules override the same name.
export function headersFor(pathname, rules = RULES) {
  const out = {};
  for (const rule of rules) {
    const ok = typeof rule.test === 'function' ? rule.test(pathname) : rule.test.test(pathname);
    if (!ok) continue;
    for (const { key, value } of rule.headers) out[key.toLowerCase()] = value;
  }
  return out;
}

function fileFor(pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return null; }
  if (rel.includes('\0')) return null;
  if (rel === '/') return join(ROOT, 'index.html');
  rel = rel.replace(/^\/+/, '');
  const full = normalize(join(ROOT, rel));
  const root = ROOT.endsWith(sep) ? ROOT : ROOT + sep;
  if (full !== ROOT && !full.startsWith(root)) return null;
  return full;
}

function send(req, res, status, headers, body) {
  const pathOnly = new URL(req.url, 'http://127.0.0.1').pathname;
  res.writeHead(status, { ...headersFor(pathOnly), ...headers });
  if (req.method === 'HEAD') { res.end(); return; }
  if (body?.pipe) body.pipe(res);
  else res.end(body);
}

export function start(port = Number(process.env.PORT) || 4173) {
  const server = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(req, res, 405, { allow: 'GET, HEAD' }, 'method not allowed');
      return;
    }
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    const file = fileFor(pathname);
    if (!file || !existsSync(file)) { send(req, res, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'not found'); return; }
    const st = statSync(file);
    if (!st.isFile()) { send(req, res, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'not found'); return; }
    send(req, res, 200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'content-length': st.size,
    }, req.method === 'HEAD' ? null : createReadStream(file));
  });
  server.listen(port, '127.0.0.1');
  return server;
}

const invoked = process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
if (invoked) {
  const port = Number(process.env.PORT) || 4173;
  start(port);
  console.log(`kernspace test server http://127.0.0.1:${port}/`);
}
