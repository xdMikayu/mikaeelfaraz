import { getStatic, getLive, getEntry, getLeague } from '@/lib/sport/fpl-server.mjs';

export const dynamic = 'force-dynamic';

// Seconds the CDN may serve a response before asking us again, and how long it may keep
// serving the old one while it refreshes. Every viewer shares the cached copy.
const CACHE = { static: [300, 3600], live: [20, 60], entry: [60, 300], league: [90, 600] };

const id = (v) => (/^\d{1,10}$/.test(v ?? '') ? Number(v) : null);

export async function GET(req, { params }) {
  const kind = params.kind;
  if (!CACHE[kind]) return Response.json({ error: 'Unknown' }, { status: 404 });
  const q = new URL(req.url).searchParams;
  try {
    let data;
    if (kind === 'static') data = await getStatic();
    else {
      const event = id(q.get('event'));
      if (!event || event > 38) return Response.json({ error: 'Need a gameweek' }, { status: 400 });
      if (kind === 'live') data = await getLive(event);
      else {
        const target = id(q.get('id'));
        if (!target) return Response.json({ error: 'Need an id' }, { status: 400 });
        data = kind === 'entry' ? await getEntry(target, event) : await getLeague(target, event);
      }
    }
    if (!data) return Response.json({ error: 'Not found on FPL' }, { status: 404, headers: cache(60, 300) });
    const [fresh, stale] = CACHE[kind];
    return Response.json(data, { headers: cache(fresh, stale) });
  } catch (e) {
    // FPL is briefly unavailable around deadlines and while it updates; say so plainly.
    return Response.json({ error: e.message || 'FPL did not answer' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}

function cache(fresh, stale) {
  const v = `public, s-maxage=${fresh}, stale-while-revalidate=${stale}`;
  return { 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': v, 'netlify-cdn-cache-control': `${v}, durable` };
}
