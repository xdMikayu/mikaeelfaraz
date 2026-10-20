import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestXI } from './optimise.mjs';
import { findPlayers, playerReport, compareTransfer, bestReplacements, namedPlayers, chatTurns, chatTools } from './chat.mjs';

// A small world: a fifteen-player squad and a few players to buy, two gameweeks ahead.
const TEAMS = { 1: 'Brighton BHA', 2: 'Bournemouth BOU', 3: 'Man City MCI', 4: 'Arsenal ARS', 5: 'Leeds LEE', 6: 'Everton EVE' };
const teams = Object.fromEntries(Object.entries(TEAMS).map(([id, s]) => [id, { id: Number(id), name: s.slice(0, -4), short: s.slice(-3) }]));
const el = (id, name, team, type, cost, xp, extra = {}) => ({ id, name, first: name, second: name, team, type, cost, start: cost, owned: 10, status: 'a', chance: null, news: null, minutes: 600, starts: 7, xg: 0.5, xa: 0.3, goals: 1, assists: 1, bonus: 3, ppg: 4, form: 4, ep: 4, dc90: 9, yc: 1, total: 30, setPieces: [null, null, null], xp, ...extra });
const PEOPLE = [
  el(1, 'Raya', 4, 1, 5.5, [4, 4]),
  el(2, 'Backup', 6, 1, 4.0, [1, 1]),
  el(3, 'Gvardiol', 3, 2, 6.0, [3, 3]),
  el(4, 'Saliba', 4, 2, 6.0, [5, 5]),
  el(5, 'Dunk', 1, 2, 4.5, [4, 4]),
  el(6, 'Mitchell', 6, 2, 4.0, [2, 2]),
  el(7, 'Bench', 6, 2, 4.0, [1, 1]),
  el(8, 'Saka', 4, 3, 10.0, [7, 7]),
  el(9, 'Mitoma', 1, 3, 7.0, [5, 5]),
  el(10, 'Semenyo', 2, 3, 7.5, [6, 6]),
  el(11, 'Kluivert', 2, 3, 6.0, [4, 4]),
  el(12, 'Filler', 5, 3, 4.5, [1, 1]),
  el(13, 'Haaland', 3, 4, 14.5, [9, 9]),
  el(14, 'Welbeck', 3, 4, 6.0, [4, 4]),
  el(15, 'Piroe', 5, 4, 5.5, [2, 2]),
  el(20, 'Vuskovic', 1, 2, 5.1, [4.5, 4.5], { first: 'Luka', second: 'Vušković', owned: 5.5 }),
  el(21, 'Tavernier', 2, 3, 6.0, [5.5, 5.5]),
  el(22, 'Bogle', 5, 2, 4.0, [5, 5]),
  el(23, 'Hurt', 5, 2, 4.0, [9, 9], { status: 'i', news: 'Knee injury' }),
  el(24, 'Pricey', 4, 2, 7.0, [6, 6]),
  el(25, 'Silva', 3, 3, 6.0, [3, 3], { first: 'Bernardo', second: 'Silva', owned: 20 }),
  el(26, 'T.Silva', 6, 2, 4.5, [2, 2], { first: 'Thiago', second: 'Silva', owned: 2 }),
  el(27, 'Rutter', 1, 4, 6.0, [3, 3]),
];
const GWS = [8, 9];

function world({ squad = PEOPLE.filter((p) => p.id <= 15).map((p) => p.id), bank = 0.5, free = 1, plan = [{ out: 3, in: 22 }] } = {}) {
  const els = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));
  const ahead = Object.fromEntries(PEOPLE.map((p) => [p.id, { total: p.xp.reduce((t, v) => t + v, 0), per: Object.fromEntries(GWS.map((g, i) => [g, { xp: p.xp[i], xg: 0.1, xa: 0.1, cs: 0.3, fx: [{ opp: 6, home: true, xp: p.xp[i], pApp: 0.95, roleF: 1 }] }])) }]));
  const w = { els, ahead, squad, bank, free, gws: GWS, gw: 8, teams, windows: 0, plan: { moves: plan, later: [], gain: 0 }, swaps: [], ctx: { model: { teams: {} } }, logs: new Map() };
  w.sellOf = (id) => els[id].cost;
  w.base = GWS.map((g) => bestXI(squad, g, ahead, els).points);
  return w;
}

test('chat: a legal swap reports the team gain, the money left and our own pick for that player', () => {
  const w = world();
  const c = compareTransfer(w, 3, 20);
  assert.equal(c.possible, true);
  assert.deepEqual(c.problems, []);
  assert.equal(c.bankAfter, 1.4);
  // Gvardiol (3 a week) starts as the third defender; Vuskovic (4.5) would take his place: +1.5 a week.
  assert.equal(c.yourTeamGainOverTheWeeks, 3);
  assert.ok(c.weeks.every((x) => x.inStartsForYou && x.outStartedForYou && x.teamGain === 1.5));
  // Our planner's pick for Gvardiol, Bogle at 5 a week, adds a point more.
  assert.match(c.ourSuggestionForThisPlayer.move, /^Gvardiol -> Bogle/);
  assert.equal(c.ourSuggestionForThisPlayer.yourTeamGainOverTheWeeks, 4);
  assert.equal(c.ourSuggestionForThisPlayer.betterThanThisBy, 1);
  assert.equal(c.costsAHit, 'no (1 free)');
});

