// GET /api/sport/tennis/now: tournaments on the ATP and WTA tours from yesterday to a week ahead,
// for the tennis page while its section is built. ESPN's two scoreboards are about 2 MB together;
// this keeps the few fields the page shows. No query string, so the CDN's path-only key is right.
import { tennisOnNow } from '@/lib/sport/othersports.mjs';

export const dynamic = 'force-dynamic';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/tennis';
const headers = (s) => ({ 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': `public, s-maxage=${s}`, 'netlify-cdn-cache-control': `public, s-maxage=${s}, durable` });
const failed = (error) => Response.json({ error }, { status: 502, headers: { 'cache-control': 'no-store' } });

export async function GET() {
  const tours = ['ATP', 'WTA'];
  const got = await Promise.allSettled(
    tours.map(async (tour) => {
      const res = await fetch(`${ESPN}/${tour.toLowerCase()}/scoreboard`, { headers: { 'user-agent': 'Mozilla/5.0 (personal score viewer; mikaeelfaraz.com)' }, cache: 'no-store' });
      if (!res.ok) throw new Error(`ESPN ${res.status}`);
      return { tour, json: await res.json() };
    }),
  );
  const feeds = got.filter((g) => g.status === 'fulfilled').map((g) => g.value);
  if (!feeds.length) return failed('ESPN didn’t answer');
  try {
    return Response.json({ at: new Date().toISOString(), tournaments: tennisOnNow(feeds) }, { headers: headers(600) });
  } catch {
    return failed('ESPN sent something unexpected');
  }
}
