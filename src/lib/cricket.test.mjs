import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kitHex } from './kit-colors.mjs';
import { splitScore, cricketNow, cricketDay, leaguesOn, upcomingInternationals, fullMember, bigMatch, isLive, inningsOf, ballsOf, oversOf, situation, describe } from './cricket.mjs';

test('cricket scores: runs and overs apart, Test innings joined, declarations kept', () => {
  assert.deepEqual(splitScore('346 & 218/4 (68.2 ov)'), { runs: '346 & 218/4', overs: '68.2 ov' });
  assert.deepEqual(splitScore('158 (19.3/20 ov, target 169)'), { runs: '158', overs: '19.3/20 ov, target 169' });
  assert.deepEqual(splitScore('500/9d'), { runs: '500/9d', overs: null });
  assert.deepEqual(splitScore(''), { runs: '', overs: null });
});

// ESPN's header feed, cut down: leagues with events, each team's score as one string.
const event = (id, cls, status, summary, teams, extra = {}) => ({
  id, date: '2026-10-11T06:00:00Z', status, summary, title: extra.title ?? 'Match', location: extra.location ?? 'Somewhere, Town',
  class: { generalClassCard: cls, internationalClassId: extra.intl ?? '0' },
  fullStatus: { longSummary: extra.long ?? '', session: extra.session ?? '', battingTeamId: extra.bat },
  competitors: teams.map(([tid, name, score, winner = false, color = '']) => ({ id: tid, displayName: name, abbreviation: name.slice(0, 3).toUpperCase(), score, winner, color })),
});
const header = {
  sports: [{
    leagues: [
      { id: '8050', name: 'Ranji Trophy', events: [event('r1', 'First-class', 'in', 'Stumps', [['a', 'Bengal', '210/5'], ['b', 'Delhi', '']], { session: 'Day 1  Session 3' })] },
      { id: '20451', name: "ICC Men's T20 World Cup Sub Regional Asia Qualifier A", events: [event('q1', 'T20I', 'post', 'Result', [['38', 'Kuwait', '37/1 (4/20 ov, target 35)', true], ['m', 'Myanmar', '34']], { intl: '3', long: 'Kuwait won by 9 wickets' })] },
      { id: '24203', name: 'Australia tour of South Africa 2026/27', events: [event('t1', 'Test', 'in', 'Live', [['3', 'South Africa', '247/8 (69 ov)', false, '#ace411'], ['2', 'Australia', '390', false, '#f3f702']], { intl: '1', title: '1st Test', long: 'South Africa trail by 143 runs', session: 'Day 3  Session 3', bat: 3 })] },
      { id: '24289', name: 'West Indies tour of India 2026/27', events: [event('i1', 'T20I', 'pre', 'Scheduled', [['6', 'India', ''], ['4', 'West Indies', '']], { intl: '3', title: '3rd T20I' })] },
    ],
  }],
};

test('cricket now: internationals first, live before scheduled before results, the big nations ahead of associates', () => {
  const all = cricketNow(header);
  assert.deepEqual(all.map((m) => m.id), ['t1', 'i1', 'q1', 'r1']);
  const [t] = all;
  assert.deepEqual([t.international, t.format, t.title, t.session, t.status, t.venue], [true, 'Test', '1st Test', 'Day 3', 'South Africa trail by 143 runs', 'Somewhere, Town']);
  assert.deepEqual(t.teams.map((x) => [x.name, x.runs, x.overs, x.batting, x.color]), [['South Africa', '247/8', '69 ov', true, kitHex('#ace411')], ['Australia', '390', null, false, kitHex('#f3f702')]]);
  assert.equal(isLive(t), true);
  assert.equal(isLive(all.find((m) => m.id === 'r1')), false); // stumps: nothing is happening
  assert.equal(all.find((m) => m.id === 'q1').teams[0].winner, true);
  assert.deepEqual(leaguesOn(all), [{ id: '8050', name: 'Ranji Trophy', matches: 1, live: 0, results: 0 }]);
});

test('cricket: the Test-playing nations, their women and A sides count; associates do not', () => {
  assert.deepEqual(['India Women', 'Australia A', 'Pakistan Under-19s', 'Hong Kong', 'Scotland'].map(fullMember), [true, true, true, false, false]);
  const [t, i, q] = cricketNow(header);
  assert.deepEqual([bigMatch(t), bigMatch(i), bigMatch(q)], [true, true, false]);
});

