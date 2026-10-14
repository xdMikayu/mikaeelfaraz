import { test } from 'node:test';
import assert from 'node:assert/strict';
import { merge, parseStream, gapOf, kindOf, startOf, sameSession, rejoin, messageKind, incidents, plain, tower } from './f1-live.mjs';

// Shapes copied from F1's feed for the 2026 Singapore weekend.
const msg = (Lap, Message, extra = {}) => ({ Utc: '2026-10-11T13:00:00', Lap, Category: 'Other', Message, ...extra });

test('updates merge the way F1 sends them', () => {
  const s = { NoEntries: [0, 0, 0], Lines: { 3: { Position: '1', Sectors: [{ Value: '' }, { Value: '' }, { Value: '' }], Stints: [] } }, Messages: [{ Message: 'A' }] };
  merge(s, { NoEntries: { 0: 22, 1: 16, 2: 10 }, SessionPart: 1 });
  merge(s, { Lines: { 3: { Sectors: { 1: { Value: '41.122' } }, Stints: { 0: { Compound: 'SOFT', TotalLaps: 1 } } }, 16: { Position: '2' } } });
  merge(s, { Lines: { 3: { Stints: { 0: { TotalLaps: 2 } } } }, Messages: { 1: { Message: 'B' } } });
  assert.deepEqual(s.NoEntries, [22, 16, 10]);
  assert.equal(s.SessionPart, 1);
  assert.equal(s.Lines[3].Sectors[1].Value, '41.122');
  assert.equal(s.Lines[3].Sectors[0].Value, '');
  assert.deepEqual(s.Lines[3].Stints, [{ Compound: 'SOFT', TotalLaps: 2 }]);
  assert.equal(s.Lines[16].Position, '2');
  assert.deepEqual(s.Messages.map((m) => m.Message), ['A', 'B']);
  merge(s, { Lines: { _deleted: ['16'] } });
  assert.equal(s.Lines[16], undefined);
  // A whole list replaces the old one.
  merge(s, { Messages: [{ Message: 'C' }] });
  assert.deepEqual(s.Messages, [{ Message: 'C' }]);
});

test('archived streams read with their times', () => {
  const rows = parseStream('﻿00:00:05.453{"Status":"Inactive"}\r\n00:56:03.497{"Status":"Started"}\nnot a line\n');
  assert.deepEqual(rows, [
    [5453, { Status: 'Inactive' }],
    [3363497, { Status: 'Started' }],
  ]);
});

test('gaps, sessions and start times', () => {
  assert.deepEqual(gapOf('+7.335'), { s: 7.335 });
  assert.deepEqual(gapOf('1L'), { laps: 1 });
  assert.deepEqual(gapOf('55L'), { laps: 55 });
  assert.equal(gapOf('LAP 62'), null);
  assert.equal(gapOf(''), null);
  assert.equal(kindOf({ Type: 'Race', Name: 'Sprint' }), 'race');
  assert.equal(kindOf({ Type: 'Qualifying', Name: 'Sprint Qualifying' }), 'quali');
  assert.equal(kindOf({ Type: 'Practice', Name: 'Practice 1' }), 'practice');
  assert.equal(startOf({ StartDate: '2026-10-11T20:00:00', GmtOffset: '08:00:00' }), '2026-10-11T12:00:00.000Z');
  assert.equal(startOf({ StartDate: '2026-10-25T14:00:00', GmtOffset: '-05:00:00' }), '2026-10-25T19:00:00.000Z');
  const feed = { name: 'Sprint Qualifying', start: '2026-10-09T12:30:00.000Z' };
  assert.ok(sameSession(feed, { label: 'Sprint qualifying', at: '2026-10-09T12:30:00Z' }));
  // Moved three hours earlier, as Miami's race was in 2026, without the calendar catching up.
  assert.ok(sameSession({ name: 'Race', start: '2026-05-03T17:00:00.000Z' }, { label: 'Race', at: '2026-05-03T20:00:00Z' }));
  assert.ok(!sameSession(feed, { label: 'Qualifying', at: '2026-10-10T13:00:00Z' }));
  assert.ok(!sameSession({ name: 'Race', start: '2025-10-05T12:00:00.000Z' }, { label: 'Race', at: '2026-10-11T12:00:00Z' }));
});

