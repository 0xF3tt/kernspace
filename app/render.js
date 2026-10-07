// Shared helpers for kernspace renderers: formats, escaping, the whoami box, the finishes (film grain and paper) and bundled fonts.

export const FORMATS = {
  desktop: { w: 3840, h: 2160, label: 'Desktop 16:9' },
  wide: { w: 3840, h: 2400, label: 'Wide 16:10' },
  phone: { w: 1290, h: 2796, label: 'Phone' },
};

export const HANDLE = 'kernspace';                   // default handle: the whoami box and the status line
export const MOTTO = 'privileged space, carefully kerned.';   // default whoami line
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

// The finishes, all optional and one at a time: film grain or paper over the whole sheet, type included. Each is one
// seeded filter with the id "grain" (in one browser and raster path, the same file draws the same texture; a canvas
// drawn without the graphics card can come out some levels apart). Its noise is a strip 256 px wide and taller than any
// sheet, repeated across: PNG can't compress noise, but it finds the repeats. Nothing in a filter moves or blurs the
// sheet, so hairlines and small type keep every pixel. Film adds three dye-layer grains weighted by the sheet's own
// tone (strongest on mid grounds, calm on dark ones). Paper lights a tooth (Tooth, Riso) or a crinkled relief (Card)
// from the top left, through ink and paper alike, and Riso and Card also mottle the ink. On the darkest grounds that
// mottle clips at black: Riso and Card push 5.7% and 5.0% of the flat ground's channel values to 0 on phosphor, 3.7%
// and 3.5% on iron gall, 2.5% and 1.8% on aniline; Tooth, under 0.4% (measured on 288 exports).
// The finest detail is 1–2 px, and the stage draws a finish at the stage's scale, not the export's, so the studio shows a
// crop at full size. The key is the file name's suffix; its first word is the family, and each family's stocks sit
// together, in the picker's order.
// family, label: the picker · alt: the sheet's alt text · note: what it imitates · png: what a PNG and the pack grow to
// (in the Saved slip's MB, 2^20 bytes)
export const FINISHES = {
  'film-35mm': {
    family: 'Film', label: '35 mm', alt: 'with 35 mm film grain',
    note: 'A 4K scan of 35 mm daylight film: soft grain, strongest on mid grounds.',
    png: '3.5–5.5 MB (about 3 MB on a phone), and a pack of 15 to 35–85 MB',
    filter: '<filter id="grain" x="-1%" y="-1%" width="102%" height="102%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
      + '<feTurbulence type="fractalNoise" baseFrequency="2.3" numOctaves="1" seed="7" stitchTiles="stitch" x="0" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="0.41236 0 0 0.50504 0.0413 0 0.56478 0 0.69171 -0.12825 0 0 0.78424 0.9605 -0.37237 0 0 0 0 1"/>'
      + '<feTile x="0" y="-32" width="512" height="2880" result="n2"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency="0 .37" numOctaves="1" seed="23" stitchTiles="stitch" x="0" y="-32" width="512" height="2880"/>'
      + '<feColorMatrix type="matrix" values=".5 0 0 0 .25 0 0 0 0 0.501961 0 0 0 0 0.501961 0 0 0 0 1" result="sh"/>'
      + '<feDisplacementMap in="n2" in2="sh" scale="510" xChannelSelector="R" yChannelSelector="G" x="0" y="-32" width="512" height="2880" result="n2"/>'
      + '<feGaussianBlur in="n2" stdDeviation="9" x="0" y="-32" width="512" height="2880"/>'
      + '<feColorMatrix type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 0 1"/>'
      + '<feComposite in="n2" operator="arithmetic" k2="1" k3="1" k4="-0.498039" x="0" y="-32" width="512" height="2880" result="n2"/>'
      + '<feConvolveMatrix in="n2" order="5" kernelMatrix="0.0009 0.0105 0.03 0.0105 0.0009 0.0105 0.1225 0.35 0.1225 0.0105 0.03 0.35 1 0.35 0.03 0.0105 0.1225 0.35 0.1225 0.0105 0.0009 0.0105 0.03 0.0105 0.0009" divisor="3.0976" bias="-0.000447" preserveAlpha="true" x="64" y="-32" width="384" height="2880"/>'
      + '<feOffset dx="0" dy="0" x="128" y="-32" width="256" height="2880" result="nc"/>'
      + '<feConvolveMatrix in="n2" order="3" kernelMatrix="0.0064 0.08 0.0064 0.08 1 0.08 0.0064 0.08 0.0064" divisor="1.3456" preserveAlpha="true" x="64" y="-32" width="384" height="2880"/>'
      + '<feConvolveMatrix order="5" kernelMatrix="0.0009 0.0105 0.03 0.0105 0.0009 0.0105 0.1225 0.35 0.1225 0.0105 0.03 0.35 1 0.35 0.03 0.0105 0.1225 0.35 0.1225 0.0105 0.0009 0.0105 0.03 0.0105 0.0009" divisor="3.0976" bias="-0.000447" preserveAlpha="true" x="64" y="-32" width="384" height="2880"/>'
      + '<feOffset dx="0" dy="0" x="128" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="0 0 0 0 0.501961 0 0 0 0 0.501961 0 0 1 0 0 0 0 0 0 1" result="nB"/>'
      + '<feColorMatrix in="nc" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 0 0 0.501961 0 0 0 0 1" result="nRG"/>'
      + '<feComposite in="nRG" in2="nB" operator="arithmetic" k2="1" k3="1" k4="-0.501961" x="128" y="-32" width="256" height="2880"/>'
      + '<feTile result="N"/>'
      + '<feComponentTransfer in="SourceGraphic" result="W">'
      + '<feFuncR type="discrete" tableValues="0 0.32 0.32 0.32 0.32 0.32 0.32 0.32 0.32 0.32 0.32 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 1 1 1 1 1 1 1 1 1 1 1 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.367 0"/>'
      + '<feFuncG type="discrete" tableValues="0 0.276 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 1 1 1 1 1 1 1 1 1 1 1 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.276 0"/>'
      + '<feFuncB type="discrete" tableValues="0 0.219 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 1 1 1 1 1 1 1 1 1 1 1 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.5 0.219 0"/></feComponentTransfer>'
      + '<feComposite in="W" in2="N" operator="arithmetic" k1="2" k2="-1.00392" k4="0.501961" result="M"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency="2.3" numOctaves="1" seed="61" stitchTiles="stitch" x="0" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1"/>'
      + '<feTile x="0" y="-32" width="512" height="2880"/>'
      + '<feDisplacementMap in2="sh" scale="510" xChannelSelector="R" yChannelSelector="G" x="0" y="-32" width="512" height="2880"/>'
      + '<feOffset dx="0" dy="0" x="128" y="-32" width="256" height="2880"/>'
      + '<feTile result="D"/>'
      + '<feComposite in="M" in2="D" operator="arithmetic" k2="1" k3="0.11029" k4="-0.055147" result="M"/>'
      + '<feComposite in="SourceGraphic" in2="M" operator="arithmetic" k2="1" k3="0.2" k4="-0.100392"/></filter>',
  },
  'film-65mm': {
    family: 'Film', label: '65 mm', alt: 'with 65 mm film grain',
    note: '65 mm film, the large format behind IMAX: finer, fainter grain, about a pixel across.',
    png: '3.5–5.5 MB (about 3 MB on a phone), and a pack of 15 to 35–85 MB',
    filter: '<filter id="grain" x="-1%" y="-1%" width="102%" height="102%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
      + '<feTurbulence type="fractalNoise" baseFrequency="2.3" numOctaves="1" seed="7" stitchTiles="stitch" x="0" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="0.34785 0 0 0.42603 0.11306 0 0.47434 0 0.58095 -0.02764 0 0 0.58186 0.71263 -0.14724 0 0 0 0 1"/>'
      + '<feTile x="0" y="-32" width="512" height="2880" result="n2"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency="0 .37" numOctaves="1" seed="23" stitchTiles="stitch" x="0" y="-32" width="512" height="2880"/>'
      + '<feColorMatrix type="matrix" values=".5 0 0 0 .25 0 0 0 0 0.501961 0 0 0 0 0.501961 0 0 0 0 1" result="sh"/>'
      + '<feDisplacementMap in="n2" in2="sh" scale="510" xChannelSelector="R" yChannelSelector="G" x="0" y="-32" width="512" height="2880" result="n2"/>'
      + '<feGaussianBlur in="n2" stdDeviation="9" x="0" y="-32" width="512" height="2880"/>'
      + '<feColorMatrix type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 0 1"/>'
      + '<feComposite in="n2" operator="arithmetic" k2="1" k3="1" k4="-0.498039" x="0" y="-32" width="512" height="2880" result="n2"/>'
      + '<feConvolveMatrix in="n2" order="3" kernelMatrix="0.0784 0.28 0.0784 0.28 1 0.28 0.0784 0.28 0.0784" divisor="2.4336" bias="-0.000447" preserveAlpha="true" x="64" y="-32" width="384" height="2880"/>'
      + '<feOffset dx="0" dy="0" x="128" y="-32" width="256" height="2880"/>'
      + '<feTile result="N"/>'
      + '<feComponentTransfer in="SourceGraphic" result="W">'
      + '<feFuncR type="discrete" tableValues="0 0.32 0.32 0.32 0.32 0.32 0.32 0.32 0.32 0.32 0.32 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 1 1 1 1 1 1 1 1 1 1 1 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.528 0"/>'
      + '<feFuncG type="discrete" tableValues="0 0.399 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 1 1 1 1 1 1 1 1 1 1 1 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.399 0"/>'
      + '<feFuncB type="discrete" tableValues="0 0.32 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 1 1 1 1 1 1 1 1 1 1 1 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.97 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.54 0.32 0"/></feComponentTransfer>'
      + '<feComposite in="W" in2="N" operator="arithmetic" k1="2" k2="-1.00391" k4="0.501953" result="M"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency="2.3" numOctaves="1" seed="61" stitchTiles="stitch" x="0" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1"/>'
      + '<feTile x="0" y="-32" width="512" height="2880"/>'
      + '<feDisplacementMap in2="sh" scale="510" xChannelSelector="R" yChannelSelector="G" x="0" y="-32" width="512" height="2880"/>'
      + '<feOffset dx="0" dy="0" x="128" y="-32" width="256" height="2880"/>'
      + '<feTile result="D"/>'
      + '<feComposite in="M" in2="D" operator="arithmetic" k2="1" k3="0.11141" k4="-0.055704" result="M"/>'
      + '<feComposite in="SourceGraphic" in2="M" operator="arithmetic" k2="1" k3="0.1485" k4="-0.07454"/></filter>',
  },
  'film-35mm-fast': {
    family: 'Film', label: '35 mm fast', alt: 'with fast 35 mm film grain',
    note: 'Fast 35 mm film for night scenes: bigger grain, with a blue and yellow mottle.',
    png: '3.5–5.5 MB (about 3 MB on a phone), and a pack of 15 to 35–85 MB',
    filter: '<filter id="grain" x="-1%" y="-1%" width="102%" height="102%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
      + '<feTurbulence type="fractalNoise" baseFrequency="2.3" numOctaves="1" seed="7" stitchTiles="stitch" x="0" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="0.4054 0 0 0.49652 0.04904 0 0.52684 0 0.64524 -0.08604 0 0 0.75895 0.92952 -0.34423 0 0 0 0 1"/>'
      + '<feTile x="0" y="-32" width="512" height="2880" result="n2"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency="0 .37" numOctaves="1" seed="23" stitchTiles="stitch" x="0" y="-32" width="512" height="2880"/>'
      + '<feColorMatrix type="matrix" values=".5 0 0 0 .25 0 0 0 0 0.501961 0 0 0 0 0.501961 0 0 0 0 1" result="sh"/>'
      + '<feDisplacementMap in="n2" in2="sh" scale="510" xChannelSelector="R" yChannelSelector="G" x="0" y="-32" width="512" height="2880" result="n2"/>'
      + '<feGaussianBlur in="n2" stdDeviation="9" x="0" y="-32" width="512" height="2880"/>'
      + '<feColorMatrix type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 0 1"/>'
      + '<feComposite in="n2" operator="arithmetic" k2="1" k3="1" k4="-0.498039" x="0" y="-32" width="512" height="2880" result="n2"/>'
      + '<feConvolveMatrix in="n2" order="5" kernelMatrix="0.0025 0.02 0.05 0.02 0.0025 0.02 0.16 0.4 0.16 0.02 0.05 0.4 1 0.4 0.05 0.02 0.16 0.4 0.16 0.02 0.0025 0.02 0.05 0.02 0.0025" divisor="3.61" bias="-0.000447" preserveAlpha="true" x="64" y="-32" width="384" height="2880"/>'
      + '<feOffset dx="0" dy="0" x="128" y="-32" width="256" height="2880" result="nc"/>'
      + '<feConvolveMatrix in="n2" order="3" kernelMatrix="0.0064 0.08 0.0064 0.08 1 0.08 0.0064 0.08 0.0064" divisor="1.3456" preserveAlpha="true" x="64" y="-32" width="384" height="2880"/>'
      + '<feConvolveMatrix order="5" kernelMatrix="0.0025 0.02 0.05 0.02 0.0025 0.02 0.16 0.4 0.16 0.02 0.05 0.4 1 0.4 0.05 0.02 0.16 0.4 0.16 0.02 0.0025 0.02 0.05 0.02 0.0025" divisor="3.61" bias="-0.000447" preserveAlpha="true" x="64" y="-32" width="384" height="2880"/>'
      + '<feOffset dx="0" dy="0" x="128" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="0 0 0 0 0.501961 0 0 0 0 0.501961 0 0 1 0 0 0 0 0 0 1" result="nB"/>'
      + '<feColorMatrix in="nc" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 0 0 0.501961 0 0 0 0 1" result="nRG"/>'
      + '<feComposite in="nRG" in2="nB" operator="arithmetic" k2="1" k3="1" k4="-0.501961" x="128" y="-32" width="256" height="2880"/>'
      + '<feTile result="N"/>'
      + '<feComponentTransfer in="SourceGraphic" result="W">'
      + '<feFuncR type="discrete" tableValues="0 0.31 0.32 0.32 0.32 0.32 0.32 0.32 0.32 0.32 0.32 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 1 1 1 1 1 1 1 1 1 1 1 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.74 0.74 0.74 0.74 0.74 0.74 0.74 0.74 0.74 0.74 0.4 0.4 0.4 0.4 0.4 0.4 0.4 0.4 0.4 0.31 0"/>'
      + '<feFuncG type="discrete" tableValues="0 0.246 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 1 1 1 1 1 1 1 1 1 1 1 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.74 0.74 0.74 0.74 0.74 0.74 0.74 0.74 0.74 0.74 0.4 0.4 0.4 0.4 0.4 0.4 0.4 0.4 0.4 0.246 0"/>'
      + '<feFuncB type="discrete" tableValues="0 0.185 0.422 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.44 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 0.84 1 1 1 1 1 1 1 1 1 1 1 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.95 0.74 0.74 0.74 0.74 0.74 0.74 0.74 0.74 0.74 0.74 0.4 0.4 0.4 0.4 0.4 0.4 0.4 0.4 0.4 0.185 0"/></feComponentTransfer>'
      + '<feComposite in="W" in2="N" operator="arithmetic" k1="2" k2="-1.00391" k4="0.501953" result="M"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency="2.3" numOctaves="1" seed="61" stitchTiles="stitch" x="0" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1"/>'
      + '<feTile x="0" y="-32" width="512" height="2880"/>'
      + '<feDisplacementMap in2="sh" scale="510" xChannelSelector="R" yChannelSelector="G" x="0" y="-32" width="512" height="2880"/>'
      + '<feOffset dx="0" dy="0" x="128" y="-32" width="256" height="2880"/>'
      + '<feTile result="D"/>'
      + '<feComposite in="M" in2="D" operator="arithmetic" k2="1" k3="0.08324" k4="-0.04162" result="M"/>'
      + '<feComposite in="SourceGraphic" in2="M" operator="arithmetic" k2="1" k3="0.265" k4="-0.133018"/></filter>',
  },
  'paper-tooth': {
    family: 'Paper', label: 'Tooth', alt: 'with the tooth of uncoated paper',
    note: 'The tooth of uncoated paper: tiny bumps lit from the top left, through ink and paper alike.',
    png: '2.5–5 MB (under 3 MB on a phone), and a pack of 15 to 35–75 MB',
    filter: '<filter id="grain" x="-1%" y="-1%" width="102%" height="102%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
      + '<feTurbulence type="fractalNoise" baseFrequency=".16 .2" numOctaves="2" seed="5" stitchTiles="stitch" x="0" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1"/>'
      + '<feTile x="0" y="-32" width="512" height="2880" result="T0b"/>'
      + '<feOffset in="T0b" dx="1" dy="1"/>'
      + '<feComponentTransfer result="T0i">'
      + '<feFuncR type="linear" slope="-1" intercept="1"/>'
      + '<feFuncG type="linear" slope="-1" intercept="1"/>'
      + '<feFuncB type="linear" slope="-1" intercept="1"/></feComponentTransfer>'
      + '<feComposite in="T0b" in2="T0i" operator="arithmetic" k2="1" k3="1" k4="-.5" x="128" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="0.35 0 0 0 0.325 0.35 0 0 0 0.325 0.35 0 0 0 0.325 0 0 0 0 1" result="T0"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="61" stitchTiles="stitch" x="128" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="0.15 0 0 0 0.425 0 0.15 0 0 0.425 0 0 0.15 0 0.425 0 0 0 0 1" result="C"/>'
      + '<feComposite in="T0" in2="C" operator="arithmetic" k2="1" k3="1" k4="-0.5" result="T0C"/>'
      + '<feTile in="T0C" result="At"/>'
      + '<feComposite in="SourceGraphic" in2="At" operator="arithmetic" k1="0.06" k2="0.97" k3="0.25" k4="-0.125"/></filter>',
  },
  'paper-riso': {
    family: 'Paper', label: 'Riso', alt: 'with riso ink on toothed paper',
    note: 'A riso print: paper tooth, with mottled solids and pale pinholes in the ink.',
    png: '3–5.5 MB (about 3 MB on a phone), and a pack of 15 to 35–80 MB',
    filter: '<filter id="grain" x="-1%" y="-1%" width="102%" height="102%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
      + '<feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="9" stitchTiles="stitch" x="128" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="0.15 0 0 0 0.425 0.15 0 0 0 0.425 0.15 0 0 0 0.425 0 0 0 0 1" result="Mg"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="2" seed="19" stitchTiles="stitch" x="128" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="0.04 0 0 0 0.48 0.04 0 0 0 0.48 0.04 0 0 0 0.48 0 0 0 0 1" result="Mc"/>'
      + '<feComposite in="Mg" in2="Mc" operator="arithmetic" k2="1" k3="1" k4="-0.5" result="M"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency=".25" numOctaves="2" seed="13" stitchTiles="stitch" x="128" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="8 0 0 0 -5.76 8 0 0 0 -5.76 8 0 0 0 -5.76 0 0 0 0 1" result="P"/>'
      + '<feColorMatrix in="M" type="matrix" values="6 0 0 0 -2.5 6 0 0 0 -2.5 6 0 0 0 -2.5 0 0 0 0 1" result="Mw"/>'
      + '<feComposite in="P" in2="Mw" operator="arithmetic" k1="1" result="Pc"/>'
      + '<feComposite in="M" in2="Pc" operator="arithmetic" k2="1" k3="0.3" result="MP"/>'
      + '<feTile in="MP" result="Qt"/>'
      + '<feComposite in="SourceGraphic" in2="Qt" operator="arithmetic" k1="-1" k2="1.5" k3="1" k4="-0.5" result="ink"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency=".16 .2" numOctaves="2" seed="5" stitchTiles="stitch" x="0" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1"/>'
      + '<feTile x="0" y="-32" width="512" height="2880" result="T0b"/>'
      + '<feOffset in="T0b" dx="1" dy="1"/>'
      + '<feComponentTransfer result="T0i">'
      + '<feFuncR type="linear" slope="-1" intercept="1"/>'
      + '<feFuncG type="linear" slope="-1" intercept="1"/>'
      + '<feFuncB type="linear" slope="-1" intercept="1"/></feComponentTransfer>'
      + '<feComposite in="T0b" in2="T0i" operator="arithmetic" k2="1" k3="1" k4="-.5" x="128" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="0.35 0 0 0 0.325 0.35 0 0 0 0.325 0.35 0 0 0 0.325 0 0 0 0 1" result="T0"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="61" stitchTiles="stitch" x="128" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="0.15 0 0 0 0.425 0 0.15 0 0 0.425 0 0 0.15 0 0.425 0 0 0 0 1" result="C"/>'
      + '<feComposite in="T0" in2="C" operator="arithmetic" k2="1" k3="1" k4="-0.5" result="T0C"/>'
      + '<feTile in="T0C" result="At"/>'
      + '<feComposite in="ink" in2="At" operator="arithmetic" k1="0.06" k2="0.97" k3="0.25" k4="-0.125"/></filter>',
  },
  'paper-card': {
    family: 'Paper', label: 'Card', alt: 'with the relief of heavy card',
    note: 'Heavy cover card: a deep, crinkled relief and a light mottle in the ink.',
    png: '2.5–5.5 MB (about 3 MB on a phone), and a pack of 15 to 35–85 MB',
    filter: '<filter id="grain" x="-1%" y="-1%" width="102%" height="102%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
      + '<feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="41" stitchTiles="stitch" x="128" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="0.08 0 0 0 0.46 0.08 0 0 0 0.46 0.08 0 0 0 0.46 0 0 0 0 1" result="Mg"/>'
      + '<feTile in="Mg" result="Qt"/>'
      + '<feComposite in="SourceGraphic" in2="Qt" operator="arithmetic" k1="-1" k2="1.5" k3="1" k4="-0.5" result="ink"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency=".06 .1" numOctaves="3" seed="5" stitchTiles="stitch" x="0" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1"/>'
      + '<feTile x="0" y="-32" width="512" height="2880" result="T0b"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency=".015" numOctaves="2" seed="71" stitchTiles="stitch" x="0" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1"/>'
      + '<feTile x="0" y="-32" width="512" height="2880" result="T0w"/>'
      + '<feDisplacementMap in="T0b" in2="T0w" scale="14" xChannelSelector="R" yChannelSelector="G" result="T0c"/>'
      + '<feOffset in="T0c" dx="1" dy="1"/>'
      + '<feComponentTransfer result="T0i">'
      + '<feFuncR type="linear" slope="-1" intercept="1"/>'
      + '<feFuncG type="linear" slope="-1" intercept="1"/>'
      + '<feFuncB type="linear" slope="-1" intercept="1"/></feComponentTransfer>'
      + '<feComposite in="T0c" in2="T0i" operator="arithmetic" k2="1" k3="1" k4="-.5" x="128" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="0.45 0 0 0 0.275 0.45 0 0 0 0.275 0.45 0 0 0 0.275 0 0 0 0 1" result="T0"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="61" stitchTiles="stitch" x="128" y="-32" width="256" height="2880"/>'
      + '<feColorMatrix type="matrix" values="0.12 0 0 0 0.44 0 0.12 0 0 0.44 0 0 0.12 0 0.44 0 0 0 0 1" result="C"/>'
      + '<feComposite in="T0" in2="C" operator="arithmetic" k2="1" k3="1" k4="-0.5" result="T0C"/>'
      + '<feTile in="T0C" result="At"/>'
      + '<feComposite in="ink" in2="At" operator="arithmetic" k1="-0.2" k2="1.1" k3="0.5" k4="-0.25"/></filter>',
  },
};
// a sheet's body (everything after its <style>), under a finish (a FINISHES key) or as it is
export const finish = (body, key) => (FINISHES[key]?.filter ? `<defs>${FINISHES[key].filter}</defs><g filter="url(#grain)">${body}</g>` : body);

