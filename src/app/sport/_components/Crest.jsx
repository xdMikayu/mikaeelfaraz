'use client';
import { useEffect, useState } from 'react';
import { crest } from '@/lib/sport/espn.mjs';
import { useDark } from './colors';

/**
 * A club crest at a fixed size (so rows never shift while it loads). In dark mode ESPN's dark
 * variant, which most clubs have (navy crests vanish on charcoal otherwise); if it's missing,
 * the normal one; if that fails too, a plain disc.
 */
export default function Crest({ src, size = 20, alt = '', light = false }) {
  // `light`: the crest sits on a white disc, so the normal (light-mode) version reads best.
  const dark = useDark() && !light;
  const [step, setStep] = useState(0); // 0 preferred, 1 normal, 2 failed
  useEffect(() => setStep(0), [src, dark]);
  if (!src || step === 2) return <span className="sp-crest-ph" style={{ width: size, height: size }} aria-hidden />;
  const darkSrc = src.includes('/500/') ? src.replace('/500/', '/500-dark/') : null;
  const url = dark && darkSrc && step === 0 ? darkSrc : src;
  return (
    // ESPN's resizer returns a small PNG; next/image would route it through our own functions.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="sp-crest"
      src={crest(url, size)}
      width={size}
      height={size}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setStep((s) => (url === darkSrc ? 1 : 2))}
    />
  );
}
