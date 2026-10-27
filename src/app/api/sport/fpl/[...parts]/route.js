// GET /api/sport/fpl/static | fixtures | top | season | recent | live/<gw> | entry/<team>/<gw> | league/<league>/<gw>
// Everything that changes the answer is in the path. The CDN's cache key ignores query strings on
// this site (Netlify's Next.js runtime narrows it to Next's own parameters), so ?id= would hand one
// manager's team to the next. The old ?id=&event= form still answers, for pages loaded before this
// change, but uncached.
import { getStatic, getLive, getEntry, getLeague, getFixtures, getTop, getSeason, getRecent, fplRequest } from '@/lib/sport/fpl-server.mjs';

export const dynamic = 'force-dynamic';

// Seconds the CDN may serve a response before asking us again, and how long it may keep
// serving the old one while it refreshes. Every viewer of the same URL shares the cached copy.
const CACHE = { static: [300, 3600], fixtures: [600, 3600], top: [3600, 86400], season: [600, 3600], recent: [600, 3600], live: [20, 60], entry: [60, 300], league: [90, 600] };

export async function GET(req, { params }) {
  const r = fplRequest(params.parts, new URL(req.url).searchParams);
  if (r.error) return Response.json({ error: r.error }, { status: r.status, headers: { 'cache-control': 'no-store' } });
  const headers = (fresh, stale) => (r.legacy ? { 'cache-control': 'no-store' } : cache(fresh, stale));
  try {
    let data;
    if (r.kind === 'static') data = await getStatic();
    else if (r.kind === 'fixtures') data = await getFixtures();
    else if (r.kind === 'top') data = await getTop();
    else if (r.kind === 'season') data = await getSeason();
    else if (r.kind === 'recent') data = await getRecent();
    else if (r.kind === 'live') data = await getLive(r.event);
    else data = r.kind === 'entry' ? await getEntry(r.id, r.event) : await getLeague(r.id, r.event);
    if (!data) return Response.json({ error: 'Not found on FPL' }, { status: 404, headers: headers(60, 300) });
    return Response.json(data, { headers: headers(...CACHE[r.kind]) });
  } catch (e) {
    // FPL is briefly unavailable around deadlines and while it updates; say so plainly.
    return Response.json({ error: e.message || 'FPL did not answer' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}

function cache(fresh, stale) {
  const v = `public, s-maxage=${fresh}, stale-while-revalidate=${stale}`;
  return { 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': v, 'netlify-cdn-cache-control': `${v}, durable` };
}
