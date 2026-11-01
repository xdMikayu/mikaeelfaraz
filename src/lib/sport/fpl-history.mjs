// A manager's season looked back on, for Matchday AI (chat.mjs): every gameweek's points, chips,
// captains and transfers, and what-ifs like "would I have more points without my wildcard?".
//
// A what-if keeps the team the manager had before the chip, unchanged, and scores it gameweek by
// gameweek the way FPL would have: its eleven and bench order, captain and vice, FPL's automatic
// substitutions (fpl.mjs teamLive). Chips played later count the same way in both: a Free Hit
// week scores the Free Hit team either way, a Bench Boost or Triple Captain is played on the kept
// team too. Pure functions over FPL's own data, fetched through `loaders`:
//   loaders.picks(gw) → that gameweek's picks (fpl-server.mjs getPicks), loaders.live(gw) → getLive.
import { teamLive, projectedBonus } from './fpl.mjs';

export const CHIP_NAMES = { wildcard: 'Wildcard', freehit: 'Free Hit', bboost: 'Bench Boost', '3xc': 'Triple Captain' };

// Each chip once before gameweek 20 and once after (since 2025/26), unless FPL's own windows are given.
const HALVES = Object.keys(CHIP_NAMES).flatMap((name) => [{ name, from: 1, to: 19 }, { name, from: 20, to: 38 }]);

/**
 * The chips a manager can still play in gameweek `gw`'s window: FPL codes, in CHIP_NAMES order.
 * used: entry.chips ([{ name, event }]); windows: FPL's ([{ name, from, to }], getStatic().chips).
 */
export function chipsLeft(used, gw, windows = null) {
  const open = (windows?.length ? windows : HALVES).filter((w) => gw >= w.from && gw <= w.to);
  const left = new Set(open.filter((w) => !used.some((u) => u.name === w.name && u.event >= w.from && u.event <= w.to)).map((w) => w.name));
  return Object.keys(CHIP_NAMES).filter((c) => left.has(c));
}

/** The last gameweek the chips open in gameweek `gw` can be played in (19, or 38 after the turn). */
export const chipsUntil = (gw, windows = null) => Math.max(gw, ...(windows?.length ? windows : HALVES).filter((w) => gw >= w.from && gw <= w.to).map((w) => w.to));

const sum = (a) => a.reduce((t, v) => t + v, 0);
const name = (els, id) => els[id]?.name ?? `player ${id}`;
const pointsOf = (live, id) => live?.elements?.[id]?.points ?? 0;

/**
 * One squad's score in one gameweek as FPL would have counted it: its eleven and bench order,
 * captain and vice, the automatic substitutions, and a chip if one is played.
 */
export function squadScore(picks, live, els, chip = null) {
  const t = teamLive(picks, chip, 0, { elements: els, live: live.elements, fixtures: live.fixtures, bonus: projectedBonus(live.fixtures) });
  const cap = t.lines.find((l) => l.captainNow);
  // The eleven who played for the team (the starters left after substitutions, and who came on).
  const eleven = t.lines.filter((l) => (l.position <= 11 && !l.subbedOff) || l.used).map((l) => ({ id: l.element, points: l.state.points }));
  return { points: t.gross, captain: cap ? { id: cap.element, points: cap.state.points, times: cap.mult } : null, viceUsed: t.viceUsed, subs: t.subs, eleven, lines: t.lines };
}

/** The team a manager had going into gameweek `gw`: the latest picks before it that weren't a Free Hit's. */
async function squadBefore(gw, entry, loaders) {
  for (let g = gw - 1; g >= (entry.started ?? 1); g--) {
    const p = await loaders.picks(g);
    if (p?.picks?.length && p.chip !== 'freehit') return { gw: g, ...p };
  }
  return null;
}

const xiOf = (els, picks) => {
  const sorted = [...picks].sort((a, b) => a.position - b.position);
  const cap = sorted.find((p) => p.captain);
  return { eleven: sorted.filter((p) => p.position <= 11).map((p) => name(els, p.element)), bench: sorted.filter((p) => p.position > 11).map((p) => name(els, p.element)), captain: cap ? name(els, cap.element) : null };
};

