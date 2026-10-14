'use client';
// A live match's score, kept in sight while the page scrolls: a compact bar under the header that
// appears once the scoreboard it stands for has scrolled away. It takes no room until it's needed.

import { useEffect, useState } from 'react';

/**
 * [ref, past]: put `ref` on the scoreboard; `past` is true once it has scrolled up out of view
 * under the sticky header (54 px on phones). A callback ref, so it works on elements that appear late.
 */
export function useScrolledPast() {
  const [el, setEl] = useState(null);
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < 0), { rootMargin: '-60px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return [setEl, past];
}

/** The bar itself. Hidden from screen readers while it's out of sight; the scoreboard says the same. */
export function StickyBar({ shown, children }) {
  return (
    <div className={`sp-stick${shown ? ' sp-stick-on' : ''}`} aria-hidden={!shown}>
      <div className="sp-stick-bar">{children}</div>
    </div>
  );
}

/** One side's chip in the bar: its colours, its name and its score. */
export function StickyTeam({ fill, ink, name, score, flip = false }) {
  return (
    <span className="sp-stick-team" style={{ background: fill, color: ink }}>
      {flip ? (
        <>
          <b>{score}</b> {name}
        </>
      ) : (
        <>
          {name} <b>{score}</b>
        </>
      )}
    </span>
  );
}
