'use client';
import { useEffect, useMemo, useState } from 'react';
import { makeKit } from '@/lib/sport/kit.mjs';

// The Premier League matchup data is built weekly into static files (scripts/sport/build-matchups.mjs)
// and served from the CDN like any image, so reading it costs nothing per visit.
const BASE = '/sport/data/pl';
const loads = {};

function load(path) {
  loads[path] ??= fetch(`${BASE}/${path}`).then((r) => {
    if (!r.ok) throw new Error(`Matchup data ${r.status}`);
    return r.json();
  });
  loads[path].catch(() => delete loads[path]);
  return loads[path];
}

function useJson(path) {
  const [state, set] = useState({ data: null, error: null });
  useEffect(() => {
    if (!path) return;
    let on = true;
    load(path).then(
      (data) => on && set({ data, error: null }),
      (e) => on && set({ data: null, error: e.message })
    );
    return () => {
      on = false;
    };
  }, [path]);
  return state;
}

export const useMatchupIndex = () => useJson('index.json');
/** Net xG inputs per FPL player: long-run, recent and per-opponent [minutes, xG, xA]. */
export const useNetXgData = () => useJson('netxg.json');
/** Learned Net xG weights and their test results (scripts/sport/fit-netxg.mjs). */
export const useNetXgModel = () => useJson('netxg-model.json');
/** Our graded record: projections saved before each deadline against what happened (scripts/sport/accuracy.mjs). */
export const useAccuracy = () => useJson('accuracy.json');
/** Every match row for one club's current players: { espnId: { n, rows } }. */
export const usePlayerLog = (espnTeam) => useJson(espnTeam ? `players-${espnTeam}.json` : null);

/** Team ratings and role factors from the index, ready for fpl.mjs withMatchups and match odds. */
export function useForecastKit(ix, learned) {
  return useMemo(() => (ix ? makeKit(ix, learned) : null), [ix, learned]);
}
