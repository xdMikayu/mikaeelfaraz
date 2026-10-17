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
//   Queue:     a text body of JSON objects back to back (the Shortcuts queue file), e.g.
//              {"source":"alert","received_at":"2026-10-17T12:28:31+04:00","title":"Tabby","body":"..."}
//              {"source":"alert","received_at":"2026-10-17T13:02:10+04:00","title":"Tabby","body":"..."}
//              Re-sending the same file is safe. The reply's "clear" is true once every
//              event in it is stored, so the Shortcut can empty the file.
import { createHash } from 'node:crypto';
import { authenticate, getAdmin, ingestEvents, jsonError, HttpError } from '@/lib/finance/server.mjs';
import { splitJsonObjects } from '@/lib/finance/parse.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_EVENTS = 100;

// A queued alert has no id of its own; derive one from its content and time so a
// re-sent queue is recognised instead of logged twice.
function queueId(event) {
  const key = JSON.stringify([event.received_at, event.text, event.title, event.subtitle, event.body, event.card, event.merchant, event.amount]);
  return `q:${createHash('sha256').update(key).digest('hex').slice(0, 32)}`;
}

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
      const queued = splitJsonObjects(text);
      if (queued && !queued.length) return Response.json({ ok: true, parsed: 0, clear: true, message: 'Nothing queued', results: [] });
      body = queued
        ? { events: queued.map((e) => (e && typeof e === 'object' && !e.external_id && e.received_at ? { ...e, external_id: queueId(e) } : e)) }
        : { source: 'text', text };
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
      // Safe to empty a Shortcuts queue: nothing failed and nothing is half-done.
      clear: !results.some((r) => r.status === 'error' || r.inFlight),
      // Handy for a Shortcuts "Show Notification" step.
      message: first ? `Logged ${first.currency} ${first.amount.toFixed(2)} at ${first.merchant}` : results[0]?.reason || results[0]?.status,
      results,
    });
  } catch (err) {
    return jsonError(err);
  }
}
