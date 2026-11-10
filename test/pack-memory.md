# Rotation-pack memory

A 15-volume pack used to keep every encoded PNG and then allocate a second typed array the size of the whole ZIP (`zip` in `app/render.js`). The pack now builds that ZIP from `zipParts`: headers, names, and the original PNG bytes, passed to `new Blob` without that second array. The PNG references are dropped once the blob exists. `rasterise` still frees its canvas backing store.

These numbers are from one run on this Linux VM, Playwright 1.65.0, headless, viewport 1280×800, one fresh page per pack. Cutting Mat, purple ink, the volume's own ground, all 15 volumes. "Phone" is the 1290×2796 sheet, not a handset. Nothing here was measured on a physical phone. JS heap is Chromium only (`Performance.getMetrics` `JSHeapUsedSize`, and `performance.memory.usedJSHeapSize` when it is larger). RSS is the process tree of the measurement script, which includes the browser, sampled every 250ms during the pack. WebKit does not expose a JS heap counter.

Re-run with `test/serve.mjs` already listening:

```sh
cd test
node pack-measure.mjs pack-measure.json chromium
node pack-measure.mjs pack-measure.json webkit
```

Every pack below finished, `unzip -t` passed, and the 15 PNGs were in volume order with the right pixel size and an sRGB chunk. ZIP byte length did not change between the two runs.

## Chromium, before the chunked ZIP

| Finish | Format | Time | ZIP | Peak JS heap | Peak RSS |
|---|---|---:|---:|---:|---:|
| plain | desktop | 2.6 s | 7.7 MiB | 34.3 MiB | 877 MiB |
| plain | wide | 2.5 s | 8.3 MiB | 39.0 MiB | 902 MiB |
| plain | phone | 2.0 s | 4.6 MiB | 22.2 MiB | 890 MiB |
| film-35mm | desktop | 15.2 s | 67.3 MiB | 140.6 MiB | 1083 MiB |
| film-35mm | wide | 15.6 s | 74.6 MiB | 155.2 MiB | 1215 MiB |
| film-35mm | phone | 13.0 s | 48.2 MiB | 111.6 MiB | 1123 MiB |

## Chromium, after

| Finish | Format | Time | ZIP | Peak JS heap | Peak RSS | JS heap change |
|---|---|---:|---:|---:|---:|---:|
| plain | desktop | 2.6 s | 7.7 MiB | 26.6 MiB | 871 MiB | −7.7 MiB |
| plain | wide | 2.5 s | 8.3 MiB | 27.1 MiB | 893 MiB | −12.0 MiB |
| plain | phone | 1.9 s | 4.6 MiB | 17.5 MiB | 872 MiB | −4.7 MiB |
| film-35mm | desktop | 15.6 s | 67.3 MiB | 88.3 MiB | 1004 MiB | −52.3 MiB |
| film-35mm | wide | 16.8 s | 74.6 MiB | 99.1 MiB | 1102 MiB | −56.2 MiB |
| film-35mm | phone | 13.5 s | 48.2 MiB | 70.3 MiB | 1058 MiB | −41.3 MiB |

On the plain packs the JS heap fell by about the ZIP size, which is the buffer that used to be allocated beside the PNG arrays. On film the heap fell by 41–56 MiB. Chromium process RSS fell on all six packs too, so the blob did not put an equal copy back into the process on this engine.

## WebKit

No JS heap figure. RSS moved both ways on a single run, including a rise on film wide, so it is not evidence that the extra buffer is gone. Times and ZIP sizes are the useful WebKit columns. The archive was still readable and the PNG sizes matched.

| Finish | Format | Before | After | ZIP | RSS before | RSS after |
|---|---|---:|---:|---:|---:|---:|
| plain | desktop | 6.8 s | 6.7 s | 5.0 MiB | 1181 MiB | 1150 MiB |
| plain | wide | 8.0 s | 7.6 s | 5.4 MiB | 1147 MiB | 1154 MiB |
| plain | phone | 3.9 s | 3.9 s | 3.1 MiB | 1090 MiB | 1091 MiB |
| film-35mm | desktop | 35.2 s | 34.0 s | 28.8 MiB | 1819 MiB | 1681 MiB |
| film-35mm | wide | 40.4 s | 42.0 s | 34.8 MiB | 1732 MiB | 1878 MiB |
| film-35mm | phone | 26.2 s | 27.9 s | 29.7 MiB | 1644 MiB | 1629 MiB |

WebKit's PNG encoder produced smaller files than Chromium. That was true before the ZIP change as well.

## Budget

For a later run on a machine of this class (headless Chromium, 1280×800):

- Peak JS heap stays under 32 MiB plain desktop, 35 MiB plain wide, 21 MiB plain phone, 110 MiB film desktop, 125 MiB film wide, 90 MiB film phone. Each ceiling is under that pack's baseline and above the run after the change.
- Plain packs finish in under 8 s and film packs in under 40 s on Chromium. On WebKit, plain under 16 s and film under 90 s.

A worker was not added. Film packs take about six times as long as plain ones because of the filter raster, not because of the ZIP headers. `drawImage` and `toBlob` still run to completion; Cancel is checked after them and between sheets, and a cancelled pack does not save a partial archive.

## Choices

The measured floor is headless Chromium and WebKit on this VM, not a phone and not Firefox. The phone column is the phone sheet size. Process RSS is reported because it is available, and it is not the budget: WebKit's film-wide RSS rose on the rerun. The budget is Chromium's JS heap and the pack duration above.
