import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchFromSummary, asListMatch, ballsOf, inningsBalls, howOut, quotaOf, phasesOf, oversFrom } from './cricket-match.mjs';
import { batForm, bowlForm, formFor, matchupsFor } from './cricket-form.mjs';
import { readMatch } from './cricket-read.mjs';

const stat = (o) => ({ statistics: { categories: [{ stats: Object.entries(o).map(([name, v]) => ({ name, value: typeof v === 'number' ? v : 0, displayValue: String(v) })) }] } });
const player = (id, name, extra = {}, lines = []) => ({ athlete: { id, displayName: name, battingName: name, style: [{ type: 'batting', description: 'Right-hand bat' }] }, linescores: lines, ...extra });

// A one-day match an over and a bit into the first innings, as ESPN's summary has it.
const summary = {
  header: {
    league: { name: 'Test Cup' },
    competitions: [
      {
        id: '9',
        description: '1st Match',
        class: { generalClassCard: 'List A', internationalClassId: '0' },
        status: { type: { state: 'in', description: 'Live' }, summary: 'Reds won toss & fielded', battingTeamId: 2 },
        competitors: [
          { team: { id: '1', displayName: 'Reds', abbreviation: 'RED', color: 'cc0000' }, score: '', linescores: [{ period: 1, isBatting: false }] },
          {
            team: { id: '2', displayName: 'Blues', abbreviation: 'BLU', color: '' },
            score: '9/1 (1.2/50 ov)',
            linescores: [
              {
                period: 1,
                isBatting: true,
                isCurrent: 1,
                runs: 9,
                wickets: 1,
                overs: 1.2,
                score: '9/1 (1.2/50 ov)',
                ...stat({ ballLimit: 300, balls: 8, extras: 1, wides: 1 }),
                fow: [{ wicketNumber: 1, wicketOver: 1.1, runs: 6, runsScored: 4, ballsFaced: 5, athlete: { id: 'a' } }],
                partnerships: [{ wicketNumber: 1, runs: 6, overs: 1.1, fowType: 'out' }],
              },
            ],
          },
        ],
      },
    ],
  },
  rosters: [
    { team: { id: '1' }, roster: [player('x', 'Ex Bowler', { active: true, activeName: 'current bowler' }, [{ period: 1, linescores: [stat({ balls: 8, overs: 1.2, conceded: 8, wickets: 1, maidens: 0, bowlingPosition: 1 })] }]), player('y', 'Why Fielder', {}, [{ period: 1, linescores: [stat({ balls: 0, overs: 0, conceded: 0, wickets: 0 })] }])] },
    {
      team: { id: '2' },
      roster: [
        player('a', 'Ay Opener', {}, [{ period: 1, linescores: [stat({ batted: 1, battingPosition: 1, runs: 4, ballsFaced: 5, fours: 1, sixes: 0, outs: 1, dismissalCard: 'c' })] }]),
        player('b', 'Bee Opener(1)', { active: true, activeName: 'striker', captain: true }, [{ period: 1, linescores: [stat({ batted: 1, battingPosition: 2, runs: 4, ballsFaced: 2, fours: 0, sixes: 0, outs: 0, dismissalCard: 'not out' })] }]),
        player('c', 'Cee Three', { active: true, activeName: 'non-striker' }, [{ period: 1, linescores: [stat({ batted: 1, battingPosition: 3, runs: 0, ballsFaced: 1, outs: 0 })] }]),
        player('d', 'Dee Four', {}, [{ period: 1, linescores: [stat({ batted: 0 })] }]),
      ],
    },
  ],
  notes: [{ type: 'toss', text: 'Reds , elected to field first' }],
  gameInfo: { venue: { fullName: 'Junction Oval, Melbourne', address: { city: 'Melbourne' } } },
};

