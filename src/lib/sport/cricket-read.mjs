// Matchday's read on a cricket match, from the model scripts/sport/fit-cricket.mjs learns from
// Cricsheet's ball-by-ball history: par at the ground, where an innings is heading, each side's
// chances, and the ground's record (batting first and chasing, the toss, how an innings usually
// goes). Pure functions: the model's tables come in as an argument, so the server can load them
// once and the tests can pass their own.
import { findGround } from './cricket-venues.mjs';
import { projectTotal, runsLeft, chaseWin, firstWin, eloWin, ratingIn, withStrength, parFor, compKey } from './cricket-model.mjs';
import { situation, inningsOf, oversOf } from './cricket.mjs';

/**
 * The model's format for an ESPN match: 't20-male', 'odi-female', 'test-male', 'fc-male' and so on,
 * or null for cricket it has no history for (age-group and "other" matches, The Hundred).
 */
export function formatOf(m) {
  const f = String(m.format ?? '').toLowerCase();
  if (/other|hundred/.test(f) || m.teams.some((t) => /under-?\d\d|\bu\d\d\b/i.test(t.name))) return null;
  const g = m.women ? 'female' : 'male';
  if (/t20|twenty20/.test(f)) return `t20-${g}`;
  if (/odi|list a/.test(f)) return `odi-${g}`;
  if (/test/.test(f)) return `test-${g}`;
  if (/first-class/.test(f) && !m.women) return 'fc-male';
  return null;
}

// Cricsheet names women's sides without "Women"; ESPN adds it.
const bare = (name) => String(name ?? '').replace(/\s+Women$/i, '').trim();
const leagueKey = (m) => compKey({ club: true, event: m.league.name });

/**
 * The record that fits the match: the ground's record for this kind of match (internationals, or
 * this league) if it has one, otherwise for every match there. scope: 'intl', 'league' or 'all'.
 */
function recordFor(here, m) {
  const recs = here?.records ?? [];
  const pool = m.international ? 'intl' : leagueKey(m);
  const own = recs.find((r) => r.of === pool);
  const all = recs.find((r) => r.of === null) ?? (recs.length === 1 ? recs[0] : null);
  const rec = own ?? all;
  if (!rec) return null;
  const { of, ...rest } = rec;
  return { scope: own ? (m.international ? 'intl' : 'league') : 'all', ...rest };
}

/** Each side's chance from the ratings and home advantage, in m.teams order, or null if a side is unrated. */
function strengthOf(F, table, m, here) {
  const [A, B] = m.teams.map((t) => bare(t.name));
  const ra = table?.[A]?.[0];
  const rb = table?.[B]?.[0];
  if (ra == null || rb == null) return null;
  const host = here?.hosts?.[m.international ? 'intl' : leagueKey(m)];
  const home = host === A ? 1 : host === B ? -1 : 0;
  const p = eloWin(F.elo, ratingIn(F.elo, ra, A, m.international), ratingIn(F.elo, rb, B, m.international), home);
  return { chances: [p, 1 - p], home: home === 1 ? m.teams[0].name : home === -1 ? m.teams[1].name : null };
}

// "Sri Lanka won the toss and elected to bat" → the side batting first, or null.
function battingFirst(m) {
  const t = String(m.status ?? '').match(/^(.+?) won the toss and (?:elected|chose) to (bat|field|bowl)/i);
  if (!t) return null;
  const caller = m.teams.find((x) => x.name === t[1] || x.short === t[1]);
  if (!caller) return null;
  return /bat/i.test(t[2]) ? caller : m.teams.find((x) => x !== caller);
}

/** In m.teams order: p is the chance of `side`. */
const order = (m, side, p) => (m.teams[0].id === side.id ? [p, 1 - p] : [1 - p, p]);
const round = (x) => Math.round(x);

