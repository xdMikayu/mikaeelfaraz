'use client';
import { useEffect, useState } from 'react';

// Team colours for charts. ESPN's kit colours are used when they read on the current surface and
// differ enough from the opponent's; otherwise the alternate kit colour, then a fixed neutral pair.

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function oklab([r, g, b]) {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

const luminance = (rgb) => {
  const [R, G, B] = rgb.map(lin);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const distance = (a, b) => {
  const [p, q] = [oklab(a), oklab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 100;
};

const FALLBACK = { light: ['#1f2328', '#2f6fd6'], dark: ['#e7e9ec', '#5b93f0'] };

/** { home, away } chart colours for this match on this surface. */
export function teamColors(home, away, dark) {
  const surface = hexToRgb(dark ? '#16191c' : '#ffffff');
  const usable = (hex) => {
    const rgb = hex && hexToRgb(hex);
    return rgb && contrast(rgb, surface) >= 2.2 ? rgb : null;
  };
  const toHex = (rgb) => `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
  const h = usable(home.color) ?? usable(home.alt);
  if (!h) return { home: FALLBACK[dark ? 'dark' : 'light'][0], away: FALLBACK[dark ? 'dark' : 'light'][1] };
  const a = [away.color, away.alt].map(usable).find((c) => c && distance(c, h) >= 18);
  if (!a) {
    const f = FALLBACK[dark ? 'dark' : 'light'];
    return { home: toHex(h), away: distance(hexToRgb(f[1]), h) >= 18 ? f[1] : f[0] };
  }
  return { home: toHex(h), away: toHex(a) };
}

/**
 * Raw kit colours for tinted backgrounds (match cards, the match header), where a dark navy reads
 * fine. The away side switches to its alternate colour when the two kits are too alike.
 */
export function kitPair(home, away) {
  const ok = (c) => Boolean(c && hexToRgb(c));
  // A near-white kit disappears on a white page: use the club's alternate colour when it has a darker one.
  const pick = (t) => {
    const main = ok(t.color) ? t.color : '#3a3a3a';
    if (luminance(hexToRgb(main)) > 0.8 && ok(t.alt) && luminance(hexToRgb(t.alt)) < 0.5) return t.alt;
    return main;
  };
  const h = pick(home);
  let a = pick(away);
  const close = (x, y) => distance(hexToRgb(x), hexToRgb(y)) < 18;
  if (close(h, a) && ok(away.alt) && !close(h, away.alt)) a = away.alt;
  return { '--home': h, '--away': a };
}

/** Readable text colour on a team-coloured shirt disc. */
export function inkOn(hex) {
  const rgb = hexToRgb(hex ?? '');
  if (!rgb) return '#ffffff';
  return contrast(rgb, [1, 1, 1]) >= contrast(rgb, [0.07, 0.08, 0.09]) ? '#ffffff' : '#111316';
}

/** True when the page is in dark mode; follows the toggle and the OS setting. */
export function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const read = () => {
      const t = el.getAttribute('data-sport-theme');
      setDark(t ? t === 'dark' : mq.matches);
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ['data-sport-theme'] });
    mq.addEventListener('change', read);
    return () => {
      mo.disconnect();
      mq.removeEventListener('change', read);
    };
  }, []);
  return dark;
}