/**
 * What one chip did for the manager. `chip` is FPL's code (wildcard, freehit, bboost, 3xc); `gw` picks
 * which time it was played, the latest by default. `done`: the gameweeks whose matches are all over;
 * `current`: the gameweek still being played, if any.
 *  - Wildcard: the team before it, kept unchanged with no transfers or hits, against what the manager
 *    actually scored after hits, every week since (up to a second wildcard); and who it sold and bought.
 *  - Free Hit: the team they'd have fielded that week without it, against the Free Hit team.
 *  - Bench Boost and Triple Captain: that week's team scored with the chip and without it.
 */
export async function chipWhatIf({ chip, gw = null, entry, els, loaders, done, current = null }) {
  const label = CHIP_NAMES[chip];
  if (!label) return { error: `Unknown chip ${chip}` };
  const uses = (entry.chips ?? []).filter((c) => c.name === chip).map((c) => c.event).sort((a, b) => a - b);
  if (!uses.length) return { error: `No ${label} played this season` };
  const at = gw == null ? uses.at(-1) : uses.includes(gw) ? gw : null;
  if (at == null) return { error: `The ${label} wasn't played in gameweek ${gw}; it was played in gameweek ${uses.join(' and ')}` };
  const hist = (g) => entry.history.find((h) => h.event === g);
  const actualOf = (g) => (hist(g) ? hist(g).points - (hist(g).hit ?? 0) : null);
  const playing = at === current;
  if (!done.includes(at) && !playing) return { error: `Gameweek ${at} hasn't been played yet` };

  if (chip === 'bboost' || chip === '3xc') {
    const p = await loaders.picks(at);
    const live = await loaders.live(at);
    const withChip = squadScore(p.picks, live, els, chip);
    const without = squadScore(p.picks, live, els);
    const benched = [...p.picks].sort((a, b) => a.position - b.position).filter((x) => x.position > 11);
    return {
      chip: label,
      gameweek: at,
      ...(playing ? { stillBeingPlayed: true } : null),
      withIt: withChip.points,
      withoutIt: without.points,
      gainedByTheChip: withChip.points - without.points,
      ...(chip === 'bboost'
        ? { bench: benched.map((x) => `${name(els, x.element)} ${pointsOf(live, x.element)}`) }
        : { captain: withChip.captain ? `${name(els, withChip.captain.id)} ${withChip.captain.points}${withChip.viceUsed ? ' (the vice-captain: the captain didn’t play)' : ''}` : 'nobody: neither captain played' }),
    };
  }

  const before = await squadBefore(at, entry, loaders);
  if (!before) return { error: `There's no team from before gameweek ${at} to compare with` };

  if (chip === 'freehit') {
    const live = await loaders.live(at);
    const kept = squadScore(before.picks, live, els);
    const actual = actualOf(at);
    return {
      chip: label,
      gameweek: at,
      ...(playing ? { stillBeingPlayed: true } : null),
      freeHitTeamScored: actual,
      yourTeamWouldHaveScored: kept.points,
      gainedByTheChip: actual - kept.points,
      yourTeam: xiOf(els, before.picks),
    };
  }

  // Wildcard: from it up to a second one (whose team is a fresh start again).
  const next = uses.find((g) => g > at) ?? Infinity;
  const weeks = done.filter((g) => g >= at && g < next);
  const chipIn = (g) => (entry.chips ?? []).find((c) => c.event === g && c.name !== 'wildcard')?.name ?? null;
  const rows = [];
  for (const g of weeks) {
    const live = await loaders.live(g);
    const later = g === at ? null : chipIn(g);
    const actual = actualOf(g);
    let kept;
    let note = null;
    if (later === 'freehit') {
      kept = { points: actual, captain: null };
      note = 'Free Hit week: the Free Hit team either way';
    } else {
      kept = squadScore(before.picks, live, els, later === 'bboost' || later === '3xc' ? later : null);
      if (later) note = `${CHIP_NAMES[later]} played on both teams`;
    }
    rows.push({
      gw: g,
      youScored: actual,
      ...(hist(g)?.hit ? { afterAHitOf: hist(g).hit } : null),
      keptTeamWouldHaveScored: kept.points,
      ...(kept.captain ? { keptTeamCaptain: `${name(els, kept.captain.id)} ${kept.captain.points}` } : null),
      ...(note ? { note } : null),
    });
  }
  const after = await loaders.picks(at);
  const was = new Set(before.picks.map((p) => p.element));
  const now = new Set((after?.picks ?? []).map((p) => p.element));
  const lives = await Promise.all(weeks.map((g) => loaders.live(g)));
  const since = (id) => sum(lives.map((l) => pointsOf(l, id)));
  const out = [...was].filter((id) => !now.has(id));
  const inn = [...now].filter((id) => !was.has(id));
  const actualTotal = sum(rows.map((r) => r.youScored ?? 0));
  const keptTotal = sum(rows.map((r) => r.keptTeamWouldHaveScored));
  let soFar = null;
  if (current != null && current >= at && current < next && !done.includes(current)) {
    const live = await loaders.live(current);
    const later = current === at ? null : chipIn(current);
    soFar = { gw: current, youHaveSoFar: actualOf(current), keptTeamWouldHaveSoFar: later === 'freehit' ? actualOf(current) : squadScore(before.picks, live, els, later === 'bboost' || later === '3xc' ? later : null).points };
  }
  return {
    chip: label,
    playedIn: at,
    comparedOver: weeks.length ? `gameweeks ${weeks[0]}–${weeks.at(-1)}` : 'no finished gameweeks yet',
    keptTeam: { from: `your team going into gameweek ${at}`, ...xiOf(els, before.picks) },
    totals: { youScored: actualTotal, keptTeamWouldHaveScored: keptTotal, difference: actualTotal - keptTotal, hitsYouTookSince: sum(rows.map((r) => r.afterAHitOf ?? 0)) },
    weeks: rows,
    ...(soFar ? { thisGameweekSoFar: soFar } : null),
    wildcardChanges: {
      sold: out.map((id) => ({ name: name(els, id), pointsSince: since(id) })).sort((a, b) => b.pointsSince - a.pointsSince),
      bought: inn.map((id) => ({ name: name(els, id), pointsSince: since(id) })).sort((a, b) => b.pointsSince - a.pointsSince),
    },
    assumes: 'The kept team makes no transfers and takes no hits, with the same eleven, bench order and captain every week (FPL’s automatic substitutions and vice-captain rule applied). With free transfers it would likely have done somewhat better. Team value isn’t counted.',
  };
}