test('race control messages sorted into kinds', () => {
  assert.equal(messageKind({ Category: 'SafetyCar', Mode: 'VSC', Status: 'DEPLOYED', Message: 'VSC DEPLOYED' }), 'sc');
  assert.equal(messageKind({ Category: 'Flag', Flag: 'BLUE', Message: 'WAVED BLUE FLAG FOR CAR 55 (SAI) TIMED AT 21:38:25' }), 'blue');
  assert.equal(messageKind(msg(59, 'CAR 31 (OCO) TIME 1:40.819 DELETED - TRACK LIMITS AT TURN 7 LAP 57 21:38:21')), 'limits');
  assert.equal(messageKind({ Category: 'Flag', Flag: 'BLACK AND WHITE', Message: 'BLACK AND WHITE FLAG FOR CAR 12 (ANT) - TRACK LIMITS' }), 'limits');
  assert.equal(messageKind(msg(55, 'FIA STEWARDS: TURN 1 INCIDENT INVOLVING CAR 44 (HAM) UNDER INVESTIGATION - LEAVING THE TRACK AND GAINING AN ADVANTAGE (21:31:36)')), 'stewards');
  assert.equal(messageKind({ Category: 'Flag', Flag: 'DOUBLE YELLOW', Message: 'DOUBLE YELLOW IN TRACK SECTOR 14' }), 'yellow');
  assert.equal(messageKind(msg(1, 'OVERTAKE ENABLED')), 'info');
});

test('the stewards’ incidents, from noted to decided', () => {
  const list = incidents([
    msg(10, 'TURN 1 INCIDENT INVOLVING CAR 55 (SAI) NOTED - LEAVING THE TRACK AND GAINING AN ADVANTAGE (20:15:06)'),
    // F1 corrected the time it happened, then closed it under the corrected time.
    msg(12, 'UPDATE: TURN 1 INCIDENT INVOLVING CAR 55 (SAI) NOTED - LEAVING THE TRACK AND GAINING AN ADVANTAGE (20:03:47)'),
    msg(12, 'FIA STEWARDS: TURN 1 INCIDENT INVOLVING CAR 55 (SAI) REVIEWED NO FURTHER INVESTIGATION - LEAVING THE TRACK AND GAINING AN ADVANTAGE (20:03:47)'),
    msg(14, 'TURN 4 INCIDENT INVOLVING CARS 4 (NOR) AND 1 (VER) NOTED - CAUSING A COLLISION (20:30:00)'),
    msg(15, 'FIA STEWARDS: TURN 4 INCIDENT INVOLVING CARS 4 (NOR) AND 1 (VER) UNDER INVESTIGATION - CAUSING A COLLISION (20:30:00)'),
    msg(18, 'FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 4 (NOR) - CAUSING A COLLISION (20:30:00)'),
    msg(24, 'FIA STEWARDS: PENALTY SERVED - 5 SECOND TIME PENALTY FOR CAR 4 (NOR) - CAUSING A COLLISION'),
    msg(30, 'FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 87 (BEA) - TRACK LIMITS (4TH OFFENCE)'),
    msg(1, 'INCIDENT INVOLVING ALL CARS NOTED - RACE CONTROL TEST'),
    msg(31, 'FIA STEWARDS: INCIDENT INVOLVING CAR 18 (STR) WILL BE INVESTIGATED AFTER THE RACE - FAILING TO FOLLOW RACE DIRECTORS INSTRUCTIONS'),
  ]);
  assert.equal(list.length, 4);
  const [str, bea, nor, sai] = list;
  assert.deepEqual(sai.cars, ['55']);
  assert.equal(sai.where, 'Turn 1');
  assert.equal(sai.reason, 'Leaving the track and gaining an advantage');
  assert.deepEqual(sai.steps.map((s) => s.what), ['noted', 'dropped']);
  assert.deepEqual(nor.cars, ['4', '1']);
  assert.deepEqual(nor.steps.map((s) => s.what), ['noted', 'investigating', 'penalty', 'served']);
  assert.equal(nor.steps[2].penalty, '5-second time penalty');
  assert.deepEqual(nor.steps[2].cars, ['4']);
  assert.equal(bea.reason, 'Track limits');
  assert.equal(bea.offence, 4);
  assert.equal(str.steps[0].what, 'after the race');
});

