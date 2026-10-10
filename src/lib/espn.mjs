// ESPN's public site API, read straight from the browser (it sends Access-Control-Allow-Origin: *),
// so live scores cost no server calls at all. Everything here turns ESPN's JSON into the small
// shapes the pages use; nothing downstream touches ESPN field names.
import { xgFor } from './xg.mjs';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const WEB = 'https://site.web.api.espn.com/apis/v2/sports/soccer';

async function attempt(url, signal) {
  const res = await fetch(url, { signal, cache: 'no-store' });
  if (res.status === 400 || res.status === 404) return null; // a league or match ESPN doesn't have
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

/** Direct first; in the browser, our own /api/sport/espn relay if ESPN turns the request away. */
async function get(url, { signal } = {}) {
  try {
    return await attempt(url, signal);
  } catch (e) {
    if (e.name === 'AbortError' || typeof window === 'undefined') throw e;
    return attempt(`/api/sport/espn?u=${encodeURIComponent(url)}`, signal);
  }
}

/* ---------------------------------------------------------------- days and time */

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

/** Local calendar day "YYYY-MM-DD" for an instant, in the viewer's time zone. */
export const localDay = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * ESPN's scoreboard "day" runs 07:00 UTC to 07:00 UTC. A local day can overlap two of them
 * (Dubai's runs 20:00 to 20:00 UTC), so ask for every ESPN day it touches and filter after.
 */
export function espnDaysFor(localYmd) {
  const [y, m, d] = localYmd.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  const end = new Date(y, m - 1, d + 1).getTime() - 1;
  const out = new Set();
  for (const t of [start, end]) {
    const shifted = new Date(t - 7 * 3600e3);
    out.add(`${shifted.getUTCFullYear()}${pad(shifted.getUTCMonth() + 1)}${pad(shifted.getUTCDate())}`);
  }
  return [...out];
}

/* ---------------------------------------------------------------- matches */

const STATE_LABEL = {
  STATUS_HALFTIME: 'HT',
  STATUS_FULL_TIME: 'FT',
  STATUS_FINAL: 'FT',
  STATUS_FINAL_AET: 'AET',
  STATUS_FINAL_PEN: 'Pens',
  STATUS_END_OF_EXTRATIME: 'End of ET',
  STATUS_SHOOTOUT: 'Pens',
  STATUS_POSTPONED: 'Postp.',
  STATUS_CANCELED: 'Canc.',
  STATUS_ABANDONED: 'Aband.',
  STATUS_SUSPENDED: 'Susp.',
  STATUS_DELAYED: 'Delayed',
};

export function statusOf(status = {}) {
  const t = status.type ?? {};
  const name = t.name ?? '';
  const state = t.state ?? 'pre';
  let label = STATE_LABEL[name];
  if (!label && state === 'in') label = status.displayClock && status.displayClock !== "0'" ? status.displayClock : t.shortDetail;
  if (!label && state === 'post') label = 'FT';
  return {
    state, // pre | in | post
    name,
    label: label ?? '',
    long: t.description ?? label ?? '',
    off: ['STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_ABANDONED', 'STATUS_SUSPENDED'].includes(name),
    period: status.period ?? 0,
  };
}

const logoOf = (team) => team?.logo ?? team?.logos?.[0]?.href ?? null;

function side(c) {
  const t = c.team ?? {};
  return {
    id: String(t.id),
    name: t.displayName ?? t.name,
    short: t.shortDisplayName ?? t.displayName,
    abbr: t.abbreviation,
    logo: logoOf(t),
    color: t.color ? `#${t.color.replace('#', '')}` : null,
    alt: t.alternateColor ? `#${t.alternateColor.replace('#', '')}` : null,
    score: c.score == null ? null : Number(typeof c.score === 'object' ? c.score.value ?? c.score.displayValue : c.score),
    shootout: c.shootoutScore != null ? Number(c.shootoutScore) : null,
    winner: Boolean(c.winner),
    form: c.form ?? null,
  };
}

/** One scoreboard event (or a summary header) into a match row. */
export function normaliseMatch(e, league) {
  const comp = e.competitions?.[0] ?? e;
  const cs = comp.competitors ?? [];
  const home = side(cs.find((c) => c.homeAway === 'home') ?? cs[0] ?? {});
  const away = side(cs.find((c) => c.homeAway === 'away') ?? cs[1] ?? {});
  const status = statusOf(comp.status ?? e.status);
  const sideOf = (teamId) => (String(teamId) === home.id ? 'home' : 'away');
  const details = (comp.details ?? []).map((d) => ({
    side: sideOf(d.team?.id),
    minute: d.clock?.displayValue ?? '',
    goal: Boolean(d.scoringPlay),
    red: Boolean(d.redCard),
    og: Boolean(d.ownGoal),
    pen: Boolean(d.penaltyKick),
    shootout: Boolean(d.shootout),
    name: d.athletesInvolved?.[0]?.shortName ?? d.athletesInvolved?.[0]?.displayName ?? '',
  }));
  return {
    id: String(e.id),
    league: league ?? e.league?.slug ?? null,
    date: comp.date ?? e.date,
    status,
    home: { ...home, red: details.filter((d) => d.red && d.side === 'home').length },
    away: { ...away, red: details.filter((d) => d.red && d.side === 'away').length },
    goals: details.filter((d) => d.goal && !d.shootout),
    venue: comp.venue?.fullName ?? e.venue?.fullName ?? null,
    tv: (comp.broadcasts ?? []).flatMap((b) => b.names ?? []).slice(0, 2),
    note: comp.notes?.[0]?.headline ?? comp.altGameNote ?? null,
    recap: comp.headlines?.find((h) => h.type === 'Recap')?.shortLinkText ?? null,
  };
}

export async function fetchScoreboard(slug, espnDay, opts) {
  const url = `${SITE}/${slug}/scoreboard${espnDay ? `?dates=${espnDay}` : ''}`;
  const d = await get(url, opts);
  if (!d) return { slug, matches: [], league: null };
  const lg = d.leagues?.[0];
  return {
    slug,
    league: lg ? { name: lg.name, abbr: lg.abbreviation, logo: lg.logos?.[0]?.href ?? null, season: lg.season?.displayName } : null,
    matches: (d.events ?? []).map((e) => normaliseMatch(e, slug)),
  };
}

/** Every match on a local day across the given leagues. Failures are reported, not thrown. */
export async function fetchDay(slugs, localYmd, opts) {
  const days = espnDaysFor(localYmd);
  const jobs = slugs.flatMap((slug) => days.map((day) => ({ slug, day })));
  const results = await Promise.allSettled(jobs.map((j) => fetchScoreboard(j.slug, j.day, opts)));
  const seen = new Set();
  const matches = [];
  const failed = new Set();
  const leagues = {};
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return failed.add(jobs[i].slug);
    if (r.value.league) leagues[r.value.slug] = r.value.league;
    for (const m of r.value.matches) {
      if (seen.has(m.id) || localDay(m.date) !== localYmd) continue;
      seen.add(m.id);
      matches.push(m);
    }
  });
  matches.sort((a, b) => new Date(a.date) - new Date(b.date));
  return { matches, failed: [...failed], leagues };
}

