import Link from 'next/link';

// Football is the app today; each other sport has a page saying what's coming and showing what's on.
// Every sport has its own mark in public/sport/marks: one object split red and white on its surface.
export const SPORTS = [
  { key: 'football', href: '/sport', label: 'Football' },
  { key: 'cricket', href: '/sport/cricket', label: 'Cricket' },
  { key: 'tennis', href: '/sport/tennis', label: 'Tennis' },
  { key: 'f1', href: '/sport/f1', label: 'F1' },
  { key: 'wrestling', href: '/sport/wrestling', label: 'Wrestling' },
];

/** A sport page's browser-tab icon is its own mark; saved to the home screen it's still Matchday. */
export const sportIcons = (key) => ({
  icon: [
    { url: `/sport/marks/${key}.svg`, type: 'image/svg+xml' },
    { url: `/sport/marks/${key}-32.png`, sizes: '32x32', type: 'image/png' },
  ],
  apple: [{ url: '/sport/apple-touch-icon.png', sizes: '180x180' }],
});

/** The sports along the top of the Scores section, each with its mark. */
export default function SportsBar({ active }) {
  return (
    <nav className="sp-read sp-pad sp-sportsnav" aria-label="Sports">
      <div className="sp-sports">
        {SPORTS.map((s) => (
          <Link key={s.key} href={s.href} aria-current={s.key === active ? 'page' : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/sport/marks/${s.key}.svg`} alt="" width={32} height={32} />
            {s.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