test('steps without F1’s time join their incident', () => {
  // Austria 2026: noted without the time, then investigated and decided with it.
  const [nor, alo] = incidents([
    msg(36, 'INCIDENT INVOLVING CAR 14 (ALO) NOTED - SPEEDING IN THE PIT LANE'),
    msg(40, 'FIA STEWARDS: INCIDENT INVOLVING CAR 14 (ALO) UNDER INVESTIGATION - SPEEDING IN THE PIT LANE (15:34:00)'),
    msg(41, 'FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 14 (ALO) - SPEEDING IN THE PIT LANE (15:34:00)'),
    msg(52, 'INCIDENT INVOLVING CAR 1 (NOR) NOTED - PIT LANE INFRINGEMENT'),
    msg(55, 'FIA STEWARDS: PENALTY SERVED - 5 SECOND TIME PENALTY FOR CAR 14 (ALO) - SPEEDING IN THE PIT LANE'),
    msg(57, 'FIA STEWARDS: INCIDENT INVOLVING CAR 1 (NOR) REVIEWED NO FURTHER INVESTIGATION - PIT LANE INFRINGEMENT (16:01:20)'),
  ]);
  assert.deepEqual(alo.steps.map((s) => s.what), ['noted', 'investigating', 'penalty', 'served']);
  assert.deepEqual(nor.steps.map((s) => s.what), ['noted', 'dropped']);
  // Britain 2026: three track-limits penalties for one car, each served at its own stop.
  const str = incidents(
    [
      [38, 'FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 18 (STR) - TRACK LIMITS'],
      [39, 'INCIDENT INVOLVING CAR 18 (STR) NOTED - TRACK LIMITS (5TH OFFENCE)'],
      [40, 'FIA STEWARDS: INCIDENT INVOLVING CAR 18 (STR) UNDER INVESTIGATION - TRACK LIMITS (5TH OFFENCE)'],
      [40, 'FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 18 (STR) - TRACK LIMITS (5TH OFFENCE)'],
      [41, 'INCIDENT INVOLVING CAR 18 (STR) NOTED - TRACK LIMITS (6TH OFFENCE)'],
      [42, 'FIA STEWARDS: INCIDENT INVOLVING CAR 18 (STR) UNDER INVESTIGATION - TRACK LIMITS (6TH OFFENCE)'],
      [42, 'FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 18 (STR) - TRACK LIMITS (6TH OFFENCE)'],
      [52, 'FIA STEWARDS: PENALTY SERVED - 5 SECOND TIME PENALTY FOR CAR 18 (STR) - TRACK LIMITS'],
      [52, 'FIA STEWARDS: PENALTY SERVED - 5 SECOND TIME PENALTY FOR CAR 18 (STR) - TRACK LIMITS (5TH OFFENCE)'],
      [52, 'FIA STEWARDS: PENALTY SERVED - 5 SECOND TIME PENALTY FOR CAR 18 (STR) - TRACK LIMITS (6TH OFFENCE)'],
    ].map(([lap, text]) => msg(lap, text)),
  );
  assert.deepEqual(str.map((i) => i.offence), [6, 5, null]);
  for (const i of str) assert.deepEqual(i.steps.map((s) => s.what).slice(-2), ['penalty', 'served']);
});