/* ---------------------------------------------------------------- match detail */

const EVENT_KIND = [
  [/own-goal/, 'og'],
  [/penalty---scored|penalty-scored/, 'pen'],
  [/penalty---missed|penalty---saved|penalty-missed|penalty-saved/, 'pen-miss'],
  [/^goal/, 'goal'],
  [/red-card|second-yellow|yellow-red/, 'red'],
  [/yellow-card/, 'yellow'],
  [/substitution/, 'sub'],
  [/var|video/, 'var'],
  [/halftime/, 'ht'],
  [/end-regular-time|end-of-regular|full-time/, 'ft'],
  [/kickoff|start-2nd-half|start-extra|end-extra|shootout/, 'phase'],
];

const kindOf = (type = {}) => {
  const k = `${type.type ?? ''} ${(type.text ?? '').toLowerCase().replace(/[^a-z]+/g, '-')}`;
  for (const [re, kind] of EVENT_KIND) if (re.test(k)) return kind;
  return null;
};

const minuteSort = (clock = {}, period = 0) => (period || 1) * 10000 + (clock.value ?? 0);

const SHOT_KIND = {
  'shot-on-target': 'saved',
  'shot-off-target': 'off',
  'shot-blocked': 'blocked',
  goal: 'goal',
  'penalty---scored': 'goal',
  'penalty---saved': 'saved',
  'penalty---missed': 'off',
};

