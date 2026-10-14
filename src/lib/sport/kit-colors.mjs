// Team colours, from ESPN's kit colours to what a page draws. Pure, so it runs on the server and in
// tests.
//
// ESPN's colours are often raw screen primaries (#0000fa for Everton, Ipswich and Portsmouth,
// #ffff00 for Norwich and Fenerbahce) that no kit is dyed in, and they make a page look cheap.
// `kitHex` tones those down to the colour of the real shirt and leaves designed colours alone.
//
// `matchKits` gives one colour per team for a match, used everywhere on its page:
//   fill  the team's block (match cards, the match header); the away side changes to its other kit
//         when the two clash, as it would on the pitch
//   ink   readable text on that block
//   line  the team drawn on the page (chart lines, bars, possession): the fill where it reads,
//         otherwise a deeper (or, in dark mode, lighter) shade of the same colour, and the page's own
//         ink for a white kit

const SIX = /^#?([0-9a-f]{6})$/i;

export const hexToRgb = (hex) => {
  const m = SIX.exec(hex ?? '');
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255) : null;
};

const toHex = (rgb) => `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')}`;
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function oklab(rgb) {
  const [R, G, B] = rgb.map(lin);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/** OKLCH back to sRGB hex, giving up chroma until the colour fits the screen's gamut. */
function fromOklch(L, C, h) {
  for (let c = C; c >= 0; c -= 0.004) {
    const a = c * Math.cos(h);
    const b = c * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) return toHex(rgb.map((v) => gam(Math.min(1, Math.max(0, v)))));
  }
  return toHex([L, L, L].map(gam));
}

