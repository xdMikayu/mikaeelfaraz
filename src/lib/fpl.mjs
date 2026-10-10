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

// ---------------------------------------------------------------------------------------------
// Projections. A deliberately simple, explainable model built only from FPL's own season data:
//  - team strength: each side's xG for and against per match this season (from the players' xG and
//    xGC), pulled towards the league average while the sample is small, and home advantage;
//  - a player's share of his team's xG and xA while he's on the pitch, and his likely minutes from
//    starts so far and FPL's availability flag;
//  - FPL's scoring rules turn those into expected points, with clean sheets, goals conceded, saves,
//    defensive contributions, bonus and cards from Poisson rates.
// Matches in play only add what the minutes left can still bring.

const GOAL_PTS = { 1: 10, 2: 6, 3: 5, 4: 4 };
const CS_PTS = { 1: 4, 2: 4, 3: 1, 4: 0 };
const DC_NEED = { 2: 10, 3: 12, 4: 12 }; // defensive contributions for 2 points
const HOME = 1.1; // home sides create about 20% more xG than away sides in the Premier League
const PRIOR_MATCHES = 4; // league-average matches mixed into each team's rating
const PRIOR_MINUTES = 540; // league-average minutes mixed into each player's per-90 rates

const pmf = (l, max = 20) => {
  const out = [Math.exp(-l)];
  for (let k = 1; k <= max; k++) out[k] = (out[k - 1] * l) / k;
  return out;
};
/** P(X >= t) for X ~ Poisson(l). */
export const poissonTail = (l, t) => (t <= 0 ? 1 : 1 - pmf(l, t - 1).reduce((a, b) => a + b, 0));
/** E[floor((X + offset) / d)] for X ~ Poisson(l). */
export const poissonFloor = (l, d, offset = 0) => pmf(l, 25).reduce((t, p, k) => t + p * Math.floor((k + offset) / d), 0);

/** Season ratings for every team and per-position rates, from bootstrap elements. */
export function buildModel(elements) {
  const teams = {};
  const pos = {};
  for (const e of elements) {
    const t = (teams[e.team] ??= { min: 0, xg: 0, xgc: 0 });
    t.min += e.minutes ?? 0;
    t.xg += e.xg ?? 0;
    t.xgc += e.xgc ?? 0;
    const p = (pos[e.type] ??= { min: 0, xg: 0, xa: 0 });
    p.min += e.minutes ?? 0;
    p.xg += e.xg ?? 0;
    p.xa += e.xa ?? 0;
  }
  // Eleven players share every minute; each one's xGC counts the goals expected against while he's on.
  const list = Object.entries(teams).map(([id, t]) => {
    const n = t.min / 990;
    return [id, { n, rawFor: n > 0 ? t.xg / n : null, rawAgainst: n > 0 ? t.xgc / 11 / n : null }];
  });
  const totalN = list.reduce((s, [, t]) => s + t.n, 0);
  const avg = totalN > 0 ? list.reduce((s, [, t]) => s + (t.rawFor ?? 0) * t.n, 0) / totalN : 1.35;
  const shrink = (raw, n) => (raw == null ? avg : (raw * n + avg * PRIOR_MATCHES) / (n + PRIOR_MATCHES));
  const out = {};
  for (const [id, t] of list) out[id] = { ...t, for: shrink(t.rawFor, t.n), against: shrink(t.rawAgainst, t.n) };
  const per90 = Object.fromEntries(Object.entries(pos).map(([k, p]) => [k, { xg: p.min ? (p.xg / p.min) * 90 : 0, xa: p.min ? (p.xa / p.min) * 90 : 0 }]));
  return { avg: avg || 1.35, teams: out, pos: per90 };
}

/** Expected goals each side scores in this fixture, before kick-off. */
export function fixtureRates(f, model) {
  const h = model.teams[f.home] ?? { for: model.avg, against: model.avg };
  const a = model.teams[f.away] ?? { for: model.avg, against: model.avg };
  return { home: (h.for * a.against * HOME) / model.avg, away: (a.for * h.against) / HOME / model.avg };
}

const statOf = (live, fixtureId, key) => live?.explain?.find((x) => x.fixture === fixtureId)?.stats.find((s) => s.identifier === key) ?? null;

/**
 * What one player can still add in one fixture: { xp, v (variance), xg, xa, cs, mins, lamFor, lamAgainst }.
 * Finished fixtures add nothing; their points are already in his live total.
 */
