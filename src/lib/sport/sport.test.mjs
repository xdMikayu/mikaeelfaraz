import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bonusFromBps, teamLive, leagueLive, projectedBonus, buildModel, fixtureRates, poissonTail, poissonFloor, projectPlayer, headToHead, returnDate, laterAvailability, availability, sellingPrices } from './fpl.mjs';
import { xgFor, shotGeometry, shotTraits, PENALTY_XG } from './xg.mjs';
import { rateTeams, goalRates, matchOdds, inPlay, winPath, shotOutcomes, simulateSeason, ratesFromTable } from './forecast.mjs';
import { rolesFromLines, versus, roleFactor } from './matchups.mjs';
import { shotPoint } from './espn.mjs';
import { netFor, rawFactors, designRow } from './netxg.mjs';
import { bestXI, nextFree, estimateFree, planTransfers, buildSquad, rotationPairs, committed } from './optimise.mjs';
import { chipsLeft, validate, whenFor, honestFacts, transferLedger } from './advice.mjs';
import { londonToUtc, ukLabel, priceWindows, priceMove, breakBefore } from './timing.mjs';
import { cleanReport, newsPatches, newsTtl, matchPlayer } from './news.mjs';
import { espnDaysFor, formationLines, normaliseMatch, statusOf, withPendingGoals, shootoutFrom, shotsFrom } from './espn.mjs';

test('bonus: plain 3-2-1', () => {
  assert.deepEqual(bonusFromBps({ 1: 30, 2: 25, 3: 20, 4: 10 }), { 1: 3, 2: 2, 3: 1 });
});

test('bonus: tie for first takes 3 each, next gets 1', () => {
  assert.deepEqual(bonusFromBps({ 1: 30, 2: 30, 3: 20, 4: 10 }), { 1: 3, 2: 3, 3: 1 });
});

test('bonus: tie for second takes 2 each, nobody gets 1', () => {
  assert.deepEqual(bonusFromBps({ 1: 30, 2: 25, 3: 25, 4: 10 }), { 1: 3, 2: 2, 3: 2 });
});

test('bonus: tie for third shares 1', () => {
  assert.deepEqual(bonusFromBps({ 1: 30, 2: 25, 3: 20, 4: 20, 5: 5 }), { 1: 3, 2: 2, 3: 1, 4: 1 });
});

test('bonus: three tied for first all get 3', () => {
  assert.deepEqual(bonusFromBps({ 1: 30, 2: 30, 3: 30, 4: 20 }), { 1: 3, 2: 3, 3: 3 });
});

test('projected bonus only where FPL has none and 20 minutes have gone', () => {
  const fx = [
    { id: 1, started: true, minutes: 10, bps: { 1: 9 }, bonus: {} },
    { id: 2, started: true, minutes: 60, bps: { 2: 30, 3: 20, 4: 10 }, bonus: {} },
    { id: 3, started: true, minutes: 60, bps: { 5: 30 }, bonus: { 5: 3 } },
  ];
  assert.deepEqual(projectedBonus(fx), { 2: { 2: 3, 3: 2, 4: 1 } });
});

// A made-up squad: team 1's match is over, team 2's hasn't started.
function squad() {
  const elements = {};
  const live = {};
  const add = (id, type, team, minutes, points) => {
    elements[id] = { id, type, team, name: `P${id}` };
    if (minutes != null) live[id] = { minutes, points, bonus: 0, bps: 0, explain: [] };
  };
  add(1, 1, 1, 90, 3); // GK
  add(2, 2, 1, 90, 6);
  add(3, 2, 1, 0, 0); // DEF did not play
  add(4, 2, 1, 90, 2);
  add(5, 3, 1, 90, 5);
  add(6, 3, 1, 90, 2);
  add(7, 3, 1, 0, 0); // MID did not play
  add(8, 3, 2, null);
  add(9, 4, 1, 90, 8); // captain
  add(10, 4, 1, 90, 2);
  add(11, 4, 2, null);
  add(12, 1, 1, 0, 0); // bench GK
  add(13, 3, 1, 70, 3); // bench 1
  add(14, 2, 1, 60, 1); // bench 2
  add(15, 4, 1, 90, 5); // bench 3
  const fixtures = [
    { id: 100, home: 1, away: 3, started: true, finished: true, finishedProvisional: true, minutes: 90 },
    { id: 101, home: 2, away: 4, started: false, finished: false, finishedProvisional: false, minutes: 0 },
  ];
  const picks = Array.from({ length: 15 }, (_, i) => ({ element: i + 1, position: i + 1, multiplier: i < 11 ? 1 : 0, captain: i === 8, vice: i === 4 }));
  return { ctx: { elements, live, fixtures, bonus: {} }, picks };
}

test('autosubs: first eligible bench player in order, keeping a legal formation', () => {
  const { ctx, picks } = squad();
  const t = teamLive(picks, null, 0, ctx);
  // DEF 3 out -> bench 13 (MID) would leave 2 DEF, so 14 (DEF) comes on; MID 7 out -> 13 (MID).
  assert.deepEqual(t.subs, [{ out: 3, in: 14 }, { out: 7, in: 13 }]);
  assert.equal(t.captain, 9);
  // 3 + 6 + 2 + 5 + 2 + 8*2 + 2 + 1 + 3 = 40, players 8 and 11 still to play
  assert.equal(t.gross, 40);
  assert.equal(t.toPlay, 2);
});

test('captain out: vice takes the armband; triple captain triples it', () => {
  const { ctx, picks } = squad();
  ctx.live[9] = { minutes: 0, points: 0, bonus: 0, bps: 0, explain: [] };
  const t = teamLive(picks, '3xc', 4, ctx);
  assert.equal(t.captain, 5);
  assert.equal(t.viceUsed, true);
  assert.equal(t.lines.find((l) => l.element === 5).mult, 3);
  assert.equal(t.net, t.gross - 4);
});

test('bench boost: everyone counts, no subs', () => {
  const { ctx, picks } = squad();
  const t = teamLive(picks, 'bboost', 0, ctx);
  assert.deepEqual(t.subs, []);
  assert.equal(t.lines.filter((l) => l.counts).length, 15);
});

test('league: live table re-ranks on live points and ownership counts captains', () => {
  const { ctx, picks } = squad();
  const other = picks.map((p) => ({ ...p, captain: p.element === 2, vice: false }));
  const out = leagueLive(
    [
      { entry: 1, rank: 1, total: 96, eventTotal: 0, picks: other, chip: null, hit: 0 },
      { entry: 2, rank: 2, total: 95, eventTotal: 0, picks, chip: null, hit: 0 },
    ],
    ctx
  );
  assert.equal(out.table[0].entry, 2); // 95 + 40 beats 96 + 38 (their captain scored 6, ours 8)
  const p9 = out.ownership.find((o) => o.element === 9);
  assert.equal(p9.captains, 1);
  assert.equal(p9.eo, 150);
});

test('poisson helpers', () => {
  assert.ok(Math.abs(poissonTail(2, 1) - (1 - Math.exp(-2))) < 1e-9);
  assert.equal(poissonTail(2, 0), 1);
  // E[floor(X/2)] for tiny rates is about P(X >= 2); an offset of 1 makes one more goal enough.
  assert.ok(poissonFloor(0.01, 2) < 1e-4);
  assert.ok(Math.abs(poissonFloor(0.01, 2, 1) - poissonTail(0.01, 1)) < 1e-4);
});

