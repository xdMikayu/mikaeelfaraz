// Server side of the portfolio: value everything at live prices and record today's net worth.
import { fetchPrices } from './prices.mjs';
import { valuePortfolio, cardLiabilities } from './portfolio.mjs';
import { dubaiParts } from './parse.mjs';

/** Latest available balance per credit card, from the most recent alert that carried one. */
async function latestBalances(db, userId, accountIds) {
  const out = {};
  for (const id of accountIds) {
    const { data, error } = await db.from('fin_transactions').select('available_balance')
      .eq('user_id', userId).eq('account_id', id).not('available_balance', 'is', null)
      .order('occurred_at', { ascending: false }).limit(1);
    if (error) throw error;
    if (data[0]) out[id] = Number(data[0].available_balance);
  }
  return out;
}

export async function portfolioNow(db, userId) {
  const [{ data: holdings, error: e1 }, { data: accounts, error: e2 }, { data: stored }] = await Promise.all([
    db.from('fin_holdings').select('*').eq('user_id', userId),
    db.from('fin_accounts').select('*').eq('user_id', userId),
    db.from('fin_prices').select('*').eq('user_id', userId).eq('asset', 'gold').eq('source', 'malabar').maybeSingle(),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const credit = accounts.filter((a) => a.kind === 'credit' && !a.closed_at && Number(a.credit_limit) > 0);
  const latest = await latestBalances(db, userId, credit.map((a) => a.id));
  const crypto = [...new Set(holdings.filter((h) => h.asset === 'crypto').map((h) => String(h.symbol).toUpperCase()))];
  const prices = await fetchPrices({ crypto: crypto.length ? crypto : ['SOL'], stored });
  const value = valuePortfolio(holdings, { gold: prices.gold?.perGram, stocks: prices.stocks, crypto: prices.crypto, fx: prices.fx }, cardLiabilities(accounts, latest));
  return { holdings, prices, value };
}

/**
 * Record today's net worth (Dubai date), overwriting earlier snapshots from today. Skipped
 * when any holding couldn't be priced, so a flaky price source never records a fake drop.
 */
export async function snapshotNetWorth(db, userId, now = new Date()) {
  const { holdings, prices, value } = await portfolioNow(db, userId);
  if (!holdings.length) return { skipped: 'no holdings' };
  if (value.missing) return { skipped: 'some prices unavailable', errors: prices.errors };
  const p = dubaiParts(now);
  const day = `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  const breakdown = Object.fromEntries(Object.entries(value.byKind).map(([k, v]) => [k, Math.round(v.value * 100) / 100]));
  const { error } = await db.from('fin_networth').upsert(
    { user_id: userId, day, total_aed: value.total, assets_aed: value.assets, owed_aed: value.owed, breakdown, updated_at: now.toISOString() },
    { onConflict: 'user_id,day' }
  );
  if (error) throw error;
  return { day, total: value.total };
}
