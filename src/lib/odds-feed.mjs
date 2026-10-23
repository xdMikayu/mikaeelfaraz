// The bookmakers' prices for Premier League matches: DraftKings', as ESPN's scoreboard carries them.
// ESPN has no date ranges, so one request a day. Shared by /api/odds and the weekly
// projections snapshot (scripts/accuracy.mjs); odds.mjs turns the prices into expected goals.
import { pricedFixtures } from './odds.mjs';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard';
const UA = { 'user-agent': 'Mozilla/5.0 (personal score viewer; matchday.mikaeelfaraz.com)' };
const DAY = 864e5;
const ymd = (t) => new Date(t).toISOString().slice(0, 10).replace(/-/g, '');

/** One day's scoreboard, asked twice: ESPN now and then turns a day down. Null if it still won't answer. */
async function board(d) {
  for (let i = 0; i < 2; i++) {
    const res = await fetch(`${ESPN}?dates=${d}`, { headers: UA, cache: 'no-store' }).catch(() => null);
    if (res?.ok) return res.json().catch(() => null);
  }
  return null;
}

/** ESPN's scoreboards for the next `days` days: { events, complete } (complete: every day came through). */
export async function scoreboards(now = Date.now(), days = 10) {
  const boards = await Promise.all(Array.from({ length: days }, (_, i) => board(ymd(now + i * DAY))));
  return { events: boards.flatMap((b) => b?.events ?? []), complete: !boards.includes(null) };
}

/** The bookmakers' view of each FPL fixture priced in the next `days` days (see pricedFixtures). */
export async function bookmakersByFixture(teams, fixtures, now = Date.now(), days = 10) {
  const { events, complete } = await scoreboards(now, days);
  return { fixtures: pricedFixtures(events, teams, fixtures), complete };
}