/** Where a one-day match stands for the model: the innings under way and the chances, or null. */
function oneDayNow(m, F, par, strength) {
  const N = F.balls;
  const s = situation(m);
  const sideOf = (id) => m.teams.find((t) => t.id === id);
  const strengthFor = (side) => (strength ? strength.chances[m.teams.indexOf(side)] : null);
  const blend = (p, side, rest, gamma) => {
    const st = strengthFor(side);
    return st == null ? p : withStrength(p, st, rest, gamma);
  };
  if (m.state === 'pre' || (m.state === 'in' && !s)) {
    // Before a ball: once the toss is known, the side batting first at nought for none. Without
    // ratings for both sides that says next to nothing, so then nothing is said.
    const first = battingFirst(m);
    if (!first || !strength) return null;
    const p = blend(firstWin(F.shape, F.first, { runs: 0, balls: 0, wickets: 0 }, par), first, 1, F.gamma.first);
    return { kind: 'toss', team: first.id, chances: order(m, first, p) };
  }
  if (!s) return null;
  if (s.kind === 'rate') {
    const side = sideOf(s.bat);
    const o = oversOf(side.overs);
    if (o.balls == null) return null;
    if (o.max != null && o.max !== N) return { kind: 'reduced' };
    const state = { runs: s.runs, balls: o.balls, wickets: 10 - s.left };
    const proj = projectTotal(F.shape, state, par);
    const p = blend(firstWin(F.shape, F.first, state, par), side, (2 * N - o.balls) / (2 * N), F.gamma.first);
    return { kind: 'first', team: side.id, projected: { mean: round(proj.mean), lo: round(proj.lo), hi: round(proj.hi) }, chances: order(m, side, p) };
  }
  if (s.kind === 'set' || s.kind === 'chase') {
    const side = s.kind === 'set' ? m.teams.find((t) => t.id !== s.bat) : sideOf(s.bat);
    const o = oversOf(sideOf(s.bat)?.overs);
    if (o.max != null && o.max !== N) return { kind: 'reduced' };
    const state =
      s.kind === 'set'
        ? { need: s.runs, left: N, wickets: 0, target: s.runs }
        : { need: s.runs, left: s.balls ?? N - (o.balls ?? 0), wickets: 10 - s.left, target: s.target };
    if (!(state.left > 0) || state.target == null) return null;
    const p = blend(chaseWin(F.shape, F.chase, state, par), side, state.left / (2 * N), F.gamma.chase);
    // What a side usually adds from here, whatever it needs: the yardstick for the chance.
    const usual = par * runsLeft(F.shape, state.left, state.wickets).mean;
    return { kind: 'chase', team: side.id, need: state.need, usual: round(usual), chances: order(m, side, p) };
  }
  return null;
}

/** How fourth-innings chases of this size have gone in Tests, once a side is set a target. */
function testChase(m, key, tables) {
  const s = situation(m);
  if (s?.kind !== 'need') return null;
  const side = m.teams.find((t) => t.id === s.bat);
  const scored = inningsOf(side?.runs).at(-1)?.runs ?? 0;
  const target = s.runs + scored;
  const band = tables.model.tests?.[key]?.chases?.find((b) => target >= b.from && (b.to == null || target <= b.to));
  return band?.n ? { target, ...band, since: tables.model.tests[key].since } : null;
}

/**
 * Matchday's read on one match still to finish (a cricketNow/cricketDay match), or null when there's
 * nothing to say (a finished match, or cricket the history doesn't cover):
 * { format, ground: { name, place }, record, par, pre, home, now, testChase }.
 *   record     the ground's record for this kind of match (see recordFor)
 *   par        what a first innings usually makes there in this competition (one-day matches)
 *   pre        each side's chance before a ball, from the ratings and home advantage, in m.teams order
 *   now        the match under way: { kind: 'toss' | 'first' | 'chase' | 'reduced', team, chances,
 *              projected (first innings: { mean, lo, hi }, lo and hi bracketing the middle 80%),
 *              need and usual (chase: what it needs and what a side usually adds from there) }
 *   testChase  in a Test's last innings, how chases of that size have gone
 * opts.record: false leaves the ground's record out (for lists of fixtures).
 */
export function readMatch(m, tables, now = Date.now(), opts = {}) {
  const key = formatOf(m);
  if (!key || m.teams.length !== 2 || m.state === 'post') return null;
  const g = m.venue ? findGround(tables.grounds, m.venue) : null;
  const here = g?.formats?.[key] ?? null;
  const ground = g ? { name: g.name, place: g.place } : null;
  const long = key.startsWith('test') || key === 'fc-male';
  if (long) {
    const record = opts.record === false || !here ? null : { scope: key === 'fc-male' ? 'fc' : 'intl', ...here };
    const chase = key === 'fc-male' ? null : testChase(m, key, tables);
    return record || chase ? { format: key, ground, record, testChase: chase } : null;
  }
  const F = tables.model.formats[key];
  const comp = m.international ? compKey({ club: false, teams: m.teams.map((t) => t.name) }) : leagueKey(m);
  // A league the history doesn't cover: its par would be a guess, so say nothing.
  if (!F?.levels[comp]) return null;
  const par = parFor(F, comp, here, now);
  const strength = strengthOf(F, tables.ratings.formats[key], m, here);
  return {
    format: key,
    ground,
    record: opts.record === false ? null : recordFor(here, m),
    par: round(par),
    pre: strength?.chances ?? null,
    home: strength?.home ?? null,
    now: m.state === 'post' ? null : oneDayNow(m, F, par, strength),
  };
}
