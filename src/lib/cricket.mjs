// Cricket from ESPN, the football source: its "header" feed (everything on now, just finished or
// starting today) and the per-day scorepanel (fixtures). Pure functions over ESPN's JSON, so
// they can be tested. Each match comes out as:
//   { id, league: { id, name }, title, format, international, women, state, summary, start, end,
//     venue, status, session, days, teams: [{ id, name, short, color, runs, overs, winner, batting }] }
// state is 'pre' | 'in' | 'post'; summary is ESPN's word for it (Live, Stumps, Result, Scheduled,
// Postponed...); status is ESPN's line under the score ("Bangladesh lead by 324 runs"); days is
// the match's length for a multi-day game. situation() works out who leads, trails or needs what,
// so nobody has to add up innings in their head.

import { kitHex } from './kit-colors.mjs';

/** "346 & 218/4 (68.2 ov)" → { runs: '346 & 218/4', overs: '68.2 ov' }; overs is null when absent. */
export function splitScore(score = '') {
  const m = String(score).trim().match(/^(.*?)\s*\(([^()]*)\)$/);
  return m ? { runs: m[1], overs: m[2] } : { runs: String(score).trim(), overs: null };
}

const truthy = (v) => v === true || v === 'true';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const isWomen = (format, name) => /women/i.test(format ?? '') || /\bwomen\b/i.test(name ?? '');

function team(c, battingId) {
  const t = c.team ?? c; // scorepanel nests the team; the header feed doesn't
  const { runs, overs } = splitScore(c.score);
  return {
    id: String(t.id ?? c.id),
    name: t.displayName ?? t.name ?? '',
    short: t.abbreviation ?? t.shortDisplayName ?? '',
    color: kitHex(t.color),
    runs,
    overs,
    winner: truthy(c.winner),
    batting: battingId != null && String(battingId) === String(t.id ?? c.id),
  };
}

// "Day 3  Session 3" → "Day 3"; one-day matches have none.
const dayOf = (session) => (session?.match(/Day \d+/) ?? [null])[0];
// "9,10,11,12,13 October 2026 (5-day match)" → 5.
const daysOf = (notes) => Number((notes ?? []).find((n) => n.type === 'matchdays')?.text?.match(/\((\d+)-day match\)/)?.[1]) || null;
// "3rd T20I (D/N)" → "3rd T20I": the start time already says when.
const tidyTitle = (t) => t.replace(/\s*\((?:D\/N|N)\)\s*$/i, '');

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
          title: tidyTitle(e.title ?? e.description?.split(',')[0] ?? ''),
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
          days: daysOf(e.notes),
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
          title: tidyTitle(c.description ?? e.shortName ?? ''),
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
          days: null,
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

/** A score is up: the first ball has been bowled (ESPN marks some matches live before it has any). */
export const started = (m) => m.teams.some((t) => t.runs);
/** Live in the red sense: a ball could be bowled now (not stumps, a break for the day, or a delay). */
export const isLive = (m) => m.state === 'in' && /^live$/i.test(m.summary) && started(m) && !/match over/i.test(m.status ?? '');

/**
 * A side's innings from its score: "346 & 223/6" → [{ runs: 346, wickets: 10 }, { runs: 223, wickets: 6 }].
 * No "/wickets" means all out; a trailing "d" is a declaration.
 */
export function inningsOf(runs = '') {
  return String(runs)
    .split('&')
    .map((part) => part.trim().match(/^(\d+)(?:\/(\d+))?\s*(d|dec)?\b/i))
    .filter(Boolean)
    .map((x) => ({ runs: Number(x[1]), wickets: x[2] == null ? 10 : Number(x[2]), declared: Boolean(x[3]) }));
}

/** Overs written cricket's way: 68.2 is 68 overs and 2 balls, 410 balls. */
export const ballsOf = (overs) => {
  const [o, b = '0'] = String(overs).split('.');
  return Number(o) * 6 + Number(b);
};

/** The bracket after a score: "15/20 ov, target 152" → { overs: '15', balls: 90, max: 120, target: 152 }. */
export function oversOf(text = '') {
  const o = String(text ?? '').match(/([\d.]+)(?:\/(\d+))?\s*ov/);
  const t = String(text ?? '').match(/target (\d+)/i);
  return { overs: o?.[1] ?? null, balls: o ? ballsOf(o[1]) : null, max: o?.[2] ? Number(o[2]) * 6 : null, target: t ? Number(t[1]) : null };
}

/**
 * What the scores mean, from the batting side's point of view, worked out from the scores shown:
 *   multi-day: how far it leads or trails (runs added up over its innings against the other's),
 *     or in the last innings how many it needs to win;
 *   one innings each: when chasing, the runs needed from the balls left; otherwise the run rate.
 * { kind, team, bat (id of the side that batted last), runs, left (wickets), innings, ... } where kind is
 *   'first' (the other side hasn't batted), 'lead', 'trail', 'level' or 'need' in a long match;
 *   'rate' (batting first), 'set' (an innings is over: the chase's target) or 'chase' in a short one;
 *   'won' when the scores already settle it but ESPN hasn't called the result yet;
 * or null when there's nothing to work out (not started or finished).
 */
