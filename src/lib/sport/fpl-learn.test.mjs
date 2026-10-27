import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countTail, poissonTail, projectFixture, buildModel } from './fpl.mjs';
import { partsFromStats, partsFromExplain, readHistory, playersBefore, logistic, fitDc, scoreWeek, PART_KEYS } from './fpl-learn.mjs';
import { withRecent } from './kit.mjs';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('counts that bunch: the negative binomial tail, and Poisson without a size', () => {
  close(countTail(6, 10), poissonTail(6, 10));
  // More spread puts more weight far above the mean...
  assert.ok(countTail(6, 10, 3) > poissonTail(6, 10));
  // ...and less near it, and it becomes Poisson as the size grows.
  assert.ok(countTail(11, 10, 3) < poissonTail(11, 10));
  close(countTail(6, 10, 1e7), poissonTail(6, 10), 1e-5);
  assert.equal(countTail(6, 0, 3), 1);
});

test('what FPL paid, part by part, adds up to its points', () => {
  // A defender: 90 minutes, a goal, an assist, a clean sheet, 11 defensive contributions, 2 bonus, a booking.
  const def = partsFromStats(2, { minutes: '90', goals_scored: '1', assists: '1', clean_sheets: '1', goals_conceded: '0', defensive_contribution: '11', bonus: '2', yellow_cards: '1' });
  assert.deepEqual(def, { app: 2, goals: 6, assists: 3, cs: 4, gc: 0, saves: 0, dc: 2, bonus: 2, cards: -1, other: 0 });
  // A goalkeeper: 7 saves, 3 conceded, a penalty saved.
  const gk = partsFromStats(1, { minutes: '90', saves: '7', goals_conceded: '3', penalties_saved: '1' });
  assert.deepEqual(gk, { app: 2, goals: 0, assists: 0, cs: 0, gc: -1, saves: 2, dc: 0, bonus: 0, cards: 0, other: 5 });
  // A midfielder on for 20 minutes short of the line.
  assert.equal(partsFromStats(3, { minutes: '20', defensive_contribution: '11' }).dc, 0);
  const fromFpl = partsFromExplain([{ fixture: 1, stats: [{ identifier: 'minutes', points: 2 }, { identifier: 'bonus', points: 3 }, { identifier: 'own_goals', points: -2 }] }]);
  assert.equal(fromFpl.app, 2);
  assert.equal(fromFpl.bonus, 3);
  assert.equal(fromFpl.other, -2);
  assert.deepEqual(Object.keys(fromFpl), PART_KEYS);
});

// Two clubs, three gameweeks: player 1 starts every match, player 2 is dropped in gameweek 2.
const parts = PART_KEYS.map(() => 0);
const hist = readHistory({
  season: '2026',
  fields: ['gw', 'id', 'team', 'fixtures', 'min', 'starts', 'xg', 'xa', 'xgc', 'saves', 'bonus', 'dc', 'yc', 'goals', 'assists', 'pts', 'fplXp', 'parts'],
  parts: PART_KEYS,
  teams: [
    { id: 1, name: 'A', espn: '1' },
    { id: 2, name: 'B', espn: '2' },
  ],
  fixtures: [1, 2, 3].map((gw) => ({ id: gw, event: gw, kickoff: `2026-08-${10 + gw}T14:00:00Z`, home: 1, away: 2, odds: [1.5, 1.1] })),
  players: { 1: { type: 4, name: 'One', team: 1 }, 2: { type: 2, name: 'Two', team: 2 } },
  rows: [
    [1, 1, 1, [1], 90, 1, 0.5, 0.1, 1, 0, 1, 2, 0, 1, 0, 8, null, parts],
    [1, 2, 2, [1], 90, 1, 0.1, 0, 1.4, 0, 0, 12, 0, 0, 0, 4, null, parts],
    [2, 1, 1, [2], 80, 1, 0.3, 0.2, 1, 0, 0, 1, 1, 0, 0, 2, null, parts],
    [2, 2, 2, [2], 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, parts],
    [3, 1, 1, [3], 90, 1, 0.2, 0, 1, 0, 0, 0, 0, 0, 0, 2, null, parts],
    [3, 2, 2, [3], 90, 1, 0, 0, 1, 0, 0, 9, 0, 0, 0, 2, null, parts],
  ],
});

