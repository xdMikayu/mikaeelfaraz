'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ScoresIcon, FantasyIcon, TablesIcon, FollowIcon, CalendarIcon, TrophyIcon, GuideIcon, FlagIcon, SearchIcon } from './glyphs';

// Phones: the sport's sections as a tab bar floating over the bottom of the page, in the glass
// iOS 26 uses for its own (Liquid Glass): the page shows through it, blurred, and a lens sits under
// the section you're in. As on iOS, the lens moves the moment a finger lands on another section and
// slides over with a little overshoot; press and slide along the bar and it follows the finger,
// opening the section you let go on. Search is the round button beside it.

const ICONS = { scores: ScoresIcon, fantasy: FantasyIcon, tables: TablesIcon, follow: FollowIcon, calendar: CalendarIcon, trophy: TrophyIcon, guide: GuideIcon, flag: FlagIcon };

const pathOf = (href) => href.split('#')[0];
const hashOf = (href) => href.split('#')[1] ?? null;
const useIsoLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Which section you're in. Sections with a hash are parts of the sport's first page, so there the
 * one you've scrolled to counts: the last whose heading has passed the top third of the screen.
 */
function useActive(sections, pathname) {
  const byPath = sections.findIndex((s) => !hashOf(s.href) && s.match(pathname));
  const spied = sections.some((s) => hashOf(s.href) && pathOf(s.href) === pathname);
  const [spy, setSpy] = useState(null);
  useEffect(() => {
    setSpy(null);
    if (!spied) return undefined;
    let raf = 0;
    const read = () => {
      raf = 0;
      let at = null;
      const line = window.innerHeight * 0.35;
      sections.forEach((s, i) => {
        const id = hashOf(s.href);
        const el = id && document.getElementById(id);
        if (el && el.getBoundingClientRect().top < line) at = i;
      });
      // At the very bottom the last section counts even if its heading never reached the line.
      const last = sections.length - 1;
      const end = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (end && window.scrollY > 0 && hashOf(sections[last].href) && document.getElementById(hashOf(sections[last].href))) at = last;
      setSpy(at);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [sections, pathname, spied]);
  return spy ?? byPath;
}

/** A field with the keyboard up: the bar steps aside until it's done. */
function useTyping() {
  useEffect(() => {
    const fields = 'textarea, select, input:not([type=radio]):not([type=checkbox]):not([type=range]):not([type=button]):not([type=submit])';
    const set = () => document.documentElement.classList.toggle('sp-typing', Boolean(document.activeElement?.matches?.(fields)));
    const later = () => setTimeout(set, 0);
    // Checked again on every tap too, in case a field went away without saying it lost focus.
    document.addEventListener('focusin', set);
    document.addEventListener('focusout', later);
    document.addEventListener('pointerdown', later);
    return () => {
      document.removeEventListener('focusin', set);
      document.removeEventListener('focusout', later);
      document.removeEventListener('pointerdown', later);
      document.documentElement.classList.remove('sp-typing');
    };
  }, []);
}

export default function TabBar({ sport, onFind }) {
  const pathname = usePathname();
  const router = useRouter();
  const sections = sport?.sections ?? [];
  const active = useActive(sections, pathname);
  const bar = useRef(null);
  const tabs = useRef([]);
  tabs.current.length = sections.length;
  const [lens, setLens] = useState(null); // { x, w } of a section's cell
  const [pending, setPending] = useState(null); // the section a finger landed on, until it opens
  const [drag, setDrag] = useState(null); // { x, over } while a finger slides along the bar
  const press = useRef(null);
  const swallow = useRef(false);
  const settle = useRef(0);
  useTyping();
  useEffect(() => () => clearTimeout(settle.current), []);

  // A new section has opened (or the press came to nothing): the lens settles where you are.
  useEffect(() => setPending(null), [active, pathname]);
  const shown = drag ? drag.over : pending ?? active;

  const measure = useCallback(() => {
    const el = tabs.current[shown];
    setLens(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
  }, [shown]);
  useIsoLayout(() => {
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (ro && bar.current) ro.observe(bar.current);
    return () => ro?.disconnect();
  }, [measure, sport?.key]);

  /** Opens section i. On its own page a section is a scroll, not a page load; the one you're in goes back to the top. */
  const go = (i, e) => {
    const s = sections[i];
    clearTimeout(settle.current);
    if (!s || (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey))) return setPending(null);
    const id = hashOf(s.href);
    const samePage = pathOf(s.href) === pathname && (id || !window.location.search);
    if (samePage) {
      e?.preventDefault();
      const el = id && document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' });
      window.history.replaceState(null, '', id ? s.href : `${pathname}`);
      setPending(id ? i : null);
      return;
    }
    setPending(i);
    if (!e) router.push(s.href);
  };

  const center = (el) => el.offsetLeft + el.offsetWidth / 2;
  const nearest = (x) => tabs.current.reduce((best, el, i) => (el && Math.abs(center(el) - x) < Math.abs(center(tabs.current[best]) - x) ? i : best), 0);
  const local = (e) => e.clientX - bar.current.getBoundingClientRect().left;
  const onDown = (e) => {
    if (e.button !== 0 || !bar.current) return;
    const at = nearest(local(e));
    press.current = { id: e.pointerId, x0: e.clientX, moved: false, at };
    swallow.current = false;
    setPending(at);
    bar.current.classList.add('sp-dock-press');
  };
  const onMove = (e) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (!p.moved && Math.abs(e.clientX - p.x0) < 8) return;
    if (!p.moved) {
      p.moved = true;
      bar.current.setPointerCapture?.(e.pointerId);
    }
    const x = local(e);
    setDrag({ x, over: nearest(x) });
  };
  const end = (e, cancelled) => {
    const p = press.current;
    press.current = null;
    bar.current?.classList.remove('sp-dock-press');
    if (!p || p.id !== e.pointerId) return;
    if (!p.moved) {
      // A tap: the link's click opens the section; without one (a long press), the lens goes back.
      clearTimeout(settle.current);
      settle.current = setTimeout(() => setPending(null), cancelled ? 0 : 600);
      return;
    }
    swallow.current = true;
    setDrag(null);
    if (cancelled) return setPending(null);
    go(nearest(local(e)));
  };

  const w = lens?.w ?? 0;
  const width = bar.current?.offsetWidth ?? 0;
  const lensX = drag ? Math.max(4, Math.min(width - w - 4, drag.x - w / 2)) : lens?.x ?? 0;

  return (
    <nav className={`sp-dock${sections.length ? '' : ' sp-dock-solo'}`} aria-label={sections.length ? `${sport.label} sections` : 'Search'}>
      {sections.length > 0 && (
        <div
          className={`sp-glass sp-dock-bar${drag ? ' sp-dock-drag' : ''}`}
          ref={bar}
          style={{ '--n': sections.length }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={(e) => end(e, false)}
          onPointerCancel={(e) => end(e, true)}
          onClickCapture={(e) => {
            if (swallow.current) {
              e.preventDefault();
              e.stopPropagation();
              swallow.current = false;
            }
          }}
        >
          {lens && <span className="sp-dock-lens" aria-hidden style={{ width: w, transform: `translateX(${lensX}px)` }} />}
          {sections.map((s, i) => {
            const Icon = ICONS[s.icon] ?? ScoresIcon;
            return (
              <Link
                key={s.href}
                href={s.href}
                ref={(el) => (tabs.current[i] = el)}
                className={i === shown ? 'sp-dock-on' : undefined}
                aria-current={i === active ? (hashOf(s.href) ? 'location' : 'page') : undefined}
                onClick={(e) => go(i, e)}
                draggable={false}
              >
                <Icon />
                <span>{s.label}</span>
              </Link>
            );
          })}
        </div>
      )}
      <button type="button" className="sp-glass sp-dock-find" onClick={onFind} aria-label="Search Matchday" aria-haspopup="dialog">
        <SearchIcon />
      </button>
    </nav>
  );
}
