// GET /api/sport/fpl/review/<team>: one manager's season reviewed (src/lib/sport/fpl-review-server.mjs):
// each gameweek's points and captain, the best and costliest transfers, what each chip did. Kept on
// the CDN for ten minutes; it only changes when a gameweek's matches do.
import { getReview } from '@/lib/sport/fpl-review-server.mjs';

export const dynamic = 'force-dynamic';

const v = 'public, s-maxage=600, stale-while-revalidate=3600';
const cached = { 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': v, 'netlify-cdn-cache-control': `${v}, durable` };

export async function GET(req, { params }) {
  const id = /^\d{1,10}$/.test(params.entry) ? Number(params.entry) : null;
  if (!id) return Response.json({ error: 'Need a team' }, { status: 400, headers: { 'cache-control': 'no-store' } });
  try {
    const review = await getReview(id);
    if (!review) return Response.json({ error: 'Not found on FPL' }, { status: 404, headers: cached });
    return Response.json(review, { headers: cached });
  } catch (e) {
    return Response.json({ error: e.message || 'FPL did not answer' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
