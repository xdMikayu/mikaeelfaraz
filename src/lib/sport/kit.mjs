// The forecasting kit (team ratings, role tilts, FPL ↔ ESPN ids) from the matchup data files.
// One definition for the browser hook, the build scripts and the advice route.
import { rateTeams, goalRates } from './forecast.mjs';
import { roleFactor } from './matchups.mjs';
import { buildModel, withMatchups, projectedBonus } from './fpl.mjs';

/** ix: index.json; learned: netxg-model.json (optional; the position tilt counts at its learned weight). */
export function makeKit(ix, learned) {
  const [, last] = ix.seasons;
  const playedLast = new Set(Object.entries(ix.games).filter(([, g]) => g.some((x) => x[0] >= `${last}-07` && x[0] < `${Number(last) + 1}-07`)).map(([id]) => id));
  const ratings = rateTeams(ix.games, { newTeams: ix.current.filter((id) => !playedLast.has(id)) });
  const wPos = learned?.xg?.weights?.position ?? 1;
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
}

/** ctx as the Fantasy page builds it, from getStatic() and a live gameweek (or none). */
export function makeCtx(st, kit, live = { elements: {}, fixtures: [] }) {
  return {
    elements: Object.fromEntries(st.elements.map((e) => [e.id, e])),
    live: live.elements,
    fixtures: live.fixtures,
    bonus: projectedBonus(live.fixtures),
    model: kit ? withMatchups(buildModel(st.elements), kit) : buildModel(st.elements),
  };
}
