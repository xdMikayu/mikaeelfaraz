// ESPN and FPL name Premier League clubs differently ("Manchester City" / "Man City",
// "Tottenham Hotspur" / "Spurs"). Match on aliases first, then on shared name words.
const ALIAS = {
  'manchester city': 'man city',
  'manchester united': 'man utd',
  'tottenham hotspur': 'spurs',
  'nottingham forest': "nott'm forest",
  'wolverhampton wanderers': 'wolves',
  'brighton & hove albion': 'brighton',
  'afc bournemouth': 'bournemouth',
  'west ham united': 'west ham',
  'newcastle united': 'newcastle',
  'sheffield united': 'sheffield utd',
};

const words = (s) => s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter((w) => w && !['fc', 'afc', 'city', 'town', 'united'].includes(w));

/** FPL team id for an ESPN club name, or null. */
export function fplTeamFor(espnName, fplTeams) {
  const n = (espnName ?? '').toLowerCase();
  const alias = ALIAS[n];
  const exact = fplTeams.find((t) => t.name.toLowerCase() === (alias ?? n));
  if (exact) return exact.id;
  const w = new Set(words(n));
  const hit = fplTeams.filter((t) => words(t.name).length && words(t.name).every((x) => w.has(x)));
  return hit.length === 1 ? hit[0].id : null;
}

/**
 * Opta's xG for both sides of a Premier League match, summed from FPL's live player data.
 * Only when each team plays once in the gameweek (FPL's live stats are per gameweek).
 */
export function optaXg(match, fplStatic, fplLive) {
  const h = fplTeamFor(match.home.name, fplStatic.teams);
  const a = fplTeamFor(match.away.name, fplStatic.teams);
  if (!h || !a) return null;
  const fx = fplLive.fixtures.find((f) => f.home === h && f.away === a);
  if (!fx || !fx.started) return null;
  const once = (t) => fplLive.fixtures.filter((f) => f.home === t || f.away === t).length === 1;
  if (!once(h) || !once(a)) return null;
  const sum = (team) =>
    fplStatic.elements.filter((e) => e.team === team).reduce((t, e) => t + (fplLive.elements[e.id]?.xg ?? 0), 0);
  return { home: sum(h), away: sum(a) };
}
