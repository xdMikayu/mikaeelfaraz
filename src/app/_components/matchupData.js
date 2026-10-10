'use client';
import { useEffect, useMemo, useState } from 'react';
import { rateTeams, goalRates } from '@/lib/sport/forecast.mjs';
import { roleFactor } from '@/lib/sport/matchups.mjs';

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
/** Every match row for one club's current players: { espnId: { n, rows } }. */
export const usePlayerLog = (espnTeam) => useJson(espnTeam ? `players-${espnTeam}.json` : null);

/** Team ratings and role factors from the index, ready for fpl.mjs withMatchups and match odds. */
export function useForecastKit(ix, learned) {
  // The position tilt counts only as much as the backtest says it predicts (1 = in full).
  const wPos = learned?.xg?.weights?.position ?? 1;
  return useMemo(() => {
    if (!ix) return null;
    const [, last] = ix.seasons;
    const playedLast = new Set(Object.entries(ix.games).filter(([, g]) => g.some((x) => x[0] >= `${last}-07` && x[0] < `${Number(last) + 1}-07`)).map(([id]) => id));
    const ratings = rateTeams(ix.games, { newTeams: ix.current.filter((id) => !playedLast.has(id)) });
    return {
      ix,
      ratings,
      goalRates,
      fplTeams: ix.fplTeams,
      roles: ix.roles,
      roleFactorRaw: (opp, role) => roleFactor(ix.conceded[opp], ix.league, role, ix.seasons).factor,
      roleFactor: (opp, role) => roleFactor(ix.conceded[opp], ix.league, role, ix.seasons).factor ** wPos,
      espnOfFpl: (fplTeam) => ix.fplTeams[fplTeam],
    };
  }, [ix, wPos]);
}