test('the match from ESPN’s summary: each innings, its batting and bowling, who is in, the toss and the ground', () => {
  const m = matchFromSummary(summary);
  assert.equal(m.toss, 'Reds, elected to field first');
  assert.equal(m.venue, 'Junction Oval, Melbourne');
  assert.equal(m.teams[0].color, '#cc0000');
  assert.equal(m.teams[1].color, null);
  assert.equal(m.innings.length, 1);
  const inn = m.innings[0];
  assert.equal(inn.team, '2');
  assert.equal(inn.ballLimit, 300);
  assert.deepEqual(inn.batting.map((b) => [b.id, b.runs, b.out, b.now]), [['a', 4, true, null], ['b', 4, false, 'striker'], ['c', 0, false, 'non-striker']]);
  assert.deepEqual(inn.yetToBat, ['d']);
  assert.deepEqual(inn.bowling.map((b) => [b.id, b.balls, b.wickets, b.now]), [['x', 8, 1, 'bowling']]);
  assert.equal(m.players.b.name, 'Bee Opener');
  assert.equal(m.players.b.captain, true);
  assert.deepEqual(inn.fow[0], { n: 1, runs: 6, balls: 7, id: 'a', batterRuns: 4, batterBalls: 5 });
  const list = asListMatch(summary, '77');
  assert.equal(list.teams[1].runs, '9/1');
  assert.equal(list.teams[1].overs, '1.2/50 ov');
  assert.equal(list.teams[1].batting, true);
  assert.equal(list.league.id, '77');
});

const ball = (seq, over, b, type, runs, batter, other, extra = {}) => ({
  sequence: seq,
  period: 1,
  over: { number: over, ball: b },
  playType: { description: type },
  scoreValue: runs,
  batsman: { athlete: { id: batter }, runs: type === 'wide' ? 0 : runs },
  otherBatsman: { athlete: { id: other } },
  bowler: { athlete: { id: 'x' } },
  innings: { runs: extra.total, wickets: extra.down },
  ...(extra.out ? { dismissal: { dismissal: true, type: 'caught', batsman: { athlete: { id: batter } }, text: extra.out } } : null),
});

test('ball by ball: scorer’s marks, the overs, partnerships with each batter’s share, and how each was out', () => {
  const items = [
    ball(100106, 1, 6, 'no run', 0, 'a', 'b', { total: 6, down: 0 }),
    ball(100101, 1, 1, 'four', 4, 'a', 'b', { total: 4, down: 0 }),
    ball(100102, 1, 1, 'wide', 1, 'a', 'b', { total: 5, down: 0 }),
    ball(100103, 1, 2, 'no run', 0, 'a', 'b', { total: 5, down: 0 }),
    ball(100104, 1, 3, 'run', 1, 'a', 'b', { total: 6, down: 0 }),
    ball(100105, 1, 4, 'no run', 0, 'b', 'a', { total: 6, down: 0 }),
    ball(100105.5, 1, 5, 'no run', 0, 'b', 'a', { total: 6, down: 0 }),
    ball(100201, 2, 1, 'out', 0, 'a', 'b', { total: 6, down: 1, out: 'Ay Opener c &dagger;Kay b Ex Bowler 4 (12m 5b 1x4 0x6) SR: 80' }),
    ball(100202, 2, 2, 'four', 4, 'b', 'c', { total: 10, down: 1 }),
    { sequence: 100203, period: 1, over: { number: 0 }, playType: { description: 'no run' }, preText: 'A word from the box' },
  ];
  const balls = ballsOf(items);
  assert.equal(balls.length, 9, 'commentary between balls is left out');
  assert.deepEqual(balls.slice(0, 3).map((b) => b.label), ['4', '1wd', '•']);
  const inn = inningsBalls(balls, 1);
  assert.deepEqual(inn.overs.map((o) => [o.n, o.runs, o.wickets, o.total, o.down, o.balls]), [[1, 6, 0, 6, 0, 6], [2, 4, 1, 10, 1, 8]]);
  assert.equal(inn.how.a, 'c †Kay b Ex Bowler');
  assert.deepEqual(inn.partnerships[0], { n: 1, runs: 6, balls: 7, batters: [{ id: 'a', runs: 5, balls: 5 }, { id: 'b', runs: 0, balls: 2 }] });
  assert.deepEqual(inn.partnerships[1].batters.map((x) => [x.id, x.runs]), [['b', 4], ['c', 0]]);
  assert.deepEqual(inn.recent.at(-1).balls, ['W', '4']);
});

