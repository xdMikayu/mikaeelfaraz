// POST /api/finance/ingest
// Called by the iPhone Shortcuts automations (SIB SMS, Apple Wallet taps), the
// Gmail Apps Script (Mashreq emails) and the dashboard's bulk import.
//
// Auth: Authorization: Bearer <FINANCE_INGEST_TOKEN or Supabase session token>
// Body: one event, { events: [...] }, or plain text (treated as one message).
//   SMS/email: { "source": "sms", "text": "A txn on your Card ..." }
//   Wallet:    { "source": "wallet", "card": "Tabby Card", "merchant": "du", "amount": "AED 1.00" }
//   Statement: { "source": "statement", "account": "mashreq", "merchant": "Noon", "amount": 8.9,
//                "occurred_at": "2026-09-09T12:00:00+04:00", "external_id": "mashreq:1664390705" }
import { authenticate, getAdmin, ingestEvents, jsonError, HttpError } from '@/lib/finance/server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_EVENTS = 100;

export async function POST(request) {
  try {
    const { userId } = await authenticate(request);

    const type = request.headers.get('content-type') || '';
    let body;
    if (type.includes('application/json')) {
      body = await request.json().catch(() => {
        throw new HttpError(400, 'Body is not valid JSON');
      });
    } else {
      const text = await request.text();
      body = { source: 'text', text };
    }

    const events = Array.isArray(body?.events) ? body.events : [body];
    if (!events.length) throw new HttpError(400, 'No events');
    if (events.length > MAX_EVENTS) throw new HttpError(413, `Send at most ${MAX_EVENTS} events per request`);

    const results = await ingestEvents(getAdmin(), userId, events);
    const count = (s) => results.filter((r) => r.status === s).length;
    const first = results.find((r) => r.status === 'parsed');
    return Response.json({
      ok: true,
      parsed: count('parsed'),
      merged: count('merged'),
      duplicate: count('duplicate'),
      ignored: count('ignored'),
      unparsed: count('unparsed'),
      errors: count('error'),
      // Handy for a Shortcuts "Show Notification" step.
      message: first ? `Logged ${first.currency} ${first.amount.toFixed(2)} at ${first.merchant}` : results[0]?.reason || results[0]?.status,
      results,
    });
  } catch (err) {
    return jsonError(err);
  }
}