// Two equal teams, plus a striker who takes a third of his side's xG.
function modelCtx() {
  const els = [];
  for (const team of [1, 2]) for (let i = 0; i < 11; i++) els.push({ id: team * 100 + i, team, type: i === 0 ? 1 : i < 5 ? 2 : i < 9 ? 3 : 4, minutes: 450, starts: 5, xg: i === 10 ? 2.5 : i > 4 ? 0.5 : 0.1, xa: 0.3, xgc: 6.5 });
  const elements = Object.fromEntries(els.map((e) => [e.id, e]));
  const fixtures = [{ id: 1, home: 1, away: 2, started: false, finished: false, finishedProvisional: false, minutes: 0, kickoff: '2026-10-11T14:00:00Z' }];
  return { elements, live: {}, fixtures, bonus: {}, model: buildModel(els) };
}

test('model: home side expected to score more than the same side away', () => {
  const ctx = modelCtx();
  const r = fixtureRates(ctx.fixtures[0], ctx.model);
  assert.ok(r.home > r.away);
  assert.ok(Math.abs(r.home / r.away - 1.21) < 0.01);
});

test('projections: a regular starter expects more than appearance points; a finished match adds nothing', () => {
  const ctx = modelCtx();
  const st = projectPlayer(110, ctx);
  assert.ok(st.rest > 2 && st.rest < 9, `striker ${st.rest}`);
  assert.equal(st.now, 0);
  ctx.fixtures[0] = { ...ctx.fixtures[0], started: true, finished: true, finishedProvisional: true, minutes: 90, hs: 1, as: 0 };
  ctx.live[110] = { minutes: 90, points: 8, bonus: 0, bps: 0, explain: [] };
  const done = projectPlayer(110, ctx);
  assert.equal(done.rest, 0);
  assert.equal(done.final, 8);
});

test('head to head: identical teams are a coin flip; a settled week is certain', () => {
  const ctx = modelCtx();
  const picks = Array.from({ length: 11 }, (_, i) => ({ element: 100 + i, position: i + 1, multiplier: 1, captain: i === 10, vice: i === 9 }));
  const a = teamLive(picks, null, 0, ctx);
  const same = headToHead(a, a, ctx);
  assert.equal(same.pA, 0.5);
  assert.equal(same.shared.length, 11);
  assert.equal(same.onlyA.length, 0);
  // Same players, different captain: only the captaincy can separate them.
  const b = teamLive(picks.map((p) => ({ ...p, captain: p.element === 105 })), null, 0, ctx);
  const h = headToHead(a, b, ctx);
  assert.deepEqual(h.onlyA.map((r) => [r.element, r.extra]), [[110, 1]]);
  assert.ok(h.pA > 0.5);
  ctx.fixtures[0] = { ...ctx.fixtures[0], started: true, finished: true, finishedProvisional: true, minutes: 90, hs: 0, as: 0 };
  ctx.live[105] = { minutes: 90, points: 3, bonus: 0, bps: 0, explain: [] };
  const settled = headToHead(teamLive(picks, null, 0, ctx), teamLive(picks.map((p) => ({ ...p, captain: p.element === 105 })), null, 0, ctx), ctx);
  assert.equal(settled.pA, 0);
});

test('xG: geometry and ordering make sense', () => {
  const { dist } = shotGeometry(100 - (11 / 105) * 100, 50);
  assert.ok(Math.abs(dist - 11) < 1e-9);
  const sixYard = xgFor({ x: 96, y: 50, text: 'right footed shot from very close range' });
  const edge = xgFor({ x: 82, y: 50, text: 'right footed shot from outside the box' });
  const angled = xgFor({ x: 97, y: 85, text: 'left footed shot from a difficult angle on the left' });
  const header = xgFor({ x: 92, y: 50, text: 'header from the centre of the box' });
  const foot = xgFor({ x: 92, y: 50, text: 'right footed shot from the centre of the box' });
  assert.ok(sixYard > 0.3 && sixYard < 0.8, `six-yard ${sixYard}`);
  assert.ok(edge > 0.02 && edge < 0.08, `edge ${edge}`);
  assert.ok(angled < sixYard);
  assert.ok(header < foot);
  assert.equal(xgFor({ x: 89, y: 50, text: 'Goal! converts the penalty with a right footed shot' }), PENALTY_XG);
  assert.equal(shotTraits('Rogers wins a penalty in the box').penalty, false);
});

test('ESPN days: Dubai local day touches two ESPN days', () => {
  if (Intl.DateTimeFormat().resolvedOptions().timeZone !== 'Asia/Dubai') return;
  assert.deepEqual(espnDaysFor('2026-10-10'), ['20261009', '20261010']);
});

test('formation: 4-2-3-1 lines with holding midfielders labelled LM/RM', () => {
  const p = (place, pos, last) => ({ place, pos, last });
  const xi = [p(1, 'G', 'K'), p(2, 'RB', 'RB'), p(3, 'LB', 'LB'), p(4, 'LM', 'DML'), p(5, 'CD-R', 'CBR'), p(6, 'CD-L', 'CBL'), p(7, 'AM-R', 'RW'), p(8, 'RM', 'DMR'), p(9, 'F', 'ST'), p(10, 'AM', 'AM'), p(11, 'AM-L', 'LW')];
  const lines = formationLines(xi, '4-2-3-1').map((l) => l.map((x) => x.last).join(' '));
  assert.deepEqual(lines, ['K', 'LB CBL CBR RB', 'DML DMR', 'LW AM RW', 'ST']);
  assert.equal(formationLines(xi.slice(0, 10), '4-2-3-1'), null);
});

test('match status labels', () => {
  assert.equal(statusOf({ displayClock: "67'", type: { name: 'STATUS_SECOND_HALF', state: 'in' } }).label, "67'");
  assert.equal(statusOf({ type: { name: 'STATUS_HALFTIME', state: 'in' } }).label, 'HT');
  assert.equal(statusOf({ type: { name: 'STATUS_POSTPONED', state: 'post' } }).off, true);
});

test('normaliseMatch reads home/away by flag, not order, and counts red cards', () => {
  const m = normaliseMatch(
    {
      id: 9,
      date: '2026-10-10T14:00Z',
      competitions: [
        {
          status: { displayClock: "80'", type: { name: 'STATUS_SECOND_HALF', state: 'in' } },
          competitors: [
            { homeAway: 'away', score: '1', team: { id: 2, displayName: 'Away FC', abbreviation: 'AWA', color: '112233' } },
            { homeAway: 'home', score: '2', team: { id: 1, displayName: 'Home FC', abbreviation: 'HOM' } },
          ],
          details: [
            { team: { id: 2 }, redCard: true, clock: { displayValue: "50'" }, athletesInvolved: [{ shortName: 'A. Away' }] },
            { team: { id: 1 }, scoringPlay: true, clock: { displayValue: "12'" }, athletesInvolved: [{ shortName: 'H. Home' }] },
          ],
        },
      ],
    },
    'eng.1'
  );
  assert.equal(m.home.name, 'Home FC');
  assert.equal(m.home.score, 2);
  assert.equal(m.away.red, 1);
  assert.equal(m.away.color, '#112233');
  assert.deepEqual(m.goals.map((g) => [g.side, g.name]), [['home', 'H. Home']]);
});

