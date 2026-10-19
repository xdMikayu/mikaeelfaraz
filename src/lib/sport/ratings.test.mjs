import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRatings, squash, clockMinute, band } from './ratings.mjs';

// Two sides in a 4-4-2, everyone on for the whole match unless a case says otherwise. Names are
// letters only: shots are matched to players by name, with digits and accents folded away.
const SPOTS = [
  ['Keeper', 'G'],
  ['Leftback', 'LB'],
  ['Centreone', 'CD-L'],
  ['Centretwo', 'CD-R'],
  ['Rightback', 'RB'],
  ['Leftmid', 'LM'],
  ['Midone', 'CM-L'],
  ['Midtwo', 'CM-R'],
  ['Rightmid', 'RM'],
  ['Strikerone', 'CF-L'],
  ['Strikertwo', 'CF-R'],
];
const blank = { on: null, off: null, goals: 0, assists: 0, yellow: 0, red: 0, og: 0, fouls: 0, fouled: 0, offsides: 0, saves: 0 };
function side(k, first) {
  const starters = SPOTS.map(([last, pos], i) => ({ ...blank, id: `${k}${i + 1}`, name: `${first} ${last}`, last, pos, starter: true }));
  const bench = [{ ...blank, id: `${k}12`, name: `${first} Substitute`, last: 'Substitute', pos: 'SUB', starter: false }];
  return { formation: '4-4-2', starters, bench, lines: [starters.slice(0, 1), starters.slice(1, 5), starters.slice(5, 9), starters.slice(9)] };
}
function match({ score = [0, 0], shots = [], events = [], commentary = [], edit } = {}) {
  const lineups = { home: side('h', 'Hal'), away: side('a', 'Abe') };
  edit?.(lineups);
  return { match: { status: { state: 'post', label: 'FT' }, home: { score: score[0] }, away: { score: score[1] } }, shots, events, commentary, lineups };
}
const who = (lineups, id) => [...lineups.home.starters, ...lineups.home.bench, ...lineups.away.starters, ...lineups.away.bench].find((p) => p.id === id);
const set = (id, fields) => (lineups) => Object.assign(who(lineups, id), fields);
const goal = (s, minute, scorer, assister) => ({ kind: 'goal', side: s, minute, period: Number(minute.slice(0, 2)) > 45 ? 2 : 1, playerIds: [scorer, assister].filter(Boolean) });
const shot = (s, minute, player, outcome, xg, text = '') => ({ side: s, minute, player, outcome, xg, penalty: false, text });

test('ratings: a striker who scores twice in a 2-0 win is past 8 and the best on the pitch', () => {
  const d = match({
    score: [2, 0],
    shots: [
      shot('home', "23'", 'Hal Strikerone', 'goal', 0.45, 'Goal! Home 1, Away 0. Hal Strikerone (Home) right footed shot from the centre of the box. Assisted by Hal Leftmid with a cross.'),
      shot('home', "67'", 'Hal Strikerone', 'goal', 0.25, 'Goal! Home 2, Away 0. Hal Strikerone (Home) header from the centre of the box.'),
    ],
    events: [goal('home', "23'", 'h10', 'h6'), goal('home', "67'", 'h10')],
    edit: (l) => (set('h10', { goals: 2 })(l), set('h6', { assists: 1 })(l)),
  });
  const r = matchRatings(d);
  assert.ok(r.players.h10.rating > 8, `striker ${r.players.h10.rating}`);
  assert.equal(r.best, 'h10');
  // The assist and the chance behind it lift the winger above the other midfielders.
  assert.ok(r.players.h6.rating > r.players.h7.rating);
  // Winning to nil is worth more to the home defence than losing it is to the away one.
  assert.ok(r.players.h3.rating > r.players.a3.rating);
});

test('ratings: a quiet 90 minutes in a goalless draw is an ordinary rating', () => {
  const r = matchRatings(match());
  for (const id of ['h1', 'h3', 'h7', 'h10', 'a1', 'a3', 'a7', 'a10']) {
    const x = r.players[id].rating;
    assert.ok(x >= 6.3 && x <= 7.5, `${id} ${x}`);
  }
  assert.equal(r.players.h7.minutes, 90);
});

