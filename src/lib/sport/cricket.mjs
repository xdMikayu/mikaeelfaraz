// Cricket from ESPN, the football source: its "header" feed (everything on now, just finished or
// starting today) and the per-day scorepanel (fixtures). Pure functions over ESPN's JSON, so
// they can be tested. Each match comes out as:
//   { id, league: { id, name }, title, format, international, women, state, summary, start, end,
//     venue, status, session, teams: [{ id, name, short, color, runs, overs, winner, batting }] }
// state is 'pre' | 'in' | 'post'; summary is ESPN's word for it (Live, Stumps, Result, Scheduled,
// Postponed...); status is the line under the score ("Bangladesh lead by 324 runs").

/** "346 & 218/4 (68.2 ov)" → { runs: '346 & 218/4', overs: '68.2 ov' }; overs is null when absent. */
export function splitScore(score = '') {
  const m = String(score).trim().match(/^(.*?)\s*\(([^()]*)\)$/);
  return m ? { runs: m[1], overs: m[2] } : { runs: String(score).trim(), overs: null };
}

const truthy = (v) => v === true || v === 'true';
const isWomen = (format, name) => /women/i.test(format ?? '') || /\bwomen\b/i.test(name ?? '');

function team(c, battingId) {
  const t = c.team ?? c; // scorepanel nests the team; the header feed doesn't
  const { runs, overs } = splitScore(c.score);
  return {
    id: String(t.id ?? c.id),
    name: t.displayName ?? t.name ?? '',
    short: t.abbreviation ?? t.shortDisplayName ?? '',
    color: /^#[0-9a-f]{6}$/i.test(t.color ?? '') ? t.color : /^[0-9a-f]{6}$/i.test(t.color ?? '') ? `#${t.color}` : null,
    runs,
    overs,
    winner: truthy(c.winner),
    batting: battingId != null && String(battingId) === String(t.id ?? c.id),
  };
}

// "Day 3  Session 3" → "Day 3"; one-day matches have none.
const dayOf = (session) => (session?.match(/Day \d+/) ?? [null])[0];

/** Every match in ESPN's cricket header feed (/apis/personalized/v2/scoreboard/header?sport=cricket). */
export function cricketNow(json) {
  const leagues = json?.sports?.[0]?.leagues ?? [];
  return sortMatches(
    leagues.flatMap((l) =>
      (l.events ?? []).map((e) => {
        const format = e.class?.generalClassCard ?? e.eventType ?? null;
        return {
          id: String(e.id),
          league: { id: String(l.id), name: l.name ?? '' },
          title: e.title ?? e.description?.split(',')[0] ?? '',
          format,
          international: (e.class?.internationalClassId ?? '0') !== '0',
          women: isWomen(format, l.name),
          state: e.status ?? e.fullStatus?.type?.state ?? 'pre',
          summary: e.summary ?? e.fullStatus?.type?.description ?? '',
          start: e.date ?? null,
          end: e.endDate ?? null,
          venue: e.location ?? null,
          status: e.fullStatus?.longSummary ?? '',
          session: dayOf(e.fullStatus?.session),
          teams: (e.competitors ?? []).map((c) => team(c, e.fullStatus?.battingTeamId)),
        };
      }),
    ),
  );
}

/** Every match in one day's ESPN scorepanel (/apis/site/v2/sports/cricket/scorepanel?dates=YYYYMMDD). */
export function cricketDay(json) {
  return sortMatches(
    (json?.scores ?? []).flatMap((g) => {
      const l = g.leagues?.[0] ?? {};
      return (g.events ?? []).map((e) => {
        const c = e.competitions?.[0] ?? {};
        const format = c.class?.generalClassCard ?? null;
        return {
          id: String(e.id),
          league: { id: String(l.id ?? e.leagueId ?? ''), name: l.name ?? '' },
          title: c.description ?? e.shortName ?? '',
          format,
          international: (c.class?.internationalClassId ?? '0') !== '0',
          women: isWomen(format, l.name),
          state: c.status?.type?.state ?? 'pre',
          summary: c.status?.type?.description ?? '',
          start: c.date ?? e.date ?? null,
          end: c.endDate ?? e.endDate ?? null,
          venue: c.venue?.fullName ?? null,
          status: c.status?.summary ?? '',
          session: null,
          // Its linescores flag every innings a side has batted, not who's in now, so no batting side here.
          teams: (c.competitors ?? []).map((x) => team(x, null)),
        };
      });
    }),
  );
}

// The twelve Test-playing nations. Their matches lead; the associates' qualifiers follow.
const FULL = new Set(['Afghanistan', 'Australia', 'Bangladesh', 'England', 'India', 'Ireland', 'New Zealand', 'Pakistan', 'South Africa', 'Sri Lanka', 'West Indies', 'Zimbabwe']);
/** "India Women", "Australia A" and "Pakistan Under-19s" count as their nation. */
export const fullMember = (name = '') => FULL.has(name.replace(/\s+(Women|A|Under-?19s?|U19)$/i, '').trim());
/** A match between two Test-playing nations' sides. */
export const bigMatch = (m) => m.teams.length === 2 && m.teams.every((t) => fullMember(t.name));

const ORDER = { in: 0, pre: 1, post: 2 };
/**
 * Internationals first; within them, what's on now, then what's next, then results, the Test-playing
 * nations' matches ahead of the rest; then by start (latest result first).
 */
export function sortMatches(list) {
  return [...list].sort(
    (a, b) =>
      b.international - a.international ||
      (ORDER[a.state] ?? 3) - (ORDER[b.state] ?? 3) ||
      bigMatch(b) - bigMatch(a) ||
      (a.state === 'post' ? Date.parse(b.start) - Date.parse(a.start) : Date.parse(a.start) - Date.parse(b.start)),
  );
}

/** Live in the red sense: a ball could be bowled now (not stumps, a break for the day, or a delay). */
export const isLive = (m) => m.state === 'in' && /^live$/i.test(m.summary);

/**
 * The domestic and franchise leagues on now, one line each: { id, name, matches, live, results }.
 * In order of how many are live, then how many matches.
 */
export function leaguesOn(matches) {
  const by = new Map();
  for (const m of matches.filter((x) => !x.international)) {
    const l = by.get(m.league.id) ?? { id: m.league.id, name: m.league.name, matches: 0, live: 0, results: 0 };
    l.matches += 1;
    if (isLive(m)) l.live += 1;
    if (m.state === 'post') l.results += 1;
    by.set(m.league.id, l);
  }
  return [...by.values()].sort((a, b) => b.live - a.live || b.matches - a.matches);
}

/** Internationals still to start, from several days' scorepanels, once each, soonest first. */
export function upcomingInternationals(days, now = Date.now()) {
  const seen = new Map();
  for (const m of days.flatMap((d) => cricketDay(d))) {
    if (m.international && m.state === 'pre' && Date.parse(m.start) > now && !seen.has(m.id)) seen.set(m.id, m);
  }
  return [...seen.values()].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
