// Formula 1 from Jolpica, which carries on the Ergast database: both championships, each race's
// winner and a weekend's classifications (race, sprint, qualifying), in the small shapes the F1
// pages use, plus the title maths. Pure, so they can be tested; the routes under
// src/app/api/sport/f1 fetch. Session analysis (laps, tyres, pace) comes from FastF1 instead:
// scripts/sport/f1_sessions.py.

export const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

/** The calendar's session labels (f1Season) as the session data's file keys. */
export const SESSION_KEY = { 'Practice 1': 'fp1', 'Practice 2': 'fp2', 'Practice 3': 'fp3', 'Sprint qualifying': 'sq', Sprint: 'sprint', Qualifying: 'q', Race: 'race' };

/** 95.202 → "1:35.202"; 35.2 → "35.200". */
export function lapText(s) {
  if (s == null || !Number.isFinite(s)) return '–';
  const m = Math.floor(s / 60);
  const rest = (s - m * 60).toFixed(3);
  return m ? `${m}:${rest.padStart(6, '0')}` : rest;
}

/** A gap in seconds as "+0.312". */
export const gapText = (s, digits = 3) => (s == null || !Number.isFinite(s) ? '–' : `+${s.toFixed(digits)}`);

const num = (v) => (v == null || v === '' ? null : Number(v));

/** "1:35.202" or "35.202" as seconds; null if it isn't a lap time. */
export function lapSeconds(t) {
  const m = String(t ?? '').match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  return m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : null;
}

const driverOf = (d) => ({
  id: d.driverId,
  code: d.code ?? d.familyName.slice(0, 3).toUpperCase(),
  number: d.permanentNumber ?? null,
  first: d.givenName,
  last: d.familyName,
});
const teamOf = (c) => (c ? { id: c.constructorId, name: c.name } : null);
const racesIn = (json) => json?.MRData?.RaceTable?.Races ?? [];

/** Both championships, from Jolpica's driverstandings and constructorstandings. */
export function standingsOf(drivers, constructors) {
  const dl = drivers?.MRData?.StandingsTable?.StandingsLists?.[0];
  const cl = constructors?.MRData?.StandingsTable?.StandingsLists?.[0];
  return {
    season: num(dl?.season ?? cl?.season),
    round: num(dl?.round ?? cl?.round),
    drivers: (dl?.DriverStandings ?? []).map((s) => ({
      pos: num(s.position),
      points: num(s.points),
      wins: num(s.wins),
      driver: driverOf(s.Driver),
      // A driver who changed teams lists each; the latest is last.
      team: teamOf(s.Constructors?.[s.Constructors.length - 1]),
    })),
    constructors: (cl?.ConstructorStandings ?? []).map((s) => ({ pos: num(s.position), points: num(s.points), wins: num(s.wins), team: teamOf(s.Constructor) })),
  };
}

/** Who won each round, from /{season}/results/1 (or /sprint/1): { [round]: { driver, team } }. */
export function winnersOf(json, key = 'Results') {
  const out = {};
  for (const r of racesIn(json)) {
    const w = r[key]?.[0];
    if (w) out[r.round] = { driver: driverOf(w.Driver), team: teamOf(w.Constructor) };
  }
  return out;
}

/**
 * A race or sprint's classification, in finishing order. A lapped car's time says how many laps
 * down it was ("+1 lap"): Jolpica's figure for it compares totals over different distances.
 */
export function classificationOf(rows) {
  const lead = num(rows?.[0]?.laps);
  return (rows ?? []).map((r) => {
    const laps = num(r.laps);
    const down = lead && laps != null && laps < lead && /^\d+$/.test(r.positionText) ? lead - laps : 0;
    return {
      pos: num(r.position),
      // "R" retired, "D" disqualified, "E" excluded, "W" withdrawn, "F" failed to qualify, "N" not classified.
      text: r.positionText,
      driver: driverOf(r.Driver),
      team: teamOf(r.Constructor),
      grid: num(r.grid),
      laps,
      status: r.status,
      time: down ? `+${down} ${down === 1 ? 'lap' : 'laps'}` : r.Time?.time || null,
      millis: num(r.Time?.millis),
      points: num(r.points),
      fastest: r.FastestLap ? { rank: num(r.FastestLap.rank), lap: num(r.FastestLap.lap), time: r.FastestLap.Time?.time ?? null } : null,
    };
  });
}

