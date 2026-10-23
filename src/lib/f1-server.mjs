// Jolpica requests for the F1 routes. It asks callers to keep to about four requests a second, so a
// route's requests go one after another; the CDN then keeps each answer.
const BASE = 'https://api.jolpi.ca/ergast/f1';
const UA = { 'user-agent': 'Mozilla/5.0 (personal F1 pages; matchday.mikaeelfaraz.com)' };

/** One Jolpica answer (null for a 404: a round or season it doesn't have). */
export async function jolpica(path) {
  const res = await fetch(`${BASE}/${path}.json?limit=100`, { headers: UA, cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Jolpica ${res.status}`);
  return res.json();
}

/** Several answers, one request at a time. */
export async function inTurn(paths) {
  const out = [];
  for (const p of paths) out.push(await jolpica(p));
  return out;
}

export const cdn = (s) => ({ 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': `public, s-maxage=${s}`, 'netlify-cdn-cache-control': `public, s-maxage=${s}, durable` });
export const failed = (e, what) => Response.json({ error: e.message || `${what} didn’t answer` }, { status: 502, headers: { 'cache-control': 'no-store' } });
