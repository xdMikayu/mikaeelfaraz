// OpenF1 (openf1.org), the fallback if F1 closes its free live feed. OpenF1's live data needs its
// paid tier: set OPENF1_USERNAME and OPENF1_PASSWORD and the live route turns to it whenever F1's
// feed fails. Without them OpenF1 still serves every session from 30 minutes after it ends, which
// is how this was tested. Its answers are rebuilt in the shape of F1's feed, so tower() reads both
// the same way. OpenF1 has no track status, total laps or qualifying clock, so those are worked out
// from race control's messages or left out.

import { tower } from './f1-live.mjs';
import { lapText } from './f1.mjs';

const API = 'https://api.openf1.org';
let token = null;

export const openF1Ready = () => Boolean(process.env.OPENF1_USERNAME && process.env.OPENF1_PASSWORD);

/** OpenF1's sign-in: a token that lasts an hour, kept while the function stays warm. */
async function bearer() {
  if (!openF1Ready()) return null;
  if (token && token.until > Date.now() + 60000) return token.value;
  const res = await fetch(`${API}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: process.env.OPENF1_USERNAME, password: process.env.OPENF1_PASSWORD }),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`OpenF1’s sign-in answered ${res.status}`);
  const j = await res.json();
  token = { value: j.access_token, until: Date.now() + Number(j.expires_in || 3600) * 1000 };
  return token.value;
}

// OpenF1 allows 3 requests a second without a sign-in and 6 with one.
let last = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path, auth, retry = true) {
  const gap = auth ? 170 : 350;
  await wait(Math.max(0, last + gap - Date.now()));
  last = Date.now();
  const res = await fetch(`${API}/v1/${path}`, { headers: { accept: 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (res.status === 429 && retry) {
    await wait(1000);
    return get(path, auth, false);
  }
  if (res.status === 404) return []; // OpenF1's "No results found."
  if (!res.ok) throw new Error(`OpenF1 answered ${res.status}`);
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

const iso = (ms) => new Date(ms).toISOString();
// F1's feed writes times without a zone: "2026-10-11T13:05:00".
const f1Time = (d) => new Date(d).toISOString().replace(/\.\d+Z$/, '');
const latest = (rows, by = 'driver_number') => {
  const out = {};
  for (const r of rows) out[r[by]] = r;
  return out;
};
const groupBy = (rows, by = 'driver_number') => {
  const out = {};
  for (const r of rows) (out[r[by]] ??= []).push(r);
  return out;
};
// OpenF1 gaps are seconds (0 for the leader), or a string such as "+1 LAP".
const gapText = (v) => {
  if (typeof v === 'number') return v > 0 ? `+${v.toFixed(3)}` : '';
  const m = String(v ?? '').match(/(\d+)\s*LAP/i);
  return m ? `${m[1]}L` : '';
};

/** Race control's messages in F1's shape; a safety car's mode and status are in its text. */
function messagesOf(rc) {
  return rc.map((m) => {
    const sc = m.category === 'SafetyCar' ? m.message.match(/^(SAFETY CAR|VSC)\b.*?(DEPLOYED|ENDING|IN THIS LAP)/) : null;
    return {
      Utc: f1Time(m.date),
      Lap: m.lap_number,
      Category: m.category,
      ...(m.flag ? { Flag: m.flag } : {}),
      ...(m.scope ? { Scope: m.scope } : {}),
      ...(m.sector ? { Sector: m.sector } : {}),
      ...(m.driver_number ? { RacingNumber: String(m.driver_number) } : {}),
      ...(sc ? { Mode: sc[1], Status: sc[2] } : {}),
      Message: m.message,
    };
  });
}

/** F1's track status codes, from race control's flags and safety cars. */
function trackFrom(rc) {
  let status = '1';
  for (const m of rc) {
    const text = m.message ?? '';
    if (m.category === 'SafetyCar') status = /ENDING/.test(text) && /VSC/.test(text) ? '7' : /DEPLOYED/.test(text) ? (/VSC/.test(text) ? '6' : '4') : status;
    else if (m.flag === 'RED') status = '5';
    else if (m.flag === 'GREEN' || (m.flag === 'CLEAR' && m.scope === 'Track') || m.flag === 'CHEQUERED') status = '1';
  }
  return status;
}

/**
 * The live view's data from OpenF1. `session` is OpenF1's key ("latest" while live), `at` the
 * moment to show (testing on a past session); now by default.
 */
export async function fromOpenF1({ session = 'latest', at = null } = {}) {
  const auth = await bearer();
  const now = at ?? Date.now();
  const before = at ? `&date<${iso(at)}` : '';
  const [s] = await get(`sessions?session_key=${session}`, auth);
  if (!s) throw new Error('OpenF1 has no session');
  const key = s.session_key;
  const kind = s.session_type === 'Race' ? 'race' : s.session_type === 'Qualifying' ? 'quali' : 'practice';
  // One request after another, inside OpenF1's limit on requests a second.
  const paths = [
    `meetings?meeting_key=${s.meeting_key}`,
    `drivers?session_key=${key}`,
    `position?session_key=${key}${before}`,
    kind === 'race' ? `intervals?session_key=${key}&date>${iso(now - 60000)}${before}` : null,
    `laps?session_key=${key}${at ? `&date_start<${iso(at)}` : ''}`,
    `stints?session_key=${key}`,
    `pit?session_key=${key}${before}`,
    `race_control?session_key=${key}${before}`,
    `weather?session_key=${key}&date>${iso(now - 600000)}${before}`,
  ];
  const [meetings, drivers, positions, intervals, allLaps, stints, pits, rc, weather] = [[], [], [], [], [], [], [], [], []];
  const into = [meetings, drivers, positions, intervals, allLaps, stints, pits, rc, weather];
  for (let i = 0; i < paths.length; i++) if (paths[i]) into[i].push(...(await get(paths[i], auth)));

  // Only laps finished by `now` count; the one under way is the driver's current lap.
  const done = allLaps.filter((l) => l.lap_duration && Date.parse(l.date_start) + l.lap_duration * 1000 <= now);
  const lapsOf = groupBy(done);
  const going = latest(allLaps.filter((l) => !done.includes(l)));
  const pos = latest(positions);
  const gaps = latest(intervals);
  const stops = groupBy(pits);
  const stintsOf = groupBy(stints);
  const grid = latest(positions.filter((p) => Date.parse(p.date) < Date.parse(s.date_start)));

  // Qualifying's parts, from the part race control tags each message with.
  const parts = rc.map((m) => m.qualifying_phase).filter(Boolean);
  const part = kind === 'quali' && parts.length ? Math.max(...parts) : 0;
  const partStart = (p) => Math.min(...rc.filter((m) => m.qualifying_phase === p).map((m) => Date.parse(m.date)));
  const partOf = (l) => (part ? [3, 2, 1].find((p) => p <= part && Date.parse(l.date_start) >= partStart(p)) ?? 1 : 0);
  const entries = drivers.length >= 22 ? [22, 16, 10] : [20, 15, 10];

  const best = {};
  for (const [n, ls] of Object.entries(lapsOf)) best[n] = ls.reduce((b, l) => (!b || l.lap_duration < b.lap_duration ? l : b), null);
  const order = Object.keys(best).sort((a, b) => best[a].lap_duration - best[b].lap_duration);
  const top = best[order[0]]?.lap_duration;

  const chequered = rc.filter((m) => m.flag === 'CHEQUERED');
  const finished = kind === 'quali' ? chequered.some((m) => m.qualifying_phase === 3) : chequered.length > 0;
  const red = trackFrom(rc) === '5';
  const status =
    now < Date.parse(s.date_start)
      ? 'Inactive'
      : finished
        ? now > Date.parse(s.date_end) + 30 * 60000
          ? 'Finalised'
          : 'Finished'
        : part && chequered.some((m) => m.qualifying_phase === part)
          ? 'Inactive'
          : red
            ? 'Aborted'
            : 'Started';

  const Lines = {};
  const AppLines = {};
  for (const d of drivers) {
    const n = String(d.driver_number);
    const ls = lapsOf[n] ?? [];
    const last = ls.at(-1);
    const b = best[n];
    const p = stops[n] ?? [];
    const lapsDone = ls.length ? Math.max(...ls.map((l) => l.lap_number)) : 0;
    const ahead = order[order.indexOf(n) - 1];
    // A lap that starts in the pit lane is an out lap; OpenF1 logs the stop once the car is out.
    const outLap = Boolean(going[n]?.is_pit_out_lap) && lapsDone > 0;
    const inPit = outLap && !p.some((x) => x.lap_number >= lapsDone);
    const line = {
      RacingNumber: n,
      Position: String(pos[n]?.position ?? 99),
      Line: pos[n]?.position ?? 99,
      ShowPosition: Boolean(pos[n]),
      NumberOfLaps: lapsDone,
      NumberOfPitStops: p.length + (inPit ? 1 : 0),
      InPit: inPit,
      PitOut: outLap && !inPit,
      Retired: false,
      Stopped: false,
      BestLapTime: b ? { Value: lapText(b.lap_duration), Lap: b.lap_number } : { Value: '' },
      LastLapTime: { Value: last ? lapText(last.lap_duration) : '' },
      Sectors: [1, 2, 3].map((k) => ({ Value: last?.[`duration_sector_${k}`] ? last[`duration_sector_${k}`].toFixed(3) : '' })),
    };
    if (kind === 'race') {
      line.GapToLeader = gapText(gaps[n]?.gap_to_leader);
      line.IntervalToPositionAhead = { Value: gapText(gaps[n]?.interval), Catching: false };
    } else {
      line.TimeDiffToFastest = b && top && b.lap_duration > top ? `+${(b.lap_duration - top).toFixed(3)}` : '';
      line.TimeDiffToPositionAhead = b && ahead ? `+${(b.lap_duration - best[ahead].lap_duration).toFixed(3)}` : '';
    }
    if (part) {
      line.BestLapTimes = [1, 2, 3].map((q) => {
        const inPart = ls.filter((l) => partOf(l) === q);
        const t = inPart.length ? Math.min(...inPart.map((l) => l.lap_duration)) : null;
        return t ? { Value: lapText(t) } : {};
      });
      line.Stats = [{}, {}, {}];
      line.Stats[part - 1] = { TimeDiffToFastest: line.TimeDiffToFastest, TimeDifftoPositionAhead: line.TimeDiffToPositionAhead };
      line.KnockedOut = part > 1 && (pos[n]?.position ?? 99) > entries[part - 1];
    }
    Lines[n] = line;
    // The sets fitted so far, each with the laps it has done; the new set shows once the car is out.
    const fitted = (stintsOf[n] ?? []).filter((st) => st.lap_start <= lapsDone + (inPit ? 0 : 1) || st.stint_number === 1);
    const sets = fitted.map((st) => ({ Compound: st.compound, New: String(!st.tyre_age_at_start), TotalLaps: (st.tyre_age_at_start ?? 0) + Math.max(0, Math.min(st.lap_end ?? lapsDone, lapsDone) - st.lap_start + 1) }));
    // OpenF1's stints sometimes start in the wrong place; then the set's age counts from the last stop.
    const lastStop = p.at(-1);
    if (sets.length && lastStop && fitted.at(-1).lap_start !== lastStop.lap_number + 1) sets.at(-1).TotalLaps = Math.max(0, lapsDone - lastStop.lap_number);
    AppLines[n] = { GridPos: grid[n] ? String(grid[n].position) : '', Stints: sets };
  }
  const leaderLaps = Math.max(0, ...Object.values(Lines).map((l) => l.NumberOfLaps));
  const w = weather.at(-1);
  const m = meetings[0] ?? {};
  const offset = s.gmt_offset ?? '00:00:00';
  const [oh, om] = offset.replace('-', '').split(':').map(Number);
  const local = Date.parse(s.date_start) + (offset.startsWith('-') ? -1 : 1) * (oh * 60 + om) * 60000;
  const left = Math.max(0, (Date.parse(s.date_end) - now) / 1000);

  const raw = {
    SessionInfo: { Key: key, Type: s.session_type, Name: s.session_name, Meeting: { Name: m.meeting_name ?? s.country_name }, StartDate: f1Time(local), GmtOffset: offset },
    SessionStatus: { Status: status, Started: finished ? 'Finished' : status === 'Inactive' && part ? 'Finished' : status === 'Inactive' ? 'Inactive' : 'Started' },
    TrackStatus: { Status: trackFrom(rc) },
    LapCount: kind === 'race' ? { CurrentLap: finished ? leaderLaps : leaderLaps + 1 } : undefined,
    ExtrapolatedClock: kind !== 'quali' ? { Utc: iso(now), Remaining: new Date(left * 1000).toISOString().slice(11, 19), Extrapolating: status === 'Started' } : undefined,
    WeatherData: w ? { AirTemp: w.air_temperature, TrackTemp: w.track_temperature, Rainfall: w.rainfall, WindSpeed: w.wind_speed, Humidity: w.humidity } : undefined,
    DriverList: Object.fromEntries(drivers.map((d) => [String(d.driver_number), { RacingNumber: String(d.driver_number), Tla: d.name_acronym, FirstName: d.first_name, LastName: d.last_name, TeamName: d.team_name, TeamColour: d.team_colour }])),
    TimingData: { Lines, ...(part ? { SessionPart: part, NoEntries: entries } : {}) },
    TimingAppData: { Lines: AppLines },
    RaceControlMessages: { Messages: messagesOf(rc) },
  };
  return tower(raw, { at: now, source: 'openf1' });
}
