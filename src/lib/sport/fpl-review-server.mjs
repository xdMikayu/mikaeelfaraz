// Server side of the season review and the league's gaps (fpl-history.mjs does the counting): what
// FPL keeps for a manager and their rivals, fetched with finished gameweeks kept for hours. Read by
// /api/sport/fpl/review, /api/sport/fpl/rivals and Matchday AI's chat.
import { getStatic, getFixtures, getEntry, getPicks, getLive, getTransfers, getStandings } from './fpl-server.mjs';
import { seasonSoFar, chipWhatIf, rivalGap, chipsLeft, chipsUntil, CHIP_NAMES } from './fpl-history.mjs';

/** The season's clock: the players, the gameweeks whose matches are all over, and the one being played. */
export async function seasonClock() {
  const [st, fixtures] = await Promise.all([getStatic(), getFixtures()]);
  const over = (g) => {
    const fx = fixtures.filter((f) => f.event === g);
    return fx.length > 0 && fx.every((f) => f.finished || f.finishedProvisional);
  };
  const done = st.events.filter((e) => e.finished || over(e.id)).map((e) => e.id);
  const current = st.events.find((e) => e.current && !done.includes(e.id))?.id ?? null;
  return { st, els: Object.fromEntries(st.elements.map((e) => [e.id, e])), done, current };
}

const liveFor = (done) => (gw) => getLive(gw, done.includes(gw) ? 6 * 3600e3 : 30e3);
const fold = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** The next deadline's gameweek, whose chip window counts for what's left; null once the season's over. */
const nextGw = (st, now = Date.now()) => st.events.find((e) => Date.parse(e.deadline) > now)?.id ?? null;
/** The chips a manager can still play in that window, by name. */
const chipsLeftNow = (entry, st) => (nextGw(st) ? chipsLeft(entry.chips ?? [], nextGw(st), st.chips).map((c) => CHIP_NAMES[c]) : null);

/** One manager's season reviewed (fpl-history seasonSoFar), with what each chip they've played did. */
export async function getReview(id, clock = null) {
  const { st, els, done, current } = clock ?? (await seasonClock());
  const [entry, transfers] = await Promise.all([getEntry(id, st.current), getTransfers(id)]);
  if (!entry) return null;
  const loaders = { picks: (gw) => getPicks(id, gw), live: liveFor(done) };
  const season = await seasonSoFar({ entry, transfers, els, loaders, done, current });
  const chips = [];
  for (const c of entry.chips ?? []) {
    const r = await chipWhatIf({ chip: c.name, gw: c.event, entry, els, loaders, done, current });
    if (r.error) continue;
    chips.push({ chip: CHIP_NAMES[c.name], gw: c.event, gain: r.totals?.difference ?? r.gainedByTheChip, ...(r.comparedOver ? { over: r.comparedOver } : null), ...(r.stillBeingPlayed ? { stillBeingPlayed: true } : null) });
  }
  return { ...season, chips, through: Math.max(0, ...done), at: new Date().toISOString() };
}

const managerOf = async (id, st) => {
  const [entry, transfers] = await Promise.all([getEntry(id, st.current), getTransfers(id)]);
  return { id, entry, transfers };
};

/**
 * One rival against the manager (fpl-history rivalGap): since `from` if asked, otherwise since just
 * after the last finished gameweek the manager ended level with or ahead of them, over at most eight;
 * a rival they're still ahead of, or were never ahead of, over the last four.
 */
