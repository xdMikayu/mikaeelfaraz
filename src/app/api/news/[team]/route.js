// GET /api/sport/news/<club>: the old form, for pages loaded before /api/sport/news/<club>/<gameweek>.
// Without the gameweek in the path the CDN could serve last week's news, so this isn't cached.
import { newsResponse } from '@/lib/sport/news-route.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req, { params }) {
  return newsResponse(params.team, { cacheable: false });
}