test('ratings: the side that creates more rates higher; probabilities add up', () => {
  const games = { A: [], B: [], C: [] };
  const add = (d, h, a, hs, as, xh, xa) => {
    games[h].push([d, a, 1, hs, as, xh, xa]);
    games[a].push([d, h, 0, as, hs, xa, xh]);
  };
  for (let i = 0; i < 6; i++) {
    add(`2026-0${(i % 6) + 1}-01`, 'A', 'B', 2, 0, 2.2, 0.6);
    add(`2026-0${(i % 6) + 1}-08`, 'B', 'C', 1, 1, 1.1, 1.2);
    add(`2026-0${(i % 6) + 1}-15`, 'C', 'A', 0, 2, 0.7, 1.9);
  }
  const r = rateTeams(games, { asOf: new Date('2026-07-01').getTime() });
  assert.ok(r.att.A > r.att.B && r.att.A > r.att.C);
  assert.ok(r.def.A < r.def.B);
  const g = goalRates(r, 'A', 'B');
  const o = matchOdds(g.home, g.away);
  assert.ok(Math.abs(o.home + o.draw + o.away - 1) < 1e-9);
  assert.ok(o.home > o.away);
});

test('in play: a two-goal lead at 89 minutes is nearly won; the final whistle settles it', () => {
  const p = inPlay(1.4, 1.4, { minute: 89, hs: 2, as: 0 });
  assert.ok(p.home > 0.97);
  const path = winPath(1.4, 1.2, [{ kind: 'goal', side: 'away', minute: "90'+3'" }], 90, { finished: true });
  assert.deepEqual([path[90].home, path[90].draw, path[90].away], [0, 0, 1]);
});

test('shot outcomes: one sure chance against nothing wins', () => {
  assert.deepEqual(shotOutcomes([1], []), { home: 1, draw: 0, away: 0 });
  const even = shotOutcomes([0.5], [0.5]);
  assert.ok(Math.abs(even.home - 0.25) < 1e-9 && Math.abs(even.draw - 0.5) < 1e-9);
});

