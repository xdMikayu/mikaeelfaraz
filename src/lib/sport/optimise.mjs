// Squad optimisation on top of projectAhead's per-gameweek expected points.
//   bestXI         the highest-scoring legal eleven for a gameweek, captain doubled
//   planTransfers  a multi-gameweek transfer plan by beam search, with free transfers, hits,
//                  budget and the three-per-club rule
//   buildSquad     the best fifteen from scratch under a budget (wildcard over a horizon, free hit
//                  for one gameweek) by greedy construction and swap search
//   rotationPairs  pairs of cheap players from two clubs whose fixtures alternate best
// All of it is our projection, so it's only as good as projectAhead; the page says so.

const MIN_XI = { 1: 1, 2: 3, 3: 2, 4: 1 };
const MAX_XI = { 1: 1, 2: 5, 3: 5, 4: 3 };
export const SQUAD = { 1: 2, 2: 5, 3: 5, 4: 3 };
const BENCH_WEIGHT = 0.1; // the bench only scores through autosubs
const HIT = 4;

const xpOf = (ahead, id, gw) => ahead[id]?.per[gw]?.xp ?? 0;

/** Best legal XI for one gameweek: { points, xi, captain, bench }. */
export function bestXI(ids, gw, ahead, els) {
  const by = { 1: [], 2: [], 3: [], 4: [] };
  for (const id of ids) by[els[id].type]?.push(id);
  for (const t of [1, 2, 3, 4]) by[t].sort((a, b) => xpOf(ahead, b, gw) - xpOf(ahead, a, gw));
  const xi = [];
  const count = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const t of [1, 2, 3, 4]) {
    for (const id of by[t].slice(0, MIN_XI[t])) {
      xi.push(id);
      count[t] += 1;
    }
  }
  const rest = [2, 3, 4].flatMap((t) => by[t].slice(MIN_XI[t])).sort((a, b) => xpOf(ahead, b, gw) - xpOf(ahead, a, gw));
  for (const id of rest) {
    if (xi.length >= 11) break;
    const t = els[id].type;
    if (count[t] >= MAX_XI[t]) continue;
    xi.push(id);
    count[t] += 1;
  }
  const inXi = new Set(xi);
  const bench = ids.filter((id) => !inXi.has(id));
  const captain = xi.reduce((b, id) => (xpOf(ahead, id, gw) > xpOf(ahead, b, gw) ? id : b), xi[0]);
  const points = xi.reduce((t, id) => t + xpOf(ahead, id, gw), 0) + xpOf(ahead, captain, gw) + BENCH_WEIGHT * bench.reduce((t, id) => t + xpOf(ahead, id, gw), 0);
  return { points, xi, captain, bench };
}

const valueOver = (ids, gws, ahead, els) => gws.reduce((t, gw) => t + bestXI(ids, gw, ahead, els).points, 0);
const clubsOk = (ids, els) => {
  const c = {};
  for (const id of ids) if ((c[els[id].team] = (c[els[id].team] ?? 0) + 1) > 3) return false;
  return true;
};

/** Free transfers after one gameweek: spent ones go, one is added, up to five banked; chips keep them. */
export const nextFree = (ft, used, chip) => Math.min(5, (chip ? ft : Math.max(0, ft - used)) + 1);

/** Estimated free transfers for the next deadline from the entry's history (FPL doesn't publish it). */
export function estimateFree(history, chips, upTo) {
  let ft = 1;
  for (const h of history.filter((x) => x.event >= 2 && x.event <= upTo).sort((a, b) => a.event - b.event)) {
    const chip = chips.some((c) => c.event === h.event && (c.name === 'wildcard' || c.name === 'freehit'));
    ft = nextFree(ft, h.transfers ?? 0, chip);
  }
  return ft;
}

/**
 * Multi-gameweek transfer plan. Each gameweek it considers no move, the best single transfers and
 * pairs of them, keeps the best `beam` plans by projected points over the rest of the horizon, and
 * returns the best plan: [{ gw, moves: [{ out, in }], hit, points }], total and the no-transfer total.
 * mode: 'conservative' (no hits), 'balanced' (one hit a week at most), 'aggressive' (two).
 */