export function projectFixture(id, f, ctx) {
  const el = ctx.elements[id];
  const model = ctx.model;
  const none = { xp: 0, v: 0, xg: 0, xa: 0, cs: null, mins: 0, pPlay: 0 };
  if (!el || !model || f.finished || f.finishedProvisional) return none;
  const home = f.home === el.team;
  const rates = fixtureRates(f, model);
  const lamFor = home ? rates.home : rates.away;
  const lamAgainst = home ? rates.away : rates.home;
  const team = model.teams[el.team] ?? { n: 0, rawFor: model.avg };
  const pos = model.pos[el.type] ?? { xg: 0, xa: 0 };
  const min = el.minutes ?? 0;
  // Per-90 rates, pulled towards his position's average until he has a few matches behind him.
  const xg90 = ((el.xg ?? 0) / Math.max(min, 1) * 90 * min + pos.xg * PRIOR_MINUTES) / (min + PRIOR_MINUTES);
  const xa90 = ((el.xa ?? 0) / Math.max(min, 1) * 90 * min + pos.xa * PRIOR_MINUTES) / (min + PRIOR_MINUTES);
  const teamFor90 = Math.max(0.4, team.rawFor ?? model.avg);
  const shareG = xg90 / teamFor90;
  const shareA = xa90 / teamFor90;
  const per90 = (v) => (min >= 90 ? (v / min) * 90 : 0);
  const type = el.type;
  const live = ctx.live[id];
  const left = f.started ? Math.max(0.03, Math.min(1, (90 - (f.minutes ?? 0)) / 90)) : 1;

  let mins;
  let pApp;
  let p60;
  let alreadyMins = 0;
  if (f.started) {
    alreadyMins = statOf(live, f.id, 'minutes')?.value ?? 0;
    const on = alreadyMins > 0;
    // On the pitch: assume he stays on. On the bench of a live match: a one-in-three chance he comes on.
    mins = on ? 90 * left : 0.35 * Math.min(25, 90 * left);
    pApp = on ? 1 : 0.35;
    p60 = on ? (alreadyMins >= 60 ? 1 : alreadyMins + 90 * left >= 60 ? 0.85 : 0) : 0;
  } else {
    const n = Math.max(1, Math.round(team.n));
    const avail = el.playing == null ? 1 : el.playing / 100;
    const starts = el.starts ?? 0;
    const pStart = Math.min(1, starts / n) * avail;
    const perStart = starts > 0 ? Math.min(90, min / starts) : 0;
    const pSub = min > 0 ? (1 - Math.min(1, starts / n)) * 0.3 * avail : 0;
    mins = pStart * perStart + pSub * 20;
    pApp = pStart + pSub;
    p60 = pStart * (perStart >= 75 ? 0.9 : perStart >= 60 ? 0.7 : 0.3);
  }
  const frac = mins / 90;
  const xg = lamFor * shareG * frac;
  const xa = lamFor * shareA * frac;
  const conceded = f.started ? (home ? f.as : f.hs) ?? 0 : 0;
  const lamRest = lamAgainst * left;

  let xp = 0;
  let v = 1.2 * pApp; // bonus, cards and the rest that the parts below don't cover
  // Appearance: 1 point for playing, 2 for 60 minutes. In a live match only what's not yet earned.
  if (f.started) {
    if (alreadyMins === 0) xp += pApp;
    if (alreadyMins < 60) xp += p60;
  } else {
    xp += pApp + p60;
  }
  xp += GOAL_PTS[type] * xg + 3 * xa;
  v += GOAL_PTS[type] ** 2 * xg + 9 * xa;

  let cs = null;
  if (CS_PTS[type]) {
    const keep = conceded === 0 ? Math.exp(-lamRest) : 0;
    cs = p60 > 0 ? keep : 0;
    const hasCsNow = f.started && alreadyMins >= 60 && conceded === 0;
    // FPL already counts a live clean sheet once he's past 60 minutes; it can still be lost.
    const gain = hasCsNow ? -CS_PTS[type] * (1 - keep) : CS_PTS[type] * p60 * keep;
    xp += gain;
    v += CS_PTS[type] ** 2 * keep * (1 - keep) * (hasCsNow ? 1 : p60);
  }
  if (type === 1 || type === 2) {
    // −1 per two goals conceded while he's on.
    const share = f.started ? (pApp === 1 ? 1 : 0) : mins / 90;
    xp -= share * (poissonFloor(lamRest, 2, conceded) - Math.floor(conceded / 2));
  }
  if (type === 1) {
    const saves90 = per90(el.saves ?? 0) * (lamAgainst / model.avg);
    const before = f.started ? statOf(live, f.id, 'saves')?.value ?? 0 : 0;
    xp += poissonFloor(saves90 * frac, 3, before) - Math.floor(before / 3);
  }
  if (DC_NEED[type] && el.dc90) {
    const have = f.started ? statOf(live, f.id, 'defensive_contribution') : null;
    if (!have?.points) {
      const p = poissonTail(el.dc90 * frac, DC_NEED[type] - (have?.value ?? 0));
      xp += 2 * p;
      v += 4 * p * (1 - p);
    }
  }
  if (!f.started) xp += per90(el.bonus ?? 0) * frac;
  xp -= per90(el.yc ?? 0) * frac;
  return { xp: Math.max(0, xp), v, xg, xa, cs, mins, pApp, lamFor, lamAgainst };
}

