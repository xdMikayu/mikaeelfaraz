// "As it stands": the league table with every match being played counted as if it ended now, and
// what that does to two sides' places. Pure, for the match page's one-line summary.
//
// ESPN's table only takes a result once the match is final, so live matches are added here; finished
// ones are left alone (they're in the table, or about to be). Ties are split by points, then goal
// difference, then goals scored, then the table's current order: head-to-head and the other rules
// some leagues use aren't known here, so a place can be one off where those decide it.

const add = (r, scored, conceded) => ({
  ...r,
  p: r.p + 1,
  gf: r.gf + scored,
  ga: r.ga + conceded,
  gd: r.gd + scored - conceded,
  pts: r.pts + (scored > conceded ? 3 : scored === conceded ? 1 : 0),
});

/**
 * The table group (rows in ESPN's order) with these scores counted: [{ homeId, awayId, hs, as }].
 * Returns the rows re-ordered, each with its new position `at`.
 */
export function withScores(rows, scores) {
  const byId = new Map(rows.map((r, i) => [r.id, { ...r, was: i + 1 }]));
  for (const s of scores) {
    const h = byId.get(s.homeId);
    const a = byId.get(s.awayId);
    if (!h || !a || s.hs == null || s.as == null) continue;
    byId.set(s.homeId, add(h, s.hs, s.as));
    byId.set(s.awayId, add(a, s.as, s.hs));
  }
  return [...byId.values()].sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.was - y.was).map((r, i) => ({ ...r, at: i + 1 }));
}

/** The group a team's in, of a standings object ({ groups: [{ rows }] }). */
export const groupOf = (standings, id) => standings?.groups?.find((g) => g.rows.some((r) => r.id === id)) ?? null;

/**
 * Where two sides would be if every live match in their group ended now.
 * `live`: the matches being played (with this one), each { home: { id, score }, away: { id, score } }.
 * Returns { home: { from, to }, away: { from, to }, size } or null when they aren't in one table.
 */
export function asItStands(standings, homeId, awayId, live) {
  const g = groupOf(standings, homeId);
  if (!g || !g.rows.some((r) => r.id === awayId)) return null;
  const scores = live.map((m) => ({ homeId: m.home.id, awayId: m.away.id, hs: m.home.score, as: m.away.score }));
  const after = withScores(g.rows, scores);
  const place = (id) => {
    const r = after.find((x) => x.id === id);
    return { from: r.was, to: r.at };
  };
  return { home: place(homeId), away: place(awayId), size: g.rows.length };
}

/**
 * Before kick-off: where each side would go with a win, everything else as it is.
 * Returns { home: place if the home side win, away: place if the away side win }.
 */
export function ifTheyWin(standings, homeId, awayId) {
  const g = groupOf(standings, homeId);
  if (!g || !g.rows.some((r) => r.id === awayId)) return null;
  const at = (hs, as, id) => withScores(g.rows, [{ homeId, awayId, hs, as }]).find((r) => r.id === id);
  const h = at(1, 0, homeId);
  const a = at(0, 1, awayId);
  return { home: { from: h.was, to: h.at }, away: { from: a.was, to: a.at }, size: g.rows.length };
}

const ordinal = (n) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** "go top", "go up to 3rd", "drop to 18th", "stay 4th": a move in words. */
export function moveWords({ from, to }) {
  if (to === from) return to === 1 ? 'stay top' : `stay ${ordinal(to)}`;
  if (to === 1) return 'go top';
  return to < from ? `go up to ${ordinal(to)}` : `drop to ${ordinal(to)}`;
}