test('cricket fixtures: a match on several days counts once; only internationals still to start, soonest first', () => {
  const day = (events) => ({ scores: [{ leagues: [{ id: '24707', name: 'Sri Lanka tour of Pakistan 2026/27' }], events }] });
  const ev = (id, date, state, intl = '3') => ({
    id, date,
    competitions: [{ date, description: `${id} match`, class: { generalClassCard: 'T20I', internationalClassId: intl }, status: { type: { state, description: 'Scheduled' }, summary: 'Starts at 19:00 local time' }, venue: { fullName: 'Rawalpindi Cricket Stadium' },
      competitors: [{ winner: 'false', score: '', team: { id: '7', displayName: 'Pakistan', abbreviation: 'PAK', color: '07df52' } }, { winner: 'false', score: '', team: { id: '8', displayName: 'Sri Lanka', abbreviation: 'SL', color: '' } }] }],
  });
  const now = Date.parse('2026-10-12T12:00:00Z');
  const list = upcomingInternationals([
    day([ev('later', '2026-10-15T14:00:00Z', 'pre'), ev('started', '2026-10-12T09:00:00Z', 'in'), ev('domestic', '2026-10-13T09:00:00Z', 'pre', '0')]),
    day([ev('soon', '2026-10-13T14:00:00Z', 'pre'), ev('later', '2026-10-15T14:00:00Z', 'pre')]),
  ], now);
  assert.deepEqual(list.map((m) => m.id), ['soon', 'later']);
  assert.deepEqual(list[0].teams.map((t) => [t.short, t.color, t.winner, t.batting]), [['PAK', kitHex('07df52'), false, false], ['SL', null, false, false]]);
  assert.equal(cricketDay(day([ev('x', '2026-10-13T14:00:00Z', 'pre')]))[0].venue, 'Rawalpindi Cricket Stadium');
});

test('cricket innings and overs: all out, declarations, and overs counted in balls', () => {
  assert.deepEqual(inningsOf('346 & 223/6'), [{ runs: 346, wickets: 10, declared: false }, { runs: 223, wickets: 6, declared: false }]);
  assert.deepEqual(inningsOf('500/9d'), [{ runs: 500, wickets: 9, declared: true }]);
  assert.deepEqual(inningsOf(''), []);
  assert.equal(ballsOf('68.2'), 410);
  assert.deepEqual(oversOf('15/20 ov, target 152'), { overs: '15', balls: 90, max: 120, target: 152 });
  assert.deepEqual(oversOf('72 ov'), { overs: '72', balls: 432, max: null, target: null });
});

// A match as cricketNow() gives it, for the sums: [name, runs, overs, batting] per side.
const game = (format, a, b, days = null) => ({
  state: 'in', summary: 'Live', format, days,
  teams: [a, b].map(([name, runs, overs = null, batting = false]) => ({ id: name, name, runs, overs, batting })),
});
const said = (m) => {
  const d = describe(situation(m));
  return d && d.bold + d.rest;
};

test('cricket sums, long matches: lead, trail and what the last innings needs, in words', () => {
  // Rayyan's Test: nobody should have to add 346 and 223 and take away 240.
  assert.equal(said(game('Test', ['Afghanistan', '240'], ['Bangladesh', '346 & 223/6', '72 ov', true], 5)), 'Bangladesh lead by 329 runs, with 4 wickets left in their second innings.');
  assert.equal(said(game('Test', ['South Africa', '284', '78 ov', true], ['Australia', '390'], 5)), 'South Africa trail by 106 runs, all out in their first innings.');
  assert.equal(said(game('Test', ['South Africa', '284'], ['Australia', '390 & 4/0', '0.2 ov', true], 5)), 'Australia lead by 110 runs, with 10 wickets left in their second innings.');
  // Following on: still behind until they pass the first-innings lead.
  assert.equal(said(game('Test', ['England', '400'], ['India', '150 & 120/3', '40 ov', true], 5)), 'India trail by 130 runs, with 7 wickets left in their second innings.');
  // The fourth innings is a chase.
  assert.equal(said(game('First-class', ['Queensland', '307 & 68'], ['Western Australia', '175 & 140/8', '60 ov', true], 4)), 'Western Australia need 61 runs to win, with 2 wickets left.');
  assert.equal(said(game('First-class', ['Bengal', ''], ['Delhi', '240', '77.3 ov', true], 4)), 'Delhi were all out for 240. Bengal bat next.');
  assert.equal(said(game('First-class', ['Kerala', ''], ['Jharkhand', '289/5', '90 ov', true], 4)), 'Jharkhand are batting first, with 5 wickets left. Kerala haven’t batted yet.');
});