/** Every player's points in each of these gameweeks, { gw: { id: points } }, as transferLedger reads them. */
const pointsByGw = (weeks, live) => Object.fromEntries(weeks.filter((g) => live[g]).map((g) => [g, Object.fromEntries(Object.entries(live[g].elements).map(([id, e]) => [id, e.points]))]));

/** A ledger line as the season review and the rival gap tell it. `now`: the gameweek being played (or next). */
const moveOf = (l, els, now) =>
  l.changes
    ? { gw: l.gw, weeksAgo: now - l.gw, ...(l.wildcard ? { wildcard: true } : null), changes: l.changes, inScored: l.inPoints, outScored: l.outPoints, gain: l.net }
    : { gw: l.gw, weeksAgo: now - l.gw, out: name(els, l.out), in: name(els, l.in), keptUntil: l.to, inScored: l.inPoints, outScored: l.outPoints, gain: l.net };

/**
 * The manager's season so far: each gameweek's points (after hits), overall rank, chip and captain,
 * with how many more the best captain among the eleven who played would have brought (hindsight);
 * and every move made with free transfers or hits (a Wildcard's are the chip's), with what the player
 * bought and the one sold have scored over the weeks the new one stayed (fpl-history transferLedger).
 */
export async function seasonSoFar({ entry, transfers = [], els, loaders, done, current = null }) {
  const played = (entry.history ?? []).filter((h) => done.includes(h.event) || h.event === current);
  const chipAt = Object.fromEntries((entry.chips ?? []).map((c) => [c.event, c.name]));
  const [picks, lives] = await Promise.all([Promise.all(played.map((h) => loaders.picks(h.event))), Promise.all(played.map((h) => loaders.live(h.event)))]);
  const live = Object.fromEntries(played.map((h, i) => [h.event, lives[i]]));
  const squadAt = Object.fromEntries(played.map((h, i) => [h.event, new Set((picks[i]?.picks ?? []).map((p) => p.element))]));
  const regrets = [];
  const weeks = played.map((h, i) => {
    const score = picks[i]?.picks?.length && lives[i] ? squadScore(picks[i].picks, lives[i], els, chipAt[h.event] === 'bboost' || chipAt[h.event] === '3xc' ? chipAt[h.event] : null) : null;
    // With hindsight: the armband on the best of the eleven who played, against the captain chosen.
    if (score?.captain && done.includes(h.event)) {
      const best = score.eleven.reduce((b, x) => (x.points > b.points ? x : b), score.eleven[0]);
      const lost = (best.points - score.captain.points) * (score.captain.times - 1);
      regrets.push({ gw: h.event, chose: `${name(els, score.captain.id)} ${score.captain.points}`, best: `${name(els, best.id)} ${best.points}`, lost, armband: score.captain.points * (score.captain.times - 1) });
    }
    return {
      gw: h.event,
      ...(h.event === current && !done.includes(h.event) ? { stillBeingPlayed: true } : null),
      points: h.points - (h.hit ?? 0),
      ...(h.hit ? { hit: h.hit } : null),
      overallRank: h.overall,
      ...(chipAt[h.event] ? { chip: CHIP_NAMES[chipAt[h.event]] ?? chipAt[h.event] } : null),
      ...(score?.captain ? { captain: `${name(els, score.captain.id)} ${score.captain.points}×${score.captain.times}${score.viceUsed ? ' (vice)' : ''}` } : null),
      benchPoints: h.bench,
    };
  });
  // Moves made with free transfers or hits, over the finished gameweeks; a Wildcard's are the chip's.
  const last = Math.max(0, ...done);
  const now = current ?? last + 1;
  const ledger = transferLedger(transfers, {
    pointsByGw: pointsByGw(done, live),
    current: last,
    freeHits: (entry.chips ?? []).filter((c) => c.name === 'freehit').map((c) => c.event),
    wildcards: (entry.chips ?? []).filter((c) => c.name === 'wildcard').map((c) => c.event),
    els,
  });
  const list = ledger.filter((l) => !l.wildcard).map((l) => moveOf(l, els, now)).sort((a, b) => a.gw - b.gw);
  // Hits over the finished gameweeks, the same weeks the moves are judged over.
  const hits = sum(played.filter((h) => done.includes(h.event)).map((h) => h.hit ?? 0));
  // Each hit against what that week's moves have gained since: did it pay back?
  const hitWeeks = played
    .filter((h) => h.hit > 0 && done.includes(h.event))
    .map((h) => {
      const moves = list.filter((m) => m.gw === h.event);
      const gained = sum(moves.map((m) => m.gain));
      return { gw: h.event, weeksAgo: now - h.event, cost: h.hit, moves: moves.map((m) => (m.changes ? `${m.changes} changes` : `${m.out} → ${m.in}`)), gained, net: gained - h.hit };
    });
  const byGain = [...list].sort((a, b) => b.gain - a.gain);
  const costly = [...regrets].sort((a, b) => b.lost - a.lost);
  return {
    team: entry.name,
    totalPoints: entry.total,
    overallRank: entry.overall,
    chipsPlayed: (entry.chips ?? []).map((c) => ({ chip: CHIP_NAMES[c.name] ?? c.name, gw: c.event })),
    weeks,
    transfers: {
      made: list.length,
      hitsTaken: hits,
      pointsGainedByThem: sum(list.map((t) => t.gain)),
      netAfterHits: sum(list.map((t) => t.gain)) - hits,
      best: byGain.slice(0, 3).filter((t) => t.gain > 0),
      costliest: byGain.slice(-3).reverse().filter((t) => t.gain < 0),
      hits: hitWeeks,
      list,
      note: 'Each move: the player bought against the one sold, over the gameweeks the new one stayed. A player bought and sold again before a deadline is netted out. Wildcard and Free Hit transfers are left out (ask about those chips). hits: each week a hit was taken, against what that week’s moves have gained since.',
    },
    captains: {
      armbandPoints: sum(regrets.map((r) => r.armband)),
      leftWithHindsight: sum(regrets.map((r) => r.lost)),
      costliest: costly.filter((r) => r.lost > 0).slice(0, 3),
      note: 'Hindsight: the armband on the best of the eleven who played that week, against the captain chosen. Nobody gets every week right.',
    },
    benchPoints: sum(played.filter((h) => done.includes(h.event)).map((h) => h.bench ?? 0)),
  };
}

