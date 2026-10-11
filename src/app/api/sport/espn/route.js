// GET /api/sport/espn?u=<ESPN URL>: the old form of the relay, for pages loaded before
// /api/sport/espn/<key>. The CDN can't tell these apart by query string, so they aren't cached.
import { relayEspn } from '@/lib/sport/espn-relay.mjs';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  return relayEspn(new URL(req.url).searchParams.get('u') ?? '', { cacheable: false });
}
