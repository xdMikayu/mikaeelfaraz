import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withScores, asItStands, ifTheyWin, moveWords } from './as-it-stands.mjs';

const row = (id, pts, gd, gf, p = 6) => ({ id, pts, gd, gf, ga: gf - gd, p });
const table = { groups: [{ rows: [row('city', 18, 11, 15), row('ars', 15, 5, 12), row('bri', 13, 13, 18), row('bre', 10, 6, 11), row('eve', 10, 3, 9), row('liv', 9, 0, 8)] }] };
const live = (h, hs, a, as) => ({ home: { id: h, score: hs }, away: { id: a, score: as } });

test('as it stands: the live score counted, the order by points, goal difference, goals', () => {
  // Liverpool win 2–0 at Brentford: Liverpool go up to 12 points, 4th. Brentford stay on 10, level
  // with Everton, and their +4 against Everton's +3 keeps them 5th.
  const r = asItStands(table, 'bre', 'liv', [live('bre', 0, 'liv', 2)]);
  assert.deepEqual(r.home, { from: 4, to: 5 });
  assert.deepEqual(r.away, { from: 6, to: 4 });
  assert.equal(r.size, 6);
  // 3–0: Brentford and Everton both +3, Brentford's 11 goals to Everton's 9 still keep them above.
  const big = asItStands(table, 'bre', 'liv', [live('bre', 0, 'liv', 3)]);
  assert.equal(big.home.to, 5);
  assert.equal(big.away.to, 4);
  // A draw: Liverpool on 10 but Everton's goal difference keeps them above.
  const draw = asItStands(table, 'bre', 'liv', [live('bre', 1, 'liv', 1)]);
  assert.deepEqual(draw.away, { from: 6, to: 6 });
  assert.deepEqual(draw.home, { from: 4, to: 4 });
});

test('as it stands: every live match in the league counts, not just this one', () => {
  // Arsenal winning alone go level on points with City, but behind on goal difference.
  const alone = asItStands(table, 'ars', 'eve', [live('ars', 1, 'eve', 0)]);
  assert.equal(alone.home.to, 2);
  // Arsenal 5–0 and City losing 1–0: both 18 points and +10, Arsenal's 17 goals to City's 15 put them top.
  const both = asItStands(table, 'ars', 'eve', [live('ars', 5, 'eve', 0), live('city', 0, 'bri', 1)]);
  assert.equal(both.home.to, 1);
  // A match not started (no score) changes nothing.
  const unplayed = asItStands(table, 'ars', 'eve', [live('ars', 0, 'eve', 0), { home: { id: 'city', score: null }, away: { id: 'bri', score: null } }]);
  assert.equal(unplayed.home.to, 2);
});

test('as it stands: sides from different tables, or not in one, give nothing', () => {
  assert.equal(asItStands(table, 'ars', 'psg', [live('ars', 1, 'psg', 0)]), null);
  assert.equal(asItStands(null, 'ars', 'eve', []), null);
});

test('if they win: where a win would take each side', () => {
  const w = ifTheyWin(table, 'bre', 'liv');
  // Brentford on 13 points, level with Brighton, whose +13 keeps them 3rd: Brentford stay 4th.
  assert.deepEqual(w.home, { from: 4, to: 4 });
  // Liverpool on 12 points: above Brentford and Everton's 10.
  assert.deepEqual(w.away, { from: 6, to: 4 });
});

test('moves in words', () => {
  assert.equal(moveWords({ from: 3, to: 1 }), 'go top');
  assert.equal(moveWords({ from: 1, to: 1 }), 'stay top');
  assert.equal(moveWords({ from: 6, to: 3 }), 'go up to 3rd');
  assert.equal(moveWords({ from: 4, to: 5 }), 'drop to 5th');
  assert.equal(moveWords({ from: 11, to: 11 }), 'stay 11th');
  assert.equal(moveWords({ from: 23, to: 22 }), 'go up to 22nd');
  assert.equal(moveWords({ from: 10, to: 12 }), 'drop to 12th');
  assert.equal(withScores(table.groups[0].rows, [])[0].at, 1);
});
