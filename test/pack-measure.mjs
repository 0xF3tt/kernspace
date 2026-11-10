// Headless measurement of a 15-volume rotation pack. Not part of the fast browser suite.
//   node pack-measure.mjs baseline.json [chromium|webkit]
// test/serve.mjs must already be listening on 127.0.0.1:4173.
// Chromium reports JS heap (CDP JSHeapUsedSize and performance.memory, whichever is higher).
// WebKit has neither. Both report the browser process tree's RSS from ps.
// One fresh page per pack, so a previous archive is not still in the heap.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, webkit } from '@playwright/test';

const outPath = process.argv[2] || 'pack-measure.json';
const only = process.argv[3];
const port = process.env.PORT || 4173;

const CASES = [
  { finish: 'plain', format: 'desktop', w: 3840, h: 2160 },
  { finish: 'plain', format: 'wide', w: 3840, h: 2400 },
  { finish: 'plain', format: 'phone', w: 1290, h: 2796 },
  { finish: 'film-35mm', format: 'desktop', w: 3840, h: 2160 },
  { finish: 'film-35mm', format: 'wide', w: 3840, h: 2400 },
  { finish: 'film-35mm', format: 'phone', w: 1290, h: 2796 },
];

function treeRssKb(root) {
  const text = execFileSync('ps', ['-eo', 'pid,ppid,rss'], { encoding: 'utf8' });
  const rows = [];
  const kids = new Map();
  for (const line of text.trim().split('\n').slice(1)) {
    const [pid, ppid, rss] = line.trim().split(/\s+/).map(Number);
    if (!pid) continue;
    rows.push([pid, ppid, rss]);
    if (!kids.has(ppid)) kids.set(ppid, []);
    kids.get(ppid).push(pid);
  }
  const rssOf = new Map(rows.map(([pid, , rss]) => [pid, rss]));
  let sum = 0;
  const walk = (pid) => {
    sum += rssOf.get(pid) || 0;
    for (const kid of kids.get(pid) || []) walk(kid);
  };
  walk(root);
  return sum;
}

function hasSrgb(png) {
  let i = 8;
  while (i + 12 <= png.length) {
    const len = png.readUInt32BE(i);
    const type = png.toString('ascii', i + 4, i + 8);
    if (type === 'sRGB') return true;
    if (type === 'IEND' || type === 'IDAT') return false;
    if (len < 0 || i + 12 + len > png.length) return false;
    i += 12 + len;
  }
  return false;
}

function inspectZip(buf) {
  const names = [];
  const pngs = [];
  let o = 0;
  while (o + 30 <= buf.length) {
    if (buf.readUInt32LE(o) !== 0x04034b50) break;
    const nameLen = buf.readUInt16LE(o + 26);
    const extra = buf.readUInt16LE(o + 28);
    const size = buf.readUInt32LE(o + 18);
    const start = o + 30 + nameLen + extra;
    const name = buf.slice(o + 30, o + 30 + nameLen).toString('utf8');
    const data = buf.subarray(start, start + size);
    names.push(name);
    pngs.push({
      name,
      width: data.length > 24 ? data.readUInt32BE(16) : 0,
      height: data.length > 24 ? data.readUInt32BE(20) : 0,
      srgb: data.length > 24 && hasSrgb(data),
    });
    o = start + size;
  }
  return { bytes: buf.length, names, pngs };
}

function unzipTest(buf) {
  const dir = mkdtempSync(join(tmpdir(), 'ks-pack-'));
  const path = join(dir, 'pack.zip');
  writeFileSync(path, buf);
  const r = spawnSync('unzip', ['-t', path], { encoding: 'utf8' });
  if (r.error) return `unzip missing: ${r.error.message}`;
  return r.status === 0 ? 'ok' : `fail ${r.status}: ${(r.stderr || r.stdout || '').slice(0, 200)}`;
}

async function sheetReady(page, { format, finish }) {
  await page.waitForFunction(({ format, finish }) => {
    const stage = document.querySelector('#stage');
    const img = document.querySelector('#sheet-img');
    const sheet = document.querySelector('#sheet');
    const slug = document.querySelector('#slug')?.textContent || '';
    const ready = stage?.getAttribute('aria-busy') === 'false'
      && img?.dataset?.u?.startsWith('blob:')
      && img.complete && img.naturalWidth > 0;
    if (!ready) return false;
    if (format && sheet?.dataset.format !== format) return false;
    if (finish === 'plain' && /film-|paper-/.test(slug)) return false;
    if (finish !== 'plain' && !slug.includes(finish)) return false;
    return true;
  }, { format, finish }, { timeout: 180000 });
}