/**
 * How a rival gained or lost ground on the manager over some gameweeks, and why. Both teams are
 * scored each week as FPL counted them (automatic substitutions, vice-captain, chips), so the parts
 * add up to the change in the gap exactly:
 *  - players: points from players who counted for one team and not the other (one owned him and the
 *    other didn't, or one started him and the other benched him; a Bench Boost's bench counts);
 *  - captaincy: the armband's extra points (a Triple Captain's two);
 *  - hits: points paid for transfers.
 * Plus the players and captain picks behind it, the chips each played, the rival's best moves and the
 * manager's costliest over those weeks. me, rival: { entry (getEntry), transfers, picks(gw) };
 * live(gw): getLive; weeks: the gameweeks, in order.
 */
export async function rivalGap({ me, rival, weeks, live, els }) {
  const chip = (entry, g) => (entry.chips ?? []).find((c) => c.event === g)?.name ?? null;
  const hit = (entry, g) => entry.history.find((h) => h.event === g)?.hit ?? 0;
  // Each player's part in one team's week: counted (1) or not, the armband's extra, and how he stood.
  const parts = (p, l, entry, g) => {
    const c = chip(entry, g);
    const s = squadScore(p.picks, l, els, c === 'bboost' || c === '3xc' ? c : null);
    return { s, by: new Map(s.lines.map((x) => [x.element, { base: x.counts ? 1 : 0, extra: x.counts ? x.mult - 1 : 0, how: x.counts ? 'fielded' : 'benched' }])) };
  };
  const none = { base: 0, extra: 0, how: 'not owned' };
  const players = {};
  const captains = [];
  let fromPlayers = 0;
  let fromCaptaincy = 0;
  let fromHits = 0;
  const lives = {};
  const loaded = await Promise.all(weeks.map((g) => Promise.all([me.picks(g), rival.picks(g), live(g)])));
  for (const [i, g] of weeks.entries()) {
    const [pm, pr, l] = loaded[i];
    lives[g] = l;
    if (!pm?.picks?.length || !pr?.picks?.length) continue;
    const a = parts(pr, l, rival.entry, g);
    const b = parts(pm, l, me.entry, g);
    let swing = 0;
    for (const id of new Set([...a.by.keys(), ...b.by.keys()])) {
      const x = a.by.get(id) ?? none;
      const y = b.by.get(id) ?? none;
      const pts = pointsOf(l, id);
      const dp = (x.base - y.base) * pts;
      swing += (x.extra - y.extra) * pts;
      fromPlayers += dp;
      if (dp) {
        const r = (players[id] ??= { points: 0, ways: {} });
        r.points += dp;
        // How it came about this week, from the side that gained: "they had him, you didn't" and so on.
        const way = dp > 0 ? (y.how === 'not owned' ? 'they had him, you didn’t' : 'you benched him') : x.how === 'not owned' ? 'you had him, they didn’t' : 'they benched him';
        r.ways[way] = (r.ways[way] ?? 0) + Math.abs(dp);
      }
    }
    fromCaptaincy += swing;
    fromHits += hit(me.entry, g) - hit(rival.entry, g);
    if (swing) {
      const cap = (s) => (s.captain ? `${name(els, s.captain.id)} ${s.captain.points}×${s.captain.times}` : 'none');
      captains.push({ gw: g, theirs: cap(a.s), yours: cap(b.s), swing });
    }
  }
  const named = Object.entries(players).map(([id, r]) => ({ name: name(els, Number(id)), points: Math.abs(r.points), how: Object.entries(r.ways).sort((x, y) => y[1] - x[1])[0][0], forThem: r.points > 0 }));
  const sorted = (side) => named.filter((x) => x.forThem === side).sort((x, y) => y.points - x.points).map(({ forThem, ...x }) => x);
  // Their best moves and the manager's costliest, over these weeks only.
  const last = weeks.at(-1);
  const pts = pointsByGw(weeks, lives);
  const ledger = (who) =>
    transferLedger(who.transfers ?? [], {
      pointsByGw: pts,
      current: last,
      freeHits: (who.entry.chips ?? []).filter((c) => c.name === 'freehit').map((c) => c.event),
      wildcards: (who.entry.chips ?? []).filter((c) => c.name === 'wildcard').map((c) => c.event),
      els,
    }).map((l) => moveOf(l, els, last + 1));
  const chips = (entry) => (entry.chips ?? []).filter((c) => weeks.includes(c.event)).map((c) => ({ chip: CHIP_NAMES[c.name] ?? c.name, gw: c.event }));
  return {
    weeks: weeks.length > 1 ? `gameweeks ${weeks[0]}–${last}` : `gameweek ${weeks[0]}`,
    gained: fromPlayers + fromCaptaincy + fromHits,
    parts: { players: fromPlayers, captaincy: fromCaptaincy, hits: fromHits },
    forThem: sorted(true).slice(0, 4),
    forYou: sorted(false).slice(0, 3),
    captains: captains.sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing)).slice(0, 4),
    chips: { theirs: chips(rival.entry), yours: chips(me.entry) },
    theirBestMoves: ledger(rival).filter((m) => m.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 3),
    yourCostliestMoves: ledger(me).filter((m) => m.gain < 0).sort((a, b) => a.gain - b.gain).slice(0, 3),
  };
}

