'use client';
import { useEffect } from 'react';
import { MATCHDAY, withPrefs } from '@/lib/matchday/link.mjs';

/** Sends /sport/… on to the same page at Matchday's own address. */
export default function Moved() {
  useEffect(() => {
    const path = window.location.pathname.replace(/^\/sport/, '') || '/';
    window.location.replace(withPrefs(`${MATCHDAY}${path}${window.location.search}${window.location.hash}`));
  }, []);
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <p>
        Matchday has moved to{' '}
        <a className="underline" href={MATCHDAY}>
          matchday.mikaeelfaraz.com
        </a>
        .
      </p>
    </main>
  );
}
