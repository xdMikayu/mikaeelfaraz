import Link from 'next/link';

// Football is the app today; the others have a page each saying what's coming and showing what's on.
export const SPORTS = [
  { key: 'football', href: '/sport', label: 'Football' },
  { key: 'tennis', href: '/sport/tennis', label: 'Tennis', soon: true },
  { key: 'f1', href: '/sport/f1', label: 'F1', soon: true },
  { key: 'wrestling', href: '/sport/wrestling', label: 'Wrestling', soon: true },
];

/** The sports, as words along the top of the Scores section. */
export default function SportsBar({ active }) {
  return (
    <nav className="sp-read sp-pad" aria-label="Sports">
      <div className="sp-tabs sp-sports">
        {SPORTS.map((s) => (
          <Link key={s.key} href={s.href} aria-current={s.key === active ? 'page' : undefined}>
            {s.label}
            {s.soon && <span className="sp-soon">Soon</span>}
          </Link>
        ))}
      </div>
    </nav>
  );
}
