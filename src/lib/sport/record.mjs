// Our track record: the projections saved before each deadline (scripts/sport/accuracy.mjs saves
// them) graded against what happened, next to FPL's own expected points. Nothing is graded that
// wasn't saved before the deadline.
//
// A gameweek is graded as soon as its last match is over. FPL's points carry its live bonus by
// then; a match without any yet gets the bonus its BPS gives. The grade is provisional until FPL
// signs the gameweek off, which can take a day, and is redone until then.
//
// Shared by the weekly job, which commits the record, and /api/sport/fpl/record, which grades on
// request so a gameweek shows the moment it's done instead of at the job's next run.
import { projectedBonus } from './fpl.mjs';

const mean = (a) => (a.length ? a.reduce((t, v) => t + v, 0) / a.length : null);
const corr = (a, b) => {
  const ma = mean(a);
  const mb = mean(b);
  let n = 0;
  let da = 0;
  let db = 0;
  a.forEach((v, i) => {
    n += (v - ma) * (b[i] - mb);
    da += (v - ma) ** 2;
    db += (b[i] - mb) ** 2;
  });
  return da && db ? n / Math.sqrt(da * db) : null;
};
const topBy = (list, k, n) => [...list].sort((a, b) => b[k] - a[k]).slice(0, n);
const over = (f) => f.finished || f.finishedProvisional;

/**
 * Whether a gameweek can be graded: 'final' once FPL has finished it, 'provisional' once every one of
 * its matches is over, otherwise null. `fixtures` are the gameweek's, as getLive gives them.
 */
export function readiness(ev, fixtures) {
  if (ev?.finished) return 'final';
  return fixtures.length && fixtures.every(over) ? 'provisional' : null;
}

/**
 * One gameweek graded. `snap` is the saved projections ({ gw, at, players: { id: [xp, xg, xa,
 * netXg, netXa, fplEp] } }), `live` getLive's answer for that gameweek, `name(id)` a player's name.
 */
export function gradeWeek(snap, live, name, state = 'final') {
  const bonus = {};
  for (const byId of Object.values(projectedBonus(live.fixtures ?? []))) for (const [id, b] of Object.entries(byId)) bonus[id] = (bonus[id] ?? 0) + b;
  const rows = Object.entries(snap.players).map(([id, [xp, xg, xa, nxg, nxa, ep]]) => {
    const a = live.elements[id] ?? { points: 0, minutes: 0, xg: 0, xa: 0 };
    return { id: Number(id), xp, xg, xa, nxg, nxa, ep, pts: (a.points ?? 0) + (bonus[id] ?? 0), min: a.minutes ?? 0, axg: a.xg ?? 0, axa: a.xa ?? 0 };
  });
  // Judged on the players anyone would consider: projected at least 2 points by us or by FPL.
  const pool = rows.filter((r) => r.xp >= 2 || r.ep >= 2);
  const played = rows.filter((r) => r.min > 0);
  const capOurs = topBy(pool, 'xp', 1)[0];
  const capFpl = topBy(pool, 'ep', 1)[0];
  return {
    gw: snap.gw,
    savedAt: snap.at,
    ...(state === 'provisional' ? { provisional: true } : null),
    n: pool.length,
    points: {
      maeOurs: mean(pool.map((r) => Math.abs(r.xp - r.pts))),
      maeFpl: mean(pool.map((r) => Math.abs(r.ep - r.pts))),
      corrOurs: corr(pool.map((r) => r.xp), pool.map((r) => r.pts)),
      corrFpl: corr(pool.map((r) => r.ep), pool.map((r) => r.pts)),
      top10Ours: mean(topBy(pool, 'xp', 10).map((r) => r.pts)),
      top10Fpl: mean(topBy(pool, 'ep', 10).map((r) => r.pts)),
      top10Best: mean(topBy(rows, 'pts', 10).map((r) => r.pts)),
      captainOurs: capOurs && { name: name(capOurs.id), pts: capOurs.pts },
      captainFpl: capFpl && { name: name(capFpl.id), pts: capFpl.pts },
    },
    netXg: {
      n: played.length,
      corr: corr(played.map((r) => r.nxg), played.map((r) => r.axg)),
      top20: mean(topBy(played, 'nxg', 20).map((r) => r.axg)),
    },
  };
}

/** The season so far, over the graded weeks. */
export function seasonOf(weeks) {
  if (!weeks.length) return null;
  const sum = (f) => weeks.reduce((t, w) => t + (f(w) ?? 0), 0);
  return {
    weeks: weeks.length,
    maeOurs: sum((w) => w.points.maeOurs) / weeks.length,
    maeFpl: sum((w) => w.points.maeFpl) / weeks.length,
    top10Ours: sum((w) => w.points.top10Ours) / weeks.length,
    top10Fpl: sum((w) => w.points.top10Fpl) / weeks.length,
    captainOurs: sum((w) => w.points.captainOurs?.pts),
    captainFpl: sum((w) => w.points.captainFpl?.pts),
    beatFplWeeks: weeks.filter((w) => w.points.maeOurs < w.points.maeFpl).length,
  };
}

/**
 * The record: every saved gameweek graded once it can be; the ones still being played, with how far
 * they've got; and the next deadline's. `snaps` are the saved projections, `st` getStatic's answer,
 * `live(gw)` getLive. `kept` are weeks graded before (the committed record): one FPL has finished
 * that was graded final then isn't fetched again.
 */
export async function buildRecord({ snaps, st, live, kept = [], now = Date.now() }) {
  const name = (id) => st.elements.find((e) => e.id === id)?.name ?? String(id);
  const weeks = [];
  const awaiting = [];
  for (const snap of [...snaps].sort((a, b) => a.gw - b.gw)) {
    // Still being saved: graded once its deadline has passed and its matches are played.
    if (new Date(snap.deadline).getTime() > now) continue;
    const ev = st.events.find((e) => e.id === snap.gw);
    const old = kept.find((w) => w.gw === snap.gw);
    if (ev?.finished && old && !old.provisional) {
      weeks.push(old);
      continue;
    }
    const l = await live(snap.gw);
    const state = readiness(ev, l.fixtures);
    if (state) weeks.push(gradeWeek(snap, l, name, state));
    else {
      const last = l.fixtures.map((f) => f.kickoff).filter(Boolean).sort().at(-1) ?? null;
      awaiting.push({ gw: snap.gw, deadline: snap.deadline, savedAt: snap.at, played: l.fixtures.filter(over).length, of: l.fixtures.length, last });
    }
  }
  const next = st.events.find((e) => new Date(e.deadline).getTime() > now);
  const pending = next ? { gw: next.id, deadline: next.deadline, savedAt: snaps.find((s) => s.gw === next.id)?.at ?? null } : null;
  // The record starts with the first gameweek saved, graded or not: a week still being played is part of it.
  const firstWeek = snaps.length ? Math.min(...snaps.map((s) => s.gw)) : (pending?.gw ?? null);
  return { built: new Date(now).toISOString(), firstWeek, pending, awaiting, season: seasonOf(weeks), weeks };
}