async function one(browser, engine, item, rootPid) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  let cdp = null;
  if (engine === 'chromium') {
    cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
  }
  const result = {
    engine, finish: item.finish, format: item.format,
    elapsedMs: null, zipBytes: null, peakJsHeap: null, peakRssKb: null,
    heapSamples: 0, entries: null, unzip: null, structure: null, failure: null, errors,
  };
  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await sheetReady(page, { format: 'desktop', finish: 'plain' });
    if (item.format !== 'desktop') {
      await page.locator(`label:has(#fmt-${item.format})`).click();
      await sheetReady(page, { format: item.format, finish: 'plain' });
    }
    if (item.finish !== 'plain') {
      await page.locator('label:has(input[name="family"][value="Film"])').click();
      await sheetReady(page, { format: item.format, finish: item.finish });
    }
    if (engine === 'chromium') await page.evaluate(() => globalThis.gc?.()).catch(() => {});
    let peakHeap = 0;
    let peakRss = 0;
    let samples = 0;
    const poll = setInterval(async () => {
      samples += 1;
      try {
        if (cdp) {
          const { metrics } = await cdp.send('Performance.getMetrics');
          const heap = metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;
          const mem = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0).catch(() => 0);
          peakHeap = Math.max(peakHeap, heap, mem);
        }
        if (rootPid) peakRss = Math.max(peakRss, treeRssKb(rootPid));
      } catch { /* page may already be closing */ }
    }, 250);
    const t0 = Date.now();
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 600000 }),
        page.locator('#dl-pack').click(),
      ]);
      result.elapsedMs = Date.now() - t0;
      const buf = readFileSync(await download.path());
      const info = inspectZip(buf);
      result.zipBytes = info.bytes;
      result.entries = info.names.length;
      result.unzip = unzipTest(buf);
      const dimsOk = info.pngs.length === 15 && info.pngs.every((p) => p.width === item.w && p.height === item.h && p.srgb);
      const orderOk = info.names.every((name, i) => name.startsWith(`${String(i + 1).padStart(2, '0')}_kernspace_cutting-mat_`));
      const finishOk = item.finish === 'plain'
        ? info.names.every((name) => !/film-|paper-/.test(name))
        : info.names.every((name) => name.includes(item.finish));
      result.structure = dimsOk && orderOk && finishOk ? 'ok' : 'mismatch';
      if (result.structure !== 'ok') {
        result.failure = `structure; first ${info.names[0]} ${info.pngs[0]?.width}x${info.pngs[0]?.height} srgb=${info.pngs[0]?.srgb} n=${info.names.length}`;
      }
    } catch (err) {
      result.elapsedMs = Date.now() - t0;
      result.failure = (err.message || String(err)).split('\n')[0];
    } finally {
      clearInterval(poll);
      result.heapSamples = samples;
      result.peakJsHeap = engine === 'chromium' ? peakHeap : null;
      result.peakRssKb = peakRss || null;
    }
  } catch (err) {
    result.failure = (err.message || String(err)).split('\n')[0];
  }
  await context.close();
  return result;
}

const engines = [];
if (only !== 'webkit') engines.push(['chromium', chromium]);
if (only !== 'chromium') engines.push(['webkit', webkit]);

const all = [];
for (const [name, type] of engines) {
  const browser = await type.launch({
    headless: true,
    args: name === 'chromium' ? ['--js-flags=--expose-gc', '--enable-precise-memory-info'] : [],
  });
  // Descendants of this process: the browser Playwright spawned, plus this script.
  // Playwright 1.65 does not expose browser.process().
  const rootPid = process.pid;
  for (const item of CASES) {
    process.stdout.write(`\n${name} ${item.finish} ${item.format} ... `);
    const row = await one(browser, name, item, rootPid);
    all.push(row);
    writeFileSync(outPath, JSON.stringify(all, null, 2));
    const mb = row.peakJsHeap ? `${(row.peakJsHeap / 1048576).toFixed(1)}MiB` : 'n/a';
    process.stdout.write(`${row.failure ? 'FAIL ' + row.failure : row.structure} ${row.elapsedMs}ms zip=${row.zipBytes} heap=${mb} rss=${row.peakRssKb}KiB\n`);
  }
  await browser.close();
}
console.log('wrote', outPath);