function shotOutcome(play) {
  const slug = play.type?.type ?? '';
  if (SHOT_KIND[slug]) return SHOT_KIND[slug];
  const t = (play.type?.text ?? '').toLowerCase();
  if (/woodwork|post|bar/.test(t)) return 'post';
  if (/goal/.test(t) && !/own/.test(t) && !/kick/.test(t)) return 'goal';
  return null;
}

/** Every shot ESPN's commentary has a position for, with our xG estimate. */
export function shotsFrom(commentary = [], keyEvents = [], sideOfName) {
  const shots = [];
  const seen = new Set();
  const plays = [...commentary.map((c) => c.play).filter(Boolean), ...keyEvents];
  for (const p of plays) {
    if (seen.has(p.id)) continue;
    const outcome = shotOutcome(p);
    if (!outcome || !Number.isFinite(p.fieldPositionX)) continue;
    if (/own-goal/.test(p.type?.type ?? '')) continue;
    seen.add(p.id);
    const text = p.text ?? '';
    shots.push({
      id: String(p.id),
      side: sideOfName(p.team),
      minute: p.clock?.displayValue ?? '',
      order: minuteSort(p.clock, p.period?.number),
      x: p.fieldPositionX,
      y: p.fieldPositionY,
      goalY: Number.isFinite(p.goalPositionY) ? p.goalPositionY : null,
      outcome,
      player: p.participants?.[0]?.athlete?.displayName ?? '',
      header: /\bheader\b/i.test(text),
      penalty: /\bpenalty\b/i.test(text),
      text,
      xg: xgFor({ x: p.fieldPositionX, y: p.fieldPositionY, text }),
    });
  }
  return shots.sort((a, b) => a.order - b.order);
}

// The stats people look for first (goals and xG sit above this list), then the rest.
const STAT_ORDER = [
  ['possessionPct', 'Possession', '%'],
  ['totalShots', 'Shots'],
  ['shotsOnTarget', 'On target'],
  ['blockedShots', 'Blocked'],
  ['wonCorners', 'Corners'],
  ['foulsCommitted', 'Fouls'],
  ['yellowCards', 'Yellow cards'],
  ['redCards', 'Red cards'],
  ['offsides', 'Offsides'],
  ['saves', 'Saves'],
  ['totalPasses', 'Passes'],
  ['passPct', 'Pass accuracy', 'pct'],
  ['totalCrosses', 'Crosses'],
  ['totalLongBalls', 'Long balls'],
  ['totalTackles', 'Tackles'],
  ['interceptions', 'Interceptions'],
  ['totalClearance', 'Clearances'],
];

function statsFrom(boxscore, homeId) {
  const teams = boxscore?.teams ?? [];
  const h = teams.find((t) => String(t.team?.id) === homeId) ?? teams[0];
  const a = teams.find((t) => t !== h);
  if (!h?.statistics?.length || !a?.statistics?.length) return [];
  const val = (t, key) => {
    const s = t.statistics.find((x) => x.name === key);
    return s ? Number(s.displayValue) : null;
  };
  return STAT_ORDER.map(([key, label, unit]) => {
    let home = val(h, key);
    let away = val(a, key);
    if (unit === 'pct' && home != null && away != null) {
      home = Math.round(home * 100);
      away = Math.round(away * 100);
    }
    return { key, label, home, away, unit: unit ? '%' : '' };
  }).filter((s) => s.home != null && s.away != null);
}

