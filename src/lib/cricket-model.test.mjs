import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseVenue, sameGround, findGround } from './cricket-venues.mjs';
import { runsLeft, projectTotal, chaseWin, firstWin, eloWin, ratingIn, withStrength, parFor, compKey } from './cricket-model.mjs';
import { formatOf, readMatch } from './cricket-read.mjs';

const json = (name) => JSON.parse(readFileSync(new URL(`./cricket/${name}.json`, import.meta.url), 'utf8'));
const tables = { model: json('model'), grounds: json('grounds').grounds, ratings: json('ratings') };

test('grounds: one ground under its spellings, a second ground of the same name kept apart', () => {
  assert.deepEqual(parseVenue('M.Chinnaswamy Stadium, Bengaluru'), parseVenue('M Chinnaswamy Stadium', 'Bangalore'));
  assert.ok(sameGround(parseVenue('Sheikh Zayed Stadium').words, parseVenue('Zayed Cricket Stadium, Abu Dhabi').words));
  assert.ok(sameGround(parseVenue('New Wanderers Stadium').words, parseVenue('The Wanderers Stadium').words));
  assert.ok(!sameGround(parseVenue('Eden Park').words, parseVenue('Eden Park Outer Oval').words));
  assert.ok(!sameGround(parseVenue('Sheikh Zayed Stadium').words, parseVenue('Sheikh Zayed Stadium Nursery 1').words));
  // ESPN sometimes gives no city; a name only one ground has is enough.
  assert.equal(findGround(tables.grounds, 'Rawalpindi Cricket Stadium')?.place, 'Rawalpindi');
  assert.equal(findGround(tables.grounds, 'Kingsmead, Durban')?.name, 'Kingsmead');
  assert.equal(findGround(tables.grounds, 'Nowhere Oval, Atlantis'), null);
});

test('competitions: a league by its name without the season, renamed ones as one, internationals by who is playing', () => {
  assert.equal(compKey({ club: true, event: 'Indian Premier League 2027' }), 'indian premier league');
  assert.equal(compKey({ club: true, event: 'Vitality Blast Men 2026' }), 'vitality blast');
  assert.equal(compKey({ club: true, event: 'NatWest T20 Blast' }), 'vitality blast');
  assert.equal(compKey({ club: true, event: 'Australian Domestic One-Day Competition 2026/27' }), 'australian one day cup');
  assert.equal(compKey({ club: false, teams: ['India Women', 'Australia Women'] }), 'intl-full');
  assert.equal(compKey({ club: false, teams: ['Nepal', 'India'] }), 'intl-mixed');
  assert.equal(compKey({ club: false, teams: ['Nepal', 'Oman'] }), 'intl-assoc');
});

const F = tables.model.formats['t20-male'];

test('runs to come: less with fewer balls or more wickets down, none when the innings is over', () => {
  const start = runsLeft(F.shape, 120, 0).mean;
  assert.ok(start > 0.9 && start < 1.1, `a whole innings is about par, got ${start}`);
  assert.ok(runsLeft(F.shape, 60, 0).mean < start);
  assert.ok(runsLeft(F.shape, 60, 6).mean < runsLeft(F.shape, 60, 2).mean);
  assert.deepEqual(runsLeft(F.shape, 0, 3), { mean: 0, sd: 0 });
  assert.deepEqual(runsLeft(F.shape, 30, 10), { mean: 0, sd: 0 });
  const p = projectTotal(F.shape, { runs: 80, balls: 48, wickets: 1 }, 180);
  assert.ok(p.lo >= 80 && p.lo < p.mean && p.mean < p.hi);
  assert.ok(p.mean > 180, 'a fast start projects above par');
});

test('chances: a chase gets likelier with fewer runs needed and wickets in hand, and is settled at the ends', () => {
  const par = 180;
  const at = (need, left, wickets) => chaseWin(F.shape, F.chase, { need, left, wickets, target: 181 }, par);
  assert.ok(at(40, 30, 3) > at(60, 30, 3));
  assert.ok(at(40, 30, 3) > at(40, 30, 7));
  assert.ok(at(40, 30, 3) < at(40, 42, 3));
  assert.equal(at(0, 10, 4), 1);
  assert.equal(at(5, 0, 4), 0);
  assert.equal(at(5, 10, 10), 0);
  const even = at(181, 120, 0);
  assert.ok(even > 0.35 && even < 0.65, `a par chase is close to even, got ${even}`);
  // The side batting first: well above par is good for it, well below is not.
  const first = (runs) => firstWin(F.shape, F.first, { runs, balls: 60, wickets: 2 }, par);
  assert.ok(first(110) > 0.6 && first(60) < 0.4);
});