export function planTransfers({ squad, bank, free, gws, ahead, els, mode = 'balanced', beam = 24, pool = 10 }) {
  const maxHits = { conservative: 0, balanced: 1, aggressive: 2 }[mode] ?? 1;
  const total = (id) => gws.reduce((t, gw) => t + xpOf(ahead, id, gw), 0);
  // Candidates: the best few per position by projected points over the horizon.
  const candidates = { 1: [], 2: [], 3: [], 4: [] };
  for (const id of Object.keys(ahead).map(Number)) {
    const e = els[id];
    if (!e || e.status === 'u' || e.status === 'i' || e.status === 's') continue;
    candidates[e.type].push(id);
  }
  for (const t of [1, 2, 3, 4]) candidates[t] = candidates[t].sort((a, b) => total(b) - total(a)).slice(0, pool * (t === 1 ? 1 : 2));

  const base = valueOver(squad, gws, ahead, els);
  let states = [{ squad: [...squad], bank, free, hits: 0, plan: [], score: base }];
  gws.forEach((gw, gi) => {
    const rest = gws.slice(gi);
    const next = [];
    for (const s of states) {
      const owned = new Set(s.squad);
      const singles = [];
      for (const out of s.squad) {
        const eo = els[out];
        for (const inn of candidates[eo.type]) {
          if (owned.has(inn) || els[inn].cost > eo.cost + s.bank + 1e-9) continue;
          const sq = s.squad.map((x) => (x === out ? inn : x));
          if (!clubsOk(sq, els)) continue;
          singles.push({ out, in: inn, gain: total(inn) - total(out) });
        }
      }
      singles.sort((a, b) => b.gain - a.gain);
      const options = [[]];
      for (const m of singles.slice(0, 25)) options.push([m]);
      const top = singles.slice(0, 8);
      for (let i = 0; i < top.length; i++) {
        for (let j = i + 1; j < top.length; j++) {
          if (top[i].out === top[j].out || top[i].in === top[j].in) continue;
          options.push([top[i], top[j]]);
        }
      }
      for (const moves of options) {
        const hits = Math.max(0, moves.length - s.free);
        if (hits > maxHits) continue;
        let sq = s.squad;
        let money = s.bank;
        for (const m of moves) {
          sq = sq.map((x) => (x === m.out ? m.in : x));
          money += els[m.out].cost - els[m.in].cost;
        }
        if (money < -1e-9 || !clubsOk(sq, els)) continue;
        const done = s.plan.reduce((t, p) => t + p.points, 0);
        const ahead2 = valueOver(sq, rest, ahead, els);
        const points = bestXI(sq, gw, ahead, els).points;
        next.push({
          squad: sq,
          bank: money,
          free: nextFree(s.free, moves.length, false),
          hits: s.hits + hits,
          plan: [...s.plan, { gw, moves: moves.map(({ out, in: inn }) => ({ out, in: inn })), hit: hits * HIT, points }],
          // A banked transfer is worth something later; a small credit stops the search spending it on noise.
          score: done + ahead2 - (s.hits + hits) * HIT + 0.6 * Math.min(nextFree(s.free, moves.length, false), 3),
        });
      }
    }
    // Keep the best distinct plans.
    const seen = new Set();
    states = next
      .sort((a, b) => b.score - a.score)
      .filter((s) => {
        const k = [...s.squad].sort((a, b) => a - b).join(',') + `|${s.free}`;
        return seen.has(k) ? false : seen.add(k);
      })
      .slice(0, beam);
  });
  const best = states.sort((a, b) => b.plan.reduce((t, p) => t + p.points - p.hit, 0) - a.plan.reduce((t, p) => t + p.points - p.hit, 0))[0];
  const totalPoints = best.plan.reduce((t, p) => t + p.points - p.hit, 0);
  return { plan: best.plan, total: totalPoints, hold: base, gain: totalPoints - base, squad: best.squad, bank: best.bank };
}

/**
 * Best fifteen from scratch: greedy by points per million, then swap any player for a better one
 * while the budget and club limits allow, until nothing improves. gws: one gameweek for a free hit,
 * several for a wildcard.
 */
