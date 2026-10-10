'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data, then reloads every `every` ms while `live(data)` is true and the tab is visible.
 * Keeps the last good data on a failed reload, so a blip never blanks the page.
 */
export function useLive(load, deps, { every = 20000, live = () => false } = {}) {
  const [state, setState] = useState({ data: null, error: null, at: null, loading: true });
  const ctrl = useRef(null);
  const liveRef = useRef(live);
  liveRef.current = live;

  const run = useCallback(async () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    try {
      const data = await load(c.signal);
      if (!c.signal.aborted) setState({ data, error: null, at: Date.now(), loading: false });
    } catch (e) {
      if (e.name === 'AbortError') return;
      setState((s) => ({ ...s, error: e.message || String(e), loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    setState({ data: null, error: null, at: null, loading: true });
    run();
    return () => ctrl.current?.abort();
  }, [run]);

  useEffect(() => {
    let t;
    const tick = () => {
      t = setTimeout(async () => {
        if (document.visibilityState === 'visible' && liveRef.current(state.data)) await run();
        tick();
      }, every);
    };
    tick();
    // Coming back to the tab after a while: refresh at once rather than waiting for the timer.
    const onVis = () => {
      if (document.visibilityState === 'visible' && state.at && Date.now() - state.at > every) run();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [run, every, state.data, state.at]);

  return { ...state, refresh: run };
}

/** "Updated 14 s ago", re-rendered every few seconds. */
export function useAge(at) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);
  if (!at) return null;
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 5) return 'Updated just now';
  if (s < 60) return `Updated ${s} s ago`;
  const m = Math.round(s / 60);
  return `Updated ${m} min ago`;
}

export function Freshness({ at, error, live, every = 20, light = false }) {
  const age = useAge(at);
  const stale = at && Date.now() - at > every * 3000;
  return (
    <span className={`sp-tiny sp-num${light ? '' : ' sp-muted'}`} aria-live="polite">
      {error && !at ? `Couldn’t load: ${error}` : error ? `${age}. Last refresh failed, trying again.` : age}
      {live && !error && !stale ? `, refreshing every ${every} s` : ''}
      {stale && !error ? '. This may be out of date.' : ''}
    </span>
  );
}
