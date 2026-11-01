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
  return { points: t.gross, captain: cap ? { id: cap.element, points: cap.state.points, times: cap.mult } : null, viceUsed: t.viceUsed, subs: t.subs };
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

/**
 * The manager's season so far: each gameweek's points (after hits), overall rank, chip and captain;
 * and every transfer outside Wildcard and Free Hit weeks, with what the player bought and the one
 * sold have scored over the weeks the manager kept the new one.
 */
export async function seasonSoFar({ entry, transfers = [], els, loaders, done, current = null }) {
  const played = (entry.history ?? []).filter((h) => done.includes(h.event) || h.event === current);
  const chipAt = Object.fromEntries((entry.chips ?? []).map((c) => [c.event, c.name]));
  const [picks, lives] = await Promise.all([Promise.all(played.map((h) => loaders.picks(h.event))), Promise.all(played.map((h) => loaders.live(h.event)))]);
  const live = Object.fromEntries(played.map((h, i) => [h.event, lives[i]]));
  const squadAt = Object.fromEntries(played.map((h, i) => [h.event, new Set((picks[i]?.picks ?? []).map((p) => p.element))]));
  const weeks = played.map((h, i) => {
    const score = picks[i]?.picks?.length && lives[i] ? squadScore(picks[i].picks, lives[i], els, chipAt[h.event] === 'bboost' || chipAt[h.event] === '3xc' ? chipAt[h.event] : null) : null;
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
  // Transfers made with free transfers or hits; a Wildcard's or Free Hit's are the chip's (chipWhatIf).
  const chipWeek = new Set((entry.chips ?? []).filter((c) => c.name === 'wildcard' || c.name === 'freehit').map((c) => c.event));
  const finished = done.filter((g) => squadAt[g]);
  const list = transfers
    .filter((t) => !chipWeek.has(t.event))
    .sort((a, b) => a.event - b.event || Date.parse(a.time) - Date.parse(b.time))
    .map((t) => {
      // The weeks he stayed: from the transfer until he left the squad (Free Hit weeks don't count either way).
      const kept = [];
      for (const g of finished.filter((x) => x >= t.event)) {
        if (chipAt[g] === 'freehit') continue;
        if (!squadAt[g].has(t.element_in)) break;
        kept.push(g);
      }
      const inPts = sum(kept.map((g) => pointsOf(live[g], t.element_in)));
      const outPts = sum(kept.map((g) => pointsOf(live[g], t.element_out)));
      return { gw: t.event, out: name(els, t.element_out), in: name(els, t.element_in), keptFor: kept.length, inScored: inPts, outScored: outPts, gain: inPts - outPts };
    });
  const hits = sum(played.map((h) => h.hit ?? 0));
  const byGain = [...list].filter((t) => t.keptFor).sort((a, b) => b.gain - a.gain);
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
      best: byGain[0] ?? null,
      worst: byGain.at(-1) ?? null,
      list,
      note: 'Each transfer: the player bought against the one sold, over the gameweeks the new one stayed in the squad. Wildcard and Free Hit transfers are left out (ask about those chips).',
    },
  };
}