// A race state: Verstappen leads, Leclerc within a second, Norris a lap down, Bortoleto stopped.
const line = (n, pos, extra = {}) => ({
  RacingNumber: n,
  Line: pos,
  Position: String(pos),
  ShowPosition: true,
  GapToLeader: '',
  IntervalToPositionAhead: { Value: '', Catching: false },
  Retired: false,
  InPit: false,
  PitOut: false,
  Stopped: false,
  NumberOfLaps: 34,
  NumberOfPitStops: 1,
  Sectors: [{ Value: '28.631', PersonalFastest: false, OverallFastest: false }, { Value: '41.122' }, { Value: '' }],
  BestLapTime: { Value: '1:36.201', Lap: 30 },
  LastLapTime: { Value: '1:37.840', PersonalFastest: false, OverallFastest: false },
  ...extra,
});
const who = (n, Tla, FirstName, LastName, TeamName, TeamColour) => ({ RacingNumber: n, Tla, FirstName, LastName, TeamName, TeamColour });
const race = {
  SessionInfo: { Key: 11388, Type: 'Race', Name: 'Race', Meeting: { Name: 'Singapore Grand Prix' }, StartDate: '2026-10-11T20:00:00', GmtOffset: '08:00:00' },
  SessionStatus: { Status: 'Started', Started: 'Started' },
  TrackStatus: { Status: '6', Message: 'VSCDeployed' },
  LapCount: { CurrentLap: 35, TotalLaps: 62 },
  SessionData: { Series: [{ Utc: '2026-10-11T12:56:22.5Z', Lap: 34 }, { Utc: '2026-10-11T12:58:00.5Z', Lap: 35 }] },
  ExtrapolatedClock: { Utc: '2026-10-11T12:03:00Z', Remaining: '02:00:00', Extrapolating: true },
  WeatherData: { AirTemp: '30.2', TrackTemp: '41.5', Rainfall: '0', WindSpeed: '1.4', Humidity: '77.4' },
  DriverList: {
    3: who('3', 'VER', 'Max', 'Verstappen', 'Red Bull Racing', '4781D7'),
    16: who('16', 'LEC', 'Charles', 'Leclerc', 'Ferrari', 'ED1131'),
    1: who('1', 'NOR', 'Lando', 'Norris', 'McLaren', 'F47600'),
    5: who('5', 'BOR', 'Gabriel', 'Bortoleto', 'Audi', 'F50537'),
  },
  TimingData: {
    Lines: {
      3: line('3', 1, { GapToLeader: 'LAP 35', IntervalToPositionAhead: { Value: 'LAP 35' } }),
      16: line('16', 2, { GapToLeader: '+0.512', IntervalToPositionAhead: { Value: '+0.512', Catching: true }, BestLapTime: { Value: '1:35.202', Lap: 33 }, LastLapTime: { Value: '1:35.202', PersonalFastest: true, OverallFastest: true } }),
      1: line('1', 3, { GapToLeader: '1L', IntervalToPositionAhead: { Value: '1L' }, InPit: true, NumberOfPitStops: 2 }),
      5: line('5', 4, { GapToLeader: '28L', IntervalToPositionAhead: { Value: '27L' }, Stopped: true, ShowPosition: false, NumberOfLaps: 6 }),
    },
  },
  TimingAppData: {
    Lines: {
      3: { GridPos: '1', Stints: [{ Compound: 'SOFT', New: 'true', TotalLaps: 14 }, { Compound: 'MEDIUM', New: 'true', TotalLaps: 20 }] },
      16: { GridPos: '3', Stints: [{ Compound: 'MEDIUM', New: 'false', TotalLaps: 34, StartLaps: 3 }] },
      1: { GridPos: '2', Stints: { 0: { Compound: 'SOFT', New: 'true', TotalLaps: 10 }, 1: { Compound: 'HARD', New: 'true', TotalLaps: 1 } } },
      5: { GridPos: '20', Stints: [] },
    },
  },
  RaceControlMessages: {
    Messages: [
      msg(20, 'CAR 16 (LEC) TIME 1:37.395 DELETED - TRACK LIMITS AT TURN 2 LAP 19 20:33:44'),
      msg(21, 'CAR 16 (LEC) LAP DELETED - TRACK LIMITS AT TURN 2 LAP 20 20:35:21 (PIT)'),
      { Utc: '2026-10-11T13:01:40', Lap: 37, Category: 'Flag', Flag: 'BLACK AND WHITE', Scope: 'Driver', RacingNumber: '16', Message: 'BLACK AND WHITE FLAG FOR CAR 16 (LEC) - TRACK LIMITS' },
      { Utc: '2026-10-11T13:38:25', Lap: 33, Category: 'Flag', Flag: 'BLUE', Scope: 'Driver', RacingNumber: '5', Message: 'WAVED BLUE FLAG FOR CAR 5 (BOR) TIMED AT 21:38:25' },
      { Utc: '2026-10-11T13:40:00', Lap: 34, Category: 'SafetyCar', Mode: 'VSC', Status: 'DEPLOYED', Message: 'VSC DEPLOYED' },
    ],
  },
};

