import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lapSeconds, lapText, gapText, standingsOf, winnersOf, classificationOf, qualifyingOf, roundOf, titleRace } from './f1.mjs';

const D = (id, code, first, last) => ({ driverId: id, code, permanentNumber: '1', givenName: first, familyName: last });
const C = (id, name) => ({ constructorId: id, name });

test('lap times both ways', () => {
  assert.equal(lapSeconds('1:35.202'), 95.202);
  assert.equal(lapSeconds('35.2'), 35.2);
  assert.equal(lapSeconds(''), null);
  assert.equal(lapSeconds('+7.335'), null);
  assert.equal(lapText(95.202), '1:35.202');
  assert.equal(lapText(61.05), '1:01.050');
  assert.equal(lapText(35.2), '35.200');
  assert.equal(lapText(null), '–');
  assert.equal(gapText(0.0541), '+0.054');
});

test('both championships from Jolpica', () => {
  const ds = { MRData: { StandingsTable: { StandingsLists: [{ season: '2026', round: '17', DriverStandings: [
    { position: '1', points: '340', wins: '8', Driver: D('antonelli', 'ANT', 'Andrea Kimi', 'Antonelli'), Constructors: [C('mercedes', 'Mercedes')] },
    // Moved teams mid-season: the latest counts.
    { position: '2', points: '238', wins: '3', Driver: D('russell', 'RUS', 'George', 'Russell'), Constructors: [C('williams', 'Williams'), C('mercedes', 'Mercedes')] },
  ] }] } } };
  const cs = { MRData: { StandingsTable: { StandingsLists: [{ season: '2026', round: '17', ConstructorStandings: [{ position: '1', points: '578', wins: '11', Constructor: C('mercedes', 'Mercedes') }] }] } } };
  const s = standingsOf(ds, cs);
  assert.equal(s.season, 2026);
  assert.equal(s.round, 17);
  assert.equal(s.drivers[0].points, 340);
  assert.equal(s.drivers[1].team.id, 'mercedes');
  assert.equal(s.constructors[0].team.name, 'Mercedes');
  assert.deepEqual(standingsOf(null, null).drivers, []);
});

test('each round’s winner', () => {
  const json = { MRData: { RaceTable: { Races: [{ round: '1', Results: [{ Driver: D('russell', 'RUS', 'George', 'Russell'), Constructor: C('mercedes', 'Mercedes') }] }, { round: '2', Results: [] }] } } };
  const w = winnersOf(json);
  assert.equal(w[1].driver.code, 'RUS');
  assert.equal(w[2], undefined);
});

test('a lapped car is a lap down, not a few seconds', () => {
  const row = (pos, code, laps, status, time) => ({ position: String(pos), positionText: status === 'Retired' ? 'R' : String(pos), Driver: D(code.toLowerCase(), code, 'A', code), Constructor: C('t', 'T'), grid: '3', laps: String(laps), status, points: '0', ...(time ? { Time: { time, millis: '1' } } : {}) });
  const c = classificationOf([row(1, 'VER', 62, 'Finished', '1:42:00.785'), row(2, 'LEC', 62, 'Finished', '+7.335'), row(3, 'GAS', 61, 'Lapped', '+2.171'), row(4, 'PER', 60, 'Lapped', '+20.520'), row(5, 'ALB', 59, 'Retired', '')]);
  assert.deepEqual(c.map((x) => x.time), ['1:42:00.785', '+7.335', '+1 lap', '+2 laps', null]);
  assert.equal(c[4].text, 'R');
});

test('qualifying: the part each went out in and the gap that decided it', () => {
  const r = (pos, code, q1, q2, q3) => ({ position: String(pos), Driver: D(code.toLowerCase(), code, 'A', code), Constructor: C('t', 'T'), Q1: q1, Q2: q2, Q3: q3 });
  const q = qualifyingOf([r(1, 'VER', '1:33.241', '1:31.639', '1:31.373'), r(2, 'LEC', '1:32.774', '1:31.953', '1:31.427'), r(3, 'HUL', '1:33.000', '1:32.784'), r(4, 'ALO', '1:34.223'), r(5, 'HAD')]);
  assert.deepEqual(q.map((x) => x.part), [3, 3, 2, 1, null]);
  assert.ok(Math.abs(q[1].gap - 0.054) < 1e-9);
  assert.ok(Math.abs(q[2].gap - (92.784 - 91.639)) < 1e-9, 'against the fastest in Q2');
  assert.ok(Math.abs(q[3].gap - (94.223 - 92.774)) < 1e-9, 'against the fastest in Q1');
  assert.equal(q[4].gap, null);
});

test('a round with nothing run yet', () => {
  const empty = { MRData: { RaceTable: { Races: [] } } };
  const r = roundOf(empty, empty, empty);
  assert.equal(r.race, null);
  assert.equal(r.qualifying, null);
});

test('the title maths', () => {
  const sess = (sprint) => [...(sprint ? [{ label: 'Sprint' }] : []), { label: 'Race' }];
  const races = [1, 2, 3, 4].map((round) => ({ round, sessions: sess(round === 4) }));
  const drivers = [
    { pos: 1, points: 100, driver: { last: 'A' } },
    { pos: 2, points: 60, driver: { last: 'B' } },
    { pos: 3, points: 40, driver: { last: 'C' } },
  ];
  const constructors = [{ pos: 1, points: 150, team: { name: 'X' } }, { pos: 2, points: 40, team: { name: 'Y' } }];
  // Rounds 1 and 2 run: two races and one sprint left, 25 + 25 + 8 for a driver, 43 + 43 + 15 for a team.
  const t = titleRace({ drivers, constructors }, races, { 1: {}, 2: {} }, {});
  assert.equal(t.racesLeft, 2);
  assert.equal(t.sprintsLeft, 1);
  assert.deepEqual(t.most, { driver: 58, team: 101 });
  assert.equal(t.drivers.gap, 40);
  assert.equal(t.drivers.decided, false);
  assert.equal(t.drivers.contenders, 2, 'C, 60 behind, is out of it');
  assert.equal(t.constructors.decided, true, 'Y can’t make up 110 with 101 left');
  // All run: the leader has won it.
  const done = titleRace({ drivers, constructors }, races, { 1: {}, 2: {}, 3: {}, 4: {} }, { 4: {} });
  assert.equal(done.racesLeft + done.sprintsLeft, 0);
});