test('the last balls: worked out one at a time, close to how such finishes have gone', () => {
  const at = (need, left, wickets) => chaseWin(F.shape, F.chase, { need, left, wickets, target: 168 }, 175);
  // In Cricsheet's men's T20 chases, sides needing these won about 63%, 12%, 87% and 35% of the
  // time (a tie as half). The bell curve alone said 70%, 3%, 84% and 37%.
  const cases = [
    [2, 1, 5, 0.5, 0.75],
    [6, 1, 5, 0.06, 0.2],
    [1, 1, 9, 0.75, 0.95],
    [14, 6, 5, 0.2, 0.5],
  ];
  for (const [need, left, wickets, lo, hi] of cases) {
    const p = at(need, left, wickets);
    assert.ok(p > lo && p < hi, `${need} off ${left} with ${wickets} down: ${p}`);
  }
  // Settled: won, tied (half), lost.
  assert.equal(at(0, 2, 5), 1);
  assert.equal(at(1, 0, 5), 0.5);
  assert.equal(at(2, 0, 5), 0);
  assert.equal(at(1, 3, 10), 0.5);
});

test('the last balls: never likelier with more runs needed, fewer balls left or fewer wickets in hand', () => {
  for (const key of ['t20-male', 'odi-female']) {
    const M = tables.model.formats[key];
    const at = (need, left, wickets) => chaseWin(M.shape, M.chase, { need, left, wickets, target: 168 }, 175);
    // Across the end of the blend too (18 balls left), where a dot ball must never help.
    for (let left = 1; left <= 21; left++) {
      for (let wickets = 0; wickets <= 9; wickets++) {
        for (let need = 1; need <= 45; need++) {
          const p = at(need, left, wickets);
          assert.ok(at(need + 1, left, wickets) <= p + 1e-9, `${key}: ${need + 1} off ${left} beats ${need} (${wickets} down)`);
          assert.ok(at(need, left + 1, wickets) >= p - 1e-9, `${key}: ${need} off ${left + 1} trails ${left} balls (${wickets} down)`);
          // Wickets within the last balls; further out the curve is as it was.
          if (wickets < 9 && left <= M.chase.end.to) assert.ok(at(need, left, wickets + 1) <= p + 1e-9, `${key}: ${need} off ${left}, ${wickets + 1} down beats ${wickets}`);
        }
      }
    }
  }
});

test('the last balls only: well before them the chances are the curve’s, unchanged', () => {
  const curve = { coef: F.chase.coef };
  for (const st of [
    { need: 40, left: 30, wickets: 3, target: 168 },
    { need: 90, left: 60, wickets: 2, target: 168 },
    { need: 181, left: 120, wickets: 0, target: 181 },
  ])
    assert.equal(chaseWin(F.shape, F.chase, st, 175), chaseWin(F.shape, curve, st, 175));
  assert.deepEqual([F.chase.end.from, F.chase.end.to], [3, 18]);
});

test('ratings: Elo is symmetric, home helps, full members get their edge only in internationals, and the nudge fades', () => {
  const elo = { home: 50, tier: 400 };
  assert.ok(Math.abs(eloWin(elo, 1600, 1500) + eloWin(elo, 1500, 1600) - 1) < 1e-12);
  assert.ok(eloWin(elo, 1500, 1500, 1) > 0.5 && eloWin(elo, 1500, 1500, -1) < 0.5);
  assert.equal(ratingIn(elo, 1500, 'India Women', true), 1900);
  assert.equal(ratingIn(elo, 1500, 'Nepal', true), 1500);
  assert.equal(ratingIn(elo, 1500, 'Mumbai Indians', false), 1500);
  assert.ok(Math.abs(withStrength(0.3, 0.8, 0, 1) - 0.3) < 1e-12);
  assert.ok(withStrength(0.3, 0.8, 0.5, 1) > 0.3);
});

test('par: a competition level times the ground’s lean, a format’s usual level for an unknown one', () => {
  const model = { at: '2026-01-01', trend: 0, levels: { 'indian premier league': 190, '*': 160 } };
  assert.equal(parFor(model, 'indian premier league', { lean: 0 }), 190);
  assert.ok(Math.abs(parFor(model, 'indian premier league', { lean: Math.log(1.1) }) - 209) < 1e-9);
  assert.equal(parFor(model, 'some league', null), 160);
  // The scoring trend carries par forward for at most a year after the fit.
  const rising = { ...model, trend: 0.02 };
  assert.ok(Math.abs(parFor(rising, 'indian premier league', null, Date.parse('2028-01-01')) - 190 * Math.exp(0.02)) < 1e-9);
});