// Depth on the pitch from ESPN's position code. ESPN's codes get the side right (-L / -R) but
// not always the line (holding midfielders in a 4-2-3-1 come through as LM / RM), so depth only
// orders players; the formation string decides where each line ends.
const DEPTH = { G: 0, GK: 0, CD: 1, 'CD-L': 1, 'CD-R': 1, RB: 1, LB: 1, D: 1, SW: 1, RWB: 1.5, LWB: 1.5, DM: 2, 'DM-L': 2, 'DM-R': 2, CM: 3, 'CM-L': 3, 'CM-R': 3, RM: 3, LM: 3, M: 3, AM: 4, 'AM-L': 4, 'AM-R': 4, RW: 4.5, LW: 4.5, CF: 5, 'CF-L': 5, 'CF-R': 5, F: 5, ST: 5, S: 5 };
// Wide positions (LB, RM, LW...) sit outside central ones with a side suffix (CD-L, CM-R).
const lateral = (pos = '') => (/^L/.test(pos) ? -2 : /-L$/.test(pos) ? -1 : /^R/.test(pos) ? 2 : /-R$/.test(pos) ? 1 : 0);

/** Starters split into lines (GK first) for drawing a formation; null if the data won't fit. */
export function formationLines(starters, formation) {
  const counts = String(formation ?? '').split('-').map(Number).filter((n) => n > 0);
  if (starters.length !== 11 || counts.reduce((a, b) => a + b, 0) !== 10) return null;
  const sorted = [...starters].sort((a, b) => (DEPTH[a.pos] ?? 3) - (DEPTH[b.pos] ?? 3) || a.place - b.place);
  const lines = [sorted.slice(0, 1)];
  let i = 1;
  for (const n of counts) {
    // Left to right as seen attacking up the page: the player's left is the viewer's left.
    lines.push(sorted.slice(i, i + n).sort((a, b) => lateral(a.pos) - lateral(b.pos) || a.place - b.place));
    i += n;
  }
  return lines;
}

function lineupFrom(roster, events) {
  if (!roster?.roster?.length) return null;
  const stat = (p, name) => Number(p.stats?.find((s) => s.name === name)?.value ?? 0);
  const players = roster.roster.map((p) => {
    const id = String(p.athlete?.id);
    const subOn = events.find((e) => e.kind === 'sub' && e.playerIds?.[0] === id);
    const subOff = events.find((e) => e.kind === 'sub' && e.playerIds?.[1] === id);
    return {
      id,
      name: p.athlete?.displayName,
      short: p.athlete?.shortName ?? p.athlete?.displayName,
      last: p.athlete?.lastName || p.athlete?.displayName,
      jersey: p.jersey ?? '',
      pos: p.position?.abbreviation ?? '',
      posName: p.position?.displayName ?? '',
      place: Number(p.formationPlace ?? 0),
      starter: Boolean(p.starter),
      on: subOn?.minute ?? (p.subbedIn ? '' : null),
      off: subOff?.minute ?? (p.subbedOut ? '' : null),
      goals: stat(p, 'totalGoals'),
      assists: stat(p, 'goalAssists'),
      yellow: stat(p, 'yellowCards'),
      red: stat(p, 'redCards'),
      og: stat(p, 'ownGoals'),
    };
  });
  const starters = players.filter((p) => p.starter).sort((a, b) => a.place - b.place);
  return {
    formation: roster.formation ?? null,
    starters,
    lines: formationLines(starters, roster.formation),
    bench: players.filter((p) => !p.starter),
  };
}

