// POST /api/finance/categorize — categorize uncategorized transactions now
// (rules first, then Claude). The same job also runs every 15 minutes from
// netlify/functions/finance-categorize.mjs.
import { authenticate, getAdmin, categorizePending, jsonError } from '@/lib/finance/server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId } = await authenticate(request);
    // Keep the batch small enough to finish inside a regular function timeout.
    const result = await categorizePending(getAdmin(), userId, { maxMerchants: 25 });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err);
  }
}
