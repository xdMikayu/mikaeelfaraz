import { test } from 'node:test';
import assert from 'node:assert/strict';
import { squadScore, chipWhatIf, seasonSoFar } from './fpl-history.mjs';

// Fifteen players and a few to buy: 1-2 keepers, 3-7 defenders, 8-12 midfielders, 13-15 forwards.
const TYPE = (id) => (id <= 2 ? 1 : id <= 7 ? 2 : id <= 12 ? 3 : id <= 15 ? 4 : { 16: 4, 17: 3, 18: 4, 19: 3 }[id]);
const els = Object.fromEntries(Array.from({ length: 19 }, (_, i) => i + 1).map((id) => [id, { id, name: `P${id}`, type: TYPE(id), team: id % 2 ? 1 : 2 }]));
// A 4-4-2: keeper 1; defenders 3-6; midfielders 8-11; forwards 13-14; bench 2, 7, 12, 15. Captain 13, vice 8.
const squad = (swap = {}, captain = 13, vice = 8) => {
  const order = [1, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14, 2, 7, 12, 15].map((id) => swap[id] ?? id);
  return order.map((element, i) => ({ element, position: i + 1, multiplier: i < 11 ? (element === captain ? 2 : 1) : 0, captain: element === captain, vice: element === vice }));
};
// One gameweek's live data: everyone plays 90 minutes for 2 points unless `pts` says otherwise
// ([points, minutes]); one match between the two clubs, finished unless `playing`.
const week = (pts = {}, { playing = false } = {}) => ({
  elements: Object.fromEntries(Object.keys(els).map((id) => {
    const [points, minutes] = pts[id] ?? [2, 90];
    return [id, { points, minutes, bonus: 0, bps: 0, explain: [] }];
  })),
  fixtures: [{ id: 1, home: 1, away: 2, started: true, finished: !playing, finishedProvisional: !playing, minutes: playing ? 60 : 90, bonus: { 1: 3 }, bps: {} }],
});

test('a squad scored the way FPL counts it: automatic substitutions, the vice-captain and chips', () => {
  const live = week({ 13: [6, 90] });
  assert.equal(squadScore(squad(), live, els).points, 10 * 2 + 6 * 2);
  assert.equal(squadScore(squad(), live, els, 'bboost').points, 14 * 2 + 6 * 2);
  assert.equal(squadScore(squad(), live, els, '3xc').points, 10 * 2 + 6 * 3);
  // The captain doesn't play: the vice's points count twice, and the first outfield player on the
  // bench (defender 7; keeper 2 can't come on for a forward) takes his place.
  const s = squadScore(squad(), week({ 13: [0, 0] }), els);
  assert.equal(s.points, 9 * 2 + 2 * 2 + 2);
  assert.equal(s.viceUsed, true);
  assert.deepEqual(s.subs, [{ out: 13, in: 7 }]);
});

// A season: gameweeks 1-5 played, 6 under way. Wildcard in 3 (forward 13 → 16, midfielder 8 → 17,
// the new captain 16), a Free Hit in 4, a hit in 5.
const picks = {
  1: { chip: null, picks: squad() },
  2: { chip: null, picks: squad() },
  3: { chip: 'wildcard', picks: squad({ 13: 16, 8: 17 }, 16, 17) },
  4: { chip: 'freehit', picks: squad({ 13: 18, 8: 19 }, 18, 19) },
  5: { chip: null, picks: squad({ 13: 16, 8: 17 }, 16, 17) },
  6: { chip: null, picks: squad({ 13: 16, 8: 17 }, 16, 17) },
};
const lives = { 1: week(), 2: week(), 3: week({ 13: [10, 90], 16: [8, 90] }), 4: week(), 5: week({ 16: [6, 90] }), 6: week({}, { playing: true }) };
const entry = {
  name: 'Test XI',
  total: 300,
  overall: 1000,
  started: 1,
  chips: [
    { name: 'wildcard', event: 3 },
    { name: 'freehit', event: 4 },
  ],
  history: [
    { event: 1, points: 55, hit: 0, overall: 5000, bench: 8 },
    { event: 2, points: 60, hit: 0, overall: 3000, bench: 8 },
    { event: 3, points: 50, hit: 0, overall: 2000, bench: 8 },
    { event: 4, points: 45, hit: 0, overall: 1500, bench: 8 },
    { event: 5, points: 40, hit: 4, overall: 1000, bench: 8 },
    { event: 6, points: 20, hit: 0, overall: 1000, bench: 0 },
  ],
};
const loaders = { picks: async (gw) => picks[gw] ?? null, live: async (gw) => lives[gw] };
const base = { entry, els, loaders, done: [1, 2, 3, 4, 5], current: 6 };

