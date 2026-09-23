// POST /api/finance/insights — a short Claude-written read of the spending
// summary the dashboard sends (totals, category and merchant breakdowns).
import { authenticate, jsonError, HttpError } from '@/lib/finance/server.mjs';
import { aiEnabled, spendingInsights } from '@/lib/finance/ai.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await authenticate(request);
    if (!aiEnabled()) throw new HttpError(503, 'Set ANTHROPIC_API_KEY in Netlify to enable AI insights');
    const summary = await request.json();
    const raw = JSON.stringify(summary);
    if (raw.length > 60_000) throw new HttpError(413, 'Summary too large');
    const text = await spendingInsights(summary);
    return Response.json({ ok: true, text });
  } catch (err) {
    return jsonError(err);
  }
}
