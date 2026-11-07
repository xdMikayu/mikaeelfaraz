import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, projectFixture } from './fpl.mjs';
import { rootEvents, rootFixtures, placeAfter, stillIn, MIN_SWING } from './fpl-root.mjs';

// Two equal sides of eleven regulars (keeper, four defenders, four midfielders, two forwards); the
// home defender 101 gets forward a lot, and away striker 210 takes a third of his side's xG.
function world() {
  const els = [];
  for (const team of [1, 2]) for (let i = 0; i < 11; i++) els.push({ id: team * 100 + i, team, type: i === 0 ? 1 : i < 5 ? 2 : i < 9 ? 3 : 4, minutes: 450, starts: 5, yc: 1, xg: i === 10 ? 2.5 : i === 1 ? 0.8 : i > 4 ? 0.5 : 0.1, xa: 0.3, xgc: 6.5 });
  const elements = Object.fromEntries(els.map((e) => [e.id, e]));
  const fixtures = [{ id: 1, home: 1, away: 2, started: false, finished: false, finishedProvisional: false, minutes: 0, hs: null, as: null, kickoff: '2026-11-07T15:00:00Z' }];
  return { elements, live: {}, fixtures, bonus: {}, model: buildModel(els) };
}

// You: home defender 101 and away striker 210 as captain. The field: 101 at 20%, 210 at 150% (captained
// by many), away defender 201 at 40%.
const mine = { 101: 1, 210: 2 };
const field = { 101: 20, 210: 150, 201: 40 };
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('root for: each event’s swing is (your multiplier − the field’s EO) × the points it pays', () => {
  const ctx = world();
  const ev = rootEvents(ctx.fixtures[0], ctx, mine, field);
  const by = Object.fromEntries(ev.map((e) => [e.key, e]));
  // A goal from your defender: 6 × (1 − 0.2); his assist 3 × 0.8; your captain's goal 4 × (2 − 1.5).
  assert.ok(near(by['goal-101'].swing, 4.8));
  assert.ok(near(by['assist-101'].swing, 2.4));
  assert.ok(near(by['goal-210'].swing, 2));
  assert.deepEqual(by['goal-101'].parts, [{ id: 101, pts: 6 }]);
  assert.deepEqual([by['goal-101'].you, by['goal-101'].field], [1, 20]);
  // The away defender the field has and you don't: his goal costs you 6 × 0.4.
  assert.ok(near(by['goal-201'].swing, -2.4));
  // Chances come from the projections: the goal's is one minus the chance he doesn't score.
  assert.ok(near(by['goal-101'].chance, 1 - Math.exp(-projectFixture(101, ctx.fixtures[0], ctx).xg)));
  // Your home clean sheet: 4 points for 101 if he plays the hour (before kick-off, by its chance).
  const p60 = projectFixture(101, ctx.fixtures[0], ctx).p60;
  assert.ok(near(by['cs-1'].swing, 4 * p60 * 0.8));
  assert.ok(near(by['cs-1'].you, 4 * p60) && near(by['cs-1'].field, 4 * p60 * 0.2));
  assert.deepEqual(by['cs-1'].yours, [101]);
  // The away clean sheet is the field's: it costs you their defender's share.
  assert.ok(by['cs-2'].swing < 0 && by['cs-2'].yours.length === 0);
  // Biggest swing first, nothing too small to matter, every chance a probability.
  for (let i = 1; i < ev.length; i++) assert.ok(Math.abs(ev[i - 1].swing) >= Math.abs(ev[i].swing));
  assert.ok(ev.every((e) => Math.abs(e.swing) >= MIN_SWING && e.chance > 0 && e.chance < 1));
  // A player nobody has moves nobody: no events for the home striker 110.
  assert.ok(!ev.some((e) => e.id === 110));
});