test('how out, the bowlers’ quota and phases', () => {
  assert.equal(howOut('Mushfiqur Rahim  b Yamin Ahmadzai 0 (9m 7b 0x4 0x6) SR: 0'), 'b Yamin Ahmadzai');
  assert.equal(howOut('MW Harvey c Short b O’Neill 11 (14b 2x4 0x6) SR: 78.57'), 'c Short b O’Neill');
  assert.equal(howOut('AB de Villiers lbw b Steyn 3 (5b 0x4 0x6) SR: 60'), 'lbw b Steyn');
  assert.equal(quotaOf(120), 24);
  assert.equal(quotaOf(300), 60);
  assert.equal(quotaOf(90), 18);
  assert.equal(quotaOf(null), null);
  assert.equal(oversFrom(229), '38.1');
  const overs = Array.from({ length: 20 }, (_, i) => ({ n: i + 1, runs: 10, wickets: i === 19 ? 2 : 0 }));
  assert.deepEqual(phasesOf(overs, 120), [{ runs: 60, wickets: 0, overs: 6 }, { runs: 90, wickets: 0, overs: 9 }, { runs: 50, wickets: 2, overs: 5 }]);
  assert.equal(phasesOf(overs, null), null);
});

test('form: averages and rates worked out, recent innings newest first, and head-to-heads', () => {
  const teams = ['Reds', 'Blues'];
  const bat = batForm({ all: [10, 2, 400, 300, 40, 10, 3, 1, 120, 1], year: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], recent: [[20261001, 30, 20, 1, 0], [20260920, 50, 31, 0, 1]], phases: [[100, 80, 2], [0, 0, 0], [50, 25, 1]] }, teams);
  assert.deepEqual(bat.all, { inns: 10, runs: 400, avg: 50, sr: 133.3, fifties: 3, hundreds: 1, best: '120*' });
  assert.equal(bat.year, null);
  assert.deepEqual(bat.recent[0], { date: '2026-10-01', runs: 30, balls: 20, out: true, opp: 'Reds' });
  assert.deepEqual(bat.phases, [{ sr: 125, avg: 50, balls: 80 }, null, { sr: 200, avg: 50, balls: 25 }]);
  const bowl = bowlForm({ all: [8, 180, 240, 12, 90, 1, 4, 20, 1, 0], year: [2, 48, 60, 3, 20, 0, 2, 25, 0, 0], recent: [[20261001, 24, 30, 2, 1]] }, teams);
  assert.deepEqual(bowl.all, { inns: 8, wickets: 12, avg: 20, econ: 8, sr: 15, dots: 50, best: '4/20' });
  assert.deepEqual(bowl.recent[0], { date: '2026-10-01', overs: '4', runs: 30, wickets: 2, opp: 'Blues' });
  const table = { teams, players: { a: { bat: { all: [1, 0, 5, 5, 0, 0, 0, 0, 5, 0], year: [1, 0, 5, 5, 0, 0, 0, 0, 5, 0], recent: [] } } }, matchups: { 'a|x': [12, 18, 1, 4, 2, 1] } };
  assert.deepEqual(Object.keys(formFor(['a', 'z'], table)), ['a']);
  assert.deepEqual(matchupsFor(['a'], ['x', 'y'], table), [{ batter: 'a', bowler: 'x', balls: 12, runs: 18, outs: 1, dots: 4, fours: 2, sixes: 1, sr: 150 }]);
});

test('chances after every over: they always add up, and a finished chase is settled', () => {
  const json = (name) => JSON.parse(readFileSync(new URL(`./cricket/${name}.json`, import.meta.url), 'utf8'));
  const tables = { model: json('model'), grounds: json('grounds').grounds, ratings: json('ratings') };
  const m = {
    id: '1',
    league: { id: '1', name: 'West Indies tour of India' },
    format: 'T20I',
    international: true,
    women: false,
    state: 'post',
    venue: 'Holkar Cricket Stadium, Indore',
    status: 'India won by 20 runs',
    teams: [
      { id: '6', name: 'India', runs: '180/5', overs: '20 ov' },
      { id: '4', name: 'West Indies', runs: '160/9', overs: '20 ov' },
    ],
  };
  const overs = (per, n, wkts) => Array.from({ length: n }, (_, i) => ({ n: i + 1, total: per * (i + 1), down: Math.min(wkts, Math.floor(i / 2)), balls: 6 * (i + 1) }));
  const innings = [
    { team: '6', runs: 180, target: null, ballLimit: 120, overs: overs(9, 20, 5) },
    { team: '4', runs: 160, target: 181, ballLimit: 120, overs: overs(8, 20, 9) },
  ];
  const r = readMatch(m, tables, Date.now(), { whole: true, innings });
  assert.ok(r.byOver.length >= 40);
  for (const p of r.byOver) assert.ok(Math.abs(p.chances[0] + p.chances[1] - 1) < 1e-9);
  assert.deepEqual(r.byOver.at(-1).chances, [1, 0], 'West Indies all out short: India have won');
  assert.equal(r.now, null);
});
