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

/** The FPL fixture an ESPN Premier League match is: the same clubs, kicking off within a day and a half. */
export function fplFixtureFor(match, fplTeams, fixtures) {
  const h = fplTeamFor(match.home.name, fplTeams);
  const a = fplTeamFor(match.away.name, fplTeams);
  if (!h || !a) return null;
  const t = Date.parse(match.date);
  return fixtures.find((f) => f.home === h && f.away === a && (!f.kickoff || Math.abs(Date.parse(f.kickoff) - t) < 36 * 3600e3)) ?? null;
}

const fold = (s) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Each player's FPL live numbers for one match, keyed by ESPN athlete id: through the matchup data's
 * FPL-to-ESPN map where it has the player, else by name within the club. Only for clubs with one fixture in
 * the gameweek, since FPL's live numbers are per gameweek.
 */
export function fplPlayersFor(lineups, fplStatic, fplLive, fx, espnOfFpl = {}) {
  const once = (t) => fplLive.fixtures.filter((f) => f.home === t || f.away === t).length === 1;
  const out = {};
  for (const [side, team] of [['home', fx.home], ['away', fx.away]]) {
    if (!once(team)) continue;
    const espn = [...(lineups?.[side]?.starters ?? []), ...(lineups?.[side]?.bench ?? [])];
    const byName = new Map(espn.map((p) => [fold(p.name), p.id]));
    const byLast = new Map();
    for (const p of espn) {
      const k = fold(p.last);
      byLast.set(k, byLast.has(k) ? null : p.id); // a surname two of them share can't pick one
    }
    const ids = new Set(espn.map((p) => p.id));
    const pool = fplStatic.elements.filter((x) => x.team === team && fplLive.elements[x.id]);
    // Sure matches first (the matchup data's map, the full name, FPL's short name), then a surname
    // for anyone who played and is still unmatched.
    const left = [];
    for (const e of pool) {
      const mapped = espnOfFpl[e.id];
      const id = (mapped && ids.has(mapped) ? mapped : null) ?? byName.get(fold(`${e.first} ${e.second}`)) ?? byName.get(fold(e.name));
      if (id && !out[id]) out[id] = fplLive.elements[e.id];
      else if (!id) left.push(e);
    }
    for (const e of left) {
      if (!(fplLive.elements[e.id].minutes > 0)) continue;
      const id = byLast.get(fold(e.second)) ?? byLast.get(fold(e.name));
      if (id && !out[id]) out[id] = fplLive.elements[e.id];
    }
  }
  return out;
}