test('season simulation: a far stronger side usually wins the league', () => {
  const r = { att: { A: 2, B: 1, C: 0.5 }, def: { A: 0.5, B: 1, C: 1.5 }, baseH: 1.5, baseA: 1.2 };
  const fx = [];
  for (let i = 0; i < 10; i++) fx.push({ home: 'A', away: 'B' }, { home: 'B', away: 'C' }, { home: 'C', away: 'A' });
  const out = simulateSeason([{ id: 'A', pts: 0, gd: 0, gf: 0 }, { id: 'B', pts: 0, gd: 0, gf: 0 }, { id: 'C', pts: 0, gd: 0, gf: 0 }], fx, r, { n: 500, top: 1, bottom: 1 });
  assert.ok(out.A.title > 0.9);
  assert.ok(out.C.bottom > 0.8);
  assert.ok(Math.abs(out.A.dist.reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test('table rates: home advantage and attack show through', () => {
  const rows = [{ id: '1', p: 10, gf: 25, ga: 8 }, { id: '2', p: 10, gf: 10, ga: 20 }];
  const r = ratesFromTable(rows, '1', '2');
  assert.ok(r.home > r.away);
});

test('roles: 4-2-3-1 has wide attackers as wingers, 4-3-3 midfield three as central', () => {
  const p = (id) => ({ id });
  const l4231 = [[p('gk')], [p('lb'), p('cb1'), p('cb2'), p('rb')], [p('dm1'), p('dm2')], [p('lw'), p('am'), p('rw')], [p('st')]];
  assert.deepEqual(rolesFromLines(l4231), { gk: 'GK', lb: 'FB-L', cb1: 'CB', cb2: 'CB', rb: 'FB-R', dm1: 'CM', dm2: 'CM', lw: 'W-L', am: 'AM', rw: 'W-R', st: 'ST' });
  const l433 = [[p('gk')], [p('lb'), p('cb1'), p('cb2'), p('rb')], [p('m1'), p('m2'), p('m3')], [p('lw'), p('st'), p('rw')]];
  const r = rolesFromLines(l433);
  assert.deepEqual([r.m1, r.m2, r.m3, r.lw, r.st, r.rw], ['CM', 'CM', 'CM', 'W-L', 'ST', 'W-R']);
  const l352 = [[p('gk')], [p('c1'), p('c2'), p('c3')], [p('lwb'), p('m1'), p('m2'), p('m3'), p('rwb')], [p('s1'), p('s2')]];
  const w = rolesFromLines(l352);
  assert.deepEqual([w.c1, w.lwb, w.rwb, w.s1], ['CB', 'FB-L', 'FB-R', 'ST']);
});

test('matchups: record against one opponent, and a shrunk role factor', () => {
  const rows = [['2025-01-01', 'X', 1, 2, 0, 'W-R', 90, 3, 0.6, 1, 0.2, 0], ['2025-02-01', 'Y', 0, 0, 1, 'W-R', 90, 1, 0.1, 0, 0.1, 0]];
  const v = versus(rows, 'X');
  assert.equal(v.goals, 1);
  assert.ok(Math.abs(v.xgi90 - 0.8) < 1e-9);
  // Where they leak, not how much: a side that concedes double everywhere has no tilt.
  const lg = { 2026: { 'W-R': [9000, 30, 0, 0, 0], ST: [9000, 60, 0, 0, 0] } };
  const leakyEverywhere = roleFactor({ 2026: { 'W-R': [3000, 20, 0, 0, 0], ST: [3000, 40, 0, 0, 0] } }, lg, 'W-R', ['2026']);
  assert.ok(Math.abs(leakyEverywhere.factor - 1) < 1e-9);
  // Right wingers getting double their usual share moves it a lot over a season, barely over one match.
  const tilted = (min) => roleFactor({ 2026: { 'W-R': [min, (min / 9000) * 60, 0, 0, 0], ST: [min, (min / 9000) * 60, 0, 0, 0] } }, lg, 'W-R', ['2026']);
  assert.ok(tilted(3000).factor > 1.3 && tilted(90).factor < 1.1);
});

test('old ESPN shot spots: fractions from goal become percentages; penalties land on the spot', () => {
  const pen = shotPoint({ fieldPositionX: 0.23, fieldPositionY: 0.5, text: 'Penalty' });
  assert.ok(Math.abs(shotGeometry(pen.x, pen.y).dist - 11.04) < 0.1);
  assert.deepEqual(shotPoint({ fieldPositionX: 88.9, fieldPositionY: 46.6 }), { x: 88.9, y: 46.6 });
  assert.equal(shotPoint({ fieldPositionX: 0, fieldPositionY: 0, text: 'shot from outside the box' }).guessed, true);
});

test('net xG: learned weights apply as powers, factors multiply out, a zero weight drops a factor', () => {
  const el = { id: 9, team: 1, type: 4, minutes: 540, xg: 3, xa: 0.6, starts: 6, playing: null };
  const ctx = { model: { pos: { 4: { xg: 0.35, xa: 0.1 } }, teams: { 1: { n: 6 } } } };
  const kit = {
    fplTeams: { 1: 'A', 2: 'B' },
    roles: { 9: 'ST' },
    roleFactorRaw: () => 1.2,
    ratings: { def: { A: 1, B: 1.2 }, baseH: 1.5, baseA: 1.2 },
    ix: { current: ['A', 'B'] },
  };
  const mdl = { xg: { intercept: 0, weights: { base: 1, form: 0.1, defence: 0.8, venue: 0.2, position: 0.25, history: 0 }, shrink: { form: 0, history: 900 } } };
  const nx = { l: [2700, 15, 3], r: [450, 2.5, 0.5], v: { B: [180, 3, 0] } };
  const home = netFor(el, { home: 1, away: 2 }, ctx, kit, nx, 'xg', mdl);
  const product = home.factors.reduce((t, f) => t * f.x, home.start);
  assert.ok(Math.abs(product - home.value) < 1e-12);
  assert.ok(Math.abs(home.factors.find((f) => f.key === 'position').x - 1.2 ** 0.25) < 1e-12);
  assert.equal(home.factors.find((f) => f.key === 'history').x, 1);
  const away = netFor(el, { home: 2, away: 1 }, ctx, kit, nx, 'xg', mdl);
  assert.ok(home.value > away.value);
});

test('net xG: the fit and the live page share one definition of each factor', () => {
  const f = rawFactors({ lMin: 900, lX: 4.5, rMin: 0, rX: 0, vMin: 0, vX: 0, pos90: 0.3, defence: 1.1, home: true, tilt: 1 }, 450, 900);
  assert.ok(Math.abs(f.base - ((4.5 + 1.5) / 1350) * 90) < 1e-12);
  assert.equal(f.form, 1);
  assert.equal(f.history, 1);
  assert.deepEqual(designRow(f).slice(2), [Math.log(1.1), 0.5, 0, 0]);
});

// A small market: 3 GKs, 8 DEFs, 8 MIDs, 5 FWDs over 20 clubs, with projected points per gameweek.
function market() {
  const els = {};
  const ahead = {};
  let id = 1;
  const add = (type, cost, pts, team) => {
    els[id] = { id, type, cost, team, status: 'a', starts: 6, name: `P${id}` };
    ahead[id] = { per: Object.fromEntries(pts.map((v, i) => [7 + i, { xp: v }])) };
    return id++;
  };
  const gk = [add(1, 4.5, [4, 4, 4], 1), add(1, 4, [3, 3, 3], 2), add(1, 5, [5, 5, 5], 3)];
  const def = Array.from({ length: 8 }, (_, i) => add(2, 4 + i * 0.5, [3 + i * 0.3, 3 + (i % 2), 3], 4 + i));
  const mid = Array.from({ length: 8 }, (_, i) => add(3, 5 + i, [4 + i * 0.5, 4, 4 + i * 0.2], 12 + (i % 4)));
  const fwd = Array.from({ length: 5 }, (_, i) => add(4, 6 + i * 1.5, [4 + i, 4 + i, 4], 16 + i));
  return { els, ahead, gk, def, mid, fwd };
}

test('optimiser: best XI is a legal formation with the captain doubled', () => {
  const { els, ahead, gk, def, mid, fwd } = market();
  const squad = [gk[0], gk[1], ...def.slice(0, 5), ...mid.slice(0, 5), ...fwd.slice(0, 3)];
  const r = bestXI(squad, 7, ahead, els);
  assert.equal(r.xi.length, 11);
  const n = (t) => r.xi.filter((id) => els[id].type === t).length;
  assert.equal(n(1), 1);
  assert.ok(n(2) >= 3 && n(3) >= 2 && n(4) >= 1);
  assert.equal(r.captain, r.xi.reduce((b, id) => (ahead[id].per[7].xp > ahead[b].per[7].xp ? id : b)));
});

test('optimiser: free transfers bank up to five and chips keep them', () => {
  assert.equal(nextFree(1, 0, false), 2);
  assert.equal(nextFree(5, 0, false), 5);
  assert.equal(nextFree(2, 3, false), 1);
  assert.equal(nextFree(3, 6, true), 4);
  assert.equal(estimateFree([{ event: 2, transfers: 0 }, { event: 3, transfers: 0 }, { event: 4, transfers: 2 }], [], 4), 2);
});

test('optimiser: plans stay legal, conservative never takes a hit, and never lose to holding', () => {
  const { els, ahead, gk, def, mid, fwd } = market();
  const squad = [gk[0], gk[1], ...def.slice(0, 5), ...mid.slice(0, 5), ...fwd.slice(0, 3)];
  for (const mode of ['conservative', 'aggressive']) {
    const r = planTransfers({ squad, bank: 1, free: 1, gws: [7, 8, 9], ahead, els, mode });
    assert.ok(r.total >= r.hold - 1e-9);
    if (mode === 'conservative') assert.ok(r.plan.every((p) => p.hit === 0));
    const cost = r.squad.reduce((t, id) => t + els[id].cost, 0);
    assert.ok(cost <= squad.reduce((t, id) => t + els[id].cost, 0) + 1 + 1e-9);
    assert.equal(new Set(r.squad).size, 15);
  }
});

test('optimiser: wildcard draft is fifteen players, two-five-five-three, within budget', () => {
  const { els, ahead } = market();
  const w = buildSquad({ budget: 100, gws: [7, 8, 9], ahead, els });
  assert.equal(w.squad.length, 15);
  assert.deepEqual([1, 2, 3, 4].map((t) => w.squad.filter((id) => els[id].type === t).length), [2, 5, 5, 3]);
  assert.ok(w.cost <= 100 + 1e-9);
});

test('rotation pairs: both players must start a fair share of the weeks', () => {
  const els = { 1: { type: 2, cost: 4, team: 1, starts: 6, status: 'a' }, 2: { type: 2, cost: 4, team: 2, starts: 6, status: 'a' }, 3: { type: 2, cost: 4, team: 3, starts: 6, status: 'a' } };
  const per = (a) => ({ per: Object.fromEntries(a.map((v, i) => [7 + i, { xp: v }])) });
  const ahead = { 1: per([6, 1, 6]), 2: per([1, 6, 1]), 3: per([7, 7, 7]) };
  const r = rotationPairs({ type: 2, maxCost: 4.5, gws: [7, 8, 9], ahead, els, teamsPlayed: { 1: 6, 2: 6, 3: 6 } });
  assert.equal(r.single, 3);
  assert.deepEqual([r.pairs[0].a, r.pairs[0].b].sort(), [1, 2]);
  assert.equal(r.pairs[0].total, 18);
});

test('advice: chips reset at the halfway point', () => {
  const used = [{ name: 'wildcard', event: 4 }, { name: '3xc', event: 21 }];
  assert.deepEqual(chipsLeft(used, 7), ['freehit', 'bboost', '3xc']);
  assert.deepEqual(chipsLeft(used, 25), ['wildcard', 'freehit', 'bboost']);
});

test('injury news: return dates read from FPL text, December news can mean January', () => {
  const oct11 = Date.UTC(2026, 9, 11);
  assert.equal(returnDate('Hamstring injury - Expected back 24 Oct', oct11), Date.UTC(2026, 9, 24));
  assert.equal(returnDate('Suspended until 3 Jan', Date.UTC(2026, 11, 20)), Date.UTC(2027, 0, 3));
  assert.equal(returnDate('Knee injury - Unknown return date', oct11), null);
  assert.equal(returnDate(null, oct11), null);
});

test('availability beyond the next round: return dates, recovery, departures', () => {
  const now = Date.UTC(2026, 9, 11);
  const f = (d) => ({ kickoff: new Date(Date.UTC(2026, 9, d, 14)).toISOString() });
  const fresh = { status: 'i', chance: 0, news: 'Thigh injury - Unknown return date', newsAt: new Date(now - 5 * 864e5).toISOString() };
  assert.equal(laterAvailability(fresh, f(24), 1, now), 0.25);
  assert.ok(Math.abs(laterAvailability(fresh, f(31), 2, now) - 0.4375) < 1e-9);
  const old = { ...fresh, newsAt: new Date(now - 40 * 864e5).toISOString() };
  assert.ok(laterAvailability(old, f(24), 1, now) < 0.11);
  const dated = { status: 'i', chance: 0, news: 'Hamstring injury - Expected back 24 Oct' };
  assert.equal(laterAvailability(dated, f(18), 1, now), 0);
  assert.equal(laterAvailability(dated, f(25), 2, now), 0.75);
  assert.equal(laterAvailability(dated, f(31), 3, now), 1);
  assert.equal(laterAvailability({ status: 'u', news: 'Has joined Valencia on loan' }, f(24), 1, now), 0);
  assert.equal(laterAvailability({ status: 'd', chance: 75 }, f(24), 1, now), 0.875);
  assert.equal(laterAvailability({ status: 'a' }, f(24), 3, now), 1);
});

test('availability: live round uses this round\'s flag, the next deadline its next-round flag, later weeks recover', () => {
  const el = { status: 'i', chance: 0, playing: 25, news: 'Knee injury - Unknown return date' };
  const ctx = { fixtures: [{ id: 1 }], from: 7, now: Date.UTC(2026, 9, 11) };
  assert.equal(availability(el, { id: 1, event: 6 }, ctx), 0.25);
  assert.equal(availability(el, { id: 2, event: 7 }, ctx), 0);
  assert.ok(availability(el, { id: 3, event: 8, kickoff: '2026-10-24T14:00:00Z' }, ctx) > 0);
  assert.equal(availability({ status: 'a', chance: null }, { id: 2, event: 7 }, {}), 1);
});

test('selling prices: half the rise rounded down, all of a fall, opening prices for the first squad', () => {
  const els = { 1: { cost: 9.5 }, 2: { cost: 9.6 }, 3: { cost: 6.3, start: 6.0 }, 4: { cost: 5.0, start: 5.5 } };
  const transfers = [
    { element_in: 1, element_in_cost: 85, event: 2, time: '2026-08-20T10:00:00Z' },
    { element_in: 1, element_in_cost: 90, event: 4, time: '2026-09-10T10:00:00Z' },
    { element_in: 2, element_in_cost: 100, event: 3, time: '2026-08-30T10:00:00Z' },
    { element_in: 4, element_in_cost: 45, event: 5, time: '2026-09-18T10:00:00Z' }, // Free Hit week: undone
  ];
  const r = sellingPrices([1, 2, 3, 4], transfers, { startedEvent: 1, freeHits: [5], els });
  assert.deepEqual(r.sell, { 1: 9.2, 2: 9.6, 3: 6.1, 4: 5.0 });
  assert.deepEqual(r.guessed, []);
  const late = sellingPrices([3], [], { startedEvent: 4, els });
  assert.deepEqual([late.sell[3], late.guessed], [6.3, [3]]);
});

test('optimiser timing: a buy that would sit on the bench this week waits; one that starts goes now', () => {
  // Fifteen players and one target: replacing the injured forward is the only move on offer.
  const squadOf = (fwdXp) => {
    const els = {};
    const ahead = {};
    const types = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4];
    types.forEach((type, i) => {
      els[i + 1] = { id: i + 1, type, cost: 5, team: i + 1, status: 'a', starts: 6 };
      ahead[i + 1] = { per: { 7: { xp: 4 }, 8: { xp: 4 }, 9: { xp: 4 } } };
    });
    ahead[13] = { per: { 7: { xp: 0 }, 8: { xp: 0 }, 9: { xp: 0 } } }; // injured forward
    els[100] = { id: 100, type: 4, cost: 6, team: 30, status: 'a', starts: 6 };
    ahead[100] = { per: { 7: { xp: fwdXp[0] }, 8: { xp: fwdXp[1] }, 9: { xp: fwdXp[2] } } };
    return { els, ahead, squad: types.map((_, i) => i + 1) };
  };
  for (const [xp, free, wantGw] of [[[0.5, 9, 9], 1, 8], [[9, 9, 9], 1, 7], [[0.5, 9, 9], 5, 7]]) {
    const { els, ahead, squad } = squadOf(xp);
    const r = planTransfers({ squad, bank: 2, free, gws: [7, 8, 9], ahead, els, mode: 'conservative' });
    assert.equal(r.plan.find((p) => p.moves.some((m) => m.in === 100))?.gw, wantGw, `xp ${xp}, ${free} free`);
  }
  assert.equal(committed(1, 1), 1);
  assert.equal(committed(1, 5), 0); // the cap would waste it
  assert.equal(committed(2, 5), 1);
});

test('UK times: press conference clock times through BST and GMT; price windows before a deadline', () => {
  assert.equal(londonToUtc('2026-10-16', '13:30'), Date.UTC(2026, 9, 16, 12, 30)); // BST
  assert.equal(londonToUtc('2026-10-30', '13:30'), Date.UTC(2026, 9, 30, 13, 30)); // GMT after 25 Oct
  assert.equal(ukLabel(Date.UTC(2026, 9, 17, 10, 0)), 'Saturday 17 October, 11:00 UK');
  // Sunday 10:00 UTC to the Saturday 10:00 UTC deadline: Monday to Saturday at 01:30 UK.
  assert.equal(priceWindows(Date.UTC(2026, 9, 11, 10), Date.UTC(2026, 9, 17, 10)).length, 6);
  const el = { price: { nights: [[0, -61, -3], [1, -66.6, -3], [2, -105.8, -5]] } };
  assert.deepEqual(priceMove(el, 6), { dir: 'fall', night: 2 });
  assert.equal(priceMove(el, 2), null); // the deadline comes first
  const fx = [{ event: 6, kickoff: '2026-10-12T19:00:00Z' }, { event: 7, kickoff: '2026-10-17T11:30:00Z' }];
  assert.deepEqual(breakBefore(fx, 7), { days: 5, international: false });
});

test('club news: only sourced, dated, on-roster claims survive; a press conference has to be for this match', () => {
  const now = Date.UTC(2026, 9, 14, 9);
  const pages = new Map([['https://www.liverpoolfc.com/news/slot-press-conference-brentford', { title: 'Slot press conference' }], ['https://www.bbc.co.uk/sport/football/123', { title: 'Team news' }]]);
  const roster = [{ id: 379, name: 'Isak', first: 'Alexander', second: 'Isak' }, { id: 380, name: 'Salah', first: 'Mohamed', second: 'Salah' }];
  const args = { club: { id: 14, short: 'LIV' }, fixtures: [{ kickoff: '2026-10-17T11:30:00Z' }], roster, now, pages };
  const r = cleanReport(
    {
      press_conference: { status: 'scheduled', date: '2026-10-16', time_uk: '13:30', source_url: 'https://liverpoolfc.com/news/slot-press-conference-brentford/', said: ['ignored until held'] },
      players: [
        { id: null, name: 'Alexander Isak', status: 'back_in_training', expected_return: null, detail: 'Slot: Isak trained on Tuesday.', published: '2026-10-13', source_url: 'https://www.bbc.co.uk/sport/football/123' },
        { id: 380, name: 'Salah', status: 'doubtful', expected_return: null, detail: 'Made up', published: '2026-10-13', source_url: 'https://example.com/not-searched' },
        { id: 999, name: 'Nobody', status: 'out', expected_return: null, detail: 'x', published: '2026-10-13', source_url: 'https://www.bbc.co.uk/sport/football/123' },
      ],
      summary: 'Isak is back in training.',
    },
    args,
  );
  assert.equal(r.presser.status, 'scheduled');
  assert.equal(r.presser.at, Date.UTC(2026, 9, 16, 12, 30));
  assert.equal(r.presser.source, 'https://www.liverpoolfc.com/news/slot-press-conference-brentford');
  assert.deepEqual(r.players.map((p) => [p.id, p.status]), [[379, 'back_in_training']]);
  // A press conference from last week, or with a source the search never returned, is dropped.
  const old = cleanReport({ press_conference: { status: 'held', date: '2026-10-03', time_uk: '13:30', source_url: 'https://www.bbc.co.uk/sport/football/123', said: [] }, players: [], summary: '' }, args);
  assert.equal(old.presser.status, 'not_announced');
  const unsourced = cleanReport({ press_conference: { status: 'scheduled', date: '2026-10-16', time_uk: '13:30', source_url: 'https://made.up/x', said: [] }, players: [], summary: '' }, args);
  assert.equal(unsourced.presser.status, 'not_announced');
  // Once its time has passed it counts as held.
  assert.equal(cleanReport({ press_conference: { status: 'scheduled', date: '2026-10-16', time_uk: '13:30', source_url: 'https://www.bbc.co.uk/sport/football/123', said: ['Isak is fit'] }, players: [], summary: '' }, { ...args, now: Date.UTC(2026, 9, 16, 15) }).presser.status, 'held');
  assert.equal(matchPlayer({ id: null, name: 'Isák' }, roster), 379);
});

test('club news: newer than FPL\'s flag changes the numbers, older doesn\'t; caching follows the press conference', () => {
  const els = { 379: { status: 'i', chance: 0, newsAt: '2026-09-27T10:30:09Z' } };
  const rep = (status, published, back = null) => [{ players: [{ id: 379, status, published, back, detail: 'x', source: 'u' }] }];
  assert.deepEqual(newsPatches(rep('back_in_training', '2026-10-13'), els)[379].chance, 75);
  assert.equal(newsPatches(rep('back_in_training', '2026-09-20'), els)[379], undefined);
  const out = newsPatches(rep('out', '2026-10-13', '2026-11-08'), els)[379];
  assert.deepEqual([out.chance, out.returnAt], [0, Date.UTC(2026, 10, 8)]);
  const now = Date.UTC(2026, 9, 15, 9);
  assert.equal(newsTtl({ presser: { status: 'scheduled', at: now + 5 * 3600e3 } }, now, now + 2 * 864e5), 5 * 3600 + 45 * 60);
  assert.equal(newsTtl({ presser: { status: 'held' } }, now, now + 2 * 864e5), 3 * 3600);
  assert.equal(newsTtl({ presser: { status: 'held' } }, now, now + 3600e3), 2700);
});

test('advice timing: wait for next week, a press conference or a price change, from the facts alone', () => {
  assert.equal(whenFor({ starts: false, deferWastes: false, priceRisk: false, hoursLeft: 100 }), 'next_gameweek');
  assert.equal(whenFor({ starts: false, deferWastes: true, priceRisk: false, hoursLeft: 100 }), 'closer_to_deadline');
  assert.equal(whenFor({ starts: true, deferWastes: false, priceRisk: false, waits: [{}], hoursLeft: 100 }), 'after_press_conference');
  assert.equal(whenFor({ starts: true, deferWastes: false, priceRisk: true, waits: [{}], hoursLeft: 100 }), 'before_price_change');
  assert.equal(whenFor({ starts: true, deferWastes: false, priceRisk: false, hoursLeft: 10 }), 'now');
});

// Fifteen fit players at 4 points a week, an injured forward (13) and two possible buys, for validate.
function advicePacket({ inXp = 0.5, free = 1, nights = null, watch = [] } = {}) {
  const els = {};
  const ahead = {};
  const types = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4];
  types.forEach((type, i) => {
    els[i + 1] = { id: i + 1, name: `P${i + 1}`, type, cost: 5, team: i + 1, status: 'a' };
    ahead[i + 1] = { per: { 7: { xp: 4 } } };
  });
  els[1].cost = 4.5;
  Object.assign(els[13], { status: 'i', chance: 0, news: 'Thigh injury - Unknown return date' });
  ahead[13] = { per: { 7: { xp: 0 } } };
  els[100] = { id: 100, name: 'Wissa', type: 4, cost: 6, team: 30, status: 'a', price: nights ? { nights } : {} };
  ahead[100] = { per: { 7: { xp: inXp } } };
  els[101] = { id: 101, name: 'Mid', type: 3, cost: 5, team: 31, status: 'a' };
  ahead[101] = { per: { 7: { xp: 3 } } };
  const squad = types.map((_, i) => i + 1);
  const xp = (id) => ahead[id]?.per[7]?.xp ?? 0;
  const lineupOf = (sq) => {
    const b = bestXI(sq, 7, ahead, els);
    return { xi: b.xi, bench: b.bench, captain: b.captain, points: b.xi.reduce((t, id) => t + xp(id), 0) + xp(b.captain) };
  };
  const evaluate = (moves) => {
    let sq = [...squad];
    let money = 1.5;
    for (const m of moves) {
      sq = sq.map((x) => (x === m.out ? m.in : x));
      money += els[m.out].cost - els[m.in].cost;
    }
    return { squad: sq, bank: money, hit: Math.max(0, moves.length - free) * 4, ...lineupOf(sq), horizon: 0 };
  };
  return { _: { squad, bank: 1.5, free, gw: 7, ahead, els, pool: new Set([100, 101]), sellOf: (id) => els[id].cost, options: [], evaluate, hold: evaluate([]), watch, chipsAvailable: ['wildcard', 'bboost', '3xc'], deadline: 0, windows: 6, newsBy: {}, drafts: { wildcard: [...squad.slice(0, 12), 14, 15, 100] }, lineup: lineupOf } };
}
const answer = (over = {}) => ({ headline: 'h', option: 'custom', transfers: [{ out: 13, in: 100, when: 'now', reason: 'Isak is out' }], conditions: [], captain: 3, vice_captain: 4, chip: { play: 'none', reason: '' }, reasoning: [], risks: [], confidence: 'medium', ...over });

test('advice rules: a buy that would sit on the bench waits for next week (the Isak → Wissa case)', () => {
  const v = validate(answer(), advicePacket({ inXp: 0.5 }));
  assert.deepEqual(v.transfers, []);
  assert.deepEqual(v.nextWeek.map((m) => [m.out, m.in, m.when]), [[13, 100, 'next_gameweek']]);
  assert.match(v.nextWeek[0].note, /wouldn't start/);
  assert.equal(v.hit, 0);
  // ...unless it can't wait: a price rise before the deadline, a fifth free transfer, or a Bench Boost.
  // ...unless it can't wait, and then the move says why.
  const kept = (a, pk) => validate(a, pk).transfers.map((m) => m.note);
  assert.match(kept(answer(), advicePacket({ inXp: 0.5, nights: [[0, 120, 4]] }))[0], /price is likely to rise/);
  assert.match(kept(answer(), advicePacket({ inXp: 0.5, free: 5 }))[0], /waste a free transfer/);
  assert.match(kept(answer({ chip: { play: 'bboost', reason: '' } }), advicePacket({ inXp: 0.5 }))[0], /Bench Boost counts the bench/);
});

test('advice rules: selling a doubt waits for his press conference; the eleven is always ours', () => {
  const watch = [{ team: 13, club: 'LIV', status: 'not_announced', beforeDeadline: true, players: [13] }];
  const v = validate(answer(), advicePacket({ inXp: 9, watch }));
  assert.deepEqual(v.transfers.map((m) => [m.in, m.when, m.starts]), [[100, 'after_press_conference', true]]);
  assert.match(v.transfers[0].note, /press conference/);
  assert.ok(v.xi.includes(100) && !v.xi.includes(13));
  assert.equal(v.captain, 100); // 9 against 4: the model's pick (P3) is replaced, with a note
  assert.equal(v.notes.length, 1);
  assert.equal(v.watch.length, 1);
});

test('advice rules: illegal moves dropped, chips checked, a Wildcard uses our draft', () => {
  const v = validate(answer({ transfers: [{ out: 12, in: 100, when: 'now', reason: '' }, { out: 99, in: 101, when: 'now', reason: '' }, { out: 13, in: 999, when: 'now', reason: '' }], chip: { play: 'freehit', reason: '' } }), advicePacket());
  assert.deepEqual(v.transfers, []);
  assert.equal(v.chip.play, 'none');
  assert.equal(v.notes.filter((n) => n.startsWith('Dropped')).length, 3);
  const w = validate(answer({ chip: { play: 'wildcard', reason: 'r' } }), advicePacket());
  assert.equal(w.chip.play, 'wildcard');
  assert.ok(w.draft.includes(100) && w.xi.every((id) => w.draft.includes(id)));
  assert.equal(w.hit, 0);
});

test('FPL routes: everything that changes the answer is in the path; the old query form still reads, uncached', async () => {
  const { fplRequest } = await import('./fpl-server.mjs');
  const q = (s) => new URLSearchParams(s);
  assert.deepEqual(fplRequest(['entry', '123', '6']), { kind: 'entry', id: 123, event: 6, legacy: false });
  assert.deepEqual(fplRequest(['league', '5508', '6']), { kind: 'league', id: 5508, event: 6, legacy: false });
  assert.deepEqual(fplRequest(['live', '6']), { kind: 'live', event: 6, legacy: false });
  assert.deepEqual(fplRequest(['static']), { kind: 'static', legacy: false });
  assert.deepEqual(fplRequest(['entry'], q('id=123&event=6')), { kind: 'entry', id: 123, event: 6, legacy: true });
  assert.deepEqual(fplRequest(['live'], q('event=6')), { kind: 'live', event: 6, legacy: true });
  assert.equal(fplRequest(['entry', '123']).status, 404); // a path missing its gameweek isn't guessed
  assert.equal(fplRequest(['entry', '123', '40']).status, 400);
  assert.equal(fplRequest(['secrets']).status, 404);
});

test('next squad: after a Free Hit the team goes back to the squad and bank from before it', async () => {
  const { getNextSquad } = await import('./fpl-server.mjs');
  const real = globalThis.fetch;
  const picks = (ids, bank) => ({ active_chip: null, entry_history: { bank, event_transfers_cost: 0 }, picks: ids.map((element, i) => ({ element, position: i + 1, multiplier: 1 })) });
  globalThis.fetch = async (url) => {
    const u = String(url);
    const body = u.includes('/event/5/picks/') ? picks([1, 2, 3], 12) : u.includes('/transfers/') ? [{ element_in: 3, element_in_cost: 55, event: 4, time: '2026-09-10T10:00:00Z', entry: 77 }] : null;
    return { ok: body != null, status: body ? 200 : 404, json: async () => body };
  };
  try {
    const entry = { gw: { chip: 'freehit', picks: [{ element: 9 }], bank: 0 } };
    const r = await getNextSquad(77, entry, 6);
    assert.deepEqual(r.picks.map((p) => p.element), [1, 2, 3]);
    assert.equal(r.bank, 1.2);
    assert.equal(r.revertedFreeHit, true);
    assert.deepEqual(r.transfers, [{ element_in: 3, element_in_cost: 55, element_out: undefined, element_out_cost: undefined, event: 4, time: '2026-09-10T10:00:00Z' }]);
  } finally {
    globalThis.fetch = real;
  }
});

test('club news: a model that can\'t search falls back to the backup; web search switched off is reported as such', async () => {
  const http = await import('node:http');
  let mode = 'haiku-unsupported';
  const seen = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const { model } = JSON.parse(raw);
      seen.push(model);
      const error = (message) => {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message } }));
      };
      if (mode === 'off') return error('Web search is not enabled for your organization.');
      if (model.includes('haiku')) return error('web_search_20250305 is not supported on this model.');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model, stop_reason: 'tool_use', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1, server_tool_use: { web_search_requests: 1 } }, content: [
        { type: 'web_search_tool_result', tool_use_id: 's', content: [{ type: 'web_search_result', url: 'https://club.example/presser', title: 'Presser', encrypted_content: 'x' }] },
        { type: 'tool_use', id: 't', name: 'report_news', input: { press_conference: { status: 'scheduled', date: '2026-10-16', time_uk: '13:30', source_url: 'https://club.example/presser', said: [] }, players: [], summary: 'All fit.' } },
      ] }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.ANTHROPIC_API_KEY ||= 'sk-test';
  try {
    const { fetchClubNews } = await import('./news.mjs');
    const args = { club: { id: 14, name: 'Liverpool', short: 'LIV' }, fixtures: [{ home: 14, away: 3, oppName: 'Brentford', kickoff: '2026-10-17T11:30:00Z' }], deadline: '2026-10-17T10:00:00Z', roster: [{ id: 379, name: 'Isak', status: 'i', chance: 0 }], focus: [379], now: Date.UTC(2026, 9, 14) };
    const r = await fetchClubNews(args);
    assert.equal(r.presser.status, 'scheduled');
    assert.equal(r.model, undefined); // the page never names the model
    assert.deepEqual(seen, ['claude-haiku-5-5', 'claude-sonnet-5-5']);
    mode = 'off';
    await assert.rejects(fetchClubNews(args), (e) => e.code === 'web_search_off');
  } finally {
    server.close();
    delete process.env.ANTHROPIC_BASE_URL;
  }
});

