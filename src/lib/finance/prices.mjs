// Live prices, fetched server-side (all free, no keys). Each fetcher throws on failure;
// fetchPrices() collects what it can and reports the rest as errors.
import { parseMalabarRates, spotPerGram, fillKarats } from './gold.mjs';
import { parseDfmStocks } from './portfolio.mjs';

const UA = 'Mozilla/5.0 (compatible; Mifolio/1.0)';
const get = (url, init = {}) => fetch(url, { ...init, headers: { 'User-Agent': UA, ...init.headers }, signal: AbortSignal.timeout(5000) });

/** Every DFM stock's last price (AED), from the endpoint dfm.ae's own pages use. */
export async function fetchDfm() {
  const res = await get('https://api2.dfm.ae/web/widgets/v1/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: 'Command=getstockslite',
  });
  if (!res.ok) throw new Error(`DFM ${res.status}`);
  const stocks = parseDfmStocks(await res.json());
  if (!Object.keys(stocks).length) throw new Error('DFM returned no prices');
  return stocks;
}

const COINGECKO_IDS = { SOL: 'solana', BTC: 'bitcoin', ETH: 'ethereum' };

/** { SOL: { usd, change24h }, … } from CoinGecko, falling back to Coinbase spot. */
export async function fetchCrypto(symbols = ['SOL']) {
  const ids = symbols.map((s) => COINGECKO_IDS[s]).filter(Boolean);
  try {
    const res = await get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const j = await res.json();
    const out = {};
    for (const s of symbols) {
      const q = j[COINGECKO_IDS[s]];
      if (q?.usd) out[s] = { usd: q.usd, change24h: q.usd_24h_change ?? null };
    }
    if (Object.keys(out).length) return out;
    throw new Error('CoinGecko returned nothing');
  } catch {
    const out = {};
    for (const s of symbols) {
      const res = await get(`https://api.coinbase.com/v2/prices/${s}-USD/spot`);
      const j = res.ok ? await res.json() : null;
      if (Number(j?.data?.amount) > 0) out[s] = { usd: Number(j.data.amount), change24h: null };
    }
    if (!Object.keys(out).length) throw new Error('Crypto prices unavailable');
    return out;
  }
}

/** AED → other currencies ({ PKR: 76.1, … }: 1 AED buys that many). */
export async function fetchFx() {
  const res = await get('https://open.er-api.com/v6/latest/AED');
  const j = res.ok ? await res.json() : null;
  if (j?.result !== 'success' || !j.rates) throw new Error('FX rates unavailable');
  return j.rates;
}

/** Gold spot → AED per gram by karat. */
export async function fetchGoldSpot() {
  const res = await get('https://api.gold-api.com/price/XAU');
  const j = res.ok ? await res.json() : null;
  if (!(j?.price > 0)) throw new Error('Gold spot unavailable');
  return { source: 'spot', perGram: spotPerGram(j.price), updated: j.updatedAt || new Date().toISOString(), usdPerOunce: j.price };
}

/** Malabar's UAE rate straight from Malabar; only works from a UAE connection (else null). */
export async function fetchMalabarDirect() {
  const res = await get('https://www.malabargoldanddiamonds.com/ae/malabarprice/index/currentGoldRate/', { redirect: 'manual', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  if (res.status !== 200) return null;
  const rates = parseMalabarRates((await res.json())?.data);
  if (!rates || rates.currency !== 'AED') return null;
  return { source: 'malabar', perGram: fillKarats(rates.perGram), updated: rates.updated };
}

export const MALABAR_FRESH_MS = 36 * 60 * 60 * 1000;

/** Everything a portfolio needs. `stored` is the user's saved Malabar rate row (fin_prices), if any. */
export async function fetchPrices({ crypto = ['SOL'], stored = null } = {}) {
  const errors = {};
  const settle = async (key, fn) => { try { return await fn(); } catch (e) { errors[key] = e.message; return null; } };
  const freshStored = stored && Date.now() - new Date(stored.fetched_at).getTime() < MALABAR_FRESH_MS
    ? { source: 'malabar', perGram: stored.per_gram, updated: stored.quoted_at || stored.fetched_at }
    : null;
  const [stocks, cryptoQ, fx, gold] = await Promise.all([
    settle('stocks', fetchDfm),
    settle('crypto', () => fetchCrypto(crypto)),
    settle('fx', fetchFx),
    freshStored || settle('gold', async () => (await fetchMalabarDirect().catch(() => null)) || (await fetchGoldSpot())),
  ]);
  return { stocks: stocks || {}, crypto: cryptoQ || {}, fx: fx || {}, gold: gold || null, errors, at: new Date().toISOString() };
}
