import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitScore, cricketNow, cricketDay, leaguesOn, upcomingInternationals, fullMember, bigMatch, isLive } from './cricket.mjs';

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
  assert.deepEqual(t.teams.map((x) => [x.name, x.runs, x.overs, x.batting, x.color]), [['South Africa', '247/8', '69 ov', true, '#ace411'], ['Australia', '390', null, false, '#f3f702']]);
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
  assert.deepEqual(list[0].teams.map((t) => [t.short, t.color, t.winner, t.batting]), [['PAK', '#07df52', false, false], ['SL', null, false, false]]);
  assert.equal(cricketDay(day([ev('x', '2026-10-13T14:00:00Z', 'pre')]))[0].venue, 'Rawalpindi Cricket Stadium');
});
