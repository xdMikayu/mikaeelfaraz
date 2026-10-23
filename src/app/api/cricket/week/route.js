// GET /api/cricket/week: internationals starting in the next week, from ESPN's per-day
// scorepanel (it has no date ranges, so one request a day), each with Matchday's pre-match read
// (par and each side's chance from the ratings). Fixtures rarely move, so the CDN keeps the answer
// for 3 hours; the page drops any that have started since.
import { upcomingInternationals } from '@/lib/cricket.mjs';
import { readMatch } from '@/lib/cricket-read.mjs';
import { modelTables } from '@/lib/cricket-data.mjs';

export const dynamic = 'force-dynamic';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/cricket/scorepanel';
const headers = (s) => ({ 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': `public, s-maxage=${s}`, 'netlify-cdn-cache-control': `public, s-maxage=${s}, durable` });
const ymd = (t) => new Date(t).toISOString().slice(0, 10).replace(/-/g, '');

export async function GET() {
  const days = Array.from({ length: 8 }, (_, i) => ymd(Date.now() + i * 864e5));
  const got = await Promise.allSettled(
    days.map(async (d) => {
      const res = await fetch(`${ESPN}?dates=${d}`, { headers: { 'user-agent': 'Mozilla/5.0 (personal score viewer; matchday.mikaeelfaraz.com)' }, cache: 'no-store' });
      if (!res.ok) throw new Error(`ESPN ${res.status}`);
      return res.json();
    }),
  );
  const feeds = got.filter((g) => g.status === 'fulfilled').map((g) => g.value);
  if (!feeds.length) return Response.json({ error: 'ESPN didn’t answer' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  try {
    const now = Date.now();
    const tables = await modelTables().catch(() => null);
    const matches = upcomingInternationals(feeds, now).map((m) => {
      const read = tables && readMatch(m, tables, now, { record: false });
      return read ? { ...m, read } : m;
    });
    return Response.json({ at: new Date(now).toISOString(), matches }, { headers: headers(3 * 3600) });
  } catch {
    return Response.json({ error: 'ESPN sent something unexpected' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
