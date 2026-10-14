// Where everything is: each sport and its own sections ("soon": a page saying what's coming). The sidebar (desktop) and the drawer
// (phones) list them; the header names the sport you're in: "Matchday · F1".

const under = (...roots) => (p) => roots.some((r) => p === r || p.startsWith(`${r}/`) || p.startsWith(`${r}?`));

export const SPORTS = [
  {
    key: 'football',
    label: 'Football',
    href: '/sport',
    match: (p) => p === '/sport' || under('/sport/match', '/sport/team', '/sport/fantasy', '/sport/table', '/sport/following')(p),
    sections: [
      { href: '/sport', label: 'Scores', match: (p) => p === '/sport' || under('/sport/match', '/sport/team')(p) },
      { href: '/sport/fantasy', label: 'Fantasy', match: under('/sport/fantasy') },
      { href: '/sport/table/eng.1', label: 'Tables', match: under('/sport/table') },
      { href: '/sport/following', label: 'Following', match: under('/sport/following') },
    ],
  },
  { key: 'cricket', label: 'Cricket', href: '/sport/cricket', match: under('/sport/cricket') },
  { key: 'tennis', label: 'Tennis', href: '/sport/tennis', match: under('/sport/tennis'), soon: true },
  {
    key: 'f1',
    label: 'F1',
    href: '/sport/f1',
    match: under('/sport/f1'),
    sections: [
      { href: '/sport/f1', label: 'Weekend', match: (p) => p === '/sport/f1' || under('/sport/f1/race')(p) },
      { href: '/sport/f1#championship', label: 'Championship', match: () => false },
      { href: '/sport/f1#calendar', label: 'Calendar', match: () => false },
    ],
  },
  { key: 'wrestling', label: 'Wrestling', href: '/sport/wrestling', match: under('/sport/wrestling'), soon: true },
];

/** The sport a page belongs to; null for the pages that belong to none (settings). */
export const sportOf = (p) => (under('/sport/settings')(p) ? null : (SPORTS.find((s) => s.match(p)) ?? SPORTS[0]));

/** A sport page's browser-tab icon is its own pictogram; saved to the home screen it's still Matchday. */
export const sportIcons = (key) => ({
  icon: [
    { url: `/sport/marks/${key}.svg`, type: 'image/svg+xml' },
    { url: `/sport/marks/${key}-32.png`, sizes: '32x32', type: 'image/png' },
  ],
  apple: [{ url: '/sport/apple-touch-icon.png', sizes: '180x180' }],
});
