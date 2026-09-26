// GET /api/finance/prices?crypto=SOL,BTC — live prices for the portfolio: every DFM stock (AED),
// crypto (USD), AED exchange rates and gold (Malabar UAE if reachable, else spot). Public data.
import { fetchPrices } from '@/lib/finance/prices.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const wanted = (new URL(request.url).searchParams.get('crypto') || 'SOL').toUpperCase().split(',').filter((s) => /^[A-Z]{2,6}$/.test(s)).slice(0, 5);
  const prices = await fetchPrices({ crypto: wanted.length ? wanted : ['SOL'] });
  return Response.json(prices, { headers: { 'Cache-Control': 'public, max-age=120, s-maxage=300' } });
}