test('honest verdict facts: dead weight, league rank by projection, what recent transfers cost, the season so far', () => {
  const els = {};
  const types = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4];
  types.forEach((type, i) => (els[i + 1] = { id: i + 1, type, cost: i === 1 ? 4 : 5.5, status: 'a' }));
  els[13] = { ...els[13], cost: 9, status: 'i' }; // £9m, injured: 2 points over five
  els[14] = { ...els[14], status: 'u' }; // left the club
  els[20] = { id: 20, type: 4, cost: 8, status: 'a' };
  const totals = { 2: 0, 13: 2, 14: 0 };
  const total = (id) => totals[id] ?? 20;
  const squad = types.map((_, i) => i + 1);
  const hold = { points: 55, horizon: 270, bench: [2, 7, 12, 15] };
  const pk = (first) => Array.from({ length: 15 }, (_, i) => ({ element: first + i }));
  const f = honestFacts({
    squad, hold, bestOver5: 300, els, total, bank: 2.4, gws: [7, 8, 9, 10, 11],
    history: [{ event: 5, points: 40, hit: 4, bench: 9, overall: 900000 }, { event: 6, points: 70, hit: 0, bench: 3, overall: 700000 }],
    events: [{ id: 5, finished: true, average: 50 }, { id: 6, finished: true, average: 60 }],
    league: { name: 'Djangos Mangoes', more: false, rows: [{ entry: 1, rank: 2, total: 400, manager: 'Me', picks: pk(1) }, { entry: 2, rank: 1, total: 425, manager: 'Raza', picks: pk(100) }, { entry: 3, rank: 3, total: 380, manager: 'Ali', picks: pk(200) }] },
    projectSquad: (ids) => (ids[0] === 100 ? 61 : 50),
    entryId: 1,
    transfers: [{ event: 5, element_out: 20, element_in: 13 }, { event: 6, element_out: 15, element_in: 1 }, { event: 4, element_out: 3, element_in: 4 }],
    pointsByGw: { 5: { 13: 2, 20: 10 }, 6: { 13: 0, 20: 6, 1: 1, 15: 7 } },
    current: 6,
    freeHits: [6],
    record: { season: { weeks: 2, maeOurs: 2.1, maeFpl: 2.4, beatFplWeeks: 2 } },
  });
  assert.equal(f.shareOfBest, 90);
  assert.deepEqual(f.deadWeight.map((d) => d.id), [13, 14]); // not the £4m reserve keeper
  assert.deepEqual([f.league.projectedRank, f.league.managers, f.league.tableRank, f.league.gapToLeader], [2, 3, 2, 25]);
  // Selling the GW5 striker for the injured one cost 14 points; the Free Hit week and the older move aren't counted.
  assert.deepEqual(f.transfers, [{ gw: 5, out: 20, in: 13, to: 6, outPoints: 16, inPoints: 2, net: -14 }]);
  assert.deepEqual(f.season, { gameweeks: 2, beatAverage: 1, hitPoints: 4, benchPoints: 12, overallRanks: [900000, 700000] });
  assert.match(f.record, /2\.1 points a player against FPL's 2\.4/);
  assert.equal(f.benchCost, 20.5);
});

