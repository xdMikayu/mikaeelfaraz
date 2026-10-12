// GET /api/sport/odds: what the bookmakers expect from each Premier League match in the next ten days,
// from DraftKings' prices on ESPN's scoreboard (src/lib/sport/odds-feed.mjs). The margin is taken
// out, each side's expected goals are fitted to the win, draw and over/under prices, and its
// clean-sheet chance follows from those (src/lib/sport/odds.mjs). Keyed by FPL fixture id, so the
// fantasy pages and Matchday AI can use them in place of our model's rates. Matches already under
// way are left out: their prices are no longer pre-match. The CDN keeps the answer for 30 minutes
// (prices move, but slowly), or 5 when a day didn't come through.
import { scoreboards } from '@/lib/sport/odds-feed.mjs';
import { pricedFixtures } from '@/lib/sport/odds.mjs';
import { getStatic, getFixtures } from '@/lib/sport/fpl-server.mjs';

export const dynamic = 'force-dynamic';

const headers = (s) => ({ 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': `public, s-maxage=${s}`, 'netlify-cdn-cache-control': `public, s-maxage=${s}, durable` });

export async function GET() {
  const now = Date.now();
  try {
    const [{ events, complete }, st, fixtures] = await Promise.all([scoreboards(now), getStatic(), getFixtures()]);
    const out = pricedFixtures(events, st.teams, fixtures);
    return Response.json({ at: new Date(now).toISOString(), fixtures: out }, { headers: headers(complete ? 1800 : 300) });
  } catch (e) {
    return Response.json({ error: e.message || 'No prices just now' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