// A match as cricketNow() gives it.
const espn = (over) => ({
  id: '1',
  league: { id: '9', name: 'West Indies tour of India 2026/27' },
  title: '3rd T20I',
  format: 'T20I',
  international: true,
  women: false,
  state: 'in',
  summary: 'Live',
  start: '2026-10-11T13:30Z',
  venue: 'Holkar Cricket Stadium, Indore',
  status: '',
  teams: [
    { id: '6', name: 'India', short: 'IND', color: '#1d4b9c', runs: '223', overs: null, batting: false },
    { id: '4', name: 'West Indies', short: 'WI', color: '#7b0041', runs: '105/3', overs: '10.5/20 ov, target 224', batting: true },
  ],
  ...over,
});

test('formats: T20s, one-day matches, Tests and first-class; nothing for age-group or "other" cricket', () => {
  assert.equal(formatOf(espn()), 't20-male');
  assert.equal(formatOf(espn({ format: "Women's ODI", women: true })), 'odi-female');
  assert.equal(formatOf(espn({ format: 'List A' })), 'odi-male');
  assert.equal(formatOf(espn({ format: 'Test' })), 'test-male');
  assert.equal(formatOf(espn({ format: 'First-class' })), 'fc-male');
  assert.equal(formatOf(espn({ format: 'Other T20' })), null);
  assert.equal(formatOf(espn({ teams: [{ name: 'Pakistan Women Under-19s' }, { name: 'Bangladesh Women Under-19s' }] })), null);
});

test('a live chase: what the side needs against what a side usually adds, and each side’s chance', () => {
  const r = readMatch(espn(), tables);
  assert.equal(r.format, 't20-male');
  assert.equal(r.ground.name, 'Holkar Cricket Stadium');
  assert.equal(r.now.kind, 'chase');
  assert.equal(r.now.team, '4');
  assert.equal(r.now.need, 119);
  assert.ok(r.now.usual > 40 && r.now.usual < 120);
  assert.ok(Math.abs(r.now.chances[0] + r.now.chances[1] - 1) < 1e-9);
  assert.ok(r.now.chances[0] > 0.7, 'India, 119 ahead with 55 balls left, are well on top');
  assert.equal(r.record.scope, 'intl');
  assert.ok(r.par > 140 && r.par < 230);
});

test('a first innings under way: the projected total and its range; a shortened match gets none', () => {
  const first = espn({ teams: [{ id: '6', name: 'India', runs: '80/1', overs: '8/20 ov', batting: true }, { id: '4', name: 'West Indies', runs: '', overs: null }] });
  const r = readMatch(first, tables);
  assert.equal(r.now.kind, 'first');
  assert.ok(r.now.projected.lo < r.now.projected.mean && r.now.projected.mean < r.now.projected.hi);
  assert.ok(r.now.chances[0] > 0.5);
  const short = espn({ teams: [{ id: '6', name: 'India', runs: '50/1', overs: '5/12 ov', batting: true }, { id: '4', name: 'West Indies', runs: '', overs: null }] });
  assert.equal(readMatch(short, tables).now.kind, 'reduced');
});

test('before a ball: chances from the ratings, then from who bats first once the toss is known', () => {
  const pre = espn({ state: 'pre', summary: 'Scheduled', teams: [{ id: '6', name: 'India', runs: '' }, { id: '4', name: 'West Indies', runs: '' }] });
  const r = readMatch(pre, tables);
  assert.equal(r.now, null);
  assert.ok(r.pre[0] > 0.5 && Math.abs(r.pre[0] + r.pre[1] - 1) < 1e-9);
  assert.equal(r.home, 'India');
  const tossed = readMatch({ ...pre, status: 'West Indies won the toss and elected to field' }, tables);
  assert.equal(tossed.now.kind, 'toss');
  assert.equal(tossed.now.team, '6');
  assert.equal(readMatch(pre, tables, Date.now(), { record: false }).record, null);
});

test('nothing to say: a finished match, or a league the history doesn’t cover', () => {
  assert.equal(readMatch(espn({ state: 'post' }), tables), null);
  assert.equal(readMatch(espn({ international: false, league: { id: '1', name: 'Somewhere Village T20' } }), tables), null);
});

test('a Test’s last innings: how chases of that size have gone', () => {
  const test4 = espn({
    format: 'Test',
    venue: 'Kingsmead, Durban',
    teams: [
      { id: '1', name: 'South Africa', runs: '284 & 301', overs: null },
      { id: '2', name: 'Australia', runs: '390 & 120/3', overs: '40 ov', batting: true },
    ],
  });
  const r = readMatch(test4, tables);
  assert.equal(r.format, 'test-male');
  assert.equal(r.testChase.target, 196);
  assert.equal(r.testChase.from, 150);
  assert.ok(r.testChase.won + r.testChase.drawn + r.testChase.lost <= r.testChase.n);
  assert.equal(r.record.scope, 'intl');
  assert.equal(r.record.inns.length, 4);
});