test('advice rules: the verdict comes through trimmed, problems capped at four', () => {
  const v = validate(answer({ verdict: { line: '  Your squad is 90% of what it could be. ', problems: ['a', 'b', '', 'c', 'd', 'e'], working: '' } }), advicePacket({ inXp: 9 }));
  assert.deepEqual(v.verdict, { line: 'Your squad is 90% of what it could be.', problems: ['a', 'b', 'c', 'd'], working: '' });
  assert.equal(validate(answer(), advicePacket({ inXp: 9 })).verdict, null);
});

test('transfer ledger: churn within a week is netted out, a replacement is judged only while kept, a Wildcard is one line', () => {
  const els = { 1: { type: 4, cost: 9 }, 2: { type: 4, cost: 6 }, 3: { type: 4, cost: 7 }, 4: { type: 4, cost: 6.5 }, 5: { type: 3, cost: 8 }, 6: { type: 3, cost: 7.5 }, 7: { type: 2, cost: 5 }, 8: { type: 2, cost: 4.5 }, 9: { type: 1, cost: 5 }, 10: { type: 1, cost: 4.5 } };
  const pointsByGw = { 3: { 1: 10, 2: 1, 3: 6, 4: 2 }, 4: { 1: 8, 2: 0, 3: 5, 4: 9 }, 5: { 1: 6, 3: 2, 4: 7 } };
  // GW3: 1 → 2, then 2 → 3 before the deadline: really 1 → 3. GW4: 3 → 4.
  const t = [
    { event: 3, element_out: 1, element_in: 2 },
    { event: 3, element_out: 2, element_in: 3 },
    { event: 4, element_out: 3, element_in: 4 },
  ];
  const lines = transferLedger(t, { pointsByGw, current: 5, els });
  // 1 → 3 counted for GW3 only (3 was sold in GW4): 6 against 10. 3 → 4 over GW4–5: 16 against 7.
  assert.deepEqual(lines, [
    { gw: 3, out: 1, in: 3, to: 3, outPoints: 10, inPoints: 6, net: -4 },
    { gw: 4, out: 3, in: 4, to: 5, outPoints: 7, inPoints: 16, net: 9 },
  ]);
  const wc = transferLedger(
    [{ event: 3, element_out: 1, element_in: 3 }, { event: 3, element_out: 5, element_in: 6 }, { event: 3, element_out: 7, element_in: 8 }, { event: 3, element_out: 9, element_in: 10 }],
    { pointsByGw, current: 5, wildcards: [3], els },
  );
  assert.equal(wc.length, 1);
  assert.deepEqual([wc[0].wildcard, wc[0].changes, wc[0].net], [true, 4, 13 - 24]);
});

