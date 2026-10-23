'use client';
import { MATCHDAY, withPrefs } from '@/lib/matchday/link.mjs';

/** A link into Matchday that takes the viewer's saved Matchday settings with it (see withPrefs). */
export default function MatchdayLink({ path = '/', children, ...props }) {
  const href = `${MATCHDAY}${path}`;
  return (
    <a
      href={href}
      onClick={(e) => {
        e.currentTarget.href = withPrefs(href);
      }}
      {...props}
    >
      {children}
    </a>
  );
}
