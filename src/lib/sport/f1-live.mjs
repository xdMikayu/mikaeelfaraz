// F1's live timing, in the shape the live view draws. F1's feed (livetiming.formula1.com) sends
// each topic as a full state followed by partial updates. merge() applies an update to a state (the
// replay script needs it; the live route asks for whole states). tower() turns one state into:
//   - the running order, with gaps, laps and tyres;
//   - the track status and the session clock;
//   - race control's messages, and the stewards' incidents grouped from noted to decided.
// Pure, so they can be tested. src/lib/sport/f1-live-server.mjs fetches.

import { lapSeconds } from './f1.mjs';

/**
 * Applies one update to a topic's state, in place, and returns the state:
 *   - objects merge key by key;
 *   - an object with numbered keys changes those places in a list;
 *   - "_deleted" lists keys to remove;
 *   - anything else replaces what was there.
 */
export function merge(state, update) {
  if (update === null || typeof update !== 'object') return update;
  if (Array.isArray(update)) return update.map((u) => merge(undefined, u));
  if (Array.isArray(state)) {
    for (const [k, v] of Object.entries(update)) {
      const i = Number(k);
      if (Number.isInteger(i) && i >= 0) state[i] = merge(state[i], v);
    }
    return state;
  }
  const out = state && typeof state === 'object' ? state : {};
  for (const [k, v] of Object.entries(update)) {
    if (k === '_deleted') {
      for (const d of [].concat(v)) delete out[d];
    } else {
      out[k] = merge(out[k], v);
    }
  }
  return out;
}

