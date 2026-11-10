// DOM helpers for the studio. Nothing here runs at import: the page is only touched when a function is called.
import { blobUrlsToRevoke } from './blobs.js';

export const $ = (s) => document.querySelector(s);
export const SVG_NS = 'http://www.w3.org/2000/svg';

// element builder: class, dataset, style (CSSOM, so the CSP needs no inline styles), attributes, children
export function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k === 'style') for (const [p, x] of Object.entries(v)) n.style.setProperty(p, x);
    else n.setAttribute(k, v === true ? '' : v);
  }
  n.append(...kids.flat().filter((x) => x != null && x !== false));
  return n;
}

// an icon or overlay drawn from a fixed SVG string (geometry only, never data)
export function svg(markup, attrs = {}) {
  const s = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  s.innerHTML = markup;
  return s;
}

// an icon-only control: the name for assistive tech, the tip (CSS ::after) for everyone else
export const nameBtn = (b, label, tip = label) => { b.setAttribute('aria-label', label); b.dataset.tip = tip; };
// replace a node's children, skipping the empty ones (replaceChildren would print "null")
export const fill = (node, ...kids) => node.replaceChildren(...kids.flat().filter((x) => x != null && x !== false));
export const setText = (sel, text) => { const n = $(sel); if (n.textContent !== text) n.textContent = text; };
export const pad2 = (v) => String(v).padStart(2, '0');
export const nice = (slug) => slug.charAt(0).toUpperCase() + slug.slice(1).replace('-', ' ');
export const volName = (e) => e.title.replace(/^Vol\. \d+ · /, '');
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isNarrow = () => matchMedia('(max-width: 860px)').matches;   // the CSS breakpoint, so JS and CSS always agree
export const blobUrl = (text) => URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));

// object URLs still shown by an image. `except` is a container about to be discarded.
export const liveBlobUrls = (except) => [...document.querySelectorAll('img[data-u]')].filter((img) => !except?.contains(img)).map((img) => img.dataset.u);
export const revokeBlobUrls = (urls) => { for (const url of urls) URL.revokeObjectURL(url); };

// point an <img> at a new blob URL and free the old one once the new one is showing,
// unless another live image still uses it
export function swap(img, url) {
  const old = img.dataset.u;
  img.src = url;
  img.dataset.u = url;
  if (old && old !== url) setTimeout(() => revokeBlobUrls(blobUrlsToRevoke([old], liveBlobUrls())), 1000);
}

// drop a thumbnail container's object URLs before its nodes go
export function releaseThumbs(root) {
  const drop = [...root.querySelectorAll('img[data-u]')];
  const gone = blobUrlsToRevoke(drop.map((img) => img.dataset.u), liveBlobUrls(root));
  for (const img of drop) delete img.dataset.u;
  revokeBlobUrls(gone);
}
