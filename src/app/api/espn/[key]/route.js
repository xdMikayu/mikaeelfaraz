// GET /api/espn/<base64url ESPN URL>: the ESPN relay, cached per URL at the CDN
// (src/lib/espn-relay.mjs). The URL is in the path because the CDN ignores query strings.
import { relayEspn, fromEspnKey } from '@/lib/espn-relay.mjs';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  return relayEspn(fromEspnKey(params.key ?? ''), { cacheable: true });
}
