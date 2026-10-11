import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tennisOnNow, roundRank, f1Season, nextRace } from './othersports.mjs';

// ESPN's tennis scoreboard, cut down: an event has groupings (draws), each with competitions (matches).
const tMatch = (round, state, date, players, winner) => ({
  round: { displayName: round },
  date,
  status: { type: { state, completed: state === 'post' } },
  competitors: players.map((n, i) => ({ athlete: { displayName: n }, winner: winner === i })),
});
const tEvent = (id, name, date, endDate, draws) => ({
  id, name, date, endDate, venue: { displayName: 'Somewhere' },
  groupings: draws.map(([draw, competitions]) => ({ grouping: { displayName: draw }, competitions })),
});

test('tennis rounds: qualifying first, the final last', () => {
  assert.deepEqual(['Qualifying Final', 'Qualifying 1st Round', 'Round 1', 'Round 3', 'Quarterfinal', 'Semifinal', 'Final'].map(roundRank), [0, 0, 1, 3, 7, 8, 9]);
});

test('tennis: a joint event once with both tours, its live final and decided champion; bigger draws first, finished last', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  const joint = tEvent('J', 'China Open', '2026-09-27T04:00Z', '2026-10-12T03:59Z', [
    ["Men's Singles", [tMatch('Qualifying Final', 'post', '2026-09-29T03:00Z', ['Q1', 'Q2'], 0), tMatch('Final', 'post', '2026-10-06T11:00Z', ['De Minaur', 'Djokovic'], 1)]],
    ["Women's Singles", [tMatch('Semifinal', 'post', '2026-10-10T07:00Z', ['Andreeva', 'B'], 0), tMatch('Final', 'in', '2026-10-11T11:35Z', ['Andreeva', 'Zheng'])]],
    ["Men's Doubles", [tMatch('Final', 'in', '2026-10-11T11:00Z', ['X', 'Y'])]],
  ]);
  const masters = tEvent('M', 'Shanghai Masters', '2026-10-05T04:00Z', '2026-10-19T03:59Z', [
    ["Men's Singles", [tMatch('Round 4', 'pre', '2026-10-13T06:00Z', ['C', 'D']), tMatch('Round 3', 'pre', '2026-10-11T13:00Z', ['E', 'F']), tMatch('Round 2', 'post', '2026-10-10T06:00Z', ['G', 'H'], 0), tMatch('Round 2', 'post', '2026-10-10T08:00Z', ['I', 'J'], 1)]],
  ]);
  const small = tEvent('S', 'Small Open presented by A Sponsor', '2026-10-11T04:00Z', '2026-10-19T03:59Z', [["Women's Singles", [tMatch('Qualifying 1st Round', 'pre', '2026-10-11T13:00Z', ['K', 'L'])]]]);
  const done = tEvent('D', 'Done Open', '2026-10-04T04:00Z', '2026-10-12T03:59Z', [
    ["Women's Singles", [tMatch('Semifinal', 'post', '2026-10-10T08:00Z', ['M', 'O'], 0), tMatch('Semifinal', 'post', '2026-10-10T10:00Z', ['N', 'P'], 0), tMatch('Final', 'post', '2026-10-11T08:00Z', ['M', 'N'], 1)]],
  ]);
  const old = tEvent('O', 'Last Month Open', '2026-09-01T04:00Z', '2026-09-08T03:59Z', []);
  const later = tEvent('L', 'Next Month Open', '2026-11-01T04:00Z', '2026-11-08T03:59Z', []);
  const out = tennisOnNow([{ tour: 'ATP', json: { events: [joint, masters, old] } }, { tour: 'WTA', json: { events: [done, joint, small, later] } }], now);
  assert.deepEqual(out.map((t) => t.id), ['M', 'J', 'S', 'D']);
  const [m, j, s, d] = out;
  assert.deepEqual(j.tours, ['ATP', 'WTA']);
  // The doubles final doesn't count; the qualifying final isn't a title.
  assert.deepEqual([j.live, j.top, j.stage], [1, { draw: "Women's Singles", round: 'Final', players: ['Andreeva', 'Zheng'] }, null]);
  assert.deepEqual(j.champions, [{ draw: "Men's Singles", name: 'Djokovic' }]);
  // The next round is the earliest scheduled match's, not the furthest-on.
  assert.deepEqual([m.live, m.top, m.stage, m.size], [0, null, 'Round 3', 4]);
  assert.equal(s.name, 'Small Open');
  assert.deepEqual(d.champions, [{ draw: "Women's Singles", name: 'N' }]);
});

test('F1: sessions in order from Jolpica, the weekend on now, and the race after', () => {
  const circuit = (circuitName, locality, country) => ({ circuitName, Location: { locality, country } });
  const json = {
    MRData: {
      RaceTable: {
        season: '2026',
        Races: [
          {
            round: '17', raceName: 'Singapore Grand Prix', date: '2026-10-11', time: '12:00:00Z', Circuit: circuit('Marina Bay Street Circuit', 'Marina Bay', 'Singapore'),
            FirstPractice: { date: '2026-10-09', time: '08:30:00Z' }, SprintQualifying: { date: '2026-10-09', time: '12:30:00Z' },
            Sprint: { date: '2026-10-10', time: '09:00:00Z' }, Qualifying: { date: '2026-10-10', time: '13:00:00Z' },
          },
          {
            round: '18', raceName: 'United States Grand Prix', date: '2026-10-25', time: '20:00:00Z', Circuit: circuit('Circuit of the Americas', 'Austin', 'USA'),
            FirstPractice: { date: '2026-10-23', time: '17:30:00Z' }, SecondPractice: { date: '2026-10-23', time: '21:00:00Z' },
            ThirdPractice: { date: '2026-10-24' }, Qualifying: { date: '2026-10-24', time: '21:00:00Z' },
          },
        ],
      },
    },
  };
  const s = f1Season(json);
  assert.equal(s.season, '2026');
  assert.deepEqual(s.races[0].sessions.map((x) => x.label), ['Practice 1', 'Sprint qualifying', 'Sprint', 'Qualifying', 'Race']);
  assert.equal(s.races[0].sessions[4].at, '2026-10-11T12:00:00.000Z');
  // A session with no time yet is placed at midday UTC on its day.
  assert.equal(s.races[1].sessions.find((x) => x.label === 'Practice 3').at, '2026-10-24T12:00:00.000Z');
  assert.deepEqual([s.races[1].place, s.races[1].country], ['Austin', 'USA']);

  // During the race: it's on, nothing else to start, the US GP after it.
  const during = nextRace(s.races, Date.parse('2026-10-11T13:00:00Z'));
  assert.deepEqual([during.round, during.live.label, during.upcoming], [17, 'Race', null]);
  assert.deepEqual(during.after, { round: 18, name: 'United States Grand Prix', at: '2026-10-25T20:00:00.000Z' });
  // Saturday evening: nothing on, the race next.
  const sat = nextRace(s.races, Date.parse('2026-10-10T20:00:00Z'));
  assert.deepEqual([sat.live, sat.upcoming.label], [null, 'Race']);
  // Once the race is over the weekend moves on; after the last race there's nothing.
  assert.equal(nextRace(s.races, Date.parse('2026-10-11T14:30:00Z')).round, 18);
  assert.equal(nextRace(s.races, Date.parse('2026-10-11T14:30:00Z')).after, null);
  assert.equal(nextRace(s.races, Date.parse('2026-10-26T00:00:00Z')), null);
});
