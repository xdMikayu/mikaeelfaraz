'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PrefsProvider, usePrefs } from './prefs';
import { ScoresIcon, FantasyIcon, TablesIcon, FollowIcon } from './glyphs';
import Crest from './Crest';
import { SPORTS } from './SportsBar';
import { LEAGUES } from '@/lib/sport/leagues.mjs';

// Scores covers the match and team pages, and the other sports' pages.
const SCORES = ['/sport/match', '/sport/team', ...SPORTS.filter((s) => s.href !== '/sport').map((s) => s.href)];
const NAV = [
  { href: '/sport', label: 'Scores', icon: ScoresIcon, match: (p) => p === '/sport' || SCORES.some((h) => p.startsWith(h)) },
  { href: '/sport/fantasy', label: 'Fantasy', icon: FantasyIcon, match: (p) => p.startsWith('/sport/fantasy') },
  { href: '/sport/table/eng.1', label: 'Tables', icon: TablesIcon, match: (p) => p.startsWith('/sport/table') },
  { href: '/sport/following', label: 'Following', icon: FollowIcon, match: (p) => p.startsWith('/sport/following') },
];

// The mark: a half-and-half shirt on the centre spot, split along the halfway line (the home-screen
// icon is the same drawing, public/sport/icon.svg).
const SHIRT = 'M212 114C221 134 236 143 256 143C276 143 291 134 300 114L368 134L426 198L392 238L352 212L352 400Q352 412 340 412L172 412Q160 412 160 400L160 212L120 238L86 198L144 134Z';
export function Mark({ size = 26 }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="sp-mark" width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <clipPath id={`${id}s`}><rect width="512" height="512" rx="118" /></clipPath>
        <clipPath id={`${id}t`}><path d={SHIRT} /></clipPath>
      </defs>
      <g clipPath={`url(#${id}s)`}>
        <rect width="512" height="512" fill="#2f8d4e" />
        <path fill="#2a8346" d="M64 0h64v512H64zM192 0h64v512h-64zM320 0h64v512h-64zM448 0h64v512h-64z" />
        <g fill="none" stroke="#fff" strokeOpacity=".62" strokeWidth="9">
          <path d="M256 0v512" />
          <circle cx="256" cy="262" r="190" />
        </g>
        <g clipPath={`url(#${id}t)`}>
          <path fill="#d6001c" d="M0 0h256v512H0z" />
          <path fill="#fff" d="M256 0h256v512H256z" />
        </g>
        <path d="M212 114C221 134 236 143 256 143C276 143 291 134 300 114" fill="none" stroke="#111" strokeWidth="14" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="sp-word">
      <Mark />
      Matchday
    </span>
  );
}

/** Opened from the home screen (no browser bar, so no back button of its own). Null until known. */
function useStandalone() {
  const [on, setOn] = useState(null);
  useEffect(() => setOn(window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches), []);
  return on;
}

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** iPhone and iPad only, in the browser, once: how to put Matchday on the home screen. */
function HomeScreenHint() {
  const { prefs, update, ready } = usePrefs();
  const standalone = useStandalone();
  const [ios, setIos] = useState(false);
  useEffect(() => setIos(isIos()), []);
  if (!ready || standalone !== false || !ios || !prefs.homeHint) return null;
  return (
    <div className="sp-hint" role="note">
      <span>
        Add Matchday to your Home Screen: tap{' '}
        <span style={{ whiteSpace: 'nowrap' }}>
          Share{' '}
          <svg width="14" height="16" viewBox="0 0 14 16" aria-label="(the Share button)" role="img">
            <path d="M7 1v9M3.5 4.5 7 1l3.5 3.5M4.5 7H2v8h10V7H9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        , then <b>Add to Home Screen</b>. It opens full screen, like an app.
      </span>
      <button className="sp-link" onClick={() => update({ homeHint: false })}>
        Got it
      </button>
    </div>
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
      {NAV.map(({ href, label, icon: Icon, match }) => (
        <Link key={href} href={href} aria-current={match(pathname) ? 'page' : undefined}>
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** The top bar. From the home screen there's no browser back button, so match and team pages get one. */
function Top() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const standalone = useStandalone();
  const detail = pathname.startsWith('/sport/match') || pathname.startsWith('/sport/team');
  // Back only returns to a page seen inside the app; opened straight onto a match, it goes to the scores.
  const here = `${pathname}?${params}`;
  const landing = useRef(here);
  const moved = useRef(false);
  useEffect(() => {
    if (here !== landing.current) moved.current = true;
  }, [here]);
  return (
    <header className="sp-top">
      <div className="sp-top-in">
        {standalone && detail && (
          <button className="sp-back" onClick={() => (moved.current ? router.back() : router.push('/sport'))}>
            <span aria-hidden="true">‹</span> Back
          </button>
        )}
        <Link href="/sport" aria-label="Matchday, today's scores"><Wordmark /></Link>
      </div>
    </header>
  );
}

export default function SportShell({ children }) {
  return (
    <PrefsProvider>
      <Top />
      <div className="sp-frame">
        <Rail />
        <main className="sp-main" id="main">
          <HomeScreenHint />
          {children}
        </main>
      </div>
      <Tabbar />
    </PrefsProvider>
  );
}