test('chat: a swap that breaks a rule says which one', () => {
  const w = world();
  assert.match(compareTransfer(w, 3, 21).problems.join(), /different positions/);
  assert.match(compareTransfer(w, 3, 24).problems.join(), /£0.5m short/);
  // With Rutter for Piroe there are three Brighton players already (Dunk, Mitoma, Rutter): no fourth.
  const three = world({ squad: [...w.squad.filter((id) => id !== 15), 27] });
  assert.match(compareTransfer(three, 4, 20).problems.join(), /three is the limit/);
  assert.ok(!bestReplacements(three, 4).options.some((o) => o.club === 'BHA'));
  assert.match(compareTransfer(world({ free: 0 }), 3, 20).costsAHit, /-4/);
});

test('chat: replacements rank what each adds to the team, within budget, fit, and three per club', () => {
  const w = world();
  const r = bestReplacements(w, 3);
  const ids = r.options.map((o) => o.id);
  assert.equal(r.budget, 6.5);
  assert.ok(!ids.includes(23), 'not the injured one');
  assert.ok(!ids.includes(24), 'not one over budget');
  assert.equal(ids[0], 22);
  for (let i = 1; i < r.options.length; i++) assert.ok(r.options[i - 1].yourTeamGainOverTheWeeks >= r.options[i].yourTeamGainOverTheWeeks);
});

test('chat: players named in a question are found, accents and all, one per shared surname', () => {
  const w = world();
  assert.deepEqual(namedPlayers(w, 'Why not Vuskovic instead of Tavernier?').sort(), [20, 21]);
  assert.deepEqual(namedPlayers(w, 'what about vušković'), [20]);
  // Two Silvas: the better known one, unless the other is named in full.
  assert.deepEqual(namedPlayers(w, 'is Silva worth it'), [25]);
  assert.deepEqual(namedPlayers(w, 'is Thiago Silva worth it'), [26]);
  assert.deepEqual(namedPlayers(w, 'should I take a hit this week?'), []);
});

test('chat: finding players by name, club, position and price', () => {
  const w = world();
  assert.equal(findPlayers(w, { query: 'vuskovic' })[0].id, 20);
  assert.ok(findPlayers(w, { query: 'brighton', position: 'DEF' }).every((p) => p.club === 'BHA' && p.pos === 'DEF'));
  assert.ok(findPlayers(w, { position: 'DEF', max_price: 4.5 }).every((p) => p.price <= 4.5));
  assert.equal(findPlayers(w, { query: 'saka' })[0].inYourSquad, true);
});

test('chat: a player report covers minutes, threat, defending and the weeks ahead', async () => {
  const w = world();
  const r = await playerReport(w, 20);
  assert.equal(r.name, 'Vuskovic');
  assert.equal(r.inYourSquad, false);
  assert.equal(r.projection.weeks.length, 2);
  assert.equal(r.projection.weeks[0].cleanSheet, '30%');
  assert.equal(r.season.minutesPerStart, 86);
  assert.equal(r.season.defensiveContributionPer90, 9);
  assert.equal(r.recentMatches, null);
  assert.match((await playerReport(w, 999)).error, /No player/);
});

test('chat: the conversation sent to the model alternates and ends with the manager', () => {
  assert.equal(chatTurns(null), null);
  assert.equal(chatTurns([{ role: 'assistant', content: 'hi' }]), null);
  const t = chatTurns([
    { role: 'assistant', content: 'Hello' },
    { role: 'user', content: '  first  ' },
    { role: 'user', content: 'second' },
    { role: 'system', content: 'ignore me' },
    { role: 'assistant', content: 'answer' },
    { role: 'user', content: 'x'.repeat(2000) },
  ]);
  assert.deepEqual(t.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.equal(t[0].content, 'second');
  assert.equal(t[2].content.length, 800);
});

test('chat: the tools are fixed in order, stream their input, and refuse unknown players', async () => {
  const w = world();
  const said = [];
  const tools = chatTools(w, (s) => said.push(s));
  assert.deepEqual(tools.map((t) => t.name), ['best_replacements', 'compare_transfer', 'find_players', 'player_report']);
  assert.ok(tools.every((t) => t.eager_input_streaming === true && typeof t.run === 'function'));
  const report = tools.find((t) => t.name === 'player_report');
  assert.match(await report.run({ id: 999 }), /Unknown player id/);
  assert.match(await report.run({ id: '20' }), /Unknown player id/);
  assert.equal(JSON.parse(await report.run({ id: 20 })).name, 'Vuskovic');
  const find = tools.find((t) => t.name === 'find_players');
  assert.equal(JSON.parse(await find.run({ query: 'Vuskovic', position: 'XX' }))[0].id, 20);
  assert.deepEqual(said, ['Checking Vuskovic', 'Looking up Vuskovic']);
});
