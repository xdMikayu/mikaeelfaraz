// Fantasy Premier League maths on top of the compact shapes /api/sport/fpl/* returns.
// Since 2026/27 FPL puts its own live bonus into fixture stats and players' totals from about
// 20 minutes in. Where a started fixture has none yet, bonus is projected here from the live BPS.
// Bonus stays provisional until FPL marks the fixture finished.
// Autosubs and vice-captaincy are projected as if every match ended now; FPL applies them for
// real only once the gameweek's matches are done.

export const POS = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const MIN_PLAY = { 1: 1, 2: 3, 3: 2, 4: 1 }; // GK exactly 1; at least 3 DEF, 2 MID, 1 FWD

/**
 * Bonus from a fixture's BPS list: 3, 2, 1 down the table, ties share the higher award and use up
 * the places below them (two tied for first both get 3, the next gets 1).
 */
export function bonusFromBps(bps) {
  const rows = Object.entries(bps).map(([id, v]) => [Number(id), v]).sort((a, b) => b[1] - a[1]);
  const out = {};
  let placed = 0;
  let i = 0;
  while (placed < 3 && i < rows.length) {
    const v = rows[i][1];
    const group = rows.filter((r) => r[1] === v);
    for (const [id] of group) out[id] = [3, 2, 1][placed];
    placed += group.length;
    i += group.length;
  }
  return out;
}

const done = (f) => f.finished || f.finishedProvisional;

/** Per fixture: projected bonus while FPL hasn't added the real one yet. */
export function projectedBonus(fixtures) {
  const out = {};
  for (const f of fixtures) {
    if (!f.started || Object.keys(f.bonus ?? {}).length) continue;
    // FPL shows its own projection from about 20 minutes; before then BPS swing too much to mean much.
    if (!done(f) && (f.minutes ?? 0) < 20) continue;
    out[f.id] = bonusFromBps(f.bps ?? {});
  }
  return out;
}

/** What one player has done this gameweek and whether he still has a match to play. */
export function playerState(id, ctx) {
  const el = ctx.elements[id];
  const live = ctx.live[id] ?? { minutes: 0, points: 0, bonus: 0, bps: 0, explain: [] };
  const fixtures = ctx.fixtures.filter((f) => f.home === el?.team || f.away === el?.team);
  let bonus = 0;
  for (const f of fixtures) bonus += ctx.bonus[f.id]?.[id] ?? 0;
  const bonusProvisional = (live.bonus > 0 || bonus > 0) && fixtures.some((f) => !f.finished);
  const anyLeft = fixtures.some((f) => !done(f));
  const inPlay = fixtures.some((f) => f.started && !done(f));
  let status;
  if (!fixtures.length) status = 'blank';
  else if (live.minutes > 0) status = anyLeft && inPlay ? 'playing' : anyLeft ? 'to play' : 'played';
  else if (!anyLeft) status = 'did not play';
  else status = inPlay ? 'not on yet' : 'to play';
  return {
    id,
    points: live.points + bonus,
    bonusProjected: bonus,
    bonus: live.bonus + bonus,
    bonusProvisional,
    bps: live.bps,
    minutes: live.minutes,
    status,
    out: status === 'did not play' || status === 'blank',
    left: anyLeft,
    explain: live.explain,
  };
}

/**
 * A manager's live gameweek: autosubs and captaincy projected, chips applied, hits taken off.
 * picks: [{ element, position, multiplier, captain, vice }], chip: FPL chip code or null.
 */