// Tag a PNG as sRGB: canvas exports carry no color chunk, and an untagged PNG may be read in the display's own space
// (Display P3 on a Mac), which shifts every ink. Adds an sRGB chunk (perceptual) after IHDR unless one is there already.
const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
export const crc32 = b => (b.reduce((c, v) => CRC[(c ^ v) & 255] ^ (c >>> 8), -1) ^ -1) >>> 0;
export function srgbPNG(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), at = 8 + 12 + dv.getUint32(8);   // signature, then IHDR
  for (let i = 8; i + 8 <= bytes.length; i += 12 + dv.getUint32(i)) {
    const t = String.fromCharCode(...bytes.subarray(i + 4, i + 8));
    if (t === 'sRGB' || t === 'iCCP') return bytes;
    if (t === 'IDAT') break;
  }
  const chunk = new Uint8Array(13), cv = new DataView(chunk.buffer);
  cv.setUint32(0, 1); chunk.set([0x73, 0x52, 0x47, 0x42, 0], 4); cv.setUint32(9, crc32(chunk.subarray(4, 9)));   // length 1, "sRGB", intent 0
  const out = new Uint8Array(bytes.length + 13);
  out.set(bytes.subarray(0, at)); out.set(chunk, at); out.set(bytes.subarray(at), at + 13);
  return out;
}