test('ESPN relay key: the ESPN URL survives the round trip through a path segment', async () => {
  const { espnKey } = await import('./espn.mjs');
  const { fromEspnKey } = await import('./espn-relay.mjs');
  const u = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20261011&limit=200';
  const k = espnKey(u);
  assert.match(k, /^[A-Za-z0-9_-]+$/);
  assert.equal(fromEspnKey(k), u);
});

test('withPendingGoals: the score is right when the events lag behind it', () => {
  const goal = (id, side, minute, period = 1) => ({ id, kind: 'goal', side, minute, order: Number.parseInt(minute, 10), period, players: ['A Player'], score: null });
  const events = [goal('1', 'home', "12'"), { id: '2', kind: 'yellow', side: 'away', minute: "30'", order: 30, period: 1, players: [] }];
  const live = { status: { state: 'in', label: "78'" }, home: { score: 1 }, away: { score: 1 } };
  const out = withPendingGoals(events, live);
  const pending = out.filter((e) => e.pending);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].side, 'away');
  assert.equal(pending[0].minute, "78'");
  assert.deepEqual(pending[0].score, [1, 1]);
  // In step: nothing added, the same list back.
  assert.equal(withPendingGoals(events, { ...live, away: { score: 0 } }), events);
  // At half-time a missing goal goes at 45′, at full time at 90′.
  assert.equal(withPendingGoals([], { status: { state: 'in', label: 'HT' }, home: { score: 1 }, away: { score: 0 } })[0].minute, "45'");
  assert.equal(withPendingGoals([], { status: { state: 'post', label: 'FT' }, home: { score: 0 }, away: { score: 2 } }).filter((e) => e.pending).length, 2);
  // Before kick-off there's no score to trust.
  assert.equal(withPendingGoals([], { status: { state: 'pre', label: '' }, home: { score: null }, away: { score: null } }).length, 0);
});