export function buildSquad({ budget, gws, ahead, els, keep = [] }) {
  const total = (id) => gws.reduce((t, gw) => t + xpOf(ahead, id, gw), 0);
  const ids = Object.keys(ahead)
    .map(Number)
    .filter((id) => els[id] && !['u', 'i', 's'].includes(els[id].status));
  const byType = { 1: [], 2: [], 3: [], 4: [] };
  for (const id of ids) byType[els[id].type].push(id);
  for (const t of [1, 2, 3, 4]) byType[t].sort((a, b) => total(b) - total(a));
  const cost = (sq) => sq.reduce((t, id) => t + els[id].cost, 0);

  // Start: the cheapest legal squad, then upgrade.
  let squad = [...keep];
  for (const t of [1, 2, 3, 4]) {
    const need = SQUAD[t] - squad.filter((id) => els[id].type === t).length;
    const cheap = [...byType[t]].filter((id) => !squad.includes(id)).sort((a, b) => els[a].cost - els[b].cost || total(b) - total(a));
    for (const id of cheap) {
      if (squad.filter((x) => els[x].type === t).length >= SQUAD[t]) break;
      if (need <= 0) break;
      if (!clubsOk([...squad, id], els)) continue;
      squad.push(id);
    }
  }
  let value = valueOver(squad, gws, ahead, els);
  for (let round = 0; round < 40; round++) {
    let best = null;
    const money = budget - cost(squad);
    for (const out of squad) {
      if (keep.includes(out)) continue;
      const eo = els[out];
      for (const inn of byType[eo.type].slice(0, 40)) {
        if (squad.includes(inn) || els[inn].cost > eo.cost + money + 1e-9) continue;
        const sq = squad.map((x) => (x === out ? inn : x));
        if (!clubsOk(sq, els)) continue;
        const v = valueOver(sq, gws, ahead, els);
        if (v > value + 0.01 && (!best || v > best.v)) best = { sq, v };
      }
    }
    if (!best) break;
    squad = best.sq;
    value = best.v;
  }
  return { squad, value, cost: cost(squad) };
}

/**
 * Two cheap players from different clubs to share one squad spot: each gameweek you start whichever
 * projects higher. Ranks every pair of clubs by that combined total over the horizon.
 * type: FPL position; maxCost: price ceiling (£m); minStartShare: how nailed a player must be.
 */
export function rotationPairs({ type, maxCost, gws, ahead, els, teamsPlayed, minStartShare = 0.6, limit = 8 }) {
  const total = (id) => gws.reduce((t, gw) => t + xpOf(ahead, id, gw), 0);
  // Each club's best nailed option under the ceiling.
  const pick = {};
  for (const id of Object.keys(ahead).map(Number)) {
    const e = els[id];
    if (!e || e.type !== type || e.cost > maxCost + 1e-9 || ['u', 'i', 's'].includes(e.status)) continue;
    const played = Math.max(1, teamsPlayed[e.team] ?? 1);
    if ((e.starts ?? 0) / played < minStartShare) continue;
    if (!pick[e.team] || total(id) > total(pick[e.team])) pick[e.team] = id;
  }
  const options = Object.values(pick);
  const pairs = [];
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      const a = options[i];
      const b = options[j];
      const weeks = gws.map((gw) => {
        const xa = xpOf(ahead, a, gw);
        const xb = xpOf(ahead, b, gw);
        return { gw, a: xa, b: xb, pick: xa >= xb ? a : b, best: Math.max(xa, xb) };
      });
      const sum = weeks.reduce((t, w) => t + w.best, 0);
      // A real rotation: each player gets the nod in at least a third of the weeks.
      const share = Math.min(weeks.filter((w) => w.pick === a).length, weeks.filter((w) => w.pick === b).length);
      if (gws.length >= 3 && share < Math.ceil(gws.length / 3)) continue;
      pairs.push({ a, b, weeks, total: sum, alone: Math.max(total(a), total(b)), cost: els[a].cost + els[b].cost });
    }
  }
  // Also say who's best on his own, so a rotation is only chosen when it beats simply owning him.
  const single = options.sort((x, y) => total(y) - total(x))[0] ?? null;
  return { pairs: pairs.sort((x, y) => y.total - x.total).slice(0, limit), single, singleTotal: single ? total(single) : 0 };
}
