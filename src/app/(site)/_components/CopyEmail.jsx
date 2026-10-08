'use client';

import { useState } from 'react';

export const EMAIL = 'mikaeel2013@gmail.com';

// A real mailto link; the small button next to it copies the address for people on webmail.
export default function CopyEmail({ label = EMAIL }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {}
  };
  return (
    <span>
      <a href={`mailto:${EMAIL}`}>{label}</a>{' '}
      <button type="button" className="copy faint" onClick={copy} aria-live="polite">
        {done ? <span className="done">copied</span> : 'copy'}
      </button>
    </span>
  );
}
