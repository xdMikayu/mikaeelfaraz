import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bonusFromBps, teamLive, leagueLive, projectedBonus, buildModel, fixtureRates, poissonTail, poissonFloor, projectPlayer, headToHead } from './fpl.mjs';
import { xgFor, shotGeometry, shotTraits, PENALTY_XG } from './xg.mjs';
import { rateTeams, goalRates, matchOdds, inPlay, winPath, shotOutcomes, simulateSeason, ratesFromTable } from './forecast.mjs';
import { rolesFromLines, versus, roleFactor } from './matchups.mjs';
import { shotPoint } from './espn.mjs';
import { espnDaysFor, formationLines, normaliseMatch, statusOf } from './espn.mjs';

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
  // An opponent allowing double the league rate over 90 minutes barely moves the factor; over a season it does.
  const lg = { 2026: { 'W-R': [9000, 30, 0, 0, 0] } };
  const small = roleFactor({ 2026: { 'W-R': [90, 0.6, 0, 0, 0] } }, lg, 'W-R', ['2026']);
  const big = roleFactor({ 2026: { 'W-R': [3000, 20, 0, 0, 0] } }, lg, 'W-R', ['2026']);
  assert.ok(small.factor < 1.15 && big.factor > 1.5);
});

test('old ESPN shot spots: fractions from goal become percentages; penalties land on the spot', () => {
  const pen = shotPoint({ fieldPositionX: 0.23, fieldPositionY: 0.5, text: 'Penalty' });
  assert.ok(Math.abs(shotGeometry(pen.x, pen.y).dist - 11.04) < 0.1);
  assert.deepEqual(shotPoint({ fieldPositionX: 88.9, fieldPositionY: 46.6 }), { x: 88.9, y: 46.6 });
  assert.equal(shotPoint({ fieldPositionX: 0, fieldPositionY: 0, text: 'shot from outside the box' }).guessed, true);
});