test('a race state as the live view draws it', () => {
  const t = tower(race, { at: Date.parse('2026-10-11T13:03:00Z') });
  assert.equal(t.session.kind, 'race');
  assert.equal(t.session.status, 'running');
  assert.equal(t.session.start, '2026-10-11T12:00:00.000Z');
  assert.equal(t.session.meeting, 'Singapore Grand Prix');
  assert.deepEqual(t.lap, { now: 35, of: 62, began: '2026-10-11T12:58:00.5Z' });
  assert.equal(t.track, 'vsc');
  assert.deepEqual(t.weather, { air: 30.2, track: 41.5, rain: false, wind: 1.4, humidity: 77.4 });
  // An hour after the clock was last set, while it ran.
  assert.deepEqual(t.clock, { left: 3600, running: true });
  assert.deepEqual(t.drivers.map((d) => d.code), ['VER', 'LEC', 'NOR', 'BOR']);
  const [ver, lec, nor, bor] = t.drivers;
  assert.equal(ver.gap, null);
  assert.deepEqual(lec.int, { s: 0.512 });
  assert.equal(lec.catching, true);
  assert.deepEqual(lec.lastLap, { s: 95.202, pb: true, fastest: true });
  assert.equal(lec.last, 'Leclerc');
  assert.deepEqual(lec.tyre, { c: 'MEDIUM', age: 34, new: false });
  assert.equal(lec.grid, 3);
  assert.deepEqual(lec.limits, { deleted: 2, warned: true });
  assert.deepEqual(nor.gap, { laps: 1 });
  assert.equal(nor.pit, 'in');
  assert.equal(nor.stops, 2);
  assert.deepEqual(nor.tyre, { c: 'HARD', age: 1, new: true });
  assert.deepEqual(nor.stints, [['SOFT', 10, true], ['HARD', 1, true]]);
  assert.equal(bor.out, 'stopped');
  assert.equal(bor.shown, false);
  assert.equal(bor.tyre, null);
  assert.deepEqual(ver.sectors.map((s) => s?.s ?? null), [28.631, 41.122, null]);
  assert.equal(ver.color, '#4781D7');
  assert.deepEqual(t.fastest, { n: '16', s: 95.202, lap: 33 });
  // Leclerc is within a second of Verstappen; Norris is in the pits, so not in a fight.
  assert.deepEqual(t.battles, [{ pos: 2, ahead: '3', behind: '16', gap: 0.512 }]);
  // Blue flags are left out; newest first.
  assert.equal(t.messages.length, 4);
  assert.equal(t.messages[0].kind, 'sc');
  assert.deepEqual(t.messages[1].cars, ['16']);
});