test('ratings: a defender sent off in a heavy defeat is under 5.5', () => {
  const d = match({
    score: [4, 0],
    shots: [shot('home', "10'", 'Hal Strikerone', 'goal', 0.4), shot('home', "25'", 'Hal Strikertwo', 'goal', 0.3), shot('home', "50'", 'Hal Midone', 'goal', 0.2), shot('home', "70'", 'Hal Strikerone', 'goal', 0.5)],
    events: [goal('home', "10'", 'h10'), goal('home', "25'", 'h11'), { kind: 'red', side: 'away', minute: "30'", period: 1, playerIds: ['a3'] }, goal('home', "50'", 'h7'), goal('home', "70'", 'h10')],
    edit: set('a3', { red: 1 }),
  });
  const r = matchRatings(d);
  assert.ok(r.players.a3.rating < 5.5, `sent off ${r.players.a3.rating}`);
  assert.equal(r.players.a3.minutes, 30);
  assert.ok(r.players.a3.rating < r.players.a4.rating);
});

test('ratings: a keeper is rated for the saves made, by how good the chances were', () => {
  const against = (outcome) => Array.from({ length: 6 }, (_, i) => shot('home', `${20 + i * 10}'`, 'Hal Strikerone', outcome, 0.15, `Attempt ${outcome}. Hal Strikerone (Home) right footed shot is ${outcome} by Abe Keeper (Away).`));
  const busy = match({ score: [1, 0], shots: [...against('saved'), shot('home', "88'", 'Hal Strikertwo', 'goal', 0.3)], events: [goal('home', "88'", 'h11')], edit: set('a1', { saves: 6 }) });
  const idle = match({ score: [1, 0], shots: [...against('off'), shot('home', "88'", 'Hal Strikertwo', 'goal', 0.3)], events: [goal('home', "88'", 'h11')] });
  const gap = matchRatings(busy).players.a1.rating - matchRatings(idle).players.a1.rating;
  assert.ok(gap > 0.8, `six saves are worth ${gap.toFixed(2)}`);
});

test('ratings: FPL’s tackles, clearances and recoveries move a defender in the Premier League', () => {
  const st = (tk, cbi, rec) => ({ h3: { st: { tk, cbi, rec, sv: 0, ps: 0 } } });
  const busy = matchRatings(match(), st(4, 9, 6)).players.h3.rating;
  const plain = matchRatings(match()).players.h3.rating;
  const idle = matchRatings(match(), st(0, 0, 0)).players.h3.rating;
  assert.ok(busy > plain && plain > idle, `${busy} > ${plain} > ${idle}`);
});

test('ratings: nobody is rated for under 10 minutes unless they scored, made one or were sent off', () => {
  const sub = { kind: 'sub', side: 'home', minute: "85'", period: 2, playerIds: ['h12', 'h11'], order: 1 };
  const quiet = matchRatings(match({ events: [sub], edit: (l) => (set('h12', { on: "85'" })(l), set('h11', { off: "85'" })(l)) }));
  assert.equal(quiet.players.h12, undefined);
  assert.ok(quiet.players.h11);
  const scored = matchRatings(
    match({
      score: [1, 0],
      shots: [shot('home', "89'", 'Hal Substitute', 'goal', 0.3)],
      events: [sub, goal('home', "89'", 'h12')],
      edit: (l) => (set('h12', { on: "85'", goals: 1 })(l), set('h11', { off: "85'" })(l)),
    })
  );
  assert.ok(scored.players.h12.rating >= 6.8, `late winner ${scored.players.h12.rating}`);
  // An unused substitute is never rated.
  assert.equal(scored.players.a12, undefined);
});

test('ratings: a substitute takes the role of the player replaced', () => {
  const d = match({
    events: [{ kind: 'sub', side: 'home', minute: "50'", period: 2, playerIds: ['h12', 'h1'], order: 1 }],
    edit: (l) => (set('h12', { on: "50'" })(l), set('h1', { off: "50'" })(l)),
  });
  const r = matchRatings(d);
  assert.equal(r.players.h12.group, 'GK');
  assert.equal(r.players.h12.minutes, 40);
});

test('ratings: the curve keeps both ends rare and every rating between 3 and 10', () => {
  assert.equal(squash(6.8), 6.8);
  assert.ok(squash(9) < 9 && squash(9) > 8.5);
  assert.ok(squash(30) < 10 && squash(-30) > 3);
  for (let x = -5; x < 15; x += 0.25) assert.ok(squash(x + 0.25) > squash(x), `rises at ${x}`);
});

test('ratings: minutes on the match clock and the colour bands', () => {
  assert.equal(clockMinute("67'"), 67);
  assert.equal(clockMinute("45'+2'"), 45.02);
  assert.equal(clockMinute("90'+4'"), 94);
  assert.equal(clockMinute(''), null);
  assert.deepEqual([9, 8.9, 7, 6.9, 6, 5.9].map(band), ['top', 'good', 'good', 'fair', 'fair', 'poor']);
});