const lch = (rgb) => {
  const [L, a, b] = oklab(rgb);
  return { L, C: Math.hypot(a, b), h: Math.atan2(b, a), deg: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
};

export const luminance = (rgb) => {
  const [R, G, B] = rgb.map(lin);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

export const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** How far apart two colours look (OKLab distance × 100; under about 18 they read as the same). */
export const distance = (a, b) => {
  const [p, q] = [oklab(a), oklab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 100;
};

/**
 * ESPN's colour ("0606fa" or "#0606fa") as "#rrggbb", with screen primaries toned to kit colours;
 * null when there isn't one.
 */
export function kitHex(raw) {
  const rgb = hexToRgb(raw);
  if (!rgb) return null;
  const { L, C, h, deg } = lch(rgb);
  // Highlighter yellow (#ffff00): a printed shirt's warmer, slightly deeper yellow.
  if (L > 0.9 && C > 0.12 && deg > 95 && deg < 125) return fromOklch(0.885, Math.min(C, 0.18), (98 * Math.PI) / 180);
  // Bright, saturated greens and blues (Pakistan's #07df52): the deeper tone of a real shirt; limes go
  // to a true green, which is what the shirt is. Oranges and golds are left alone: they are that bright.
  if (L > 0.72 && C > 0.17 && !(deg > 50 && deg < 115)) return fromOklch(0.6, 0.17, deg < 140 ? (145 * Math.PI) / 180 : h);
  // Other neons (cyan).
  if (L > 0.85 && C > 0.12) return fromOklch(0.8, 0.12, h);
  // Pure screen blue (#0000fa): a royal blue.
  if (C > 0.26 && deg > 250 && deg < 275) return fromOklch(0.42, 0.2, h);
  if (C > 0.22) return fromOklch(L, 0.22, h);
  return toHex(rgb);
}

/** Near-white: a kit that would vanish on a white page. */
export const isWhite = (hex) => {
  const rgb = hexToRgb(hex);
  return Boolean(rgb) && luminance(rgb) > 0.8;
};

const NEUTRAL = '#3a3a3a';
const INK = { light: '#111111', dark: '#f2f2f2' };
const SURFACE = { light: [1, 1, 1], dark: [0.071, 0.071, 0.071] };

/** Readable text on a block of this colour. */
export function inkOn(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  return contrast(rgb, [1, 1, 1]) >= contrast(rgb, [0.07, 0.08, 0.09]) ? '#ffffff' : '#111316';
}

/**
 * A team's block colour: its kit, or the darker alternate when the kit is white (a white block
 * vanishes on a white page).
 */
export function fillOf(t) {
  const main = kitHex(t?.color);
  const alt = kitHex(t?.alt);
  if (!main) return alt ?? NEUTRAL;
  if (isWhite(main) && alt && luminance(hexToRgb(alt)) < 0.5) return alt;
  return main;
}

/** Both sides' blocks: when they clash the away side changes to its other kit, as on the pitch. */
function fills(home, away) {
  const close = (x, y) => distance(hexToRgb(x), hexToRgb(y)) < 18;
  const h = fillOf(home);
  let a = fillOf(away);
  if (close(h, a)) {
    const other = [kitHex(away?.alt), kitHex(away?.color)].find((c) => c && !close(h, c));
    if (other) a = other;
  }
  return [h, a];
}

/** The team on the page: its fill where that reads, else a deeper or lighter shade of it, else ink. */
export function lineOf(fill, dark = false) {
  const surface = SURFACE[dark ? 'dark' : 'light'];
  const rgb = hexToRgb(fill);
  if (!rgb) return INK[dark ? 'dark' : 'light'];
  if (contrast(rgb, surface) >= 2.6) return toHex(rgb);
  const { L, C, h } = lch(rgb);
  // White, grey or black kits have no colour to keep: draw them in the page's ink.
  if (C < 0.04) return INK[dark ? 'dark' : 'light'];
  for (let step = 1; step <= 30; step += 1) {
    const L2 = dark ? L + step * 0.02 : L - step * 0.02;
    if (L2 <= 0.05 || L2 >= 0.98) break;
    const hex = fromOklch(L2, C, h);
    if (contrast(hexToRgb(hex), surface) >= 2.6) return hex;
  }
  return INK[dark ? 'dark' : 'light'];
}

// Red-green colour blindness (about one man in twelve), simulated on linear RGB (Machado, Oliveira
// and Fernandes 2009, full severity): deuteranopia and protanopia.
const CVD = [
  [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
];
const seenAs = (rgb, M) => {
  const L = rgb.map(lin);
  return M.map((r) => gam(Math.min(1, Math.max(0, r[0] * L[0] + r[1] * L[1] + r[2] * L[2]))));
};

/** How far apart two colours look to someone with red-green colour blindness (the worse of the two kinds). */
export const cvdDistance = (a, b) => Math.min(...CVD.map((M) => distance(seenAs(a, M), seenAs(b, M))));

/**
 * Two lines someone who is red-green colour blind can tell apart (Liverpool's red against a green
 * looks like two browns to them, and to some a red looks dark): one of them lighter or darker, the
 * smallest change that does it, so each stays its team's colour and readable on the page. The away
 * line changes before the home one. Failing that, the pair they can best tell apart.
 */
function apart(lh, la, dark) {
  const surface = SURFACE[dark ? 'dark' : 'light'];
  let best = { lh, la, d: cvdDistance(hexToRgb(lh), hexToRgb(la)) + 4 };
  // At most 0.2 lighter or darker: further and a green is black.
  for (let step = 1; step <= 10; step += 1) {
    for (const moving of ['away', 'home']) {
      const from = lch(hexToRgb(moving === 'away' ? la : lh));
      const other = hexToRgb(moving === 'away' ? lh : la);
      for (const dir of [1, -1]) {
        const L2 = from.L + dir * step * 0.02;
        if (L2 <= 0.05 || L2 >= 0.98) continue;
        const hex = fromOklch(L2, from.C, from.h);
        const rgb = hexToRgb(hex);
        if (contrast(rgb, surface) < 2.6) continue;
        const d = cvdDistance(other, rgb);
        const pair = moving === 'away' ? { lh, la: hex, d } : { lh: hex, la, d };
        if (d >= 18) return pair;
        if (d > best.d) best = pair;
      }
    }
  }
  return best;
}

/** { home, away }, each { fill, ink, white, line }: one colour per team for a whole match page. */
export function matchKits(home, away, dark = false) {
  const [h, a] = fills(home, away);
  let lh = lineOf(h, dark);
  let la = lineOf(a, dark);
  // Two lines that look alike can't tell the teams apart: the away side goes to a mid grey, or to
  // ink when the home side is itself greyish.
  if (distance(hexToRgb(lh), hexToRgb(la)) < 18) {
    const grey = dark ? '#8c8c8c' : '#a3a3a3';
    la = distance(hexToRgb(lh), hexToRgb(grey)) >= 18 ? grey : INK[dark ? 'dark' : 'light'];
  }
  // Two that only look alike to someone colour blind: a shade lighter or darker. Pairs that are
  // merely close (15 to 18) are left as they are.
  if (cvdDistance(hexToRgb(lh), hexToRgb(la)) < 15) ({ lh, la } = apart(lh, la, dark));
  const side = (fill, line) => ({ fill, ink: inkOn(fill), white: isWhite(fill), line });
  return { home: side(h, lh), away: side(a, la) };
}
