// GET /api/sport/fpl/record: our track record (src/lib/sport/record.mjs), graded on request, so a
// gameweek shows within minutes of its last match ending instead of at the weekly job's next run.
// The saved projections ship with the route (next.config.mjs). Weeks the job has already graded final
// come from its committed copy; only the rest are fetched from FPL.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getStatic, getLive } from '@/lib/sport/fpl-server.mjs';
import { buildRecord } from '@/lib/sport/record.mjs';

export const dynamic = 'force-dynamic';

const SNAP = join(process.cwd(), 'data/sport/projections');
const KEPT = join(process.cwd(), 'public/sport/data/pl/accuracy.json');
const json = (path) => readFile(path, 'utf8').then(JSON.parse);

export async function GET() {
  try {
    const files = (await readdir(SNAP)).filter((f) => /^gw\d+\.json$/.test(f));
    const [snaps, kept, st] = await Promise.all([Promise.all(files.map((f) => json(join(SNAP, f)))), json(KEPT).catch(() => null), getStatic()]);
    const record = await buildRecord({ snaps, st, live: getLive, kept: kept?.weeks ?? [] });
    // Two minutes on the CDN: every viewer shares one grading, and a finished week is never far behind.
    const v = 'public, s-maxage=120, stale-while-revalidate=600';
    return Response.json(record, { headers: { 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': v, 'netlify-cdn-cache-control': `${v}, durable` } });
  } catch (e) {
    // The page falls back to the committed copy.
    return Response.json({ error: e.message || 'FPL did not answer' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
