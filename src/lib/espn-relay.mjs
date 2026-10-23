// The server half of the ESPN relay (/api/espn): pages read ESPN directly from the browser
// and come here only when that fails (ESPN's CDN turns some clients away, and its error responses
// carry no CORS header). Limited to the read-only soccer paths the app uses.

const ALLOWED = [
  /^https:\/\/site\.api\.espn\.com\/apis\/site\/v2\/sports\/soccer\/[a-z0-9._]+\/(scoreboard|summary|teams(\/\d+\/schedule)?)(\?[\w=&.-]*)?$/,
  /^https:\/\/site\.web\.api\.espn\.com\/apis\/v2\/sports\/soccer\/[a-z0-9._]+\/standings(\?[\w=&.-]*)?$/,
];

/** Fetch an allowed ESPN URL. cacheable: let the CDN share the answer (only when the URL is in the request path). */
export async function relayEspn(u, { cacheable }) {
  if (!ALLOWED.some((re) => re.test(u))) return Response.json({ error: 'Not an allowed ESPN path' }, { status: 400 });
  try {
    const res = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (personal score viewer; matchday.mikaeelfaraz.com)' }, cache: 'no-store' });
    const body = await res.text();
    const fresh = u.includes('standings') || u.includes('schedule') ? 300 : 15;
    const v = `public, s-maxage=${fresh}, stale-while-revalidate=${fresh * 4}`;
    return new Response(body, {
      status: res.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        ...(cacheable ? { 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': v, 'netlify-cdn-cache-control': `${v}, durable` } : { 'cache-control': 'no-store' }),
      },
    });
  } catch (e) {
    return Response.json({ error: e.message || 'ESPN did not answer' }, { status: 502 });
  }
}

/** The ESPN URL from its path segment (base64url, as espnKey in espn.mjs makes it). */
export const fromEspnKey = (key) => {
  try {
    return Buffer.from(key, 'base64url').toString('utf8');
  } catch {
    return '';
  }
};