/**
 * Qualifying, in grid order: each driver's Q1, Q2 and Q3 times, the part he went out in, and his
 * gap to the fastest time in that part (the time that decided his place).
 */
export function qualifyingOf(rows) {
  const parts = ['Q1', 'Q2', 'Q3'];
  const list = (rows ?? []).map((r) => {
    const times = parts.map((k) => lapSeconds(r[k]));
    const last = times.findLastIndex((t) => t != null);
    return { pos: num(r.position), driver: driverOf(r.Driver), team: teamOf(r.Constructor), q: parts.map((k) => r[k] || null), times, part: last < 0 ? null : last + 1 };
  });
  const fastest = parts.map((_, i) => Math.min(...list.map((x) => x.times[i] ?? Infinity)));
  return list.map(({ times, ...x }) => ({ ...x, gap: x.part && Number.isFinite(fastest[x.part - 1]) ? times[x.part - 1] - fastest[x.part - 1] : null }));
}

/** One round from Jolpica's results, sprint and qualifying answers: { season, round, name, date, race, sprint, qualifying }. */
export function roundOf(results, sprint, qualifying) {
  const r = racesIn(results)[0];
  const s = racesIn(sprint)[0];
  const q = racesIn(qualifying)[0];
  const any = r ?? s ?? q;
  return {
    season: num(any?.season),
    round: num(any?.round),
    name: any?.raceName ?? null,
    race: r?.Results?.length ? classificationOf(r.Results) : null,
    sprint: s?.SprintResults?.length ? classificationOf(s.SprintResults) : null,
    qualifying: q?.QualifyingResults?.length ? qualifyingOf(q.QualifyingResults) : null,
  };
}

/**
 * What's left to win, from the standings, the calendar (f1Season) and which rounds have results:
 * races and sprints still to run, the most points a driver or a team can still score, and where
 * each title stands. A round counts as run once Jolpica has its result, so the sums match the table.
 */
export function titleRace(standings, races, raceDone, sprintDone) {
  const racesLeft = races.filter((r) => !raceDone[r.round]).length;
  const sprintsLeft = races.filter((r) => r.sessions.some((s) => s.label === 'Sprint') && !sprintDone[r.round]).length;
  const most = { driver: racesLeft * RACE_POINTS[0] + sprintsLeft * SPRINT_POINTS[0], team: racesLeft * (RACE_POINTS[0] + RACE_POINTS[1]) + sprintsLeft * (SPRINT_POINTS[0] + SPRINT_POINTS[1]) };
  const title = (rows, max) => {
    const [lead, next] = rows;
    if (!lead) return null;
    const alive = rows.filter((x) => x.points + max >= lead.points);
    return { leader: lead, second: next ?? null, gap: next ? lead.points - next.points : null, decided: !next || lead.points > next.points + max, contenders: alive.length };
  };
  return { racesLeft, sprintsLeft, most, drivers: title(standings.drivers, most.driver), constructors: title(standings.constructors, most.team) };
}

/** What's left until a time, as its two biggest units: [[11, 'days']], [[1, 'day'], [14, 'h']], [[3, 'h'], [12, 'min']]. */
export function countdown(ms) {
  const min = Math.max(0, Math.ceil(ms / 60000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d >= 2) return [[d, 'days']];
  if (d === 1) return h ? [[1, 'day'], [h, 'h']] : [[1, 'day']];
  if (h) return m ? [[h, 'h'], [m, 'min']] : [[h, 'h']];
  return [[m, 'min']];
}