test('the safety car’s last lap, and the flag at the end', () => {
  const sc = merge(structuredClone(race), {
    TrackStatus: { Status: '4' },
    RaceControlMessages: { Messages: { 5: { Category: 'SafetyCar', Mode: 'SAFETY CAR', Status: 'DEPLOYED', Message: 'SAFETY CAR DEPLOYED' }, 6: { Category: 'SafetyCar', Mode: 'SAFETY CAR', Status: 'IN THIS LAP', Message: 'SAFETY CAR IN THIS LAP' } } },
  });
  assert.equal(tower(sc).track, 'sc-ending');
  const done = merge(structuredClone(race), { SessionStatus: { Status: 'Finished', Started: 'Finished' }, TrackStatus: { Status: '1' } });
  const t = tower(done, { at: Date.parse('2026-10-11T14:00:00Z') });
  assert.equal(t.track, 'chequered');
  assert.equal(t.session.status, 'finished');
  assert.deepEqual(t.battles, []);
  assert.equal(t.clock.running, false);
});

test('qualifying: the part, the cut and each part’s best', () => {
  const q = {
    SessionInfo: { Type: 'Qualifying', Name: 'Qualifying', StartDate: '2026-10-10T21:30:00', GmtOffset: '08:00:00' },
    SessionStatus: { Status: 'Started', Started: 'Started' },
    TrackStatus: { Status: '1' },
    DriverList: { 3: who('3', 'VER', 'Max', 'Verstappen', 'Red Bull Racing', '4781D7'), 6: who('6', 'HAD', 'Isack', 'Hadjar', 'Red Bull Racing', '4781D7') },
    TimingData: {
      NoEntries: [22, 16, 10],
      SessionPart: 2,
      Lines: {
        3: line('3', 1, { BestLapTimes: [{ Value: '1:33.241', Lap: 2 }, { Value: '1:31.639', Lap: 8 }, {}], Stats: [{ TimeDiffToFastest: '+0.812' }, { TimeDiffToFastest: '', TimeDifftoPositionAhead: '' }, {}], KnockedOut: false, Cutoff: false }),
        6: line('6', 22, { BestLapTimes: [{ Value: '' }, {}, {}], Stats: [{}, {}, {}], KnockedOut: true, Cutoff: true, ShowPosition: false }),
      },
    },
    TimingAppData: { Lines: { 3: { Stints: [{ Compound: 'SOFT', New: 'true', TotalLaps: 3 }] } } },
  };
  const t = tower(q);
  assert.equal(t.session.kind, 'quali');
  assert.deepEqual(t.part, { now: 2, of: 3, cut: 10, entries: [22, 16, 10] });
  assert.equal(t.lap, null);
  assert.deepEqual(t.drivers[0].q, [93.241, 91.639, null]);
  assert.equal(t.drivers[0].gap, null);
  assert.equal(t.drivers[1].knockedOut, true);
  assert.equal(t.drivers[1].grid, undefined);
  // Between the parts F1 says "Inactive" again.
  const gap = tower({ ...q, SessionStatus: { Status: 'Inactive', Started: 'Finished' } });
  assert.equal(gap.session.status, 'break');
});

