// GET /api/f1/data/{season}/{name}: one file of the F1 session data that
// scripts/f1_sessions.py writes after each session and pushes to the repository's f1-data
// branch: the index, or one session such as 17-race. Read from GitHub's raw files and kept by the
// CDN for 10 minutes, so new data needs no rebuild of the site. F1_DATA_URL points it somewhere
// else (a local copy when testing).
import { cdn } from '@/lib/f1-server.mjs';

export const dynamic = 'force-dynamic';

const BASE = process.env.F1_DATA_URL || 'https://raw.githubusercontent.com/xdMikayu/matchday/f1-data/f1';
const NAME = /^(index|\d{1,2}-(fp1|fp2|fp3|sq|sprint|q|race|predict))$/;

export async function GET(_req, { params }) {
  const { season, name } = params;
  if (!/^\d{4}$/.test(season) || !NAME.test(name)) return Response.json({ error: 'Not a file' }, { status: 400, headers: { 'cache-control': 'no-store' } });
  try {
    const res = await fetch(`${BASE}/${season}/${name}.json`, { cache: 'no-store' });
    // Not written yet: say so, and ask again in five minutes.
    if (res.status === 404) return Response.json({ error: 'Not there yet' }, { status: 404, headers: cdn(300) });
    if (!res.ok) throw new Error(`F1 data ${res.status}`);
    return new Response(await res.text(), { headers: { 'content-type': 'application/json', ...cdn(600) } });
  } catch (e) {
    return Response.json({ error: e.message || 'The F1 data didn’t answer' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
