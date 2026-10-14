// GET /api/sport/f1/round/{season}/{round}: one weekend's race, sprint and qualifying
// classifications from Jolpica. Both numbers are in the path, so the CDN's path-only key tells
// rounds apart. A weekend that's over and done keeps for a day; one still in play for 10 minutes.
import { roundOf } from '@/lib/sport/f1.mjs';
import { inTurn, cdn, failed } from '@/lib/sport/f1-server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const { season, round } = params;
  if (!/^\d{4}$/.test(season) || !/^\d{1,2}$/.test(round)) return Response.json({ error: 'Not a round' }, { status: 400, headers: { 'cache-control': 'no-store' } });
  try {
    const [results, sprint, qualifying] = await inTurn([`${season}/${round}/results`, `${season}/${round}/sprint`, `${season}/${round}/qualifying`]);
    const out = roundOf(results, sprint, qualifying);
    const raceDay = Date.parse(results?.MRData?.RaceTable?.Races?.[0]?.date ?? '');
    const settled = out.race && Number.isFinite(raceDay) && Date.now() - raceDay > 2 * 864e5;
    return Response.json({ at: new Date().toISOString(), ...out }, { headers: cdn(settled ? 86400 : 600) });
  } catch (e) {
    return failed(e, 'Jolpica');
  }
}
