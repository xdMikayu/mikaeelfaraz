import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clubChances, fixtureXg, matchChances, PENALTY_XG } from './chances.mjs';
import { defconRows, pointsPerXgi, samePointsLevels, samePointsLine } from './defcon.mjs';
import { defconPoints90 } from './fpl.mjs';

const near = (a, b, d = 1e-9) => assert.ok(Math.abs(a - b) < d, `${a} is not ${b}`);
const mins = (fixture, min) => ({ fixture, stats: [{ identifier: 'minutes', points: min >= 60 ? 2 : 1, value: min }] });

test('chances: each player’s xG goes to his club’s fixture, split by minutes in a double gameweek', () => {
  const fixtures = [
    { id: 1, team_h: 10, team_a: 20 },
    { id: 2, team_h: 30, team_a: 10 },
  ];
  const teamOf = { 101: 10, 102: 10, 201: 20, 301: 30, 999: 40 };
  const live = {
    elements: [
      { id: 101, stats: { expected_goals: '0.90' }, explain: [mins(1, 90), mins(2, 45)] }, // 0.6 and 0.3
      { id: 102, stats: { expected_goals: '0.20' }, explain: [mins(1, 0), mins(2, 30)] }, // all in fixture 2
      { id: 201, stats: { expected_goals: '1.10' }, explain: [mins(1, 90)] },
      { id: 301, stats: { expected_goals: '0.40' }, explain: [mins(2, 90)] },
      { id: 999, stats: { expected_goals: '0.70' }, explain: [mins(1, 90)] }, // moved clubs since: not counted
    ],
  };
  const xg = fixtureXg(live, teamOf, fixtures);
  near(xg[1][0], 0.6);
  near(xg[1][1], 1.1);
  near(xg[2][0], 0.4);
  near(xg[2][1], 0.5);
});

test('chances: big chances are scored plus missed, penalties every attempt, from Opta’s names', () => {
  const data = {
    21: { M: [{ name: 'big_chance_scored', value: 2 }, { name: 'big_chance_missed', value: 3 }, { name: 'att_pen_goal', value: 1 }, { name: 'att_pen_target', value: 1 }] },
    5: { M: [{ name: 'big_chance_created', value: 1 }] },
  };
  assert.deepEqual(matchChances(data, 21.0, 5), { bc: [5, 0], pens: [2, 0] });
  assert.equal(matchChances(data, 21, 7), null, 'a side without stats');
});

test('chances: clubs add up both ends, with penalties taken off xG and big chances', () => {
  const file = {
    matches: [
      // date, gw, home, away, goals, goals, xG, xG, pens, pens, big chances, big chances
      ['2026-08-22', 1, 1, 2, 2, 0, 2.29, 0.5, 1, 0, 4, 1],
      ['2026-08-29', 2, 3, 1, 1, 1, 1.2, 0.8, 0, 0, 2, 2],
    ],
  };
  const all = clubChances(file);
  assert.equal(all[1].n, 2);
  assert.equal(all[1].gf, 3);
  assert.equal(all[1].ga, 1);
  near(all[1].npxg, 2.29 - PENALTY_XG + 0.8);
  near(all[1].npxga, 0.5 + 1.2);
  assert.equal(all[1].bc, 3 + 2);
  assert.equal(all[1].bca, 1 + 2);
  near(all[2].npxga, 2.29 - PENALTY_XG);
  assert.equal(all[2].bca, 3);
  const one = clubChances(file, [2]);
  assert.equal(one[1].n, 1);
  assert.equal(one[2], undefined);
});

test('defcon: per-90 rates and their worth, for players with the minutes', () => {
  const el = (id, type) => ({ id, type, team: 1, cost: 5, owned: 1, name: `P${id}` });
  const players = [
    { id: 1, el: el(1, 2), min: 360, dc: 44, xg: 0.4, xa: 0.4 }, // 11 DC, 0.1 xG, 0.1 xA per 90
    { id: 2, el: el(2, 2), min: 200, dc: 30, xg: 1, xa: 0 }, // too few minutes
    { id: 3, el: el(3, 3), min: 900, dc: 100, xg: 1, xa: 1 }, // a midfielder
  ];
  const rows = defconRows(players, 2, 270, { 1: { apps: 4, dcHits: 3 } });
  assert.deepEqual(rows.map((r) => r.id), [1]);
  const [r] = rows;
  near(r.dc90, 11);
  near(r.xgi90, 0.2);
  near(r.def, defconPoints90(2, 11));
  near(r.att, 6 * 0.1 + 3 * 0.1);
  near(r.value, r.def + r.att);
  assert.equal(r.hits, 3);
  // An xGI is worth 6 to a defender who only shoots, 3 to one who only creates.
  near(pointsPerXgi([{ xg90: 0.2, xgi90: 0.2, min: 90 }], 2), 6);
  near(pointsPerXgi([{ xg90: 0, xgi90: 0.2, min: 90 }], 2), 3);
});

test('defcon: three round levels under the best, and curves that fall where the line is', () => {
  assert.deepEqual(samePointsLevels([0.4, 1.2, 2.52]), [1.5, 2, 2.5]);
  assert.deepEqual(samePointsLevels([3.39]), [2, 2.5, 3]);
  assert.deepEqual(samePointsLevels([4.7]), [2, 3, 4]);
  assert.deepEqual(samePointsLevels([0.6]), [0.5]);
  const perXgi = 4.6;
  const curve = samePointsLine(1.5, 2, perXgi, 14);
  near(curve[0][1], 1.5 / perXgi);
  for (let i = 1; i < curve.length; i++) assert.ok(curve[i][1] <= curve[i - 1][1] + 1e-12, 'never rises');
  // Worth 1.5 from DEFCON alone at about 12 per 90 (a 76% chance of reaching 10), so it meets zero there.
  const [x, y] = curve[curve.length - 1];
  assert.equal(y, 0);
  near(defconPoints90(2, x), 1.5, 1e-6);
  // The steepest fall is around the line of 10, not far from it.
  const drops = curve.slice(1).map((p, i) => [p[0], curve[i][1] - p[1]]);
  const steepest = drops.reduce((m, d) => (d[1] > m[1] ? d : m));
  assert.ok(steepest[0] > 8 && steepest[0] < 11.5, `steepest at ${steepest[0]}`);
  // A level above DEFCON's 2 points never reaches zero: it runs the whole width.
  near(samePointsLine(2.5, 2, perXgi, 14).pop()[0], 14);
});
