import { test } from 'node:test';
import assert from 'node:assert/strict';
import { implied, fair, outcomes, fitGoals, pricesOf, bookmakersView, pricedFixtures } from './odds.mjs';
import { fixtureRates } from './fpl.mjs';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('American prices as chances', () => {
  near(implied('+215'), 100 / 315, 1e-12);
  near(implied('-155'), 155 / 255, 1e-12);
  near(implied(260), 100 / 360, 1e-12);
  assert.equal(implied('+100'), 0.5);
  assert.equal(implied('-100'), 0.5);
  for (const x of [null, undefined, '', 'EVEN', '50', 'n/a']) assert.equal(implied(x), null, String(x));
});

test('the margin comes out in proportion', () => {
  const f = fair([0.5, 0.3, 0.3]);
  near(f.reduce((s, p) => s + p, 0), 1, 1e-12);
  near(f[0] / f[1], 0.5 / 0.3, 1e-12);
});

test('outcomes add up and follow from the two rates', () => {
  const o = outcomes(1.6, 1.15);
  near(o.home + o.draw + o.away, 1, 1e-6, 'win, draw, loss');
  near(o.csHome, Math.exp(-1.15), 1e-12, 'home clean sheet: the away side scores none');
  near(o.csAway, Math.exp(-1.6), 1e-12);
  near(o.btts, (1 - Math.exp(-1.6)) * (1 - Math.exp(-1.15)), 1e-12);
  // Total goals are Poisson with the summed rate: over 2.5 is three or more.
  const t = 2.75;
  near(o.over, 1 - Math.exp(-t) * (1 + t + (t * t) / 2), 1e-6, 'over 2.5');
  assert.deepEqual(outcomes(2.8, 0.85).likely, [2, 0]);
  assert.ok(outcomes(1.3, 1.3).home > 0.3 && Math.abs(outcomes(1.3, 1.3).home - outcomes(1.3, 1.3).away) < 1e-12, 'level rates, level chances');
});

test('the fit gets back the rates that made the prices', () => {
  for (const [h, a, line] of [[1.7, 1.1, 2.5], [2.8, 0.85, 3.5], [0.9, 1.8, 2.5], [1.3, 1.3, 2.5]]) {
    const o = outcomes(h, a, line);
    const g = fitGoals({ home: o.home, draw: o.draw, away: o.away, over: o.over, line });
    near(g.home, h, 0.005, `home ${h}-${a}`);
    near(g.away, a, 0.005, `away ${h}-${a}`);
    assert.ok(g.miss < 1e-3, `miss ${g.miss}`);
  }
  // Without a total the win, draw and loss prices alone still pin both rates.
  const o = outcomes(1.9, 0.95);
  const g = fitGoals({ home: o.home, draw: o.draw, away: o.away });
  near(g.home, 1.9, 0.02);
  near(g.away, 0.95, 0.02);
});

// The shape ESPN's scoreboard gives a match's DraftKings prices.
const espn = (over = true) => ({
  odds: [
    {
      provider: { name: 'DraftKings', displayName: 'DraftKings' },
      details: 'NEW +100',
      overUnder: over ? 2.5 : undefined,
      moneyline: {
        home: { open: { odds: '+225' }, close: { odds: '+260' } },
        draw: { open: { odds: '+250' }, close: { odds: '+275' } },
        away: { open: { odds: '+110' }, close: { odds: '+100' } },
      },
      total: over ? { over: { close: { line: 'o2.5', odds: '-165' } }, under: { close: { line: 'u2.5', odds: '+135' } } } : undefined,
    },
  ],
});

test('prices from an ESPN scoreboard match', () => {
  const p = pricesOf(espn());
  const raw = [100 / 360, 100 / 375, 0.5];
  const sum = raw.reduce((s, x) => s + x, 0);
  assert.equal(p.provider, 'DraftKings');
  near(p.home, raw[0] / sum, 1e-12, 'closing price, margin out');
  near(p.draw, raw[1] / sum, 1e-12);
  near(p.away, raw[2] / sum, 1e-12);
  near(p.margin, sum - 1, 1e-12);
  near(p.over, 165 / 265 / (165 / 265 + 100 / 235), 1e-12);
  assert.equal(p.line, 2.5);

  // No total: still the three-way prices. Only an opening price: that one.
  const bare = pricesOf(espn(false));
  assert.equal(bare.over, undefined);
  const open = espn();
  delete open.odds[0].moneyline.home.close;
  const rawOpen = [100 / 325, 100 / 375, 0.5];
  near(pricesOf(open).home, rawOpen[0] / rawOpen.reduce((s, x) => s + x, 0), 1e-12, 'opening price');
  assert.ok(pricesOf(open).home > p.home, 'the shorter opening price makes the home side likelier');

  // Nothing usable: null rather than a guess.
  assert.equal(pricesOf({}), null);
  assert.equal(pricesOf({ odds: [{ provider: { name: 'X' } }] }), null);
  const noDraw = espn();
  noDraw.odds[0].moneyline.draw = {};
  assert.equal(pricesOf(noDraw), null);
});