test('a wildcard against the team before it, kept unchanged, every week since', async () => {
  const r = await chipWhatIf({ ...base, chip: 'wildcard' });
  assert.equal(r.playedIn, 3);
  assert.equal(r.comparedOver, 'gameweeks 3–5');
  // Kept team: gameweek 3, ten players at 2 and captain 13's 10 doubled; the Free Hit week scores
  // the Free Hit team either way; gameweek 5, ten at 2 and the captain's 2 doubled.
  assert.deepEqual(r.weeks.map((x) => [x.gw, x.youScored, x.keptTeamWouldHaveScored]), [[3, 50, 40], [4, 45, 45], [5, 36, 24]]);
  assert.match(r.weeks[1].note, /Free Hit/);
  assert.equal(r.weeks[2].afterAHitOf, 4);
  assert.deepEqual(r.totals, { youScored: 131, keptTeamWouldHaveScored: 109, difference: 22, hitsYouTookSince: 4 });
  assert.equal(r.keptTeam.captain, 'P13');
  // What the wildcard sold and bought, and what each has scored since (gameweeks 3-5).
  assert.deepEqual(r.wildcardChanges.sold, [{ name: 'P13', pointsSince: 14 }, { name: 'P8', pointsSince: 6 }]);
  assert.deepEqual(r.wildcardChanges.bought, [{ name: 'P16', pointsSince: 16 }, { name: 'P17', pointsSince: 6 }]);
  // The gameweek under way is left out of the totals.
  assert.deepEqual(r.thisGameweekSoFar, { gw: 6, youHaveSoFar: 20, keptTeamWouldHaveSoFar: 24 });
});

test('the other chips, and chips not played', async () => {
  // Free Hit in 4: the wildcard team from gameweek 3 would have scored ten at 2 and captain 16's 2 doubled.
  const fh = await chipWhatIf({ ...base, chip: 'freehit' });
  assert.deepEqual([fh.freeHitTeamScored, fh.yourTeamWouldHaveScored, fh.gainedByTheChip], [45, 24, 21]);
  const bb = await chipWhatIf({ ...base, entry: { ...entry, chips: [{ name: 'bboost', event: 2 }] }, chip: 'bboost' });
  assert.deepEqual([bb.withIt, bb.withoutIt, bb.gainedByTheChip], [32, 24, 8]);
  assert.deepEqual(bb.bench, ['P2 2', 'P7 2', 'P12 2', 'P15 2']);
  const tc = await chipWhatIf({ ...base, entry: { ...entry, chips: [{ name: '3xc', event: 3 }] }, chip: '3xc' });
  assert.equal(tc.gainedByTheChip, 8);
  assert.match(tc.captain, /^P16 8/);
  assert.match((await chipWhatIf({ ...base, chip: 'bboost' })).error, /No Bench Boost/);
  assert.match((await chipWhatIf({ ...base, chip: 'wildcard', gw: 5 })).error, /played in gameweek 3/);
});

test("the season so far: each week's points and captain, and the transfers outside chip weeks", async () => {
  const transfers = [
    { event: 2, element_out: 14, element_in: 18, time: '2026-08-29T10:00:00Z' },
    { event: 3, element_out: 13, element_in: 16, time: '2026-09-12T10:00:00Z' },
    { event: 4, element_out: 13, element_in: 18, time: '2026-09-19T10:00:00Z' },
    { event: 5, element_out: 9, element_in: 19, time: '2026-09-26T10:00:00Z' },
  ];
  // Forward 18 for 14 from gameweek 2 (kept through 3, back from the Free Hit in 5); midfielder 19 for 9 in 5.
  const own = {
    1: picks[1],
    2: { chip: null, picks: squad({ 14: 18 }) },
    3: { chip: 'wildcard', picks: squad({ 14: 18, 13: 16, 8: 17 }, 16, 17) },
    4: picks[4],
    5: { chip: null, picks: squad({ 14: 18, 13: 16, 8: 17, 9: 19 }, 16, 17) },
    6: { chip: null, picks: squad({ 14: 18, 13: 16, 8: 17, 9: 19 }, 16, 17) },
  };
  const scored = { ...lives, 2: week({ 18: [9, 90], 14: [1, 90] }), 5: week({ 16: [6, 90], 19: [5, 90], 9: [3, 90] }) };
  const s = await seasonSoFar({ ...base, transfers, loaders: { picks: async (gw) => own[gw], live: async (gw) => scored[gw] } });
  assert.deepEqual(s.weeks.map((x) => x.points), [55, 60, 50, 45, 36, 20]);
  assert.equal(s.weeks[2].chip, 'Wildcard');
  assert.equal(s.weeks[2].captain, 'P16 8×2');
  assert.equal(s.weeks[5].stillBeingPlayed, true);
  // The wildcard's and Free Hit's transfers are left out; 18 stayed for 2, 3 and 5 (the Free Hit
  // week doesn't count either way): 9 + 2 + 2 against 14's 1 + 2 + 2.
  assert.deepEqual(s.transfers.list.map((t) => [t.gw, t.out, t.in, t.keptFor, t.inScored, t.outScored, t.gain]), [[2, 'P14', 'P18', 3, 13, 5, 8], [5, 'P9', 'P19', 1, 5, 3, 2]]);
  assert.equal(s.transfers.hitsTaken, 4);
  assert.equal(s.transfers.netAfterHits, 6);
  assert.equal(s.transfers.best.in, 'P18');
  assert.deepEqual(s.chipsPlayed, [{ chip: 'Wildcard', gw: 3 }, { chip: 'Free Hit', gw: 4 }]);
});