test('shootoutFrom: a shoot-out kick by kick, and its kicks are not shots', () => {
  const c = (sequence, text, period = 5) => ({ sequence, text, play: { id: String(sequence), period: { number: period }, type: { type: /^goal/i.test(text) ? 'goal' : 'penalty---missed' }, text } });
  // ESPN's own words, from Bradford v Burnley in the Carabao Cup.
  const commentary = [
    c(1, 'Penalty Shootout begins Bradford City 0, Burnley 0.'),
    c(2, 'Goal! Bradford City 0, Burnley 0(1). Zian Flemming (Burnley) converts the penalty with a right footed shot to the bottom left corner.'),
    c(3, 'Goal! Bradford City 0(1), Burnley 0(1). Antoni Sarcevic (Bradford City) converts the penalty with a right footed shot to the top left corner.'),
    c(4, 'Penalty missed! Still Bradford City 0(1), Burnley 0(1). Zeki Amdouni (Burnley) hits the left post with a right footed shot.'),
    c(5, 'Penalty saved. Jacob Bruun Larsen (Burnley) right footed shot saved in the bottom left corner by Jon McCracken (Bradford City).'),
    c(6, 'Penalty Shootout ends, Bradford City 0(1), Burnley 0(1).'),
  ];
  const kicks = shootoutFrom(commentary, { home: ['Bradford City', 'Bradford', 'BRA'], away: ['Burnley', 'BUR'] });
  assert.deepEqual(kicks.map((k) => [k.side, k.outcome, k.player]), [
    ['away', 'scored', 'Zian Flemming'],
    ['home', 'scored', 'Antoni Sarcevic'],
    ['away', 'missed', 'Zeki Amdouni'],
    ['away', 'saved', 'Jacob Bruun Larsen'],
  ]);
  assert.deepEqual(shootoutFrom([c(1, 'Kick-off', 1)], { home: [], away: [] }), []);
  assert.equal(shotsFrom(commentary, [], () => 'home').length, 0);
});
