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

export const MenuIcon = () => (
  <svg {...nav}>
    <path d="M3.5 6.5h15M3.5 11h15M3.5 15.5h15" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...nav}>
    <path d="m5.5 5.5 11 11m0-11-11 11" />
  </svg>
);

export const SettingsIcon = () => (
  <svg {...nav}>
    <path d="M3.5 6.5h9M16.5 6.5h2M3.5 15.5h2M9.5 15.5h9" />
    <circle cx="14.5" cy="6.5" r="2" />
    <circle cx="7.5" cy="15.5" r="2" />
  </svg>
);

// The sports, drawn on the same grid and stroke as the rest and balanced to carry about the same
// ink: a ball, a bat and ball, a tennis ball's seams, a chequered flag and a championship belt.
const SPORT_GLYPHS = {
  football: (
    <>
      <circle cx="11" cy="11" r="8.5" />
      <path d="m11 7.6 3.2 2.3-1.2 3.8H9l-1.2-3.8Z" />
      <path d="M11 7.6V2.5M14.2 9.9l4.5-1.5M13 13.7l2.8 3.9M9 13.7l-2.8 3.9M7.8 9.9 3.3 8.4" />
    </>
  ),
  cricket: (
    <>
      <path d="m12.3 4.3 4.4 4.4-9.2 9.2a1.8 1.8 0 0 1-2.5 0l-1.9-1.9a1.8 1.8 0 0 1 0-2.5Z" />
      <path d="m8.6 13.4 3.2-3.2" />
      <path d="m14.5 6.5 4.2-4.2" strokeWidth="2.4" />
      <circle cx="17" cy="17" r="2.6" fill="currentColor" stroke="none" />
    </>
  ),
  tennis: (
    <>
      <circle cx="11" cy="11" r="8.5" />
      <path d="M5.2 5.3c2.7 3.2 2.7 8.2 0 11.4M16.8 5.3c-2.7 3.2-2.7 8.2 0 11.4" transform="rotate(-40 11 11)" />
    </>
  ),
  f1: (
    <>
      <path d="M4.5 20V2.8" />
      <path d="M4.5 3.5h14v10h-14" />
      <path d="M4.5 3.5h4.7v3.3H4.5zM13.8 3.5h4.7v3.3h-4.7zM9.2 6.8h4.6v3.4H9.2zM4.5 10.2h4.7v3.3H4.5zM13.8 10.2h4.7v3.3h-4.7z" fill="currentColor" stroke="none" />
    </>
  ),
  wrestling: (
    <>
      <path d="M1.6 9h3.2M17.2 9h3.2M1.6 13h3.2M17.2 13h3.2M1.6 9v4M20.4 9v4" />
      <path d="M4.8 8.4h2v5.2h-2zM15.2 8.4h2v5.2h-2z" />
      <circle cx="11" cy="11" r="5.9" />
      <path d="m11 7.6 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3Z" fill="currentColor" stroke="none" />
    </>
  ),
};

export const SportGlyph = ({ sport, size = 22 }) => (
  <svg {...nav} width={size} height={size}>
    {SPORT_GLYPHS[sport]}
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

/**
 * A small shirt in the team's kit colour: the team marker in lists, where a crest would usually sit.
 * The collar takes the alternate colour when there is one; a hairline keeps white kits visible.
 */
export function ShirtMark({ color, alt, size = 22 }) {
  const body = color && /^#[0-9a-f]{6}$/i.test(color) ? color : '#9a9a9a';
  const trim = alt && /^#[0-9a-f]{6}$/i.test(alt) && alt.toLowerCase() !== body.toLowerCase() ? alt : 'rgba(0,0,0,0.18)';
  return (
    <svg className="sp-shirtmark" width={size} height={size * 0.92} viewBox="0 0 22 20" aria-hidden>
      <path d="M7 1 2.5 3.5 0.8 8.2l3.4 1.4V19h13.6V9.6l3.4-1.4L19.5 3.5 15 1c-.6 1.6-2.2 2.7-4 2.7S7.6 2.6 7 1Z" fill={body} style={{ stroke: 'var(--sp-shirt-edge)' }} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M7.3 1.4c.8 1.4 2.1 2.2 3.7 2.2s2.9-.8 3.7-2.2" fill="none" stroke={trim} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
