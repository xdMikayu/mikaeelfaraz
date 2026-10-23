// Mifolio moved to mifolio.mikaeelfaraz.com. iPhone Shortcuts and the Gmail script set up
// before the move still post to /api/finance/*, so pass those requests on unchanged
// (method, body, Authorization) until every device points at the new address. A redirect
// isn't enough: Shortcuts and Apps Script can drop the body or the token when following one.
const TARGET = process.env.MIFOLIO_API_URL || 'https://mifolio.mikaeelfaraz.com/api/';

async function forward(request, { params }) {
  const url = new URL(request.url);
  const to = `${TARGET}${params.path.map(encodeURIComponent).join('/')}${url.search}`;
  const headers = {};
  for (const h of ['authorization', 'content-type']) {
    const v = request.headers.get(h);
    if (v) headers[h] = v;
  }
  let res;
  try {
    res = await fetch(to, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: 'no-store',
    });
  } catch {
    // Not a 2xx, so the Shortcuts' queue and the Gmail script both keep the message and retry.
    return Response.json({ error: 'Mifolio can’t be reached right now', queue: 'keep' }, { status: 502 });
  }
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
  });
}

export const dynamic = 'force-dynamic';
export { forward as GET, forward as POST };
