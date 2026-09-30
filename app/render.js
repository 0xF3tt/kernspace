// Shared helpers for kernspace renderers: formats, escaping, the whoami box and bundled fonts.

export const FORMATS = {
  desktop: { w: 3840, h: 2160, label: 'Desktop 16:9' },
  wide: { w: 3840, h: 2400, label: 'Wide 16:10' },
  phone: { w: 1290, h: 2796, label: 'Phone' },
};

export const HANDLE = '0xF3tt';                     // default handle: the whoami box and the status line
export const MOTTO = 'somewhere exploring the purple colors.';   // default whoami line
const XML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

// XML-escape text and attribute values; also drops control chars XML 1.0 forbids
export const esc = s => String(s)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
  .replace(/[&<>"']/g, ch => XML[ch]);

export const validHandle = s => typeof s === 'string' && /^[A-Za-z0-9._-]{1,20}$/.test(s);

// a whoami line: up to 40 characters, no control characters, no leading or trailing space.
// Whether every character exists in JetBrains Mono is the caller's check (app/check.js glyphs()).
export const validMotto = s => typeof s === 'string' && s !== '' && s === s.trim()
  && !/[\u0000-\u001F\u007F-\u009F]/.test(s) && [...s].length <= 40;

// two lines while the handle fits beside the motto, three once it doesn't
export function whoamiLines(handle, motto) {
  const h = handle || HANDLE, m = motto || MOTTO, line = `${h} · ${m}`;
  return [...line].length <= 48 ? ['# whoami', line] : ['# whoami', h, m];
}

const FONT_FILES = {
  nunito: 'fonts/nunito/Nunito-Variable.ttf',
  jbm: 'fonts/jetbrains-mono/JetBrainsMono-Variable.ttf',
};

// fetch one font as a data: URL (an SVG shown as an image can't load outside files)
async function dataURL(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font ${url}: HTTP ${res.status}`);
  const blob = new Blob([await res.arrayBuffer()], { type: 'font/ttf' });
  return new Promise((ok, fail) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.onerror = () => fail(fr.error);
    fr.readAsDataURL(blob);
  });
}

export async function loadFonts(base = '') {
  const [nunito, jbm] = await Promise.all([FONT_FILES.nunito, FONT_FILES.jbm].map(f => dataURL(base + f)));
  return { nunito, jbm };
}