function eventsFrom(keyEvents = [], sideOfId) {
  return keyEvents
    .map((e) => {
      const kind = kindOf(e.type);
      if (!kind) return null;
      const names = (e.participants ?? []).map((p) => p.athlete?.displayName).filter(Boolean);
      return {
        id: String(e.id),
        kind,
        side: e.team ? sideOfId(e.team.id) : null,
        minute: e.clock?.displayValue ?? '',
        order: minuteSort(e.clock, e.period?.number),
        period: e.period?.number ?? 0,
        players: names,
        playerIds: (e.participants ?? []).map((p) => String(p.athlete?.id)),
        text: e.text ?? e.type?.text ?? '',
        wallclock: e.wallclock ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
}

/** Running score after each goal, so the timeline can print "1–0" beside it. */
function withScores(events) {
  let h = 0;
  let a = 0;
  return events.map((e) => {
    if (['goal', 'pen', 'og'].includes(e.kind) && e.side) {
      if (e.side === 'home') h += 1;
      else a += 1;
      return { ...e, score: [h, a] };
    }
    return e;
  });
}

function formFrom(lastFive = [], teamId) {
  const t = lastFive.find((x) => String(x.team?.id) === teamId);
  return (t?.events ?? []).slice(0, 5).map((g) => ({
    id: String(g.id),
    result: g.gameResult,
    // ESPN gives the score home-first; show it from this team's side.
    score: String(g.homeTeamId) === teamId ? g.score : String(g.score ?? '').split('-').reverse().join('-'),
    date: g.gameDate,
    home: String(g.homeTeamId) === teamId,
    opponent: g.opponent?.abbreviation ?? g.opponent?.displayName,
    league: g.leagueAbbreviation,
  }));
}

export async function fetchMatch(slug, id, opts) {
  const d = await get(`${SITE}/${slug}/summary?event=${id}`, opts);
  if (!d?.header) return null;
  // 'all' works for any match id; the header then says which competition it belongs to.
  const match = normaliseMatch({ ...d.header, id }, d.header.league?.slug ?? slug);
  match.leagueName = d.header.league?.name ?? null;
  match.round = d.header.competitions?.[0]?.notes?.[0]?.headline ?? null;
  const homeName = match.home.name;
  const sideOfId = (tid) => (String(tid) === match.home.id ? 'home' : 'away');
  const sideOfName = (team) => (team?.id ? sideOfId(team.id) : team?.displayName === homeName ? 'home' : 'away');
  const events = withScores(eventsFrom(d.keyEvents, sideOfId));
  const rosters = d.rosters ?? [];
  const rHome = rosters.find((r) => r.homeAway === 'home');
  const rAway = rosters.find((r) => r.homeAway === 'away');
  const commentary = (d.commentary ?? [])
    .filter((c) => c.text)
    .map((c) => ({ seq: c.sequence ?? 0, minute: c.time?.displayValue ?? '', text: c.text, kind: c.play ? kindOf(c.play.type) : null }))
    .sort((a, b) => b.seq - a.seq);
  const shots = shotsFrom(d.commentary, d.keyEvents, sideOfName);
  const gi = d.gameInfo ?? {};
  return {
    match,
    events,
    shots,
    hasShotData: (d.commentary ?? []).length > 0,
    stats: statsFrom(d.boxscore, match.home.id),
    lineups: { home: lineupFrom(rHome, events), away: lineupFrom(rAway, events) },
    commentary,
    form: { home: formFrom(d.lastFiveGames, match.home.id), away: formFrom(d.lastFiveGames, match.away.id) },
    h2h: (d.headToHeadGames?.[0]?.events ?? d.seasonseries?.[0]?.events ?? []).slice(0, 5).map((g) => {
      const hc = g.competitors?.find((c) => c.homeAway === 'home');
      const ac = g.competitors?.find((c) => c.homeAway === 'away');
      return { id: String(g.id), date: g.date, home: hc?.team?.abbreviation, away: ac?.team?.abbreviation, hs: hc?.score, as: ac?.score };
    }),
    info: {
      venue: gi.venue?.fullName ?? match.venue,
      city: gi.venue?.address?.city ?? null,
      attendance: gi.attendance ?? null,
      referee: gi.officials?.find((o) => /referee/i.test(o.position?.displayName ?? o.position?.name ?? ''))?.displayName ?? gi.officials?.[0]?.displayName ?? null,
    },
  };
}

/* ---------------------------------------------------------------- tables and teams */

export async function fetchStandings(slug, opts) {
  const d = await get(`${WEB}/${slug}/standings`, opts);
  if (!d) return null;
  const groups = (d.children ?? []).map((ch) => ({
    name: d.children.length > 1 ? ch.name : null,
    rows: (ch.standings?.entries ?? []).map((e) => {
      const s = Object.fromEntries((e.stats ?? []).map((x) => [x.name, x.displayValue]));
      return {
        id: String(e.team?.id),
        name: e.team?.displayName,
        short: e.team?.shortDisplayName ?? e.team?.displayName,
        abbr: e.team?.abbreviation,
        logo: logoOf(e.team),
        rank: Number(s.rank ?? 0),
        p: Number(s.gamesPlayed ?? 0),
        w: Number(s.wins ?? 0),
        d: Number(s.ties ?? 0),
        l: Number(s.losses ?? 0),
        gf: Number(s.pointsFor ?? 0),
        ga: Number(s.pointsAgainst ?? 0),
        gd: Number(String(s.pointDifferential ?? '0').replace('+', '')),
        pts: Number(s.points ?? 0),
        deduction: s.deductions ? Number(s.deductions) : 0,
        zone: e.note?.description ?? null,
      };
    }).sort((a, b) => a.rank - b.rank),
  }));
  return { season: d.children?.[0]?.name ?? d.name, groups };
}

export async function fetchTeam(slug, teamId, opts) {
  let [past, next] = await Promise.all([
    get(`${SITE}/all/teams/${teamId}/schedule`, opts),
    get(`${SITE}/${slug}/teams/${teamId}/schedule?fixture=true`, opts),
  ]);
  // Arriving from a cup tie, `slug` is the cup; fixtures should come from the team's own league,
  // the competition most of its results are in.
  const count = {};
  for (const e of past?.events ?? []) {
    const l = e.league?.slug;
    if (l && !/friendly|charity|cup|champions|europa|nations|world/.test(l)) count[l] = (count[l] ?? 0) + 1;
  }
  const home = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (home && home !== slug) {
    next = (await get(`${SITE}/${home}/teams/${teamId}/schedule?fixture=true`, opts).catch(() => null)) ?? next;
    slug = home;
  }
  if (!past && !next) return null;
  const team = past?.team ?? next?.team ?? {};
  const map = (e) => normaliseMatch(e, e.league?.slug ?? slug);
  const results = (past?.events ?? []).map(map).filter((m) => m.status.state === 'post').sort((a, b) => new Date(b.date) - new Date(a.date));
  const fixtures = (next?.events ?? []).map(map).filter((m) => m.status.state !== 'post').sort((a, b) => new Date(a.date) - new Date(b.date));
  return {
    league: slug,
    team: { id: String(team.id ?? teamId), name: team.displayName, abbr: team.abbreviation, logo: team.logo ?? logoOf(team), color: team.color ? `#${team.color}` : null, standing: team.standingSummary ?? null, record: team.recordSummary ?? null },
    results,
    fixtures,
  };
}

/** Crest at a small size from ESPN's image resizer (the originals are 500 px). */
export const crest = (url, size = 40) =>
  url ? `https://a.espncdn.com/combiner/i?img=${encodeURIComponent(new URL(url).pathname)}&w=${size * 2}&h=${size * 2}` : null;

/** Clubs in a competition, for picking teams to follow. */
export async function fetchTeams(slug, opts) {
  const d = await get(`${SITE}/${slug}/teams`, opts);
  const list = d?.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return list
    .map(({ team: t }) => ({ id: String(t.id), name: t.displayName, short: t.shortDisplayName ?? t.displayName, logo: logoOf(t) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
