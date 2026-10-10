'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LEAGUES } from '@/lib/sport/leagues.mjs';

// Everything the viewer chooses lives in their own browser; there are no accounts.
const KEY = 'md-prefs-v1';

export const DEFAULTS = {
  order: LEAGUES.map((l) => l.slug),
  off: LEAGUES.filter((l) => !l.on).map((l) => l.slug),
  teams: [], // { id, name, logo, leagues: [slug] }
  spoilers: 'off', // off | mine | all
  alerts: false,
  theme: 'system', // system | light | dark
  fplEntry: null,
  fplLeague: null,
  fplRival: {}, // league id -> the manager you last compared yourself with there
};

function read() {
  try {
    const p = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    // Competitions added after the viewer saved their order go to the end, in their default state.
    for (const l of LEAGUES) {
      if (!p.order.includes(l.slug)) {
        p.order = [...p.order, l.slug];
        if (!l.on && !p.off.includes(l.slug)) p.off = [...p.off, l.slug];
      }
    }
    p.order = p.order.filter((s) => LEAGUES.some((l) => l.slug === s));
    return p;
  } catch {
    return DEFAULTS;
  }
}

const PrefsContext = createContext(null);

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setPrefs(read());
    setReady(true);
  }, []);
  const update = useCallback((patch) => {
    setPrefs((p) => {
      const next = { ...p, ...(typeof patch === 'function' ? patch(p) : patch) };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  useEffect(() => {
    if (!ready) return;
    const el = document.documentElement;
    if (prefs.theme === 'system') el.removeAttribute('data-sport-theme');
    else el.setAttribute('data-sport-theme', prefs.theme);
  }, [prefs.theme, ready]);
  const value = useMemo(() => ({ prefs, update, ready }), [prefs, update, ready]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);

export function useFollow() {
  const { prefs, update } = usePrefs();
  const ids = useMemo(() => new Set(prefs.teams.map((t) => t.id)), [prefs.teams]);
  const toggle = useCallback(
    (team) =>
      update((p) => ({
        teams: p.teams.some((t) => t.id === team.id) ? p.teams.filter((t) => t.id !== team.id) : [...p.teams, team],
      })),
    [update]
  );
  return { ids, teams: prefs.teams, toggle, isFollowed: (id) => ids.has(String(id)) };
}

/** Whether to hide this match's score, and a way to reveal it for the rest of the visit. */
export function useSpoiler(match) {
  const { prefs } = usePrefs();
  const [shown, setShown] = useState(false);
  const key = match ? `md-reveal-${match.id}` : null;
  useEffect(() => {
    if (!key) return;
    try {
      setShown(sessionStorage.getItem(key) === '1');
    } catch {}
  }, [key]);
  const followed = match && prefs.teams.some((t) => t.id === match.home.id || t.id === match.away.id);
  const applies = match && match.status.state !== 'pre' && (prefs.spoilers === 'all' || (prefs.spoilers === 'mine' && followed));
  const reveal = () => {
    setShown(true);
    try {
      sessionStorage.setItem(key, '1');
    } catch {}
  };
  return { hidden: Boolean(applies && !shown), reveal };
}
