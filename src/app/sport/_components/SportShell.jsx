'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PrefsProvider, usePrefs } from './prefs';
import { ScoresIcon, FantasyIcon, TablesIcon, FollowIcon } from './glyphs';
import Crest from './Crest';
import { LEAGUES } from '@/lib/sport/leagues.mjs';

const NAV = [
  { href: '/sport', label: 'Scores', icon: ScoresIcon, match: (p) => p === '/sport' || p.startsWith('/sport/match') || p.startsWith('/sport/team') },
  { href: '/sport/fantasy', label: 'Fantasy', icon: FantasyIcon, match: (p) => p.startsWith('/sport/fantasy'), cls: 'sp-tab-fpl' },
  { href: '/sport/table/eng.1', label: 'Tables', icon: TablesIcon, match: (p) => p.startsWith('/sport/table') },
  { href: '/sport/following', label: 'Following', icon: FollowIcon, match: (p) => p.startsWith('/sport/following') },
];

export function Wordmark() {
  return (
    <span className="sp-word">
      <span className="sp-mark" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
          <path d="M8 3.5v9" />
          <circle cx="8" cy="8" r="2" />
        </svg>
      </span>
      Matchday
    </span>
  );
}

function Rail() {
  const pathname = usePathname();
  const { prefs } = usePrefs();
  const tables = prefs.order.filter((s) => !prefs.off.includes(s)).map((s) => LEAGUES.find((l) => l.slug === s)).filter((l) => l?.table).slice(0, 8);
  return (
    <aside className="sp-rail" aria-label="Sections">
      <Link href="/sport" className="mb-4" style={{ height: 'auto', padding: 0, margin: '0 0 18px' }}><Wordmark /></Link>
      {NAV.map(({ href, label, icon: Icon, match }) => (
        <Link key={href} href={href} aria-current={match(pathname) ? 'page' : undefined}>
          <Icon /> {label}
        </Link>
      ))}
      {prefs.teams.length > 0 && (
        <div className="sp-rail-sub">
          <span className="sp-tiny sp-muted" style={{ padding: '0 0 4px' }}>Your teams</span>
          {prefs.teams.slice(0, 10).map((t) => (
            <Link key={t.id} href={`/sport/team?id=${t.id}${t.leagues?.[0] ? `&l=${t.leagues[0]}` : ''}`}>
              <Crest src={t.logo} size={18} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
            </Link>
          ))}
        </div>
      )}
      <div className="sp-rail-sub">
        <span className="sp-tiny sp-muted" style={{ padding: '0 0 4px' }}>Tables</span>
        {tables.map((l) => (
          <Link key={l.slug} href={`/sport/table/${l.slug}`} aria-current={pathname === `/sport/table/${l.slug}` ? 'page' : undefined}>{l.name}</Link>
        ))}
      </div>
      <p className="sp-tiny sp-muted" style={{ marginTop: 'auto', lineHeight: 1.5 }}>
        Scores from ESPN, fantasy from FPL. No ads, no tracking. <Link className="sp-link" href="/sport/following#about">About the data</Link>
      </p>
    </aside>
  );
}

function Tabbar() {
  const pathname = usePathname();
  return (
    <nav className="sp-tabbar" aria-label="Sections">
      {NAV.map(({ href, label, icon: Icon, match, cls }) => (
        <Link key={href} href={href} className={cls} aria-current={match(pathname) ? 'page' : undefined}>
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export default function SportShell({ children }) {
  return (
    <PrefsProvider>
      <header className="sp-top">
        <div className="sp-top-in">
          <Link href="/sport"><Wordmark /></Link>
        </div>
      </header>
      <div className="sp-frame">
        <Rail />
        <main className="sp-main" id="main">{children}</main>
      </div>
      <Tabbar />
    </PrefsProvider>
  );
}
