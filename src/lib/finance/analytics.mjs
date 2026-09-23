// Pure aggregation over transaction rows (as loaded from Supabase) for the dashboard.
import { dubaiParts } from './parse.mjs';
import { lastMonths, daysInMonth } from './periods.mjs';
import { UNCATEGORIZED } from './categories.mjs';

/** Signed AED spend of a row: purchases count, refunds subtract, excluded rows are ignored. */
export function spendOf(tx) {
  if (tx.excluded) return 0;
  const v = Number(tx.amount_aed) || 0;
  return tx.direction === 'credit' ? -v : v;
}

export function inRange(tx, start, end) {
  const t = new Date(tx.occurred_at).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function sumBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    const cur = m.get(k) || { key: k, total: 0, count: 0 };
    cur.total += spendOf(r);
    cur.count += r.excluded ? 0 : 1;
    m.set(k, cur);
  }
  return m;
}

export function pctChange(cur, prev) {
  if (!prev) return cur ? null : 0;
  return (cur - prev) / Math.abs(prev);
}

/** Everything the overview needs for one period + its comparison period. */
export function summarize(transactions, period, accounts = [], budgets = []) {
  const cur = transactions.filter((t) => inRange(t, period.start, period.end));
  const prev = transactions.filter((t) => inRange(t, period.prevStart, period.prevEnd));
  const total = cur.reduce((s, t) => s + spendOf(t), 0);
  const prevTotal = prev.reduce((s, t) => s + spendOf(t), 0);
  const days = Math.max(1, (Math.min(period.end.getTime(), Date.now()) - period.start.getTime()) / 86400000);

  const catCur = sumBy(cur, (t) => t.category || UNCATEGORIZED);
  const catPrev = sumBy(prev, (t) => t.category || UNCATEGORIZED);
  const budgetMap = new Map(budgets.map((b) => [b.category, Number(b.monthly_amount)]));
  const categories = [...new Set([...catCur.keys(), ...catPrev.keys()])]
    .map((k) => {
      const c = catCur.get(k)?.total || 0;
      const p = catPrev.get(k)?.total || 0;
      const budget = budgetMap.get(k);
      return { category: k, total: c, prevTotal: p, count: catCur.get(k)?.count || 0, change: pctChange(c, p), budget: budget ? budget * (period.months || 1) : null };
    })
    .filter((c) => c.total > 0 || c.prevTotal > 0)
    .sort((a, b) => b.total - a.total || b.prevTotal - a.prevTotal);

  const merchCur = sumBy(cur, (t) => t.merchant || t.merchant_raw || 'Unknown');
  const merchants = [...merchCur.values()]
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((m) => ({ merchant: m.key, total: m.total, count: m.count, category: cur.find((t) => (t.merchant || t.merchant_raw) === m.key)?.category || null }));

  const acctCur = sumBy(cur, (t) => t.account_id);
  const acctPrev = sumBy(prev, (t) => t.account_id);
  const byAccount = accounts.map((a) => {
    const latest = transactions
      .filter((t) => t.account_id === a.id && t.available_balance != null)
      .sort((x, y) => new Date(y.occurred_at) - new Date(x.occurred_at))[0];
    return {
      account: a,
      total: acctCur.get(a.id)?.total || 0,
      prevTotal: acctPrev.get(a.id)?.total || 0,
      count: acctCur.get(a.id)?.count || 0,
      available: latest ? Number(latest.available_balance) : null,
      availableAt: latest?.occurred_at || null,
    };
  });

  const biggest = cur.filter((t) => !t.excluded).sort((a, b) => spendOf(b) - spendOf(a))[0] || null;

  return {
    total, prevTotal, change: pctChange(total, prevTotal),
    count: cur.filter((t) => !t.excluded).length,
    perDay: total / days,
    perMonth: period.months > 1 ? total / period.months : null,
    categories, merchants, byAccount, biggest,
    uncategorized: cur.filter((t) => !t.category && !t.excluded).length,
  };
}

/** Monthly totals per account for the last `n` months: [{ label, fullLabel, total, parts: {accountId: total} }]. */
export function monthlySeries(transactions, n, now = new Date()) {
  const months = lastMonths(n, now);
  return months.map((mo) => {
    const rows = transactions.filter((t) => inRange(t, mo.start, mo.end));
    const parts = {};
    for (const r of rows) parts[r.account_id] = (parts[r.account_id] || 0) + spendOf(r);
    return { ...mo, total: rows.reduce((s, r) => s + spendOf(r), 0), parts };
  });
}

/** Cumulative spend by day-of-month for this month and last month. */
export function cumulativeByDay(transactions, now = new Date()) {
  const { y, m, d } = dubaiParts(now);
  const [prevMo, curMo] = lastMonths(2, now);
  const build = (mo, upToDay) => {
    const len = daysInMonth(mo.y, mo.m);
    const daily = new Array(len).fill(0);
    for (const t of transactions) {
      if (!inRange(t, mo.start, mo.end)) continue;
      daily[dubaiParts(t.occurred_at).d - 1] += spendOf(t);
    }
    let run = 0;
    return daily.slice(0, upToDay ?? len).map((v, i) => ({ day: i + 1, value: (run += v), daily: v }));
  };
  return {
    current: build(curMo, d),
    previous: build(prevMo),
    currentLabel: curMo.label,
    previousLabel: prevMo.label,
    daysInMonth: daysInMonth(y, m),
  };
}
