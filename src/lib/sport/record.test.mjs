import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readiness, gradeWeek, seasonOf, buildRecord } from './record.mjs';

// A gameweek of two matches, in getLive's shape.
const fx = (id, over, extra = {}) => ({ id, kickoff: `2026-10-2${id}T14:00:00Z`, started: over, finished: false, finishedProvisional: over, minutes: over ? 90 : 0, bps: {}, bonus: {}, ...extra });
const el = (points, minutes = 90, xg = 0) => ({ points, minutes, xg, xa: 0 });

test('a gameweek is graded once its last match is over, and final once FPL finishes it', () => {
  assert.equal(readiness({ finished: false }, [fx(1, true), fx(2, false)]), null);
  assert.equal(readiness({ finished: false }, [fx(1, true), fx(2, true)]), 'provisional');
  assert.equal(readiness({ finished: true }, [fx(1, true), fx(2, true)]), 'final');
  // Nothing to grade in a gameweek without matches.
  assert.equal(readiness({ finished: false }, []), null);
});

// Saved projections: [xp, xg, xa, netXg, netXa, fplEp].
const snap = (gw, deadline) => ({
  gw,
  deadline,
  at: '2026-10-23T13:34:30Z',
  players: { 1: [6, 0.6, 0.2, 0.7, 0.2, 3], 2: [4, 0.3, 0.1, 0.3, 0.1, 5], 3: [2.5, 0.1, 0, 0.1, 0, 1], 4: [1, 0, 0, 0, 0, 1] },
});

test('grading a gameweek: errors, top picks and captains against what happened', () => {
  const live = { fixtures: [fx(3, true, { bonus: { 1: 3 } }), fx(4, true, { bonus: { 9: 3 } })], elements: { 1: el(13, 90, 1.1), 2: el(2), 3: el(1, 30) } };
  const w = gradeWeek(snap(8, '2026-10-23T17:30:00Z'), live, (id) => `P${id}`, 'provisional');
  assert.equal(w.provisional, true);
  // Players 1-3 were projected 2 or more by one side; player 4 by neither.
  assert.equal(w.n, 3);
  assert.equal(w.points.maeOurs, (7 + 2 + 1.5) / 3);
  assert.equal(w.points.maeFpl, (10 + 3 + 0) / 3);
  assert.deepEqual(w.points.captainOurs, { name: 'P1', pts: 13 });
  assert.deepEqual(w.points.captainFpl, { name: 'P2', pts: 2 });
  // Player 4 didn't play: 0 points.
  assert.equal(w.points.top10Best, (13 + 2 + 1 + 0) / 4);
  assert.equal(gradeWeek(snap(8, '2026-10-23T17:30:00Z'), live, String).provisional, undefined);
});

test('a finished match FPL has no bonus for yet gets the bonus its BPS gives', () => {
  const live = { fixtures: [fx(3, true, { bps: { 1: 40, 2: 30, 3: 20 } })], elements: { 1: el(10), 2: el(2), 3: el(1, 30) } };
  const w = gradeWeek(snap(8, '2026-10-23T17:30:00Z'), live, String, 'provisional');
  assert.deepEqual(w.points.captainOurs, { name: '1', pts: 13 });
  assert.equal(w.points.top10Best, (13 + 4 + 2 + 0) / 4);
});

test('the season over the graded weeks', () => {
  const w = (gw, maeOurs, maeFpl, cap) => ({ gw, points: { maeOurs, maeFpl, top10Ours: 5, top10Fpl: 3, captainOurs: { pts: cap }, captainFpl: null } });
  assert.equal(seasonOf([]), null);
  assert.deepEqual(seasonOf([w(7, 2, 3, 13), w(8, 3, 2.5, 8)]), { weeks: 2, maeOurs: 2.5, maeFpl: 2.75, top10Ours: 5, top10Fpl: 3, captainOurs: 21, captainFpl: 0, beatFplWeeks: 1 });
});

test('the record: final weeks kept, a finished one graded at once, one being played waiting, the next deadline saving', async () => {
  const now = Date.parse('2026-10-26T08:00:00Z');
  const st = {
    elements: [1, 2, 3, 4].map((id) => ({ id, name: `P${id}` })),
    events: [
      { id: 7, deadline: '2026-10-17T10:00:00Z', finished: true },
      { id: 8, deadline: '2026-10-23T17:30:00Z', finished: false },
      { id: 9, deadline: '2026-10-25T11:00:00Z', finished: false },
      { id: 10, deadline: '2026-10-31T11:00:00Z', finished: false },
    ],
  };
  const lives = {
    8: { fixtures: [fx(3, true), fx(4, true)], elements: { 1: el(8) } },
    9: { fixtures: [fx(5, true), fx(6, false), fx(7, false)], elements: {} },
  };
  const asked = [];
  const live = async (gw) => (asked.push(gw), lives[gw]);
  const kept = [{ gw: 7, savedAt: 'x', n: 1, points: { maeOurs: 2, maeFpl: 3, top10Ours: 5, top10Fpl: 3, captainOurs: { pts: 13 }, captainFpl: { pts: 6 } } }];
  const snaps = [snap(9, '2026-10-25T11:00:00Z'), snap(7, '2026-10-17T10:00:00Z'), snap(8, '2026-10-23T17:30:00Z'), { ...snap(10, '2026-10-31T11:00:00Z'), at: '2026-10-26T07:00:00Z' }];
  const r = await buildRecord({ snaps, st, live, kept, now });
  // Gameweek 7 was graded final before: not asked of FPL again.
  assert.deepEqual(asked, [8, 9]);
  assert.deepEqual(r.weeks.map((w) => [w.gw, w.provisional ?? false]), [[7, false], [8, true]]);
  assert.deepEqual(r.awaiting, [{ gw: 9, deadline: '2026-10-25T11:00:00Z', savedAt: '2026-10-23T13:34:30Z', played: 1, of: 3, last: '2026-10-27T14:00:00Z' }]);
  assert.deepEqual(r.pending, { gw: 10, deadline: '2026-10-31T11:00:00Z', savedAt: '2026-10-26T07:00:00Z' });
  assert.equal(r.firstWeek, 7);
  assert.equal(r.season.weeks, 2);
  // A week graded provisional before is graded again until FPL finishes it.
  const again = await buildRecord({ snaps, st, live, kept: [...kept, { ...r.weeks[1] }], now });
  assert.equal(again.weeks[1].provisional, true);
  assert.deepEqual(asked.slice(2), [8, 9]);
});
