// "As it stands": the league table with every match being played counted as if it ended now, and
// what that does to two sides' places. Pure, for the match page's one-line summary.
//
// ESPN's table only takes a result once the match is final, and not at once: it can be minutes behind
// the final whistle, and this site caches it for five. So live matches are added here, and finished
// ones too until the table has them (`inTable`). Ties are split by points, then goal difference, then
// goals scored, then the table's current order: head-to-head and the other rules some leagues use
// aren't known here, so a place can be one off where those decide it.

const points = (scored, conceded) => (scored > conceded ? 3 : scored === conceded ? 1 : 0);

/** A row with a result added (`by` 1) or taken back off (`by` -1). */
const add = (r, scored, conceded, by = 1) => ({
  ...r,
  p: r.p + by,
  gf: r.gf + by * scored,
  ga: r.ga + by * conceded,
  gd: r.gd + by * (scored - conceded),
  pts: r.pts + by * points(scored, conceded),
});

const order = (rows) => rows.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.was - y.was);

/**
 * The table group (rows in ESPN's order) with these scores counted: [{ homeId, awayId, hs, as }].
 * Returns the rows re-ordered, each with its place before (`was`) and after (`at`).
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
  return order([...byId.values()]).map((r, i) => ({ ...r, at: i + 1 }));
}

/** The group a team's in, of a standings object ({ groups: [{ rows }] }). */
export const groupOf = (standings, id) => standings?.groups?.find((g) => g.rows.some((r) => r.id === id)) ?? null;

/** Games in a record, "W-D-L": "1-0-1" is 2; null without one. */
export const gamesIn = (summary) => (summary ? String(summary).split('-').reduce((t, x) => t + (Number(x) || 0), 0) : null);

const scoreOf = (m) => ({ homeId: m.home.id, awayId: m.away.id, hs: m.home.score, as: m.away.score });

/**
 * Whether the table has taken a finished match yet: true once each side's games played has gone past
 * what it was while the match was on (`seen`, by team id, kept by the page that watched it) or,
 * failing that, reached the record ESPN gives with the finished match (`games`, which includes it).
 * Null when there's no telling.
 */
export function inTable(rows, m, seen = {}) {
  const played = new Map(rows.map((r) => [r.id, r.p]));
  const side = (t) => {
    const now = played.get(t.id);
    if (now == null) return null;
    if (seen[t.id] != null) return now > seen[t.id];
    if (t.games != null) return now >= t.games;
    return null;
  };
  const h = side(m.home);
  const a = side(m.away);
  return h == null || a == null ? (h ?? a) : h && a;
}

/**
 * Where a match leaves its two sides, with the league's other matches today (`others`) counted too:
 * the ones being played as if they ended now, the finished ones until the table has them.
 *   - Live: "as it stands", from the table before it to the table with it.
 *   - Finished: from the table before it to the table after it. Once the table has the result, the
 *     table before it is the table with the result taken back off.
 * Returns { home: { from, to }, away: { from, to }, size, final } or null: before kick-off, when the
 * two aren't in one table, or when it can't be told whether the table has the result.
 */
export function standingsNow(standings, m, others = [], seen = {}) {
  const g = groupOf(standings, m.home.id);
  if (!g || !g.rows.some((r) => r.id === m.away.id) || m.status.off) return null;
  const live = m.status.state === 'in';
  const final = m.status.state === 'post';
  if (!live && !final) return null;
  let base = g.rows;
  if (final) {
    const has = inTable(g.rows, m, seen);
    if (has == null) return null;
    if (has) {
      // The table before the match: its result taken back off, the order worked out again.
      const s = scoreOf(m);
      base = order(g.rows.map((r, i) => ({ ...r, was: i + 1 })).map((r) => (r.id === s.homeId ? add(r, s.hs, s.as, -1) : r.id === s.awayId ? add(r, s.as, s.hs, -1) : r)));
    }
  }
  const counted = others.filter((x) => x.id !== m.id && !x.status.off && (x.status.state === 'in' || (x.status.state === 'post' && inTable(g.rows, x, seen) === false)));
  const after = withScores(base, [m, ...counted].map(scoreOf));
  const place = (id) => {
    const r = after.find((x) => x.id === id);
    return { from: r.was, to: r.at };
  };
  return { home: place(m.home.id), away: place(m.away.id), size: g.rows.length, final };
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
