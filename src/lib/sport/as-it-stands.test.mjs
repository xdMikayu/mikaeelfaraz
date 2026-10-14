import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withScores, standingsNow, inTable, gamesIn, ifTheyWin, moveWords } from './as-it-stands.mjs';

const row = (id, pts, gd, gf, p = 6) => ({ id, pts, gd, gf, ga: gf - gd, p });
const rows = [row('city', 18, 11, 15), row('ars', 15, 5, 12), row('bri', 13, 13, 18), row('bre', 10, 6, 11), row('eve', 10, 3, 9), row('liv', 9, 0, 8)];
const table = { groups: [{ rows }] };
let n = 0;
/** A match: state 'in', 'post' or 'pre'; `games` is each side's record ESPN gives with it. */
const match = (h, hs, a, as, state = 'in', games = {}) => ({
  id: `m${(n += 1)}`,
  status: { state, off: false },
  home: { id: h, score: hs, games: games[h] ?? null },
  away: { id: a, score: as, games: games[a] ?? null },
});

test('as it stands: the live score counted, the order by points, goal difference, goals', () => {
  // Liverpool win 2–0 at Brentford: Liverpool go up to 12 points, 4th. Brentford stay on 10, level
  // with Everton, and their +4 against Everton's +3 keeps them 5th.
  const r = standingsNow(table, match('bre', 0, 'liv', 2));
  assert.deepEqual(r.home, { from: 4, to: 5 });
  assert.deepEqual(r.away, { from: 6, to: 4 });
  assert.equal(r.size, 6);
  assert.equal(r.final, false);
  // 3–0: Brentford and Everton both +3, Brentford's 11 goals to Everton's 9 still keep them above.
  const big = standingsNow(table, match('bre', 0, 'liv', 3));
  assert.equal(big.home.to, 5);
  assert.equal(big.away.to, 4);
  // A draw: Liverpool on 10 but Everton's goal difference keeps them above.
  const draw = standingsNow(table, match('bre', 1, 'liv', 1));
  assert.deepEqual(draw.away, { from: 6, to: 6 });
  assert.deepEqual(draw.home, { from: 4, to: 4 });
});

test('as it stands: every live match in the league counts, not just this one', () => {
  // Arsenal winning alone go level on points with City, but behind on goal difference.
  assert.equal(standingsNow(table, match('ars', 1, 'eve', 0)).home.to, 2);
  // Arsenal 5–0 and City losing 1–0: both 18 points and +10, Arsenal's 17 goals to City's 15 put them top.
  assert.equal(standingsNow(table, match('ars', 5, 'eve', 0), [match('city', 0, 'bri', 1)]).home.to, 1);
  // A match not started changes nothing.
  assert.equal(standingsNow(table, match('ars', 0, 'eve', 0), [match('city', null, 'bri', null, 'pre')]).home.to, 2);
});

test('as it stands: a finished match counts until the table has it', () => {
  const live = match('ars', 5, 'eve', 0);
  // City lost 1–0 at full time, and the table hasn't taken it: City are still on 6 games.
  const seen = { city: 6, bri: 6 };
  const done = match('city', 0, 'bri', 1, 'post');
  assert.equal(standingsNow(table, live, [done], seen).home.to, 1);
  // Once the table has it (7 games, 18 points, +10), it isn't counted twice: Arsenal still top on goals.
  const taken = { groups: [{ rows: rows.map((r) => (r.id === 'city' ? { ...r, p: 7, gd: 10, ga: 5 } : r.id === 'bri' ? { ...r, p: 7, pts: 16, gd: 14, gf: 19 } : r)) }] };
  assert.equal(inTable(taken.groups[0].rows, done, seen), true);
  assert.equal(standingsNow(taken, live, [done], seen).home.to, 1);
  // Not watched while it was on: ESPN's record with the finished match (7 games) tells instead.
  const told = match('city', 0, 'bri', 1, 'post', { city: 7, bri: 7 });
  assert.equal(inTable(rows, told), false);
  assert.equal(inTable(taken.groups[0].rows, told), true);
  // No way to tell: left out of the others, and no full-time line for the match itself.
  assert.equal(inTable(rows, match('city', 0, 'bri', 1, 'post')), null);
  assert.equal(standingsNow(table, match('city', 0, 'bri', 1, 'post')), null);
});

test('full time: from the table before the match to the table after it', () => {
  // Liverpool won 2–0 at Brentford. Before the table has it: as it stood at the whistle.
  const ft = match('bre', 0, 'liv', 2, 'post');
  const r = standingsNow(table, ft, [], { bre: 6, liv: 6 });
  assert.equal(r.final, true);
  assert.deepEqual(r.away, { from: 6, to: 4 });
  assert.deepEqual(r.home, { from: 4, to: 5 });
  // After the table has it (Liverpool 12 points, 4th; Brentford 5th), the same move, not a double count.
  const after = { groups: [{ rows: [rows[0], rows[1], rows[2], { ...row('liv', 12, 2, 10), p: 7 }, { ...row('bre', 10, 4, 11), p: 7 }, rows[4]] }] };
  const again = standingsNow(after, ft, [], { bre: 6, liv: 6 });
  assert.deepEqual(again.away, { from: 6, to: 4 });
  assert.deepEqual(again.home, { from: 4, to: 5 });
  // Before kick-off it's for "if they win" instead.
  assert.equal(standingsNow(table, match('bre', null, 'liv', null, 'pre')), null);
});

test('as it stands: sides from different tables, or not in one, give nothing', () => {
  assert.equal(standingsNow(table, match('ars', 1, 'psg', 0)), null);
  assert.equal(standingsNow(null, match('ars', 1, 'eve', 0)), null);
});

test('if they win: where a win would take each side', () => {
  const w = ifTheyWin(table, 'bre', 'liv');
  // Brentford on 13 points, level with Brighton, whose +13 keeps them 3rd: Brentford stay 4th.
  assert.deepEqual(w.home, { from: 4, to: 4 });
  // Liverpool on 12 points: above Brentford and Everton's 10.
  assert.deepEqual(w.away, { from: 6, to: 4 });
});

test('moves and records in words', () => {
  assert.equal(moveWords({ from: 3, to: 1 }), 'go top');
  assert.equal(moveWords({ from: 1, to: 1 }), 'stay top');
  assert.equal(moveWords({ from: 6, to: 3 }), 'go up to 3rd');
  assert.equal(moveWords({ from: 4, to: 5 }), 'drop to 5th');
  assert.equal(moveWords({ from: 11, to: 11 }), 'stay 11th');
  assert.equal(moveWords({ from: 23, to: 22 }), 'go up to 22nd');
  assert.equal(moveWords({ from: 10, to: 12 }), 'drop to 12th');
  assert.equal(withScores(rows, [])[0].at, 1);
  assert.equal(gamesIn('1-0-1'), 2);
  assert.equal(gamesIn(undefined), null);
});
