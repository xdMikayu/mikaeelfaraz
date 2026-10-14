// GET /api/sport/f1/standings: both championships and who won each round so far (races and
// sprints), from Jolpica. Results land there a while after each session, so the CDN keeps the
// answer for 15 minutes.
import { standingsOf, winnersOf } from '@/lib/sport/f1.mjs';
import { inTurn, cdn, failed } from '@/lib/sport/f1-server.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [ds, cs, wins, sprints] = await inTurn(['current/driverstandings', 'current/constructorstandings', 'current/results/1', 'current/sprint/1']);
    return Response.json(
      { at: new Date().toISOString(), ...standingsOf(ds, cs), winners: winnersOf(wins), sprintWinners: winnersOf(sprints, 'SprintResults') },
      { headers: cdn(900) },
    );
  } catch (e) {
    return failed(e, 'Jolpica');
  }
}