test('a match summary’s prices read the same as the scoreboard’s', () => {
  // ESPN's summary (pickcenter) lays the same DraftKings prices out flat.
  const summary = { odds: [{ provider: { name: 'DraftKings' }, details: 'MNC -450', overUnder: 3.5, overOdds: -110, underOdds: -120, homeTeamOdds: { moneyLine: -450 }, awayTeamOdds: { moneyLine: 950 }, drawOdds: { moneyLine: 600 } }] };
  const board = { odds: [{ provider: { name: 'DraftKings' }, overUnder: 3.5, moneyline: { home: { close: { odds: '-450' } }, draw: { close: { odds: '+600' } }, away: { close: { odds: '+950' } } }, total: { over: { close: { odds: '-110' } }, under: { close: { odds: '-120' } } } }] };
  const a = pricesOf(summary);
  const b = pricesOf(board);
  for (const k of ['home', 'draw', 'away', 'over', 'margin']) near(a[k], b[k], 1e-12, k);
  assert.equal(a.line, 3.5);
  near(a.home, 0.7746, 1e-4, 'Man City at home to Ipswich');
});

test('what FPL needs from a priced match', () => {
  const v = bookmakersView(pricesOf(espn()));
  assert.equal(v.provider, 'DraftKings');
  assert.ok(v.away > v.home, 'the favourite scores more');
  near(v.csHome, Math.exp(-v.away), 0.002, 'clean sheet from the other side’s rate');
  near(v.csAway, Math.exp(-v.home), 0.002);
  near(v.win.reduce((s, x) => s + x, 0), 1, 0.002);
  assert.equal(v.line, 2.5);
  assert.ok(v.miss < 0.03);
  assert.equal(v.likely.length, 2);
});

test('ESPN matches find their FPL fixtures', () => {
  const teams = [
    { id: 13, name: 'Man City', short: 'MCI' },
    { id: 11, name: 'Ipswich', short: 'IPS' },
    { id: 8, name: 'Everton', short: 'EVE' },
    { id: 6, name: 'Chelsea', short: 'CHE' },
  ];
  const ev = (home, away, date, state = 'pre') => ({
    date,
    status: { type: { state } },
    competitions: [{ ...espn(), competitors: [{ homeAway: 'home', team: { displayName: home } }, { homeAway: 'away', team: { displayName: away } }] }],
  });
  const fixtures = [
    { id: 67, event: 7, home: 13, away: 11, kickoff: '2026-10-17T14:00:00Z', started: false },
    { id: 64, event: 7, home: 8, away: 6, kickoff: '2026-10-17T11:30:00Z', started: false },
    // The return fixture months later, same sides the other way round.
    { id: 300, event: 30, home: 11, away: 13, kickoff: '2027-03-20T15:00:00Z', started: false },
  ];
  const got = pricedFixtures(
    [
      ev('Manchester City', 'Ipswich Town', '2026-10-17T14:00Z'),
      ev('Everton', 'Chelsea', '2026-10-17T11:30Z', 'in'), // under way: its prices are live ones
      ev('Ipswich Town', 'Manchester City', '2026-10-17T14:00Z'), // no such fixture near this date
      ev('Unknown FC', 'Chelsea', '2026-10-18T14:00Z'),
    ],
    teams,
    fixtures,
  );
  assert.deepEqual(Object.keys(got), ['67']);
  assert.equal(got[67].event, 7);
  assert.equal(got[67].provider, 'DraftKings');
  assert.ok(got[67].home > 0 && got[67].away > 0);
  // Moved by more than two days: not the same match.
  assert.deepEqual(pricedFixtures([ev('Manchester City', 'Ipswich Town', '2026-10-21T19:00Z')], teams, fixtures), {});
  // Started on FPL's side already: left out too.
  assert.deepEqual(pricedFixtures([ev('Manchester City', 'Ipswich Town', '2026-10-17T14:00Z')], teams, fixtures.map((f) => ({ ...f, started: true }))), {});
});

test('fixture rates use the bookmakers where they have priced the match', () => {
  const model = { avg: 1.35, teams: { 1: { for: 1.8, against: 1.0 }, 2: { for: 1.1, against: 1.5 } }, pos: {} };
  const f = { id: 7, home: 1, away: 2 };
  const ours = fixtureRates(f, model);
  assert.ok(ours.home > ours.away && !ours.odds);
  const priced = fixtureRates(f, { ...model, byFixture: { 7: { home: 2.2, away: 0.7, csHome: 0.5 } } });
  assert.equal(priced.home, 2.2);
  assert.equal(priced.away, 0.7);
  assert.equal(priced.odds.csHome, 0.5);
  // Another fixture between the same sides isn't priced: back to the model.
  assert.deepEqual(fixtureRates({ ...f, id: 8 }, { ...model, byFixture: { 7: { home: 2.2, away: 0.7 } } }), ours);
});
