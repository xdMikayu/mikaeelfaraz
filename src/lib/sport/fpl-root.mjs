// What to root for in each match still to finish this gameweek: everything that could still happen in
// it (a goal, an assist, a clean sheet, a booking, defensive contributions paying) and what each would
// do to you against a field of managers. An event's swing is the points it brings you minus what it
// brings the field on average: for each player it pays, (your multiplier − his effective ownership in
// the field) × those points. So a clean sheet you hold one defender of, in a defence the field holds
// a fifth of on average, is worth 4 × (1 − 0.2) = 3.2 points to you against them. Each event comes with
// how likely it still is, from the projections (fpl.mjs projectFixture, defconFixture), so a long shot
// can be told from a live chance.
import { GOAL_PTS, CS_PTS, fixtureRates, projectFixture, defconFixture, minutesBefore } from './fpl.mjs';

export const MIN_SWING = 0.3; // points against the field: anything smaller isn't worth rooting over
const MIN_CHANCE = 0.02; // rarer than one in fifty, and it isn't listed

const settled = (f) => Boolean(f.finished || f.finishedProvisional);
const minsIn = (live, f) => live?.explain?.find((x) => x.fixture === f.id)?.stats.find((s) => s.identifier === 'minutes')?.value ?? 0;
const chanceOf = (mean) => 1 - Math.exp(-Math.max(0, mean));

/**
 * Whether a player can still do anything in this fixture: on the pitch now (not sent off, and not a
 * starter whose minutes have fallen ten behind the match clock, who has been taken off, as
 * defconFixture reads it), or before kick-off, at least a one-in-four chance he plays. A player still
 * on the bench of a live match isn't counted.
 */
export function stillIn(id, f, ctx) {
  const el = ctx.elements[id];
  if (!el || settled(f)) return false;
  if (!f.started) return minutesBefore(el, f, ctx).pApp >= 0.25;
  const live = ctx.live[id];
  const here = minsIn(live, f);
  if (here <= 0 || (live?.st?.rc ?? 0) > 0) return false;
  return !((live?.st?.starts ?? 0) > 0 && (f.minutes ?? 0) - here >= 10);
}

/**
 * Everything that could still happen in one fixture, unfiltered: { events: [{ key, kind (goal, assist,
 * defcon, yellow), id, team, parts: [{ id, pts }] (who it pays and how much), swing, chance, you (your
 * multiplier on him), field (his EO %) }], cleanSheets: [{ key, kind: 'cs', team, parts, swing, chance,
 * you, field (the points it brings you and the field on average), yours (your players in it) }] for each
 * side still without a goal against it }. mine: { element: your live multiplier } (teamLive's lines);
 * field: { element: EO % } (leagueLive's ownership).
 */
