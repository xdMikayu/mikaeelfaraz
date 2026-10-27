// The forecasting kit (team ratings, role tilts, FPL ↔ ESPN ids) from the matchup data files.
// One definition for the browser hook, the build scripts and the advice route.
import { rateTeams, goalRates } from './forecast.mjs';
import { roleFactor } from './matchups.mjs';
import { buildModel, withMatchups, projectedBonus } from './fpl.mjs';

/**
 * ix: index.json; learned: netxg-model.json (optional; the position tilt counts at its learned weight);
 * fpl: fpl-model.json (optional; what the projections learned from past gameweeks, used when its own
 * check passed).
 */
export function makeKit(ix, learned, fpl = null) {
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
    fpl: fpl?.use ? fpl : null,
  };
}

/**
 * ctx as the Fantasy page builds it, from getStatic() and a live gameweek (or none). byFixture: the
 * bookmakers' expected goals by FPL fixture id (/api/sport/odds), used in place of the model's
 * where a match is priced. recent: getRecent().players, each player's last three matches, for the
 * learned minutes.
 */
export function makeCtx(st, kit, live = { elements: {}, fixtures: [] }, byFixture = null, recent = null) {
  const model = kit ? withMatchups(buildModel(st.elements), kit) : buildModel(st.elements);
  return {
    elements: withRecent(st.elements, recent),
    live: live.elements,
    fixtures: live.fixtures,
    bonus: projectedBonus(live.fixtures),
    model: byFixture && Object.keys(byFixture).length ? { ...model, byFixture } : model,
  };
}

/** Elements by id, each with his last three matches (getRecent().players) when they're known. */
export function withRecent(elements, recent) {
  return Object.fromEntries(elements.map((e) => [e.id, recent ? { ...e, recent: recent[e.id] ?? [] } : e]));
}
