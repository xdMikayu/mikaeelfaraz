// GET /api/sport/cricket/now: the cricket on now, just finished or starting today, from ESPN's
// header feed (about 240 KB). This keeps the internationals in full and one line per domestic
// league. No query string, so the CDN's path-only key is right; it keeps an answer for 30
// seconds, about the time a ball takes.
import { cricketNow, leaguesOn } from '@/lib/sport/cricket.mjs';

export const dynamic = 'force-dynamic';

const FEED = 'https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket';
const headers = (s) => ({ 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': `public, s-maxage=${s}`, 'netlify-cdn-cache-control': `public, s-maxage=${s}, durable` });
const failed = (error) => Response.json({ error }, { status: 502, headers: { 'cache-control': 'no-store' } });

export async function GET() {
  try {
    const res = await fetch(FEED, { headers: { 'user-agent': 'Mozilla/5.0 (personal score viewer; mikaeelfaraz.com)' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`ESPN ${res.status}`);
    const all = cricketNow(await res.json());
    return Response.json({ at: new Date().toISOString(), internationals: all.filter((m) => m.international), leagues: leaguesOn(all) }, { headers: headers(30) });
  } catch (e) {
    return failed(e.message || 'ESPN didn’t answer');
  }
}