// A ZIP of files, STORED (a PNG is compressed already): local headers, central directory, end record. 32-bit sizes, UTF-8 names.
export function zip(files) {
  const d = new Date(), time = d.getHours() << 11 | d.getMinutes() << 5 | d.getSeconds() >> 1;
  const date = Math.max(0, d.getFullYear() - 1980) << 9 | (d.getMonth() + 1) << 5 | d.getDate();
  const enc = new TextEncoder(), parts = [], dir = [];
  let at = 0;
  const put = (n, ...v) => { const b = new Uint8Array(n), dv = new DataView(b.buffer); let o = 0; for (const [w, x] of v) { w === 2 ? dv.setUint16(o, x, true) : dv.setUint32(o, x, true); o += w; } return b; };
  for (const { name, bytes } of files) {
    const nm = enc.encode(name), crc = crc32(bytes), common = [[2, 0x0800], [2, 0], [2, time], [2, date], [4, crc], [4, bytes.length], [4, bytes.length], [2, nm.length], [2, 0]];
    parts.push(put(30, [4, 0x04034b50], [2, 20], ...common), nm, bytes);
    dir.push(put(46, [4, 0x02014b50], [2, 20], [2, 20], ...common, [2, 0], [2, 0], [2, 0], [4, 0], [4, at]), nm);   // comment length, disk, internal and external attrs, local header offset
    at += 30 + nm.length + bytes.length;
  }
  const size = dir.reduce((n, b) => n + b.length, 0), out = new Uint8Array(at + size + 22);
  let o = 0;
  for (const b of [...parts, ...dir, put(22, [4, 0x06054b50], [2, 0], [2, 0], [2, files.length], [2, files.length], [4, size], [4, at], [2, 0])]) { out.set(b, o); o += b.length; }
  return out;
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
