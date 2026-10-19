'use client';
import { useEffect, useState } from 'react';
import { inkOn } from './colors';

// A player as the lineups and the ratings show them: the face cut out on the kit colour where we
// have a photo (the Premier League's own), else the shirt number on it.

export const DISC = 44;

/** A player's disc: the face (each photo url in turn) or, without one, the number on the kit colour. */
export default function Disc({ srcs, number, color, size = DISC }) {
  const [i, setI] = useState(0);
  // Back to the first photo only for another player: the live page hands over fresh arrays every refresh.
  const first = srcs?.[0];
  useEffect(() => setI(0), [first]);
  const src = srcs?.[i];
  return (
    <span className="sp-disc" style={{ width: size, height: size, background: color, color: inkOn(color), fontSize: Math.round(size * 0.36) }}>
      {src ? (
        // The league's CDN, already sized; next/image would route it through our own functions.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setI((k) => k + 1)} />
      ) : (
        number
      )}
    </span>
  );
}