export function teamLive(picks, chip, transferCost, ctx) {
  const rows = picks
    .map((p) => ({ ...p, type: ctx.elements[p.element]?.type, state: playerState(p.element, ctx) }))
    .sort((a, b) => a.position - b.position);
  const xi = rows.filter((r) => r.position <= 11);
  const bench = rows.filter((r) => r.position > 11);
  const subs = [];
  if (chip !== 'bboost') {
    for (const out of xi.filter((r) => r.state.out)) {
      const counts = (list) => list.reduce((c, r) => ((c[r.type] = (c[r.type] ?? 0) + 1), c), {});
      for (const b of bench) {
        if (b.used || b.state.out || b.state.minutes === 0) continue;
        if ((out.type === 1) !== (b.type === 1)) continue;
        const after = xi.filter((r) => r !== out && !r.subbedOff).concat(subs.map((s) => s.in), b);
        const c = counts(after);
        if ([1, 2, 3, 4].some((t) => (c[t] ?? 0) < MIN_PLAY[t])) continue;
        b.used = true;
        out.subbedOff = true;
        subs.push({ out, in: b });
        break;
      }
    }
  }
  const playing = chip === 'bboost' ? rows : xi.filter((r) => !r.subbedOff).concat(subs.map((s) => s.in));
  const capMult = chip === '3xc' ? 3 : 2;
  const cap = rows.find((r) => r.captain);
  const vice = rows.find((r) => r.vice);
  let captainId = cap?.element;
  if (cap?.state.out && vice && !vice.state.out && playing.includes(vice)) captainId = vice.element;
  const lines = rows.map((r) => {
    const counts = playing.includes(r);
    const mult = !counts ? 0 : r.element === captainId ? capMult : 1;
    return { ...r, counts, mult, total: r.state.points * mult, captainNow: r.element === captainId };
  });
  const gross = lines.reduce((t, l) => t + l.total, 0);
  return {
    lines,
    subs: subs.map((s) => ({ out: s.out.element, in: s.in.element })),
    captain: captainId,
    viceUsed: captainId != null && captainId !== cap?.element,
    gross,
    hit: transferCost ?? 0,
    net: gross - (transferCost ?? 0),
    toPlay: lines.filter((l) => l.counts && l.state.left).length,
    bonusProjected: lines.reduce((t, l) => t + l.state.bonusProjected * l.mult, 0),
  };
}

/** Live mini-league table, plus who in it owns and captains whom (league "effective ownership"). */
export function leagueLive(rows, ctx) {
  const table = rows
    .map((r) => {
      const live = r.picks?.length ? teamLive(r.picks, r.chip, r.hit, ctx) : null;
      const before = r.total - r.eventTotal;
      const gw = live ? live.net : r.eventTotal;
      return { ...r, live, gw, liveTotal: before + gw };
    })
    .sort((a, b) => b.liveTotal - a.liveTotal || a.rank - b.rank);
  table.forEach((r, i) => {
    r.liveRank = i + 1;
  });
  const n = table.filter((r) => r.live).length || 1;
  const own = {};
  for (const r of table) {
    if (!r.live) continue;
    for (const l of r.live.lines) {
      const o = (own[l.element] ??= { element: l.element, owners: 0, captains: 0, multSum: 0 });
      if (l.position <= 11 || r.chip === 'bboost') o.owners += 1;
      if (l.captainNow) o.captains += 1;
      o.multSum += l.mult;
    }
  }
  const ownership = Object.values(own)
    .map((o) => ({ ...o, eo: (o.multSum / n) * 100 }))
    .sort((a, b) => b.eo - a.eo);
  return { table, ownership, managers: n };
}

/** The difference a player makes to you against the league: (your multiplier - league EO) x points. */
export function swing(element, myMult, ownership, points) {
  const eo = (ownership.find((o) => o.element === element)?.eo ?? 0) / 100;
  return (myMult - eo) * points;
}

/** Point changes between two polls, for "what just happened" lines. */
export function pointChanges(prev, next, elementIds) {
  const out = [];
  for (const id of elementIds) {
    const a = prev[id];
    const b = next[id];
    if (!a || !b || a.points === b.points) continue;
    const flat = (st) => Object.fromEntries((st.explain ?? []).flatMap((f) => f.stats.map((s) => [`${f.fixture}:${s.identifier}`, s])));
    const pa = flat(a);
    const pb = flat(b);
    const why = Object.entries(pb)
      .filter(([k, s]) => (pa[k]?.points ?? 0) !== s.points)
      .map(([k, s]) => ({ stat: s.identifier, delta: s.points - (pa[k]?.points ?? 0) }));
    out.push({ element: id, delta: b.points - a.points, why });
  }
  return out;
}

export const STAT_LABEL = {
  minutes: 'Minutes',
  goals_scored: 'Goal',
  assists: 'Assist',
  clean_sheets: 'Clean sheet',
  goals_conceded: 'Goals conceded',
  own_goals: 'Own goal',
  penalties_saved: 'Penalty save',
  penalties_missed: 'Penalty miss',
  yellow_cards: 'Yellow card',
  red_cards: 'Red card',
  saves: 'Saves',
  bonus: 'Bonus',
  defensive_contribution: 'Defensive contribution',
};
