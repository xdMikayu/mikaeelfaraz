// Net worth: holdings of every kind valued in AED (and USD), minus what the credit cards owe.
// Pure functions; prices come from prices.mjs (server) or /api/finance/prices (browser).

import { valueHoldings as valueGold } from './gold.mjs';

export const AED_PER_USD = 3.6725; // pegged

export const ASSET_KINDS = {
  cash: { label: 'Cash', plural: 'Bank accounts' },
  stock: { label: 'Stock', plural: 'DFM stocks' },
  crypto: { label: 'Crypto', plural: 'Crypto' },
  gold: { label: 'Gold', plural: 'Gold' },
};
export const KIND_ORDER = ['cash', 'stock', 'crypto', 'gold'];

export const CASH_CURRENCIES = ['AED', 'USD', 'PKR', 'EUR', 'GBP', 'SAR', 'INR'];
export const CRYPTO = { SOL: 'Solana', BTC: 'Bitcoin', ETH: 'Ethereum' };

/** DFM's "getstockslite" list → { EMAAR: { price, change, changePct }, … } (untraded symbols dropped). */
export function parseDfmStocks(list) {
  const out = {};
  for (const s of Array.isArray(list) ? list : []) {
    if (!s?.id || !(Number(s.p) > 0)) continue;
    out[String(s.id).toUpperCase()] = { price: Number(s.p), change: Number(s.c) || 0, changePct: Number(s.cp) || 0 };
  }
  return out;
}

/** AED for 1 unit of a currency, from a table of AED→currency rates ({ PKR: 76.1 } means 1 AED = 76.1 PKR). */
export function aedPer(currency, fx) {
  if (!currency || currency === 'AED') return 1;
  if (currency === 'USD') return AED_PER_USD;
  const r = fx?.[currency];
  return r > 0 ? 1 / r : null;
}

/**
 * Value every holding. prices = { gold: { 24: …, 22: … } (AED/g), stocks: parseDfmStocks(…),
 * crypto: { SOL: { usd, change24h } }, fx: { PKR: …, EUR: … } }. Missing prices give value null.
 */
export function valuePortfolio(holdings, prices = {}, liabilities = []) {
  const rows = holdings.map((h) => {
    let unitAed = null;
    let dayChangePct = null;
    const qty = Number(h.asset === 'gold' ? h.grams : h.quantity) || 0;
    if (h.asset === 'cash') unitAed = aedPer(h.currency || 'AED', prices.fx);
    else if (h.asset === 'stock') {
      const q = prices.stocks?.[String(h.symbol || '').toUpperCase()];
      if (q) { unitAed = q.price; dayChangePct = q.changePct; }
    } else if (h.asset === 'crypto') {
      const q = prices.crypto?.[String(h.symbol || '').toUpperCase()];
      if (q?.usd) { unitAed = q.usd * AED_PER_USD; dayChangePct = q.change24h ?? null; }
    } else if (h.asset === 'gold') {
      const g = valueGold([{ karat: h.karat, grams: h.grams }], prices.gold?.perGram || prices.gold).rows[0];
      unitAed = g.price;
    }
    const value = unitAed == null ? null : qty * unitAed;
    const cost = h.cost_aed == null || h.cost_aed === '' ? null : Number(h.cost_aed);
    return { ...h, qty, unitAed, value, valueUsd: value == null ? null : value / AED_PER_USD, cost, gain: value != null && cost ? value - cost : null, dayChangePct };
  });
  const byKind = {};
  for (const k of KIND_ORDER) {
    const rs = rows.filter((r) => r.asset === k);
    if (rs.length) byKind[k] = { value: rs.reduce((t, r) => t + (r.value || 0), 0), count: rs.length, missing: rs.some((r) => r.value == null) };
  }
  const assets = rows.reduce((t, r) => t + (r.value || 0), 0);
  const owed = liabilities.reduce((t, l) => t + (l.owed || 0), 0);
  const total = assets - owed;
  return { rows, byKind, assets, owed, total, totalUsd: total / AED_PER_USD, liabilities, missing: rows.some((r) => r.value == null) };
}

/**
 * What each credit card owes now: limit − latest available balance, for cards with both.
 * accounts: fin_accounts rows; latest: { [account_id]: available_balance }.
 */
export function cardLiabilities(accounts, latest) {
  return accounts
    .filter((a) => a.kind === 'credit' && !a.closed_at && Number(a.credit_limit) > 0 && latest[a.id] != null)
    .map((a) => ({ account_id: a.id, slug: a.slug, name: a.name, owed: Math.max(0, Number(a.credit_limit) - Number(latest[a.id])) }))
    .filter((l) => l.owed > 0.005);
}