async function rivalReport({ me, row, clock, from: asked = null }) {
  const { st, els, done, current } = clock;
  const [entry, transfers] = await Promise.all([getEntry(row.entry, st.current), getTransfers(row.entry)]);
  if (!entry || !me.entry) return null;
  const last = Math.max(0, ...done);
  const totalAt = (e, g) => (g === 0 ? 0 : (e.history.find((h) => h.event === g)?.total ?? null));
  const gap = (g) => (totalAt(entry, g) ?? 0) - (totalAt(me.entry, g) ?? 0);
  const level = done.filter((g) => g < last && gap(g) <= 0 && totalAt(me.entry, g) != null && totalAt(entry, g) != null).at(-1);
  const ahead = gap(last) > 0;
  const from = asked != null ? Math.min(Math.max(asked, 1), last) : Math.max(ahead && level != null ? level + 1 : last - 3, last - 7, 1);
  const weeks = done.filter((g) => g >= from && g <= last);
  if (!weeks.length) return null;
  const why = await rivalGap({ me: { entry: me.entry, transfers: me.transfers, picks: (g) => getPicks(me.id, g) }, rival: { entry, transfers, picks: (g) => getPicks(row.entry, g) }, weeks, live: liveFor(done), els });
  // The gameweek under way moves the live table too: what it's done to the gap so far.
  const net = (e, g) => {
    const h = e.history.find((x) => x.event === g);
    return h ? h.points - (h.hit ?? 0) : null;
  };
  const live = current != null && net(entry, current) != null && net(me.entry, current) != null ? { gw: current, gained: net(entry, current) - net(me.entry, current) } : null;
  const left = chipsLeftNow(entry, st);
  return {
    entry: row.entry,
    team: row.team,
    manager: row.manager,
    rank: row.rank,
    gapNow: gap(last),
    since: from,
    gapBefore: gap(from - 1),
    ...(asked == null && ahead && level != null && level + 1 === from ? { sinceYouLed: true } : null),
    ...why,
    ...(left ? { chipsLeft: left } : null),
    ...(live ? { thisGameweekSoFar: live } : null),
  };
}

/**
 * The league's gaps from one manager's seat: the rivals just above them in the live table (up to
 * three, nearest first), or when they lead, the two just behind, each with how the gap moved and why.
 */
export async function getRivals(id, leagueId, clock = null) {
  const c = clock ?? (await seasonClock());
  const standings = await getStandings(leagueId);
  if (!standings) return null;
  const mine = standings.rows.find((r) => r.entry === id);
  if (!mine) return { league: standings.name, rivals: [], note: 'You’re outside the first 50 of this league, so it can’t be compared.' };
  const above = standings.rows.filter((r) => r.rank < mine.rank).slice(-3);
  const picked = above.length ? above.reverse() : standings.rows.filter((r) => r.rank > mine.rank).slice(0, 2);
  const me = await managerOf(id, c.st);
  const rivals = (await Promise.all(picked.map((row) => rivalReport({ me, row, clock: c })))).filter(Boolean);
  const left = me.entry ? chipsLeftNow(me.entry, c.st) : null;
  const gw = nextGw(c.st);
  return {
    league: standings.name,
    you: { rank: mine.rank, team: mine.team, ...(left ? { chipsLeft: left } : null) },
    through: Math.max(0, ...c.done),
    ...(gw ? { chipsUntil: chipsUntil(gw, c.st.chips) } : null),
    rivals,
    at: new Date().toISOString(),
  };
}

/**
 * Any manager in the league's first 50, found by team or manager name (or part of either), against
 * the manager: since gameweek `from` if given, otherwise over the weeks getRivals would pick.
 * Matchday AI's compare_with_rival.
 */
export async function getRivalGap(id, leagueId, query, { from = null } = {}, clock = null) {
  const c = clock ?? (await seasonClock());
  const standings = await getStandings(leagueId);
  if (!standings) return { error: 'FPL didn’t return the league' };
  const q = fold(String(query ?? ''));
  const others = standings.rows.filter((r) => r.entry !== id);
  const row = q ? (others.find((r) => fold(r.team) === q || fold(r.manager) === q) ?? others.find((r) => fold(r.team).includes(q) || fold(r.manager).includes(q))) : null;
  if (!row) return { error: `Nobody called "${query}" in the first 50 of ${standings.name}`, managers: others.slice(0, 30).map((r) => `${r.rank}. ${r.team} (${r.manager})`) };
  const me = await managerOf(id, c.st);
  const report = await rivalReport({ me, row, clock: c, from });
  if (!report) return { error: 'There are no finished gameweeks to compare yet' };
  const mine = standings.rows.find((r) => r.entry === id);
  return { league: standings.name, yourRank: mine?.rank ?? null, through: Math.max(0, ...c.done), ...report };
}
