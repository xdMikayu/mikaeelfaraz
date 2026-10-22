// POST /api/finance/signup — invite-only sign-up for the beta.
// Body: { "email": "…", "code": "…" }. A valid code (one of FINANCE_INVITE_CODES,
// comma-separated) makes Supabase email an invite link; it opens /finance/welcome,
// where the new user picks a password. Turn off "Allow new users to sign up" in
// Supabase so this is the only way in.
import { getAdmin, jsonError, HttpError, ownerOnly } from '@/lib/finance/server.mjs';
import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request) {
  try {
    const codes = String(process.env.FINANCE_INVITE_CODES || '').split(',').map((c) => c.trim()).filter((c) => c.length >= 6);
    if (ownerOnly() || !codes.length) throw new HttpError(403, 'Sign-ups are closed for now');
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const code = String(body?.code || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address');
    if (!codes.some((c) => same(c, code))) throw new HttpError(403, 'That invite code isn’t valid');
    const origin = process.env.FINANCE_SITE_URL || new URL(request.url).origin;
    const { error } = await getAdmin().auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/finance/welcome` });
    // Same answer whether or not the address already has an account, so this can't be used to probe emails.
    if (error && !/already|registered|exists/i.test(error.message)) throw error;
    return Response.json({ ok: true, message: 'Check your email for a link to finish setting up your account.' });
  } catch (err) {
    return jsonError(err);
  }
}