test('race control in plain words', () => {
  const names = { 31: 'Ocon', 6: 'Hadjar', 12: 'Antonelli', 44: 'Hamilton', 87: 'Bearman', 4: 'Norris', 1: 'Verstappen', 18: 'Stroll' };
  const cases = [
    ['CAR 31 (OCO) TIME 1:40.819 DELETED - TRACK LIMITS AT TURN 7 LAP 57 21:38:21', 'Ocon’s lap 57 (1:40.819) deleted: track limits at turn 7'],
    ['CAR 6 (HAD) LAP DELETED - TRACK LIMITS AT TURN 2 LAP 33 20:57:43 (PIT)', 'Hadjar’s lap 33 deleted: track limits at turn 2'],
    ['CAR 12 (ANT) TIME 1:31.234 DELETED - TRACK LIMITS AT TURN 2 (NEXT LAP)', 'Antonelli’s 1:31.234 lap deleted: track limits at turn 2, and the next lap'],
    ['CAR 63 (RUS) TIME 1:31.900 DELETED - DOUBLE YELLOW AT TURN 9', 'RUS’s 1:31.900 lap deleted: not slowing for double yellows at turn 9'],
    ['BLACK AND WHITE FLAG FOR CAR 12 (ANT) - TRACK LIMITS', 'Black-and-white flag for Antonelli: a warning for track limits'],
    ['FIA STEWARDS: TURN 1 INCIDENT INVOLVING CAR 44 (HAM) UNDER INVESTIGATION - LEAVING THE TRACK AND GAINING AN ADVANTAGE (21:31:36)', 'Turn 1 incident, Hamilton (leaving the track and gaining an advantage): under investigation'],
    ['TURN 4 INCIDENT INVOLVING CARS 4 (NOR) AND 1 (VER) NOTED - CAUSING A COLLISION (20:30:00)', 'Turn 4 incident, Norris and Verstappen (causing a collision): noted'],
    ['FIA STEWARDS: INCIDENT INVOLVING CAR 18 (STR) WILL BE INVESTIGATED AFTER THE RACE - FAILING TO FOLLOW RACE DIRECTORS INSTRUCTIONS', 'Incident, Stroll (failing to follow race directors instructions): to be investigated after the race'],
    ['FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 87 (BEA) - TRACK LIMITS (4TH OFFENCE)', '5-second time penalty for Bearman: track limits (4th offence)'],
    ['FIA STEWARDS: DRIVE THROUGH PENALTY FOR CAR 87 (BEA) - YELLOW FLAG INFRINGEMENT (12:00:00)', 'Drive-through penalty for Bearman: yellow flag infringement'],
    ['FIA STEWARDS: PENALTY SERVED - 5 SECOND TIME PENALTY FOR CAR 4 (NOR) - CAUSING A COLLISION', 'Norris served the 5-second time penalty'],
    ['FIA STEWARDS: WARNING FOR CAR 6 (HAD) - MOVING UNDER BRAKING (21:00:00)', 'Warning for Hadjar: moving under braking'],
    ['RISK OF RAIN FOR THE F1 RACE IS 5%', 'Chance of rain in the race: 5%'],
    ['RISK OF RAIN FOR F1 FREE PRACTICE 2 IS 10%', 'Chance of rain in practice 2: 10%'],
    ['DOUBLE YELLOW IN TRACK SECTOR 14', 'Double yellow flags in sector 14'],
    ['VSC DEPLOYED', 'Virtual safety car'],
    ['OVERTAKE ENABLED', 'Overtake mode on'],
    ['Q2 WILL START AT 16:25', 'Q2 will start at 16:25'],
    ['TRACK SURFACE SLIPPERY IN TRACK SECTOR 3', 'Track surface slippery in track sector 3'],
  ];
  for (const [text, want] of cases) assert.equal(plain(text, names), want);
});

test('where a car would rejoin if it pitted now', () => {
  const d = (n, pos, gap, extra = {}) => ({ n, pos, gap: gap == null ? null : typeof gap === 'object' ? gap : { s: gap }, ...extra });
  const drivers = [d('3', 1, null), d('16', 2, 3.2), d('44', 3, 10.4), d('1', 4, 24.9), d('81', 5, 30.0), d('63', 6, { laps: 1 }), d('5', 7, null, { out: 'retired' })];
  // Leclerc, 3.2 s behind, loses 21.6 s: 24.8 s, just ahead of Norris.
  assert.deepEqual(rejoin(drivers, '16', 21.6), { pos: 3, ahead: '44', behind: '1', toAhead: 24.8 - 10.4, toBehind: 24.9 - 24.8 });
  // The leader rejoins behind Hamilton.
  const lead = rejoin(drivers, '3', 21.6);
  assert.equal(lead.pos, 3);
  assert.equal(lead.ahead, '44');
  // Last of the cars on the lead lap: no one behind on the same lap.
  assert.equal(rejoin(drivers, '81', 21.6).behind, null);
  assert.equal(rejoin(drivers, '63', 21.6), null);
  assert.equal(rejoin(drivers, '5', 21.6), null);
  assert.equal(rejoin(drivers, '16', null), null);
});
