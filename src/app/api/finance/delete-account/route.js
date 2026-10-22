// POST /api/finance/delete-account — permanently delete the signed-in user's account
// and every row of their data. Auth: a signed-in session. Body: { "confirm": "DELETE" }
//
// On Mifolio's own Supabase project this deletes the login itself; every table
// references auth.users with ON DELETE CASCADE, so all data goes with it. While the
// site still points at a shared project (ownerOnly), the login belongs to other apps
// too, so only the Mifolio data is deleted and the login is left alone.
import { authenticateSession, getAdmin, jsonError, HttpError, ownerOnly, USER_TABLES } from '@/lib/finance/server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId } = await authenticateSession(request);
    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== 'DELETE') throw new HttpError(400, 'Type DELETE to confirm');
    const db = getAdmin();
    if (ownerOnly()) {
      for (const table of [...USER_TABLES].reverse().concat('fin_api_keys')) {
        const { error } = await db.from(table).delete().eq('user_id', userId);
        if (error) throw error;
      }
      return Response.json({ ok: true, deleted: 'data' });
    }
    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) throw error;
    return Response.json({ ok: true, deleted: 'account' });
  } catch (err) {
    return jsonError(err);
  }
}