const plus = (n) => (n > 0 ? `+${n}` : `${n}`);

/** One move in a line: "GW3 Palestra → De Cuyper: De Cuyper 43, Palestra 2 over the same weeks (+41)". */
const moveLine = (m) =>
  m.changes
    ? `GW${m.gw} ${m.wildcard ? 'Wildcard' : 'transfers'}, ${m.changes} changes: the players in scored ${m.inScored}, the players out ${m.outScored} (${plus(m.gain)})`
    : `GW${m.gw} ${m.out} → ${m.in}: ${m.in} ${m.inScored}, ${m.out} ${m.outScored} over the same weeks (${plus(m.gain)})`;

/**
 * The season review (fpl-review-server getReview) in a few lines, for Matchday AI to bring up what the
 * manager's own season shows: the moves that paid and the ones that cost, hits, chips, captains, bench.
 */
export function recordLessons(r) {
  if (!r?.transfers) return null;
  const t = r.transfers;
  return {
    throughGameweek: r.through,
    transfers: `${t.made} ${t.made === 1 ? 'move' : 'moves'} with free transfers or hits: ${plus(t.netAfterHits)} points after ${t.hitsTaken} points of hits`,
    bestMoves: t.best.map(moveLine),
    costliestMoves: t.costliest.map(moveLine),
    hits: (t.hits ?? []).map(
      (h) =>
        `GW${h.gw}: −${h.cost} for ${h.moves.join(', ') || 'moves since undone'}; those moves ${plus(h.gained)} since, so ${h.net >= 0 ? `paid back by ${h.net}` : `${-h.net} short of paying back`}${h.weeksAgo <= 2 ? ' (recent: still paying out)' : ''}`,
    ),
    chips: (r.chips ?? []).map((c) => `${c.chip} GW${c.gw}: ${plus(c.gain)}${c.over ? `, ${c.over}, against the team from before it kept as it was` : ''}${c.stillBeingPlayed ? ' so far' : ''}`),
    captains: `the armband left ${r.captains.leftWithHindsight} points with hindsight${r.captains.costliest.length ? `: ${r.captains.costliest.map((c) => `GW${c.gw} ${c.chose} when ${c.best}`).join('; ')}` : ''}`,
    benchPoints: r.benchPoints,
  };
}

