'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PrefsProvider, usePrefs } from './prefs';
import { MenuIcon, CloseIcon, SettingsIcon, SportGlyph } from './glyphs';
import Crest from './Crest';
import { SPORTS, sportOf } from './nav';
import { LEAGUES } from '@/lib/sport/leagues.mjs';

// The frame of every page. The header names the sport you're in ("Matchday · F1"); on phones the
// sport's sections sit under it as tabs, since they're used all the time, while the other sports
// wait in a drawer, since switching sport is occasional. On desktop all of it is the sidebar.

// The mark: a half-and-half shirt on the centre spot, split along the halfway line. It's the
// home-screen icon (public/sport/icon.svg); the pages themselves carry only the name.
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

/** "Matchday · F1": the name, then where you are, which is the word that stands out. */
export function Wordmark({ sport }) {
  return (
    <span className={`sp-word${sport ? ' sp-word-in' : ''}`}>
      <span className="sp-word-name">Matchday</span>
      {sport && (
        <>
          <span className="sp-word-dot" aria-hidden="true">
            ·
          </span>
          <span className="sp-word-sport">{sport}</span>
        </>
      )}
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

/**
 * Everything you can go to: each sport, with the sections of the one you're in under it, then
 * football's teams and tables when you're in football, and the settings.
 */
function SideNav() {
  const pathname = usePathname();
  const { prefs } = usePrefs();
  const here = sportOf(pathname);
  const tables = prefs.order.filter((s) => !prefs.off.includes(s)).map((s) => LEAGUES.find((l) => l.slug === s)).filter((l) => l?.table).slice(0, 8);
  const sports = prefs.sports.map((k) => SPORTS.find((s) => s.key === k)).filter(Boolean);
  return (
    <nav className="sp-side" aria-label="Sports">
      <ul className="sp-side-sports">
        {sports.map((s) => {
          const on = here?.key === s.key;
          return (
            <li key={s.key}>
              <Link href={s.href} className="sp-side-sport" aria-current={on && pathname === s.href ? 'page' : on ? 'true' : undefined}>
                <SportGlyph sport={s.key} />
                <span>{s.label}</span>
                {s.soon && <small className="sp-side-soon">Soon</small>}
              </Link>
              {on && s.sections && (
                <ul className="sp-side-sections">
                  {s.sections.map((x) => (
                    <li key={x.href}>
                      <Link href={x.href} aria-current={x.match(pathname) ? 'page' : undefined}>
                        {x.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {here?.key === 'football' && prefs.teams.length > 0 && (
        <div className="sp-side-group">
          <span className="sp-side-head">Your teams</span>
          {prefs.teams.slice(0, 10).map((t) => (
            <Link key={t.id} href={`/sport/team?id=${t.id}${t.leagues?.[0] ? `&l=${t.leagues[0]}` : ''}`}>
              <Crest src={t.logo} size={18} /> <span className="sp-side-clip">{t.name}</span>
            </Link>
          ))}
        </div>
      )}
      {here?.key === 'football' && (
        <div className="sp-side-group">
          <span className="sp-side-head">Tables</span>
          {tables.map((l) => (
            <Link key={l.slug} href={`/sport/table/${l.slug}`} aria-current={pathname === `/sport/table/${l.slug}` ? 'page' : undefined}>
              {l.name}
            </Link>
          ))}
        </div>
      )}
      <div className="sp-side-group sp-side-foot">
        <Link href="/sport/settings" className="sp-side-settings" aria-current={pathname.startsWith('/sport/settings') ? 'page' : undefined}>
          <SettingsIcon /> Settings
        </Link>
        <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0', lineHeight: 1.5 }}>
          No ads, no tracking, no accounts.{' '}
          <Link className="sp-link" href="/sport/settings#about">
            About the data
          </Link>
        </p>
      </div>
    </nav>
  );
}

/** Desktop: the sidebar, always there. */
function Rail() {
  const here = sportOf(usePathname());
  return (
    <aside className="sp-rail">
      <Link href={here?.href ?? '/sport'} className="sp-rail-brand">
        <Wordmark sport={here?.label} />
      </Link>
      <SideNav />
    </aside>
  );
}

/** Phones: the same, sliding in from the left. Closes on a choice, on Escape and on a tap outside. */
function Drawer({ open, onClose }) {
  const pathname = usePathname();
  const panel = useRef(null);
  const first = useRef(pathname);
  useEffect(() => {
    if (pathname !== first.current) onClose();
    first.current = pathname;
  }, [pathname, onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = 'hidden';
    panel.current?.querySelector('a[aria-current], a')?.focus();
    return () => {
      document.removeEventListener('keydown', key);
      root.style.overflow = was;
    };
  }, [open, onClose]);
  return (
    <div className={`sp-drawer${open ? ' sp-drawer-open' : ''}`} aria-hidden={!open} inert={open ? undefined : ''}>
      <div className="sp-drawer-scrim" onClick={onClose} />
      <div className="sp-drawer-panel" role="dialog" aria-modal="true" aria-label="Sports and sections" ref={panel}>
        <div className="sp-drawer-top">
          <Wordmark />
          <button className="sp-icon-tap" onClick={onClose} aria-label="Close the menu">
            <CloseIcon />
          </button>
        </div>
        <SideNav />
      </div>
    </div>
  );
}

/** Phones: the sport's sections as tabs under the header. */
function Sections({ sport }) {
  const pathname = usePathname();
  return (
    <nav className="sp-sections" aria-label={`${sport.label} sections`}>
      {sport.sections.map(({ href, label, match }) => (
        <Link key={href} href={href} aria-current={match(pathname) ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Opening Matchday (a new visit, straight onto the football scores) goes to the sport the viewer
 * chose to open on. Moving around inside never does.
 */
function useStartSport() {
  const pathname = usePathname();
  const router = useRouter();
  const { prefs, ready } = usePrefs();
  useEffect(() => {
    if (!ready) return;
    let first = false;
    try {
      first = !sessionStorage.getItem('md-opened');
      sessionStorage.setItem('md-opened', '1');
    } catch {}
    const to = SPORTS.find((s) => s.key === prefs.start);
    if (first && pathname === '/sport' && !window.location.search && to && to.key !== 'football') router.replace(to.href);
    // Only ever on the first page of a visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
}

/** The top bar on phones: the menu, then "Matchday · F1". From the home screen, match and team pages get a back button. */
function Top({ onMenu, open }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const standalone = useStandalone();
  const here = sportOf(pathname);
  const detail = pathname.startsWith('/sport/match') || pathname.startsWith('/sport/team');
  // Back only returns to a page seen inside the app; opened straight onto a match, it goes to the scores.
  const at = `${pathname}?${params}`;
  const landing = useRef(at);
  const moved = useRef(false);
  useEffect(() => {
    if (at !== landing.current) moved.current = true;
  }, [at]);
  return (
    <header className="sp-top">
      <div className="sp-top-in">
        {standalone && detail ? (
          <button className="sp-back" onClick={() => (moved.current ? router.back() : router.push('/sport'))}>
            <span aria-hidden="true">‹</span> Back
          </button>
        ) : (
          <button className="sp-icon-tap" onClick={onMenu} aria-label="Sports and sections" aria-expanded={open}>
            <MenuIcon />
          </button>
        )}
        <Link href={here?.href ?? '/sport'} aria-label={`Matchday${here ? `, ${here.label}` : ''}`}>
          <Wordmark sport={here ? here.label : 'Settings'} />
        </Link>
      </div>
    </header>
  );
}

function Frame({ children }) {
  const pathname = usePathname();
  const here = sportOf(pathname);
  const [open, setOpen] = useState(false);
  const close = useRef(() => setOpen(false)).current;
  useStartSport();
  return (
    <>
      <Top onMenu={() => setOpen(true)} open={open} />
      <Drawer open={open} onClose={close} />
      {here?.sections && <Sections sport={here} />}
      <div className="sp-frame">
        <Rail />
        <main className="sp-main" id="main">
          <HomeScreenHint />
          {children}
        </main>
      </div>
    </>
  );
}

export default function SportShell({ children }) {
  return (
    <PrefsProvider>
      <Frame>{children}</Frame>
    </PrefsProvider>
  );
}