test('cricket sums, one-innings matches: the chase from the balls left, the run rate, the target once set', () => {
  assert.equal(said(game('Twenty20', ['Eastern Province', '151/4'], ['Boland', '137/5', '15/20 ov, target 152', true])), 'Boland need 15 runs from 30 balls, with 5 wickets left. The target is 152. They need 3.0 an over and are scoring 9.1.');
  assert.equal(said(game('T20I', ['Pakistan', '131/1', '13.1/20 ov', true], ['Sri Lanka', ''])), 'Pakistan are scoring 9.9 runs an over, with 13.1 of 20 overs gone.');
  assert.equal(said(game('T20I', ['Pakistan', '180/5', '20/20 ov', true], ['Sri Lanka', ''])), 'Sri Lanka need 181 runs to win from 20 overs.');
  // No target in the bracket: the other side's total plus one.
  assert.equal(situation(game('ODI', ['Nepal', '235'], ['Canada', '100/2', '20/50 ov', true])).target, 236);
  // Nothing to say before a ball or after the result.
  assert.equal(situation(game('T20I', ['Pakistan', ''], ['Sri Lanka', ''])), null);
  assert.equal(situation({ ...game('T20I', ['Pakistan', '180/5', '20/20 ov'], ['Sri Lanka', '181/3', '18/20 ov, target 181', true]), state: 'post' }), null);
  // ESPN marks some matches live before any score: not live until a ball is bowled.
  assert.equal(isLive(game('T20I', ['Pakistan', ''], ['Sri Lanka', ''])), false);
});

test('cricket feed: the match length from its notes, and day-night tags off the title', () => {
  const feed = { sports: [{ leagues: [{ id: '1', name: 'Tour', events: [{ id: 'x', status: 'in', summary: 'Live', title: '2nd T20I (D/N)', class: { generalClassCard: 'Test', internationalClassId: '1' }, notes: [{ type: 'matchdays', text: '9,10,11,12,13 October 2026 (5-day match)' }], fullStatus: { session: 'Day 3  Session 3' }, competitors: [] }] }] }] };
  const [m] = cricketNow(feed);
  assert.deepEqual([m.title, m.days, m.session], ['2nd T20I', 5, 'Day 3']);
});

test('cricket: at a break the side just out is not the side batting, whatever the flag says', () => {
  const m = game('First-class', ['Bengal', ''], ['Delhi', '240', '77.3 ov', true], 4);
  const s = situation(m);
  assert.equal(s.kind, 'first');
  assert.equal(s.allOut, true); // so the page drops "batting" from Delhi
  // A stale flag on the side that's out, with the other side's innings under way: the overs bracket wins.
  const later = game('Test', ['South Africa', '284', null, true], ['Australia', '390 & 9/0', '1.3 ov'], 5);
  assert.equal(said(later), 'Australia lead by 115 runs, with 10 wickets left in their second innings.');
});

test('cricket: once the scores settle it, say who won, before ESPN calls the result', () => {
  const over = { ...game('Twenty20', ['Eastern Province', '151/4'], ['Boland', '155/7', '16.3/20 ov, target 152', true]), status: 'Match over' };
  assert.equal(said(over), 'Boland have won by 3 wickets. The official result follows shortly.');
  assert.equal(isLive(over), false); // not red "Live" once it's over
  assert.equal(said(game('T20I', ['Pakistan', '180/5'], ['Sri Lanka', '170', '19.2/20 ov, target 181', true])), 'Pakistan have won by 10 runs. The official result follows shortly.');
  assert.equal(said(game('T20I', ['Pakistan', '180/5'], ['Sri Lanka', '180/6', '20/20 ov, target 181', true])), 'The match is tied. The official result follows shortly.');
  assert.equal(said(game('Test', ['Queensland', '307 & 68'], ['Western Australia', '175 & 201/8', '72.5 ov, target 201', true], 4)), 'Western Australia have won by 2 wickets. The official result follows shortly.');
});
