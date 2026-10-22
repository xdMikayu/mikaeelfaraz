// POST /api/finance/keys — create a personal API key for the iPhone Shortcuts or the
// Gmail script. The key is returned once; only its hash is stored. Listing and
// revoking happen in the browser (row-level security lets owners do just that).
// Auth: a signed-in session (an API key can't mint more keys).
// Body: { "name": "iPhone" }
import { authenticateSession, getAdmin, jsonError, HttpError, newApiKey } from '@/lib/finance/server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ACTIVE_KEYS = 10;

export async function POST(request) {
  try {
    const { userId } = await authenticateSession(request);
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || '').trim().slice(0, 40) || 'Shortcuts';
    const db = getAdmin();
    const { count, error: countErr } = await db.from('fin_api_keys').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('revoked_at', null);
    if (countErr) throw countErr;
    if (count >= MAX_ACTIVE_KEYS) throw new HttpError(400, `You already have ${MAX_ACTIVE_KEYS} keys. Revoke one you no longer use first.`);
    const { key, prefix, hash } = newApiKey();
    const { data, error } = await db.from('fin_api_keys').insert({ user_id: userId, name, prefix, key_hash: hash }).select('id, name, prefix, created_at').single();
    if (error) throw error;
    return Response.json({ ok: true, key, ...data });
  } catch (err) {
    return jsonError(err);
  }
}
