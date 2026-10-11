// GET /api/sport/f1/season: this season's F1 calendar with every session time, for the F1 page
// while its section is built. From Jolpica (api.jolpi.ca), the free successor to the Ergast API,
// which doesn't send CORS headers, so the browser can't read it directly.
import { f1Season } from '@/lib/sport/othersports.mjs';

export const dynamic = 'force-dynamic';

const headers = (s) => ({ 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': `public, s-maxage=${s}`, 'netlify-cdn-cache-control': `public, s-maxage=${s}, durable` });

export async function GET() {
  try {
    const res = await fetch('https://api.jolpi.ca/ergast/f1/current.json', { headers: { 'user-agent': 'Mozilla/5.0 (personal F1 calendar; mikaeelfaraz.com)' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`Jolpica ${res.status}`);
    return Response.json(f1Season(await res.json()), { headers: headers(6 * 3600) });
  } catch (e) {
    return Response.json({ error: e.message || 'The F1 calendar didn’t answer' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