/** An archived topic (".jsonStream") as [milliseconds into the recording, update] pairs. */
export function parseStream(text) {
  const out = [];
  for (const line of String(text).replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = line.match(/^(\d+):(\d\d):(\d\d)\.(\d{3})(.+)$/);
    if (!m) continue;
    try {
      out.push([((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number(m[4]), JSON.parse(m[5])]);
    } catch {}
  }
  return out;
}

/** "00:12:34" as seconds. */
const clockSeconds = (t) => {
  const m = String(t ?? '').match(/^(\d+):(\d\d):(\d\d(?:\.\d+)?)$/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
};

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const list = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map((k) => v[k]) : []);
const yes = (v) => v === true || v === 'true';

/**
 * A gap as F1 writes it:
 *   - "+7.335" → { s: 7.335 };
 *   - "1L" → { laps: 1 }, a lap or more down;
 *   - "LAP 62" (the leader) and "" → null.
 */
export function gapOf(t) {
  const s = String(t ?? '').trim();
  let m = s.match(/^\+?(\d+(?:\.\d+)?)$/);
  if (m) return { s: Number(m[1]) };
  m = s.match(/^\+?(\d+)\s*L(?:APS?)?$/i);
  return m ? { laps: Number(m[1]) } : null;
}

/** The kind of session: the race and the sprint race, qualifying (sprint qualifying too) or practice. */
export function kindOf(info) {
  if (info?.Type === 'Race') return 'race';
  if (info?.Type === 'Qualifying') return 'quali';
  return 'practice';
}

/** When a session starts, in UTC. F1 gives the local time and its offset. */
export function startOf(info) {
  if (!info?.StartDate) return null;
  const m = String(info.GmtOffset ?? '').match(/^(-)?(\d+):(\d\d)/);
  const mins = m ? (m[1] ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  const t = Date.parse(`${info.StartDate}Z`);
  return Number.isFinite(t) ? new Date(t - mins * 60000).toISOString() : null;
}

/**
 * Whether F1's feed is on the calendar's session: the same name ("Practice 1", "Sprint
 * qualifying"…) within a day and a half. Not by start time alone: sessions get moved, and F1's
 * own schedule and Jolpica's don't always catch up.
 */
export function sameSession(feed, cal) {
  const name = (x) => String(x ?? '').toLowerCase().replace('sprint shootout', 'sprint qualifying');
  return Boolean(feed?.start && cal?.at) && name(feed.name) === name(cal.label) && Math.abs(Date.parse(feed.start) - Date.parse(cal.at)) < 36 * 3600e3;
}

/**
 * Where a car would rejoin if it pitted now: its gap to the leader plus what a stop costs (`loss`
 * seconds), against everyone else's gap. Cars a lap or more down and cars out of the race don't
 * count. → { pos, ahead, behind, toAhead, toBehind } (racing numbers, seconds), or null.
 */
export function rejoin(drivers, n, loss) {
  const gapOf = (d) => (d.pos === 1 && !d.gap ? 0 : (d.gap?.s ?? null));
  const d = drivers.find((x) => x.n === n);
  if (!d || d.out || !loss || gapOf(d) == null) return null;
  const after = gapOf(d) + loss;
  const others = drivers
    .filter((x) => x.n !== n && !x.out && gapOf(x) != null)
    .map((x) => ({ n: x.n, g: gapOf(x) }))
    .sort((a, b) => a.g - b.g);
  const before = others.filter((x) => x.g <= after);
  const ahead = before.at(-1) ?? null;
  const behind = others.find((x) => x.g > after) ?? null;
  return { pos: before.length + 1, ahead: ahead?.n ?? null, behind: behind?.n ?? null, toAhead: ahead ? after - ahead.g : null, toBehind: behind ? behind.g - after : null };
}

// F1's track status codes.
const TRACK = { 1: 'green', 2: 'yellow', 4: 'sc', 5: 'red', 6: 'vsc', 7: 'vsc-ending' };
const STATUS = { Inactive: 'waiting', Started: 'running', Aborted: 'suspended', Finished: 'finished', Finalised: 'final', Ends: 'final' };

/** Where a message belongs: the flags and safety cars, the stewards, track limits, or the rest. */
export function messageKind(m) {
  const text = m?.Message ?? '';
  if (m?.Category === 'SafetyCar') return 'sc';
  if (m?.Flag === 'BLUE') return 'blue';
  if (m?.Flag === 'RED') return 'red';
  if (m?.Flag === 'CHEQUERED') return 'chequered';
  if (/TRACK LIMITS/.test(text)) return 'limits';
  if (/^FIA STEWARDS|INCIDENT INVOLVING|PENALTY/.test(text)) return 'stewards';
  if (m?.Flag === 'YELLOW' || m?.Flag === 'DOUBLE YELLOW') return 'yellow';
  if (m?.Flag === 'CLEAR' || m?.Flag === 'GREEN') return 'clear';
  return 'info';
}

/** The cars a message names, by racing number: "CARS 4 (NOR) AND 1 (VER)" → ["4", "1"]. */
const carsIn = (text) => [...String(text).matchAll(/(\d+) \(([A-Z0-9]{3})\)/g)].map((x) => x[1]);

const sentence = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s);
// "TURN 1" → "Turn 1"; "Q1", "SQ2" stay as they are.
const place = (s) => (!s ? null : /^S?Q\d$/.test(s) ? s : sentence(s));
const utc = (t) => (t ? t.replace(/Z?$/, 'Z') : null);

const INCIDENT =
  /^(?:FIA STEWARDS: )?(UPDATE: )?(?:(.+?) )?INCIDENT INVOLVING (.+?) (NOTED|UNDER INVESTIGATION|WILL BE INVESTIGATED AFTER THE (?:RACE|SESSION|SPRINT)|REVIEWED NO FURTHER INVESTIGATION|NO FURTHER INVESTIGATION|NO FURTHER ACTION)(?: - (.+?))?(?: \((\d\d:\d\d:\d\d)\))?$/;
const DECISION = /^FIA STEWARDS: (PENALTY SERVED - )?(.+?) FOR CARS? (.+?\([A-Z0-9]{3}\))(?: - (.+?))?(?: \((\d\d:\d\d:\d\d)\))?$/;
const STEP = {
  NOTED: 'noted',
  'UNDER INVESTIGATION': 'investigating',
  'REVIEWED NO FURTHER INVESTIGATION': 'dropped',
  'NO FURTHER INVESTIGATION': 'dropped',
  'NO FURTHER ACTION': 'no action',
};
const stepOf = (s) => STEP[s] ?? `after the ${s.split(' ').pop().toLowerCase()}`;
const DECIDED = ['dropped', 'no action', 'penalty', 'warning'];

// "5 SECOND TIME PENALTY" → "5-second time penalty".
const penaltyWords = (p) => p.toLowerCase().replace(/(\d+) second/, '$1-second').replace('drive through', 'drive-through').replace('stop/go', 'stop-go');
// "TRACK LIMITS (5TH OFFENCE)" → ["Track limits", 5].
const reasonOf = (s) => {
  const m = String(s ?? '').match(/^(.*?)(?: \((\d+)(?:ST|ND|RD|TH) OFFENCE\))?$/);
  return [m[1] ? sentence(m[1]) : null, Number(m[2]) || null];
};

/**
 * The stewards' work as incidents, newest first. Each incident gathers its steps: noted, under
 * investigation, a decision (no further action, a 5-second penalty…), then the penalty served.
 * F1's messages name an incident by the time it happened ("(21:31:36)"), which joins the steps.
 * A step without that time joins the latest open incident for the same car and reason (and the
 * same offence, for track limits); "UPDATE:" corrects the time.
 */
export function incidents(messages) {
  const out = [];
  // Incidents by the time F1 gave them; a decision names only the car it punishes.
  const byTime = new Map();
  const timed = (time, cars) => (byTime.get(time) ?? []).find((i) => i.cars.some((c) => cars.includes(c)));
  const open = (cars, reason, offence, what, keyless) => {
    const fits = (i) =>
      i.cars.some((c) => cars.includes(c)) &&
      (!reason || !i.reason || i.reason === reason) &&
      (!keyless || !i.key) &&
      (what === 'served' ? i.steps.some((s) => s.what === 'penalty') && !i.steps.some((s) => s.what === 'served') : !i.steps.some((s) => DECIDED.includes(s.what)));
    return out.findLast((i) => fits(i) && i.offence === offence) ?? out.findLast(fits);
  };
  const find = (time, cars, reason, offence, what, update) => {
    let inc = (time && timed(time, cars)) ?? open(cars, reason, offence, what, Boolean(time) && !update);
    if (!inc) {
      inc = { cars, where: null, reason, offence, key: null, steps: [] };
      out.push(inc);
    }
    if (time && inc.key !== time) {
      inc.key = time;
      byTime.set(time, [...(byTime.get(time) ?? []), inc]);
    }
    return inc;
  };
  for (const m of messages) {
    const text = (m.Message ?? '').trim();
    const step = { at: utc(m.Utc), lap: m.Lap ?? null };
    let x = text.match(INCIDENT);
    if (x) {
      const cars = carsIn(x[3]);
      if (!cars.length) continue; // "ALL CARS": race control testing its messages
      const [reason, offence] = reasonOf(x[5]);
      const what = stepOf(x[4]);
      const inc = find(x[6], cars, reason, offence, what, Boolean(x[1]));
      inc.where ??= place(x[2]);
      // An update repeats the step it corrects.
      if (!(x[1] && inc.steps.at(-1)?.what === what)) inc.steps.push({ ...step, what });
      continue;
    }
    x = text.match(DECISION);
    if (!x) continue;
    const cars = carsIn(x[3]);
    const [reason, offence] = reasonOf(x[4]);
    const what = x[1] ? 'served' : /WARNING/.test(x[2]) ? 'warning' : 'penalty';
    const inc = find(x[5], cars, reason, offence, what, false);
    inc.steps.push({ ...step, what, penalty: penaltyWords(x[2]), cars });
  }
  return out.reverse().map(({ key, ...i }) => i);
}

// Words race control writes in capitals that stay that way in a sentence.
const KEEP = /\b(fia|vsc|drs|f[123]|s?q[123]|ers)\b/g;
/** "TRACK SURFACE SLIPPERY IN SECTOR 3" → "Track surface slippery in sector 3", drivers' codes kept. */
const sentenceCase = (t) => {
  const s = t.toLowerCase().replace(KEEP, (w) => w.toUpperCase()).replace(/\(([a-z0-9]{3})\)/g, (_, c) => `(${c.toUpperCase()})`);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const ordinal = (n) => `${n}${n % 100 > 10 && n % 100 < 14 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th'}`;
const STEP_WORDS = { noted: 'noted', investigating: 'under investigation', dropped: 'reviewed, no investigation', 'no action': 'no further action' };

/**
 * Race control's message in plain words, with drivers by name. `names` maps racing numbers to
 * surnames. Messages it doesn't know come back in sentence case.
 */
export function plain(text, names = {}) {
  const t = String(text ?? '').trim();
  const who = (n, code) => names[n] ?? code ?? `car ${n}`;
  const whose = (n, code) => `${who(n, code)}’s`;
  const cars = (s) => {
    const list = [...String(s).matchAll(/(\d+) \(([A-Z0-9]{3})\)/g)].map((x) => who(x[1], x[2]));
    return list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : (list[0] ?? String(s).toLowerCase());
  };
  let m = t.match(/^CAR (\d+) \(([A-Z0-9]{3})\) (?:TIME ([\d:.]+)|LAP) DELETED - (TRACK LIMITS|DOUBLE YELLOW) AT TURN (\d+)(?: LAP (\d+))?.*?(\(NEXT LAP(?: PIT)?\))?$/);
  if (m) {
    const what = m[6] ? `lap ${m[6]}${m[3] ? ` (${m[3]})` : ''}` : m[3] ? `${m[3]} lap` : 'lap';
    const why = m[4] === 'TRACK LIMITS' ? `track limits at turn ${m[5]}` : `not slowing for double yellows at turn ${m[5]}`;
    return `${whose(m[1], m[2])} ${what} deleted: ${why}${m[7] ? ', and the next lap' : ''}`;
  }
  if ((m = t.match(/^CAR (\d+) \(([A-Z0-9]{3})\) TIME ([\d:.]+) WILL BE REINSTATED/))) return `${whose(m[1], m[2])} ${m[3]} lap reinstated`;
  if ((m = t.match(/^BLACK AND WHITE FLAG FOR CAR (\d+) \(([A-Z0-9]{3})\) - (.+?)(?: \(\d\d:\d\d:\d\d\))?$/))) return `Black-and-white flag for ${who(m[1], m[2])}: a warning for ${m[3].toLowerCase()}`;
  if ((m = t.match(/^WAVED BLUE FLAG FOR CAR (\d+) \(([A-Z0-9]{3})\)/))) return `Blue flag for ${who(m[1], m[2])}`;
  if ((m = t.match(/^(DOUBLE YELLOW|YELLOW) IN TRACK SECTOR (\d+)$/))) return `${m[1] === 'YELLOW' ? 'Yellow flag' : 'Double yellow flags'} in sector ${m[2]}`;
  if ((m = t.match(/^CLEAR IN TRACK SECTOR (\d+)$/))) return `Sector ${m[1]} clear`;
  if ((m = t.match(/^FIRST CAR TO TAKE THE FLAG - CAR (\d+) \(([A-Z0-9]{3})\)$/))) return `${who(m[1], m[2])} first to take the flag`;
  if ((m = t.match(/^RISK OF RAIN FOR (?:THE )?F1 (.+?) IS (\d+)%$/))) {
    const what = m[1].toLowerCase().replace('free practice', 'practice');
    return `Chance of rain in ${/^(race|sprint)$/.test(what) ? 'the ' : ''}${what}: ${m[2]}%`;
  }
  const words = {
    'VSC DEPLOYED': 'Virtual safety car',
    'VSC ENDING': 'Virtual safety car ending',
    'SAFETY CAR DEPLOYED': 'Safety car',
    'SAFETY CAR IN THIS LAP': 'Safety car comes in this lap',
    'RED FLAG': 'Red flag',
    'CHEQUERED FLAG': 'Chequered flag',
    'TRACK CLEAR': 'Track clear',
    'OVERTAKE ENABLED': 'Overtake mode on',
    'OVERTAKE DISABLED': 'Overtake mode off',
    'DRS ENABLED': 'DRS on',
    'DRS DISABLED': 'DRS off',
    'GREEN LIGHT - PIT EXIT OPEN': 'Green light: pit exit open',
  };
  if (words[t]) return words[t];
  if ((m = t.match(INCIDENT))) {
    const [why] = reasonOf(m[5]);
    const step = stepOf(m[4]);
    return `${place(m[2]) ? `${place(m[2])} incident` : 'Incident'}, ${cars(m[3])}${why ? ` (${why.toLowerCase()})` : ''}: ${STEP_WORDS[step] ?? `to be investigated ${step}`}`;
  }
  if ((m = t.match(DECISION))) {
    const [why, offence] = reasonOf(m[4]);
    const reason = why ? `: ${why.toLowerCase()}${offence ? ` (${ordinal(offence)} offence)` : ''}` : '';
    if (m[1]) return `${cars(m[3])} served the ${penaltyWords(m[2])}`;
    return /^WARNING$/.test(m[2]) ? `Warning for ${cars(m[3])}${reason}` : `${penaltyWords(m[2]).replace(/^./, (c) => c.toUpperCase())} for ${cars(m[3])}${reason}`;
  }
  return sentenceCase(t);
}

/** Track limits so far: each car's deleted laps, and whether it has had the black-and-white flag. */
function limitsOf(messages) {
  const out = {};
  for (const m of messages) {
    const text = m.Message ?? '';
    const x = text.match(/^CAR (\d+) \([A-Z0-9]{3}\) (?:TIME [\d:.]+|LAP) DELETED - TRACK LIMITS/);
    if (x) (out[x[1]] ??= { deleted: 0, warned: false }).deleted += 1;
    if (m.Flag === 'BLACK AND WHITE' && /TRACK LIMITS/.test(text) && m.RacingNumber) (out[m.RacingNumber] ??= { deleted: 0, warned: false }).warned = true;
    if (/WILL BE REINSTATED/.test(text)) {
      const r = text.match(/^CAR (\d+)/);
      if (r && out[r[1]]) out[r[1]].deleted = Math.max(0, out[r[1]].deleted - 1);
    }
  }
  return out;
}

/** The flag over the track: F1's status, with the safety car's last lap from race control. */
function trackOf(raw, status, messages) {
  if (status === 'finished' || status === 'final') return 'chequered';
  let flag = TRACK[Number(raw.TrackStatus?.Status)] ?? 'green';
  if (flag === 'sc') {
    const last = messages.findLast((m) => m.Category === 'SafetyCar' && m.Mode === 'SAFETY CAR');
    if (last?.Status === 'IN THIS LAP') flag = 'sc-ending';
  }
  return flag;
}

const timeOf = (t) => (t && (t.Value ?? '') !== '' ? { s: lapSeconds(t.Value), pb: yes(t.PersonalFastest), fastest: yes(t.OverallFastest) } : null);

// F1's mini-sectors: each sector is cut into six to ten, and each turns a colour as a car passes it.
// As letters: "." not reached yet this lap, "y" slower than the driver's best there, "g" the driver's
// best, "p" the best of anyone, "b" the pit lane.
const SEG = { 0: '.', 2048: 'y', 2049: 'g', 2051: 'p', 2064: 'b' };
const segOf = (g) => SEG[num(g?.Status) ?? 0] ?? 'y';
// F1's status bits for a car (TimingData's Status): in the pits, on an out lap, has taken the flag.
const IN_PIT = 16;
const OUT_LAP = 512;
const FLAG = 1024;
// A sector this much slower than the best of anyone isn't a flying lap.
const SLOW = 1.07;

/**
 * Where a car is in its lap, for qualifying and practice. `status` is F1's status for the car,
 * `inPit` and `pitOut` its flags, `segs` this lap's mini-sectors by sector, `now` the sectors done
 * this lap (seconds or null), `prev` the last lap's (the sectors not reached yet still show them),
 * `best` the best of anyone in each sector.
 *   pit    in the pit lane or the garage;
 *   out    an out lap: F1 marks it, and the lap began in the pit lane;
 *   in     heading into the pits: the lap has reached the pit lane;
 *   push   a flying lap: a best mini-sector, sectors within 7% of the best of anyone, or, before
 *          it has shown either, the lap after a slow one;
 *   slow   a slow lap: cooling the tyres, or a lap given up;
 *   done   has taken the chequered flag;
 *   track  on track, not yet clear which (just over the line after a flying lap).
 */
export function phaseOf({ status = 0, inPit = false, pitOut = false, segs = [], now = [], prev = [], best = [] }) {
  if (inPit || status & IN_PIT) return 'pit';
  const flat = segs.join('');
  if (pitOut || status & OUT_LAP || flat.startsWith('b')) return 'out';
  if (segs[2]?.includes('b')) return 'in';
  if (status & FLAG) return 'done';
  const slow = (x, i) => x != null && best[i] != null && x > best[i] * SLOW;
  if (now.some(slow)) return 'slow';
  if (now.some((x, i) => x != null && best[i] != null)) return 'push';
  if (/[gp]/.test(flat)) return 'push';
  // Three mini-sectors and not one of them a best: not pushing.
  if (flat.replace(/\./g, '').length >= 3) return 'slow';
  // Just over the line: after a slow lap (out, or cooling down) comes a flying one; after a flying
  // one, a slow one. The last lap shows in the sectors this one hasn't reached.
  for (let i = prev.length - 1; i >= 0; i--) if (prev[i] != null && best[i] != null) return slow(prev[i], i) ? 'push' : 'slow';
  return 'track';
}

/**
 * A car's lap so far, in qualifying and practice: its mini-sectors ("ygg…" by sector), the sectors
 * done this lap, what kind of lap it is (phaseOf) and, on a flying lap, the time it's heading for
 * (paceOf). Without mini-sectors (OpenF1 sends none) only the pits and out laps can be told.
 */
function lapOf(l, best) {
  const secs = list(l.Sectors);
  const segs = secs.map((s) => list(s?.Segments).map(segOf).join(''));
  if (!segs.some(Boolean)) return yes(l.InPit) ? { phase: 'pit' } : yes(l.PitOut) ? { phase: 'out' } : null;
  // F1 keeps the last lap's sector times on the board into the next lap: the first sector's stays until
  // this lap's arrives, which is when the second's and third's are cleared. So a sector is done this
  // lap once its mini-sectors are and the third sector has been cleared, or the whole lap is done.
  const full = segs.map((x) => x.length > 0 && !x.includes('.'));
  const vals = secs.map((s) => lapSeconds(s?.Value));
  const fresh = full.every(Boolean) || vals[2] == null;
  const now = vals.map((x, i) => (full[i] && fresh ? x : null));
  const prev = secs.map((s, i) => (now[i] != null ? null : (vals[i] ?? lapSeconds(s?.PreviousValue))));
  const phase = phaseOf({ status: num(l.Status) ?? 0, inPit: yes(l.InPit), pitOut: yes(l.PitOut), segs, now, prev, best });
  return {
    phase,
    segs,
    sectors: now.map((x, i) => (x == null ? null : { s: x, pb: yes(secs[i].PersonalFastest), fastest: yes(secs[i].OverallFastest) })),
    pace: phase === 'push' ? paceOf(now, best) : null,
  };
}

/**
 * Where a flying lap is heading: the sectors done so far, and the rest at the same pace against the
 * best of anyone (the ratio of this lap's sectors to the best ones, applied to the sector left).
 * Only from two sectors: on the 2026 United States and Singapore qualifying sessions it was then a
 * median 0.2 s and one place out, where after one sector it was two to three places out.
 * → seconds, or null.
 */
export function paceOf(now, best) {
  if (best.length < 3 || best.some((b) => b == null)) return null;
  const done = now.map((x, i) => (x != null ? i : null)).filter((i) => i != null);
  if (done.length < 2) return null;
  const took = done.reduce((t, i) => t + now[i], 0);
  if (done.length === 3) return took;
  const ratio = took / done.reduce((t, i) => t + best[i], 0);
  return took + ratio * best.reduce((t, b, i) => (done.includes(i) ? t : t + b), 0);
}

/**
 * One state of F1's feed as the live view's data. `at` is when the state was read (milliseconds),
 * so the session clock can be worked out.
 */
export function tower(raw, { at = Date.now(), source = 'f1' } = {}) {
  const info = raw.SessionInfo ?? {};
  const kind = kindOf(info);
  const td = raw.TimingData ?? {};
  const app = raw.TimingAppData?.Lines ?? {};
  const roster = raw.DriverList ?? {};
  const messages = list(raw.RaceControlMessages?.Messages);
  const started = raw.SessionStatus?.Started;
  let status = STATUS[raw.SessionStatus?.Status ?? info.SessionStatus] ?? 'waiting';
  // Qualifying stops between its parts: "Inactive" again, after "Finished".
  if (status === 'waiting' && started === 'Finished' && kind === 'quali') status = 'break';
  const part = kind === 'quali' ? num(td.SessionPart) || null : null;
  const entries = list(td.NoEntries).map(num);
  const limits = kind === 'race' ? limitsOf(messages) : {};
  // The best of anyone in each sector: F1's own record (TimingStats) when it's there, else the
  // quickest sector on the board.
  const best = [0, 1, 2].map((i) => {
    const kept = Object.values(raw.TimingStats?.Lines ?? {}).map((x) => lapSeconds(list(x?.BestSectors)[i]?.Value));
    const board = Object.values(td.Lines ?? {}).flatMap((l) => [list(l?.Sectors)[i]?.Value, list(l?.Sectors)[i]?.PreviousValue].map(lapSeconds));
    const xs = (kept.some((x) => x > 0) ? kept : board).filter((x) => x > 0);
    return xs.length ? Math.min(...xs) : null;
  });

  const drivers = Object.entries(td.Lines ?? {})
    .filter(([, l]) => l && typeof l === 'object')
    .map(([n, l]) => {
      const who = roster[n] ?? {};
      const a = app[n] ?? {};
      const stints = list(a.Stints).filter((s) => s && s.Compound);
      const now = stints.at(-1);
      const stats = part ? list(l.Stats)[part - 1] ?? {} : {};
      const d = {
        n,
        code: who.Tla ?? n,
        first: who.FirstName ?? '',
        last: who.LastName ?? who.Tla ?? n,
        team: who.TeamName ?? null,
        color: who.TeamColour ? `#${who.TeamColour}` : null,
        pos: num(l.Position) ?? num(l.Line) ?? 99,
        shown: l.ShowPosition !== false,
        laps: num(l.NumberOfLaps),
        gap: kind === 'race' ? gapOf(l.GapToLeader) : gapOf(part ? stats.TimeDiffToFastest : l.TimeDiffToFastest),
        int: kind === 'race' ? gapOf(l.IntervalToPositionAhead?.Value) : gapOf(part ? stats.TimeDifftoPositionAhead : l.TimeDiffToPositionAhead),
        lastLap: timeOf(l.LastLapTime),
        bestLap: l.BestLapTime?.Value ? { s: lapSeconds(l.BestLapTime.Value), lap: num(l.BestLapTime.Lap) } : null,
        sectors: list(l.Sectors).map((s) => timeOf(s)),
        stops: num(l.NumberOfPitStops) ?? 0,
        pit: yes(l.InPit) ? 'in' : yes(l.PitOut) ? 'out' : null,
        out: yes(l.Retired) ? 'retired' : yes(l.Stopped) ? 'stopped' : null,
        tyre: now ? { c: now.Compound, age: num(now.TotalLaps) ?? 0, new: yes(now.New) } : null,
        stints: stints.map((s) => [s.Compound, num(s.TotalLaps) ?? 0, yes(s.New)]),
      };
      if (kind === 'race') {
        d.grid = num(a.GridPos);
        d.catching = yes(l.IntervalToPositionAhead?.Catching);
        if (limits[n]) d.limits = limits[n];
      }
      if (kind === 'quali') {
        d.q = list(l.BestLapTimes).map((t) => (t?.Value ? lapSeconds(t.Value) : null));
        d.knockedOut = yes(l.KnockedOut);
        d.cutoff = yes(l.Cutoff);
      }
      if (kind !== 'race') d.lap = lapOf(l, best);
      return d;
    })
    .sort((x, y) => x.pos - y.pos);

  // Where each flying lap would put the car: against everyone else's time in this part (practice:
  // the session), and whether it beats the car's own.
  if (kind !== 'race') {
    const timeIn = (d) => (part ? d.q?.[part - 1] : d.bestLap?.s) ?? null;
    for (const d of drivers) {
      const s = d.lap?.pace;
      if (s == null) continue;
      const field = drivers.filter((x) => x.n !== d.n && !x.knockedOut && timeIn(x) != null);
      // A finished lap is the time on the board, so it counts as one that improved.
      d.lap.pace = { s, pos: 1 + field.filter((x) => timeIn(x) < s).length, better: timeIn(d) == null || s <= timeIn(d) + 0.0005, done: d.lap.sectors.every(Boolean) };
    }
  }

  let fastest = null;
  for (const d of drivers) if (d.bestLap?.s && (!fastest || d.bestLap.s < fastest.s)) fastest = { n: d.n, s: d.bestLap.s, lap: d.bestLap.lap };

  // The session clock at `at`: F1 sends what was left when it last said, and whether it's running.
  const ck = raw.ExtrapolatedClock;
  let clock = null;
  if (ck?.Remaining != null) {
    const left = clockSeconds(ck.Remaining);
    const since = ck.Utc ? (at - Date.parse(ck.Utc)) / 1000 : 0;
    const running = ck.Extrapolating === true && status === 'running';
    if (left != null) clock = { left: Math.max(0, running && since > 0 ? left - since : left), running };
  }

  const w = raw.WeatherData;
  const ahead = (d, i) => (i > 0 ? drivers[i - 1] : null);
  return {
    v: 1,
    at: new Date(at).toISOString(),
    source,
    session: {
      key: info.Key ?? null,
      meeting: info.Meeting?.Name ?? null,
      name: info.Name ?? null,
      kind,
      start: startOf(info),
      status,
    },
    // When the leader started the lap: matching it to the TV picture sets the TV delay.
    lap: kind === 'race' && raw.LapCount ? { now: num(raw.LapCount.CurrentLap), of: num(raw.LapCount.TotalLaps), began: utc(list(raw.SessionData?.Series).findLast((x) => x?.Lap === num(raw.LapCount.CurrentLap))?.Utc) } : null,
    // How many go through from this part, and how many started each part.
    part: part ? { now: part, of: 3, cut: part < 3 ? (entries[part] ?? null) : null, entries } : null,
    clock,
    // The best of anyone in each sector, in seconds.
    best: kind === 'race' ? null : best,
    track: trackOf(raw, status, messages),
    weather: w ? { air: num(w.AirTemp), track: num(w.TrackTemp), rain: Number(w.Rainfall) > 0, wind: num(w.WindSpeed), humidity: num(w.Humidity) } : null,
    fastest,
    battles:
      kind === 'race' && status === 'running'
        ? drivers.flatMap((d, i) => (ahead(d, i) && d.int?.s != null && d.int.s < 1 && !d.pit && !d.out && !ahead(d, i).pit && !ahead(d, i).out ? [{ pos: d.pos, ahead: ahead(d, i).n, behind: d.n, gap: d.int.s }] : []))
        : [],
    drivers,
    messages: messages
      .filter((m) => messageKind(m) !== 'blue')
      .slice(-40)
      .reverse()
      .map((m) => ({ at: utc(m.Utc), lap: m.Lap ?? null, kind: messageKind(m), text: m.Message ?? '', cars: m.RacingNumber ? [String(m.RacingNumber)] : carsIn(m.Message ?? '') })),
    incidents: incidents(messages).slice(0, 20),
  };
}
