// GET /api/sport/cricket/now: the cricket on now, just finished or starting today, from ESPN's
// header feed (about 240 KB). This keeps the fields the page shows, internationals and domestic
// matches apart, with a line per domestic league, and Matchday's read on each match still to finish
// (par, the projected total, win chances and the ground's record). No query string, so the CDN's
// path-only key is right; it keeps an answer for 30 seconds, about the time a ball takes.
import { cricketNow, leaguesOn } from '@/lib/sport/cricket.mjs';
import { readMatch } from '@/lib/sport/cricket-read.mjs';
import { modelTables } from '@/lib/sport/cricket-data.mjs';

export const dynamic = 'force-dynamic';

const FEED = 'https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket';
const headers = (s) => ({ 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': `public, s-maxage=${s}`, 'netlify-cdn-cache-control': `public, s-maxage=${s}, durable` });
const failed = (error) => Response.json({ error }, { status: 502, headers: { 'cache-control': 'no-store' } });

export async function GET() {
  try {
    const res = await fetch(FEED, { headers: { 'user-agent': 'Mozilla/5.0 (personal score viewer; mikaeelfaraz.com)' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`ESPN ${res.status}`);
    const now = Date.now();
    // Scores come first: if the model's tables can't be read, the matches go out without a read.
    const tables = await modelTables().catch(() => null);
    const all = cricketNow(await res.json()).map((m) => {
      const read = tables && readMatch(m, tables, now);
      return read ? { ...m, read } : m;
    });
    return Response.json(
      { at: new Date(now).toISOString(), internationals: all.filter((m) => m.international), domestic: all.filter((m) => !m.international), leagues: leaguesOn(all) },
      { headers: headers(30) },
    );
  } catch (e) {
    return failed(e.message || 'ESPN didn’t answer');
  }
}
