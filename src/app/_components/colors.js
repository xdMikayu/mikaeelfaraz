'use client';
import { useEffect, useState } from 'react';
import { matchKits, inkOn as inkOnHex } from '@/lib/kit-colors.mjs';

// Team colours on a page, from src/lib/kit-colors.mjs: one colour per team for a whole match,
// the same in its block, its chart lines and its bars.

/** { home, away } colours for charts and bars on the current surface. */
export function teamColors(home, away, dark) {
  const k = matchKits(home, away, dark);
  return { home: k.home.line, away: k.away.line };
}

/**
 * Block colours for match cards and the match header. A white kit shows as a pale tone with a
 * hairline edge, so it doesn't merge with the page.
 */
export function kitPair(home, away) {
  const k = matchKits(home, away);
  const fill = (s) => (s.white ? 'var(--sp-kit-white)' : s.fill);
  return { '--home': fill(k.home), '--away': fill(k.away) };
}

/** Readable text colour on a team-coloured block. */
export const inkOn = (color) => (String(color ?? '').startsWith('var(') ? '#111316' : inkOnHex(color));

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