/** Points so far plus what's still expected, across his fixtures this gameweek. */
export function projectPlayer(id, ctx) {
  const el = ctx.elements[id];
  const state = playerState(id, ctx);
  const fx = ctx.fixtures.filter((f) => f.home === el?.team || f.away === el?.team);
  const parts = fx.map((f) => ({ fixture: f, ...projectFixture(id, f, ctx) }));
  const rest = parts.reduce((t, p) => t + p.xp, 0);
  // Chance he gets no minutes at all this gameweek, which would bring a bench player on.
  const pMiss = state.minutes > 0 || !state.left ? 0 : parts.reduce((m, p) => m * (1 - p.pApp), 1);
  return {
    now: state.points,
    rest,
    final: state.points + rest,
    v: parts.reduce((t, p) => t + p.v, 0),
    xgLive: ctx.live[id]?.xg ?? 0,
    xaLive: ctx.live[id]?.xa ?? 0,
    // Still to come: expected goals and assists for the minutes left.
    xgRest: parts.reduce((t, p) => t + p.xg, 0),
    xaRest: parts.reduce((t, p) => t + p.xa, 0),
    pMiss: state.minutes > 0 ? 0 : pMiss,
    parts,
    state,
  };
}

/**
 * A manager's projected final gameweek score, from teamLive's lines: the counting players' points
 * plus what they're still expected to add (with their multipliers), plus the expected value of
 * autosubs for starters who might not play.
 */
export function projectTeam(team, ctx) {
  const rows = team.lines.map((l) => ({ ...l, proj: projectPlayer(l.element, ctx) }));
  let rest = 0;
  let v = 0;
  for (const r of rows) {
    if (!r.counts) continue;
    rest += r.mult * r.proj.rest;
    v += r.mult ** 2 * r.proj.v;
  }
  // A starter who may not play hands his place to the first bench player of the right kind.
  const bench = rows.filter((r) => !r.counts && r.position > 11).sort((a, b) => a.position - b.position);
  let autosub = 0;
  for (const r of rows.filter((x) => x.counts && x.proj.pMiss > 0.05)) {
    const b = bench.find((x) => (x.type === 1) === (r.type === 1) && !x.used);
    if (!b) continue;
    b.used = true;
    autosub += r.proj.pMiss * b.proj.final;
  }
  return { rows, now: team.net, rest: rest + autosub, final: team.net + rest + autosub, v };
}

const normalCdf = (z) => {
  // Abramowitz and Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
};

/**
 * You against one rival this gameweek. a and b are teamLive results. Players you both field with the
 * same multiplier cancel out; the rest decide it.
 */
export function headToHead(a, b, ctx) {
  const pa = projectTeam(a, ctx);
  const pb = projectTeam(b, ctx);
  const mult = (t) => Object.fromEntries(t.lines.filter((l) => l.counts).map((l) => [l.element, l.mult]));
  const ma = mult(a);
  const mb = mult(b);
  const squadA = new Set(a.lines.map((l) => l.element));
  const squadB = new Set(b.lines.map((l) => l.element));
  const ids = [...new Set([...Object.keys(ma), ...Object.keys(mb)].map(Number))];
  const projOf = Object.fromEntries([...pa.rows, ...pb.rows].map((r) => [r.element, r.proj]));
  const rows = ids.map((id) => ({ element: id, a: ma[id] ?? 0, b: mb[id] ?? 0, proj: projOf[id] }));
  const shared = rows.filter((r) => r.a && r.b);
  const onlyA = rows.filter((r) => r.a > r.b).map((r) => ({ ...r, extra: r.a - r.b }));
  const onlyB = rows.filter((r) => r.b > r.a).map((r) => ({ ...r, extra: r.b - r.a }));
  const diff = pa.final - pb.final;
  // Shared players with equal multipliers don't move the gap, so only the differences add spread.
  const v = rows.reduce((t, r) => t + (r.a - r.b) ** 2 * (r.proj?.v ?? 0), 0);
  const sd = Math.sqrt(v);
  const pA = sd < 0.5 ? (diff > 0 ? 1 : diff < 0 ? 0 : 0.5) : normalCdf(diff / sd);
  return {
    a: pa,
    b: pb,
    shared,
    squadShared: [...squadA].filter((id) => squadB.has(id)).length,
    onlyA: onlyA.sort((x, y) => y.extra * y.proj.final - x.extra * x.proj.final),
    onlyB: onlyB.sort((x, y) => y.extra * y.proj.final - x.extra * x.proj.final),
    diff,
    sd,
    pA,
  };
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
