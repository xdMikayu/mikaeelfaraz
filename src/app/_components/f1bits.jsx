'use client';
import { useEffect, useState } from 'react';
import { usePrefs } from './prefs';

// Shared pieces of the F1 pages: one request per URL however many parts ask for it, each team's
// colour from the session data's index (F1's own, via FastF1), and a driver with his team's mark.

const loads = {};
function load(url) {
  loads[url] ??= fetch(url).then(async (r) => {
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(body.error || `${r.status}`), { status: r.status });
    return body;
  });
  loads[url].catch(() => delete loads[url]);
  return loads[url];
}

/** { data, error } for a JSON URL; nothing is asked for while url is null. */
export function useJson(url) {
  const [state, set] = useState({ url: null, data: null, error: null });
  useEffect(() => {
    if (!url) return undefined;
    let on = true;
    load(url).then(
      (data) => on && set({ url, data, error: null }),
      (error) => on && set({ url, data: null, error }),
    );
    return () => {
      on = false;
    };
  }, [url]);
  return state.url === url ? state : { data: null, error: null };
}

/** The session data's index for a season: which sessions are on file, every team's colour. */
export const useF1Index = (season) => useJson(season ? `/api/f1/data/${season}/index` : null);

/** A team's colour as CSS, or null when the index doesn't have it yet. */
export const teamColor = (index, team) => (index?.teams?.[team]?.color ? `#${index.teams[team].color}` : null);

/** A team's name as F1 has it ("Racing Bulls", not Jolpica's "RB F1 Team"), where the index knows it. */
export const teamName = (index, team) => index?.teams?.[team?.id]?.name ?? team?.name ?? null;

/** The thin bar in a team's colour that marks its drivers, as on F1's own graphics. */
export function Mark({ color }) {
  return <i className="sp-f1-mark" style={{ background: color ?? 'var(--sp-rule-2)' }} aria-hidden="true" />;
}

/** "Max Verstappen" with his team's mark and, under it, the team; the surname alone on phones. */
export function Driver({ d, color, short = false, team }) {
  return (
    <span className="sp-f1-driver">
      <Mark color={color} />
      <span>
        <span>
          {!short && <span className="sp-hide-sm">{d.first} </span>}
          <b>{d.last}</b>
        </span>
        {team && <small className="sp-muted">{team}</small>}
      </span>
    </span>
  );
}

/** "Singapore Grand Prix" → "Singapore", for tight rows. */
export const shortRace = (name) => (name ?? '').replace(/\s*Grand Prix$/i, '');

/**
 * Spoiler mode for F1: with spoilers hidden everywhere, results wait for a tap, remembered for the
 * visit like the football tables. { hidden, reveal }.
 */
export function useF1Reveal(key) {
  const { prefs } = usePrefs();
  const [shown, setShown] = useState(false);
  const store = `md-reveal-f1-${key}`;
  useEffect(() => {
    try {
      setShown(sessionStorage.getItem(store) === '1');
    } catch {}
  }, [store]);
  const reveal = () => {
    setShown(true);
    try {
      sessionStorage.setItem(store, '1');
    } catch {}
  };
  return { hidden: prefs.spoilers === 'all' && !shown, reveal };
}

/** The tap that shows hidden results. */
export function Reveal({ onReveal, what = 'results' }) {
  return (
    <div className="sp-empty" style={{ padding: '24px 16px' }}>
      <p style={{ margin: '0 0 12px' }}>Spoiler mode is hiding the {what}.</p>
      <button className="sp-btn sp-btn-primary" onClick={onReveal}>
        Show the {what}
      </button>
    </div>
  );
}