/** The league race (fpl-review-server getRivals) in a few lines, for Matchday AI: each rival's gap and why it moved. */
export function raceLessons(d) {
  if (!d) return null;
  if (!d.rivals?.length) return d.note ? { league: d.league, note: d.note } : null;
  const gapText = (g) => (g > 0 ? `${g} ahead of you` : g < 0 ? `${-g} behind you` : 'level with you');
  const chipText = (cs) => (cs?.length ? cs.map((c) => `${c.chip} GW${c.gw}`).join(', ') : 'none');
  return {
    league: d.league,
    yourRank: d.you?.rank ?? null,
    afterGameweek: d.through,
    ...(d.you?.chipsLeft ? { yourChipsLeft: d.you.chipsLeft } : null),
    ...(d.chipsUntil ? { chipsLeftExpireAfter: `GW${d.chipsUntil}` } : null),
    note: 'Ranks are the live table. For each rival, gainedOnYou = players + captaincy + hits over the weeks since; positive went their way.',
    rivals: d.rivals.map((r) => ({
      team: r.team,
      manager: r.manager,
      rank: r.rank,
      gapAfterGameweek: gapText(r.gapNow),
      since: `GW${r.since}${r.sinceYouLed ? (r.gapBefore < 0 ? `, when you led by ${-r.gapBefore}` : ', when you were level') : ''}`,
      gainedOnYou: r.gained,
      from: r.parts,
      playersForThem: r.forThem.map((p) => `${p.name} ${p.points} (${p.how})`),
      playersForYou: r.forYou.map((p) => `${p.name} ${p.points} (${p.how})`),
      captains: r.captains.map((c) => `GW${c.gw}: theirs ${c.theirs}, yours ${c.yours} (${plus(c.swing)} to them)`),
      theirBestMoves: r.theirBestMoves.map(moveLine),
      yourCostliestMoves: r.yourCostliestMoves.map(moveLine),
      chipsPlayedSince: `theirs ${chipText(r.chips?.theirs)}; yours ${chipText(r.chips?.yours)}`,
      ...(r.chipsLeft ? { theirChipsLeft: r.chipsLeft } : null),
      ...(r.thisGameweekSoFar ? { thisGameweekSoFar: `GW${r.thisGameweekSoFar.gw}: ${plus(r.thisGameweekSoFar.gained)} to them so far` } : null),
    })),
  };
}