function analyse(f, ctx, mine, field) {
  if (settled(f) || !ctx.model) return { events: [], cleanSheets: [] };
  const my = (id) => mine[id] ?? 0;
  const eo = (id) => (field[id] ?? 0) / 100;
  const swingOf = (parts) => parts.reduce((t, p) => t + (my(p.id) - eo(p.id)) * p.pts, 0);
  // Only players you or the field have can move you against it.
  const players = Object.values(ctx.elements).filter((el) => (el.team === f.home || el.team === f.away) && (my(el.id) > 0 || eo(el.id) > 0) && stillIn(el.id, f, ctx));
  const proj = Object.fromEntries(players.map((el) => [el.id, projectFixture(el.id, f, ctx)]));
  const events = [];
  const add = (e) => events.push({ ...e, swing: swingOf(e.parts) });
  for (const el of players) {
    const p = proj[el.id];
    const who = { id: el.id, team: el.team, you: my(el.id), field: field[el.id] ?? 0 };
    add({ key: `goal-${el.id}`, kind: 'goal', ...who, parts: [{ id: el.id, pts: GOAL_PTS[el.type] }], chance: chanceOf(p.xg) });
    add({ key: `assist-${el.id}`, kind: 'assist', ...who, parts: [{ id: el.id, pts: 3 }], chance: chanceOf(p.xa) });
    const dc = defconFixture(el.id, f, ctx);
    if (dc && !dc.reached) add({ key: `defcon-${el.id}`, kind: 'defcon', ...who, parts: [{ id: el.id, pts: 2 }], chance: dc.chance, have: dc.have, need: dc.need });
    // A booking, unless he already has one: his season's rate over the minutes still to come.
    if (!(ctx.live[el.id]?.st?.yc > 0) && el.minutes > 0) add({ key: `yellow-${el.id}`, kind: 'yellow', ...who, parts: [{ id: el.id, pts: -1 }], chance: chanceOf(((el.yc ?? 0) / el.minutes) * p.mins) });
  }
  // Each side's clean sheet while it still has one: its keeper's, defenders' and midfielders' points
  // for it, from those who'd have played the hour (before kick-off, weighted by the chance they do).
  const rates = fixtureRates(f, ctx.model);
  const left = f.started ? Math.max(0.03, Math.min(1, (90 - (f.minutes ?? 0)) / 90)) : 1;
  const cleanSheets = [];
  for (const side of [f.home, f.away]) {
    const conceded = f.started ? ((side === f.home ? f.as : f.hs) ?? 0) : 0;
    if (conceded > 0) continue;
    const parts = players
      .filter((el) => el.team === side && CS_PTS[el.type])
      .map((el) => ({ id: el.id, pts: CS_PTS[el.type] * (f.started ? (proj[el.id].p60 > 0 ? 1 : 0) : proj[el.id].p60) }))
      .filter((x) => x.pts > 0);
    cleanSheets.push({
      key: `cs-${side}`,
      kind: 'cs',
      team: side,
      parts,
      swing: swingOf(parts),
      chance: Math.exp(-(side === f.home ? rates.away : rates.home) * left),
      you: parts.reduce((t, x) => t + my(x.id) * x.pts, 0),
      field: parts.reduce((t, x) => t + eo(x.id) * x.pts, 0),
      yours: parts.filter((x) => my(x.id) > 0).map((x) => x.id),
    });
  }
  return { events, cleanSheets };
}

const worth = (e) => Math.abs(e.swing) >= MIN_SWING && e.chance >= MIN_CHANCE;
const bySwing = (a, b) => Math.abs(b.swing) - Math.abs(a.swing);

/**
 * Everything still worth rooting for or against in one fixture, biggest swing first: the players'
 * events and each side's clean sheet (analyse's shapes), leaving out swings under MIN_SWING and
 * anything rarer than MIN_CHANCE.
 */
export function rootEvents(f, ctx, mine, field) {
  const a = analyse(f, ctx, mine, field);
  return [...a.events, ...a.cleanSheets].filter(worth).sort(bySwing);
}

/**
 * Every fixture of the gameweek still to finish, the ones being played first, then by kick-off: { fixture,
 * events (the players' worth rooting over, biggest swing first), cleanSheets (both sides' while they
 * last, however small: whether a clean sheet helps you is always worth knowing) }.
 */
export function rootFixtures(ctx, mine, field) {
  return ctx.fixtures
    .filter((f) => !settled(f))
    .sort((a, b) => Number(b.started) - Number(a.started) || Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id - b.id)
    .map((f) => {
      const a = analyse(f, ctx, mine, field);
      return { fixture: f, events: a.events.filter(worth).sort(bySwing), cleanSheets: a.cleanSheets };
    });
}

/**
 * Where an event would leave you in a live table: each manager's points move by their own multipliers
 * on the players it pays. rows: [{ entry, total (live), mult: { element: multiplier } }]; me: your entry.
 * { now, after } places, ties shared; null when you aren't in the table.
 */
export function placeAfter(e, rows, me) {
  const mine = rows.find((r) => r.entry === me);
  if (!mine) return null;
  const gain = (mult) => e.parts.reduce((t, p) => t + (mult[p.id] ?? 0) * p.pts, 0);
  const mineAfter = mine.total + gain(mine.mult);
  const others = rows.filter((r) => r !== mine);
  return { now: 1 + others.filter((r) => r.total > mine.total).length, after: 1 + others.filter((r) => r.total + gain(r.mult) > mineAfter).length };
}
