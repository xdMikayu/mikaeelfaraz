// The arithmetic behind Fantasy › Stats' DEFCON chart: defensive contributions per 90 against expected
// goal involvement per 90, with curves through the players those two make worth the same. A player's
// worth here is his expected points per 90 from defensive contributions (fpl.mjs defconPoints90) plus
// goals and assists (attackPoints90); clean sheets are the team's doing.
import { attackPoints90, defconPoints90, GOAL_PTS } from './fpl.mjs';

/**
 * One row per player at the position with at least `minMinutes`: his per-90 rates and their worth.
 * players: [{ id, el, min, dc, xg, xa }], the stats tab's numbers for its period; sources:
 * { id: { apps, dcHits } }, how often his contributions reached FPL's line in that period.
 */
export function defconRows(players, type, minMinutes, sources = null) {
  return players
    .filter((p) => p.el?.type === type && p.min >= minMinutes)
    .map((p) => {
      const f = 90 / p.min;
      const dc90 = (p.dc ?? 0) * f;
      const xg90 = (p.xg ?? 0) * f;
      const xa90 = (p.xa ?? 0) * f;
      const def = defconPoints90(type, dc90);
      const att = attackPoints90(type, xg90, xa90);
      const s = sources?.[p.id];
      return { id: p.id, el: p.el, min: p.min, dc90, xg90, xa90, xgi90: xg90 + xa90, def, att, value: def + att, apps: s?.apps ?? null, hits: s?.dcHits ?? null };
    });
}

/** What an expected goal involvement is worth at the position, at its players' own mix of goals and assists. */
export function pointsPerXgi(rows, type) {
  const xg = rows.reduce((t, r) => t + r.xg90 * r.min, 0);
  const xgi = rows.reduce((t, r) => t + r.xgi90 * r.min, 0);
  const share = xgi > 0 ? xg / xgi : 0.5;
  return (GOAL_PTS[type] ?? 0) * share + 3 * (1 - share);
}

/** Up to three round levels for the curves, lowest first, the top one at or just under the best player. */
export function samePointsLevels(values) {
  const best = Math.max(0, ...values);
  const step = best >= 4 ? 1 : 0.5;
  const top = Math.floor(best / step) * step;
  return [top - 2 * step, top - step, top].filter((v) => v >= 0.5);
}

/**
 * Players worth `level` points per 90 from the two together, as [DC per 90, xGI per 90] from no
 * defensive contributions up to `xMax`: xGI = (level − DEFCON points) / points per xGI. The curve
 * falls most around FPL's line, where reaching it turns likely; it stops where it meets zero xGI.
 */
export function samePointsLine(level, type, perXgi, xMax, steps = 80) {
  const y = (x) => (level - defconPoints90(type, x)) / perXgi;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const x = (xMax * i) / steps;
    if (y(x) >= 0) {
      pts.push([x, y(x)]);
      continue;
    }
    // Where it crosses zero, between the last step and this one.
    let lo = (xMax * (i - 1)) / steps;
    let hi = x;
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2;
      if (y(mid) >= 0) lo = mid;
      else hi = mid;
    }
    pts.push([lo, 0]);
    break;
  }
  return pts;
}
