// GET /api/sport/fpl/rivals/<team>/<league>: how the gap to the rivals around a manager moved and
// why (src/lib/sport/fpl-review-server.mjs): captaincy, players one fielded and the other didn't,
// hits, and the moves behind it. Kept on the CDN for ten minutes.
import { getRivals } from '@/lib/sport/fpl-review-server.mjs';

export const dynamic = 'force-dynamic';

const v = 'public, s-maxage=600, stale-while-revalidate=3600';
const cached = { 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': v, 'netlify-cdn-cache-control': `${v}, durable` };
const num = (s) => (/^\d{1,10}$/.test(s) ? Number(s) : null);

export async function GET(req, { params }) {
  const id = num(params.entry);
  const league = num(params.league);
  if (!id || !league) return Response.json({ error: 'Need a team and a league' }, { status: 400, headers: { 'cache-control': 'no-store' } });
  try {
    const rivals = await getRivals(id, league);
    if (!rivals) return Response.json({ error: 'Not found on FPL' }, { status: 404, headers: cached });
    return Response.json(rivals, { headers: cached });
  } catch (e) {
    return Response.json({ error: e.message || 'FPL did not answer' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
