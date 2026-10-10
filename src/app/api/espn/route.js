// Fallback only: pages read ESPN directly from the browser and come here when that fails
// (ESPN's CDN turns some clients away, and its error responses carry no CORS header).
// Limited to the read-only soccer paths the app uses; the CDN shares each answer between viewers.
export const dynamic = 'force-dynamic';

const ALLOWED = [
  /^https:\/\/site\.api\.espn\.com\/apis\/site\/v2\/sports\/soccer\/[a-z0-9._]+\/(scoreboard|summary|teams(\/\d+\/schedule)?)(\?[\w=&.-]*)?$/,
  /^https:\/\/site\.web\.api\.espn\.com\/apis\/v2\/sports\/soccer\/[a-z0-9._]+\/standings(\?[\w=&.-]*)?$/,
];

export async function GET(req) {
  const u = new URL(req.url).searchParams.get('u') ?? '';
  if (!ALLOWED.some((re) => re.test(u))) return Response.json({ error: 'Not an allowed ESPN path' }, { status: 400 });
  try {
    const res = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (personal score viewer; mikaeelfaraz.com)' }, cache: 'no-store' });
    const body = await res.text();
    const fresh = u.includes('standings') || u.includes('schedule') ? 300 : 15;
    const v = `public, s-maxage=${fresh}, stale-while-revalidate=${fresh * 4}`;
    return new Response(body, {
      status: res.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate',
        'cdn-cache-control': v,
        'netlify-cdn-cache-control': `${v}, durable`,
      },
    });
  } catch (e) {
    return Response.json({ error: e.message || 'ESPN did not answer' }, { status: 502 });
  }
}
