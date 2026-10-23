// GET /api/f1/live: F1's live timing now, in the shape src/lib/f1-live.mjs gives it.
// While a session is on, the CDN keeps each answer for 3 seconds, so F1 sees about one connection
// every 3 seconds however many people are watching. Otherwise it keeps it for a minute.
import { liveState } from '@/lib/f1-live-server.mjs';

export const dynamic = 'force-dynamic';

const BUSY = ['waiting', 'running', 'suspended', 'break', 'finished'];
const cdn = (s, stale) => ({
  'cache-control': 'public, max-age=0, must-revalidate',
  'cdn-cache-control': `public, s-maxage=${s}, stale-while-revalidate=${stale}`,
  'netlify-cdn-cache-control': `public, durable, s-maxage=${s}, stale-while-revalidate=${stale}`,
});

export async function GET() {
  try {
    const t = await liveState();
    // A session that hasn't started counts as on from an hour before; OpenF1 is asked less often,
    // to stay inside its limit of 60 requests a minute.
    const soon = t.session.status !== 'waiting' || Date.parse(t.session.start) - Date.now() < 3600e3;
    const on = BUSY.includes(t.session.status) && soon;
    return Response.json(t, { headers: on ? cdn(t.source === 'openf1' ? 10 : 3, 10) : cdn(60, 120) });
  } catch (e) {
    // Kept briefly too, so a failing feed isn't asked again by every viewer at once.
    return Response.json({ error: e.message || 'F1’s live timing didn’t answer' }, { status: 502, headers: cdn(5, 0) });
  }
}
