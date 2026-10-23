// GET /api/news/<club>/<gameweek>: one club's press conference and fitness news before the
// next deadline (src/lib/news-route.mjs), shared by every manager through the CDN.
import { newsResponse } from '@/lib/news-route.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req, { params }) {
  return newsResponse(params.team, { cacheable: true });
}
