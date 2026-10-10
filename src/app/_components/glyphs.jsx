// Small drawn glyphs: navigation, cards, goals, substitutions. Drawn for this app at the sizes
// they're used, rather than taken from an icon set.

const nav = { width: 22, height: 22, viewBox: '0 0 22 22', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const ScoresIcon = () => (
  <svg {...nav}>
    <rect x="2.5" y="5" width="17" height="12" rx="2" />
    <path d="M11 5v12M6.5 9.5v3.5M15.5 9.5l-1.5 1h2l-2 2.5" />
  </svg>
);

export const FantasyIcon = () => (
  <svg {...nav}>
    <path d="M8 3.5 4 5.5 2.5 9.5l3 1.2V18.5h11v-7.8l3-1.2L18 5.5l-4-2c-.4 1.4-1.6 2.3-3 2.3s-2.6-.9-3-2.3Z" />
  </svg>
);

export const TablesIcon = () => (
  <svg {...nav}>
    <path d="M3 5.5h16M3 11h16M3 16.5h16M7 3.5v15" />
  </svg>
);

export const FollowIcon = ({ filled }) => (
  <svg {...nav} fill={filled ? 'currentColor' : 'none'}>
    <path d="m11 3.2 2.3 4.8 5.2.7-3.8 3.6.9 5.2L11 15l-4.6 2.5.9-5.2-3.8-3.6 5.2-.7Z" />
  </svg>
);

export function Star({ on, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="m11 3.2 2.3 4.8 5.2.7-3.8 3.6.9 5.2L11 15l-4.6 2.5.9-5.2-3.8-3.6 5.2-.7Z" />
    </svg>
  );
}

export const Card = ({ red, size = 11 }) => (
  <svg width={size * 0.72} height={size} viewBox="0 0 8 11" aria-hidden>
    <rect x="0.5" y="0.5" width="7" height="10" rx="1.4" fill={red ? 'var(--sp-red-card)' : 'var(--sp-yellow)'} />
  </svg>
);

/** Second yellow: a yellow card behind a red one. */
export const SecondYellow = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden>
    <rect x="0.5" y="0.5" width="7" height="10" rx="1.4" fill="var(--sp-yellow)" />
    <rect x="4" y="1.5" width="7" height="10" rx="1.4" fill="var(--sp-red-card)" stroke="var(--sp-surface)" />
  </svg>
);

export const Ball = ({ size = 14, own }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
    <circle cx="8" cy="8" r="7" fill={own ? 'var(--sp-loss)' : 'var(--sp-surface)'} stroke={own ? 'var(--sp-loss)' : 'currentColor'} strokeWidth="1.3" />
    <path d="m8 4.6 3 2.2-1.1 3.6H6.1L5 6.8Z" fill={own ? 'var(--sp-surface)' : 'currentColor'} />
    <path d="M8 4.6V1.2M11 6.8l3.2-1M9.9 10.4l2 2.8M6.1 10.4l-2 2.8M5 6.8 1.8 5.8" stroke={own ? 'var(--sp-surface)' : 'currentColor'} strokeWidth="1.1" fill="none" />
  </svg>
);

export const SubArrows = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13V3M2 6l3-3 3 3" stroke="var(--sp-win)" />
    <path d="M11 3v10M8 10l3 3 3-3" stroke="var(--sp-loss)" />
  </svg>
);

export const In = () => (
  <svg width="9" height="9" viewBox="0 0 10 10" aria-label="on" role="img"><path d="M5 9V1.5M1.8 4.5 5 1.3l3.2 3.2" stroke="var(--sp-win)" strokeWidth="1.7" fill="none" strokeLinecap="round" /></svg>
);
export const Out = () => (
  <svg width="9" height="9" viewBox="0 0 10 10" aria-label="off" role="img"><path d="M5 1v7.5M1.8 5.5 5 8.7l3.2-3.2" stroke="var(--sp-loss)" strokeWidth="1.7" fill="none" strokeLinecap="round" /></svg>
);

export const Missed = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3">
    <circle cx="8" cy="8" r="7" strokeDasharray="2.2 2" />
    <path d="m5.5 5.5 5 5m0-5-5 5" strokeLinecap="round" />
  </svg>
);

export const Screen = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
    <rect x="1.5" y="3" width="13" height="9" rx="1.5" />
    <path d="M5.5 14.5h5" strokeLinecap="round" />
  </svg>
);
