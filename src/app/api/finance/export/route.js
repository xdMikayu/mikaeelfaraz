// POST /api/finance/export — everything Mifolio stores about the signed-in user, as JSON.
// Auth: a signed-in session.
import { authenticateSession, exportUserData, getAdmin, jsonError } from '@/lib/finance/server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId } = await authenticateSession(request);
    const data = await exportUserData(getAdmin(), userId);
    return Response.json({ ok: true, exported_at: new Date().toISOString(), user_id: userId, ...data });
  } catch (err) {
    return jsonError(err);
  }
}
