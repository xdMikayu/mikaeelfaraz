// The same forecasting kit the Fantasy page builds in the browser (matchupData.js useForecastKit),
// for scripts that need projections server-side.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rateTeams, goalRates } from '../../src/lib/sport/forecast.mjs';
import { roleFactor } from '../../src/lib/sport/matchups.mjs';
import { buildModel, withMatchups, projectedBonus } from '../../src/lib/sport/fpl.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA = join(ROOT, 'public/sport/data/pl');
export const readJson = async (path, d = null) => {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return d;
  }
};

export async function loadKit() {
  const ix = await readJson(join(DATA, 'index.json'));
  const learned = await readJson(join(DATA, 'netxg-model.json'));
  const nx = await readJson(join(DATA, 'netxg.json'));
  const [, last] = ix.seasons;
  const playedLast = new Set(Object.entries(ix.games).filter(([, g]) => g.some((x) => x[0] >= `${last}-07` && x[0] < `${Number(last) + 1}-07`)).map(([id]) => id));
  const ratings = rateTeams(ix.games, { newTeams: ix.current.filter((id) => !playedLast.has(id)) });
  const wPos = learned?.xg?.weights?.position ?? 1;
  const kit = {
    ix,
    ratings,
    goalRates,
    fplTeams: ix.fplTeams,
    roles: ix.roles,
    roleFactorRaw: (opp, role) => roleFactor(ix.conceded[opp], ix.league, role, ix.seasons).factor,
    roleFactor: (opp, role) => roleFactor(ix.conceded[opp], ix.league, role, ix.seasons).factor ** wPos,
  };
  return { kit, learned, nx };
}

/** ctx as FantasyView builds it, from getStatic() and a live/fixtures list. */
export function makeCtx(st, kit, live = { elements: {}, fixtures: [] }) {
  return {
    elements: Object.fromEntries(st.elements.map((e) => [e.id, e])),
    live: live.elements,
    fixtures: live.fixtures,
    bonus: projectedBonus(live.fixtures),
    model: withMatchups(buildModel(st.elements), kit),
  };
}
