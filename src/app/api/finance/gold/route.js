// GET  /api/finance/gold — today's gold price in AED per gram (24K, 22K, 21K, 18K).
//      Malabar's UAE rate if this server can reach it; Malabar only serves it to visitors
//      in the UAE (others are redirected to their own country's store), so usually this
//      falls back to the live spot price, and says which one it is.
// POST /api/finance/gold — store Malabar's UAE rate, fetched by something in the UAE (the
//      iPhone Shortcut). Auth: Authorization: Bearer <FINANCE_INGEST_TOKEN or session token>.
//      Body: exactly what Malabar's currentGoldRate endpoint returned ({"data": "<div…"}).
import { parseMalabarRates, spotPerGram, fillKarats } from '@/lib/finance/gold.mjs';
import { authenticate, getAdmin, jsonError, HttpError } from '@/lib/finance/server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MALABAR_AE = 'https://www.malabargoldanddiamonds.com/ae/malabarprice/index/currentGoldRate/';
const SPOT = 'https://api.gold-api.com/price/XAU';
const UA = 'Mozilla/5.0 (compatible; Mifolio/1.0)';

async function malabar() {
  const res = await fetch(MALABAR_AE, { redirect: 'manual', headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest' }, signal: AbortSignal.timeout(4000) });
  if (res.status !== 200) return null;
  const rates = parseMalabarRates((await res.json())?.data);
  if (!rates || rates.currency !== 'AED') return null;
  return { source: 'malabar', label: 'Malabar Gold UAE rate', perGram: fillKarats(rates.perGram), updated: rates.updated };
}

async function spot() {
  const res = await fetch(SPOT, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Spot price unavailable (${res.status})`);
  const j = await res.json();
  if (!(j.price > 0)) throw new Error('Spot price unavailable');
  return { source: 'spot', label: 'Live spot price', perGram: spotPerGram(j.price), updated: j.updatedAt || new Date().toISOString(), usdPerOunce: j.price };
}

export async function GET() {
  try {
    const price = (await malabar().catch(() => null)) || (await spot());
    return Response.json(price, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=900' } });
  } catch (err) {
    return Response.json({ error: err.message || 'Gold price unavailable' }, { status: 502 });
  }
}

export async function POST(request) {
  try {
    const { userId } = await authenticate(request);
    const text = await request.text();
    let html = text;
    try {
      const j = JSON.parse(text);
      html = typeof j === 'string' ? j : j?.data ?? '';
    } catch {}
    const rates = parseMalabarRates(html);
    if (!rates) throw new HttpError(400, 'No gold rates found in the body');
    if (rates.currency !== 'AED') throw new HttpError(400, `Rates are in ${rates.currency}, not AED (was it fetched from outside the UAE?)`);
    const perGram = fillKarats(rates.perGram);
    const { error } = await getAdmin().from('fin_prices').upsert(
      { user_id: userId, asset: 'gold', source: 'malabar', per_gram: perGram, quoted_at: rates.updated, fetched_at: new Date().toISOString() },
      { onConflict: 'user_id,asset,source' }
    );
    if (error) throw error;
    return Response.json({ ok: true, message: `Gold 24K AED ${perGram[24]}/g`, perGram, updated: rates.updated });
  } catch (err) {
    return jsonError(err);
  }
}