test("a replayed week sees only the season's totals and matches before its deadline", () => {
  const [one, two] = playersBefore(hist, 3);
  assert.equal(one.minutes, 170);
  assert.equal(one.starts, 2);
  close(one.xg, 0.8);
  assert.equal(one.bonus, 1);
  close(two.dc90, (12 / 90) * 90);
  // Newest first: [share of the match's starts, minutes].
  assert.deepEqual(two.recent, [[0, 0], [1, 90]]);
  assert.deepEqual(playersBefore(hist, 1)[0].recent, []);
  assert.equal(playersBefore(hist, 3, new Set([2]))[1].playing, 0);
});

test('learned minutes read his last three matches', () => {
  const minutes = { start: [-3, 3, 3, 1, 0], sub: [-3, 1, 3, 0], minStart: [40, 0.5], p60: [-2, 5], minSub: 18, perStart: 74 };
  const els = [
    { id: 1, team: 1, type: 4, minutes: 270, starts: 3, xg: 1, xa: 0.3, dc90: 1 },
    { id: 2, team: 2, type: 2, minutes: 270, starts: 3, xg: 0.1, xa: 0, dc90: 9 },
  ];
  const model = { ...buildModel(els.map((e) => ({ ...e, xgc: 3 }))), learned: { minutes } };
  model.teams[1].n = 3;
  model.teams[2].n = 3;
  const f = { id: 9, event: 4, home: 1, away: 2 };
  const ctx = (recent) => ({ elements: withRecent(els, recent), live: {}, fixtures: [], model: { ...model, byFixture: { 9: { home: 1.5, away: 1.1 } } }, from: 4 });
  const started = projectFixture(1, f, ctx({ 1: [[1, 90], [1, 90], [1, 90]] }));
  const dropped = projectFixture(1, f, ctx({ 1: [[0, 0], [1, 90], [1, 90]] }));
  close(started.pApp, 1 / (1 + Math.exp(-(-3 + 3 + 3 + 1))) + (1 - 1 / (1 + Math.exp(-4))) * (1 / (1 + Math.exp(-(-3 + 1 + 3)))));
  assert.ok(dropped.pApp < started.pApp);
  assert.ok(dropped.xp < started.xp);
  // Without his recent matches the plain minutes stand.
  const plain = projectFixture(1, f, ctx(null));
  close(plain.pApp, 1);
});

test("a defender's defensive contributions: each way he might play on its own", () => {
  const els = [{ id: 2, team: 2, type: 2, minutes: 450, starts: 5, xg: 0, xa: 0, dc90: 9, xgc: 5 }];
  const model = buildModel(els);
  model.teams[2].n = 10;
  const f = { id: 9, event: 4, home: 1, away: 2 };
  const ctx = { elements: withRecent(els, null), live: {}, fixtures: [], model: { ...model, byFixture: { 9: { home: 1.5, away: 1.1 } } }, from: 4 };
  const p = projectFixture(2, f, ctx);
  // Starts half his club's matches, a full 90 when he does: half the chance of a full match's.
  close(p.parts.dc, 2 * 0.5 * poissonTail(9, 10) + 2 * 0.15 * poissonTail(9 * (20 / 90), 10), 1e-9);
});

test('logistic regression finds the coefficients behind its data', () => {
  const X = [];
  const y = [];
  for (let i = 0; i < 4000; i++) {
    const x = (i % 100) / 25 - 2;
    const p = 1 / (1 + Math.exp(-(0.5 + 1.5 * x)));
    X.push([1, x]);
    y.push(((i * 7919) % 1000) / 1000 < p ? 1 : 0);
  }
  const [b0, b1] = logistic(X, y);
  close(b0, 0.5, 0.15);
  close(b1, 1.5, 0.2);
});

test('the spread of defensive contributions is fitted by position, and weeks are scored on regulars', () => {
  const rows = [];
  for (let i = 0; i < 400; i++) rows.push({ type: 2, n: 1, features: { dc90: 6 }, row: { min: 90, parts: { dc: i % 6 === 0 ? 2 : 0 } } });
  const size = fitDc(rows)[2];
  // One in six full matches reach 10 at 6 a match: far more than Poisson's 8%, so a small size.
  close(countTail(6, 10, size), 1 / 6, 0.05);
  const week = [
    { share: 1, xp: 6, row: { pts: 8 } },
    { share: 1, xp: 2, row: { pts: 2 } },
    { share: 0, xp: 9, row: { pts: 0 } },
  ];
  const s = scoreWeek(week);
  close(s.sq, Math.sqrt(2));
  close(s.abs, 1);
  close(s.rho, 1);
});