test('root for: in a live match, only who’s still on, and a clean sheet only while it lasts', () => {
  const ctx = world();
  // 70 minutes gone, the away side a goal up: the home clean sheet has gone.
  ctx.fixtures[0] = { ...ctx.fixtures[0], started: true, minutes: 70, hs: 0, as: 1 };
  const on = (minutes, starts, extra = {}) => ({ minutes, points: 2, bonus: 0, bps: 0, explain: [{ fixture: 1, stats: [{ identifier: 'minutes', points: 2, value: minutes }] }], st: { starts, yc: 0, rc: 0 }, ...extra });
  ctx.live = { 101: on(55, 1), 201: on(70, 1), 210: on(20, 0) };
  const f = ctx.fixtures[0];
  // 101 started and is fifteen minutes behind the clock: taken off. 210 came on: still on.
  assert.equal(stillIn(101, f, ctx), false);
  assert.equal(stillIn(210, f, ctx), true);
  assert.equal(stillIn(201, f, ctx), true);
  assert.equal(stillIn(105, f, ctx), false, 'not on the pitch');
  const ev = rootEvents(f, ctx, mine, field);
  assert.ok(!ev.some((e) => e.id === 101), 'nothing left for a player taken off');
  assert.ok(!ev.some((e) => e.key === 'cs-1'), 'no home clean sheet after conceding');
  // The away clean sheet is still alive, with their defender on for the hour.
  const cs = ev.find((e) => e.key === 'cs-2');
  assert.ok(cs && near(cs.swing, -4 * 0.4));
  // Sent off: nothing more from him.
  ctx.live[201] = on(70, 1, { st: { starts: 1, yc: 1, rc: 1 } });
  assert.equal(stillIn(201, f, ctx), false);
  // A finished match has nothing left in it.
  assert.deepEqual(rootEvents({ ...f, finished: true, finishedProvisional: true, minutes: 90 }, ctx, mine, field), []);
});

test('root for: matches being played first, then by kick-off; finished ones left out', () => {
  const ctx = world();
  const base = ctx.fixtures[0];
  ctx.fixtures = [
    { ...base, id: 3, kickoff: '2026-11-08T16:30:00Z' },
    { ...base, id: 2, kickoff: '2026-11-07T12:30:00Z', started: true, finished: true, finishedProvisional: true, minutes: 90, hs: 1, as: 1 },
    { ...base, id: 4, kickoff: '2026-11-07T17:30:00Z', started: true, minutes: 30, hs: 0, as: 0 },
    { ...base, id: 1, kickoff: '2026-11-07T15:00:00Z' },
  ];
  const list = rootFixtures(ctx, mine, field);
  assert.deepEqual(list.map((x) => x.fixture.id), [4, 1, 3]);
  // Both sides' clean sheets on their own, whatever their size, and none among the players' events.
  assert.deepEqual(list[1].cleanSheets.map((c) => c.key), ['cs-1', 'cs-2']);
  assert.ok(list.every((x) => !x.events.some((e) => e.kind === 'cs')));
  assert.ok(list[1].events.length > 0);
  // A side nobody has any of still says so: a clean sheet worth nothing either way.
  const none = rootFixtures(ctx, { 210: 2 }, { 210: 150 });
  assert.ok(none[1].cleanSheets.every((c) => c.swing === 0 && c.you === 0 && c.field === 0));
});

test('root for: where an event would leave you in the league, each manager moved by their own multipliers', () => {
  const rows = [
    { entry: 1, total: 100, mult: { 101: 1 } },
    { entry: 2, total: 103, mult: {} },
    { entry: 3, total: 98, mult: { 101: 2 } },
  ];
  const goal = { parts: [{ id: 101, pts: 6 }] };
  // You go to 106 and past the leader's 103; the manager who captained him goes to 110 and past you both.
  assert.deepEqual(placeAfter(goal, rows, 1), { now: 2, after: 2 });
  assert.deepEqual(placeAfter(goal, rows.slice(0, 2), 1), { now: 2, after: 1 });
  // A booking for him costs you a place only when someone is within a point.
  assert.deepEqual(placeAfter({ parts: [{ id: 101, pts: -1 }] }, [{ entry: 1, total: 100, mult: { 101: 1 } }, { entry: 4, total: 99.5, mult: {} }], 1), { now: 1, after: 2 });
  assert.equal(placeAfter(goal, rows, 9), null);
});
