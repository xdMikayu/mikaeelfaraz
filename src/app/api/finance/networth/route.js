// POST /api/finance/networth — record today's net worth now (the scheduled job also does this).
import { authenticate, getAdmin, jsonError } from '@/lib/finance/server.mjs';
import { snapshotNetWorth } from '@/lib/finance/networth-server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId } = await authenticate(request);
    return Response.json({ ok: true, ...(await snapshotNetWorth(getAdmin(), userId)) });
  } catch (err) {
    return jsonError(err);
  }
}