/**
 * What recent transfers have earned. Each week counts only its real changes: a player bought and
 * sold again before the deadline never played for the team, so that churn is netted out. Each sold
 * player is set against his replacement (same position, dearest with dearest) over the same weeks,
 * for as long as the replacement was kept. A Wildcard week, or a week of more than three changes,
 * is one line. Free Hit weeks are left out (that squad was undone). Worst first.
 */
export function transferLedger(transfers, { pointsByGw, current, freeHits = [], wildcards = [], els }) {
  const have = Object.keys(pointsByGw).map(Number);
  const pts = (id, from, to) => have.filter((g) => g >= from && g <= to).reduce((t, g) => t + (pointsByGw[g][id] ?? 0), 0);
  const byGw = {};
  for (const t of transfers) if (!freeHits.includes(t.event) && pointsByGw[t.event] && t.event <= current && t.element_out != null) (byGw[t.event] ??= []).push(t);
  const weeks = Object.keys(byGw).map(Number).sort((a, b) => a - b);
  const net = {};
  for (const g of weeks) {
    const ins = byGw[g].map((t) => t.element_in);
    const outs = byGw[g].map((t) => t.element_out);
    net[g] = { ins: ins.filter((id) => !outs.includes(id)), outs: outs.filter((id) => !ins.includes(id)) };
  }
  const price = (id) => els[id]?.cost ?? 0;
  const lines = [];
  for (const g of weeks) {
    const left = [...net[g].ins];
    const pairs = [];
    for (const o of [...net[g].outs].sort((a, b) => price(b) - price(a))) {
      const i = left.filter((x) => els[x]?.type === els[o]?.type).sort((a, b) => price(b) - price(a))[0];
      if (i == null) continue;
      left.splice(left.indexOf(i), 1);
      // Kept until he was sold again; the player he replaced is judged over the same weeks.
      const to = (weeks.find((w) => w > g && net[w].outs.includes(i)) ?? current + 1) - 1;
      pairs.push({ out: o, in: i, to, outPoints: pts(o, g, to), inPoints: pts(i, g, to) });
    }
    if (wildcards.includes(g) || pairs.length > 3) {
      const inPoints = pairs.reduce((t, p) => t + p.inPoints, 0);
      const outPoints = pairs.reduce((t, p) => t + p.outPoints, 0);
      lines.push({ gw: g, wildcard: wildcards.includes(g), changes: pairs.length, inPoints, outPoints, net: inPoints - outPoints });
    } else {
      for (const p of pairs) lines.push({ gw: g, ...p, net: p.inPoints - p.outPoints });
    }
  }
  return lines.sort((a, b) => a.net - b.net);
}