export function situation(m) {
  if (m.state !== 'in' || m.teams.length !== 2) return null;
  // The side in: ESPN flags it, and only the latest innings carries an overs bracket. At a break the
  // flag can stay on the side just out, so the bracket wins when they disagree.
  const bat = m.teams.find((t) => t.batting && t.overs) ?? m.teams.find((t) => t.overs) ?? m.teams.find((t) => t.batting);
  if (!bat) return null;
  const other = m.teams.find((t) => t !== bat);
  const mine = inningsOf(bat.runs);
  const theirs = inningsOf(other.runs);
  if (!mine.length) return null;
  const now = mine[mine.length - 1];
  const out = now.wickets >= 10;
  const left = out || now.declared ? 0 : 10 - now.wickets;
  const total = (list) => list.reduce((sum, i) => sum + i.runs, 0);
  const o = oversOf(bat.overs);
  const base = { team: bat.name, bat: bat.id, left, allOut: out, declared: now.declared, innings: mine.length };

  if (/test|first-class/i.test(m.format ?? '') || m.days > 1 || mine.length > 1 || theirs.length > 1) {
    if (!theirs.length) return { ...base, kind: 'first', other: other.name, runs: now.runs };
    if (mine.length === 2 && theirs.length === 2) {
      const need = total(theirs) - total(mine) + 1;
      if (need <= 0) return { ...base, kind: 'won', margin: plural(left, 'wicket') };
      return out ? null : { ...base, kind: 'need', runs: need };
    }
    const diff = total(mine) - total(theirs);
    return { ...base, kind: diff > 0 ? 'lead' : diff < 0 ? 'trail' : 'level', runs: Math.abs(diff) };
  }

  // At the break ESPN's score line can drop the overs limit ("20 ov", not "20/20 ov"); the format
  // still says it: 20 overs a side in a T20, 50 in a one-day match.
  if (o.max == null) o.max = /T20/i.test(m.format ?? '') ? 120 : /ODI|One-Day|List A/i.test(m.format ?? '') ? 300 : null;
  const rate = o.balls ? now.runs / (o.balls / 6) : null;
  const target = o.target ?? (theirs.length === 1 ? theirs[0].runs + 1 : null);
  if (target != null) {
    const need = target - now.runs;
    const balls = o.max != null && o.balls != null ? o.max - o.balls : null;
    if (need <= 0) return { ...base, kind: 'won', margin: plural(left, 'wicket') };
    // All out or out of balls short of the target: the side that batted first has won, or it's a tie.
    if (out || balls === 0) return need === 1 ? { ...base, kind: 'tied' } : { ...base, kind: 'won', team: other.name, margin: plural(need - 1, 'run') };
    return { ...base, kind: 'chase', runs: need, balls, bowled: o.balls, target, rate, needRate: balls ? need / (balls / 6) : null };
  }
  // Batting first: all out or the overs used up means the chase's target is set.
  if (out || (o.max != null && o.balls >= o.max)) return { ...base, kind: 'set', team: other.name, runs: now.runs + 1, by: bat.name, maxOvers: o.max ? o.max / 6 : null };
  return rate == null ? null : { ...base, kind: 'rate', runs: now.runs, rate, overs: o.overs, maxOvers: o.max ? o.max / 6 : null };
}

const oneDp = (x) => (Math.round(x * 10) / 10).toFixed(1);

/**
 * situation() in plain words: { bold, rest }, e.g. bold "Bangladesh lead by 329 runs" and rest
 * ", with 4 wickets left in their second innings."
 */
export function describe(s) {
  if (!s) return null;
  const inns = `in their ${s.innings === 1 ? 'first' : 'second'} innings`;
  const where = s.allOut ? `all out ${inns}` : s.declared ? `having declared ${inns}` : `with ${plural(s.left, 'wicket')} left ${inns}`;
  switch (s.kind) {
    case 'first':
      return s.allOut || s.declared
        ? { bold: `${s.team} ${s.allOut ? 'were all out for' : 'declared on'} ${s.runs}`, rest: `. ${s.other} bat next.` }
        : { bold: `${s.team} are batting first`, rest: `, with ${plural(s.left, 'wicket')} left. ${s.other} haven’t batted yet.` };
    case 'set':
      return { bold: `${s.team} need ${plural(s.runs, 'run')} to win`, rest: s.maxOvers ? ` from ${s.maxOvers} overs.` : '.' };
    case 'won':
      return { bold: `${s.team} have won by ${s.margin}`, rest: '. The official result follows shortly.' };
    case 'tied':
      return { bold: 'The match is tied', rest: '. The official result follows shortly.' };
    case 'lead':
      return { bold: `${s.team} lead by ${plural(s.runs, 'run')}`, rest: `, ${where}.` };
    case 'trail':
      return { bold: `${s.team} trail by ${plural(s.runs, 'run')}`, rest: `, ${where}.` };
    case 'level':
      return { bold: 'The scores are level', rest: `, ${s.team} ${where}.` };
    case 'need':
      return { bold: `${s.team} need ${plural(s.runs, 'run')} to win`, rest: `, with ${plural(s.left, 'wicket')} left.` };
    case 'chase':
      return {
        bold: `${s.team} need ${plural(s.runs, 'run')}${s.balls != null ? ` from ${plural(s.balls, 'ball')}` : ''}`,
        rest: `, with ${plural(s.left, 'wicket')} left. The target is ${s.target}.${s.needRate != null && s.rate != null ? ` They need ${oneDp(s.needRate)} an over and are scoring ${oneDp(s.rate)}.` : ''}`,
      };
    case 'rate':
      return { bold: `${s.team} are scoring ${oneDp(s.rate)} runs an over`, rest: s.maxOvers ? `, with ${s.overs} of ${s.maxOvers} overs gone.` : '.' };
    default:
      return null;
  }
}

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
