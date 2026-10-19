'use client';
import { useEffect, useState } from 'react';
import { inkOn } from './colors';

// A player as the lineups and the ratings show them: the face cut out on a plain grey disc where we
// have a photo (the Premier League's own), else a shirt in the kit colour with the number on it.

export const DISC = 48;

/** A shirt in the kit colour with the number across its chest. */
function Shirt({ color, number, size }) {
  const body = /^#[0-9a-f]{6}$/i.test(color ?? '') ? color : '#8e8e93';
  const n = String(number ?? '');
  return (
    <svg width={size} height={size * 0.91} viewBox="0 0 22 20" aria-hidden>
      <path d="M7 1 2.5 3.5 0.8 8.2l3.4 1.4V19h13.6V9.6l3.4-1.4L19.5 3.5 15 1c-.6 1.6-2.2 2.7-4 2.7S7.6 2.6 7 1Z" fill={body} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" strokeLinejoin="round" />
      {n && (
        <text x="11" y="14.2" textAnchor="middle" fontSize={n.length > 1 ? 7.2 : 8} fontWeight="800" fill={inkOn(body)} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {n}
        </text>
      )}
    </svg>
  );
}

/** A player's disc: the face (each photo url in turn) or, without one, the shirt and number. */
export default function Disc({ srcs, number, color, size = DISC }) {
  const [i, setI] = useState(0);
  // Back to the first photo only for another player: the live page hands over fresh arrays every refresh.
  const first = srcs?.[0];
  useEffect(() => setI(0), [first]);
  const src = srcs?.[i];
  return (
    <span className="sp-disc" style={{ width: size, height: size }}>
      {src ? (
        // The league's CDN, already sized; next/image would route it through our own functions.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setI((k) => k + 1)} />
      ) : (
        <Shirt color={color} number={number} size={Math.round(size * 0.66)} />
      )}
    </span>
  );
}
