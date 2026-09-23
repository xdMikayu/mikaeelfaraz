// Pure aggregation over transaction rows (as loaded from Supabase) for the dashboard.
import { dubaiDate, dubaiParts } from './parse.mjs';
import { lastMonths, daysInMonth, monthLabel } from './periods.mjs';
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

const DAY = 24 * 60 * 60 * 1000;
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Dubai midnight of the day an instant falls on. */
function dubaiDay(date) {
  const { y, m, d } = dubaiParts(date);
  return dubaiDate(y, m, d);
}
const dayLabel = (date) => {
  const { m, d } = dubaiParts(date);
  return `${d} ${SHORT[m]}`;
};
const isSingleMonth = (period) => period.key === 'this_month' || period.key === 'last_month';

/** Running total per day over [from, to), with a point for every Dubai calendar day. */
function runningTotal(transactions, from, to) {
  const first = dubaiDay(from);
  const n = Math.max(1, Math.round((dubaiDay(new Date(to.getTime() - 1)) - first) / DAY) + 1);
  const daily = new Array(n).fill(0);
  for (const t of transactions) {
    if (!inRange(t, from, to)) continue;
    const i = Math.round((dubaiDay(t.occurred_at) - first) / DAY);
    if (i >= 0 && i < n) daily[i] += spendOf(t);
  }
  let run = 0;
  return daily.map((v, i) => {
    const date = new Date(first.getTime() + i * DAY);
    return { i, value: (run += v), daily: v, label: dayLabel(date), date };
  });
}

/**
 * The selected period's running total against its comparison period, aligned by
 * day offset. This month is drawn against the whole of last month; other periods
 * against a window of the same length. Ticks are day numbers for a single month,
 * month names otherwise.
 */
export function cumulativeForPeriod(transactions, period, now = new Date()) {
  const single = isSingleMonth(period);
  const curEnd = new Date(Math.min(period.end.getTime(), now.getTime() + 60 * 1000));
  const current = runningTotal(transactions, period.start, curEnd);
  const previous = runningTotal(transactions, period.prevStart, period.key === 'this_month' ? period.start : period.prevEnd);
  const { y, m } = dubaiParts(period.start);
  const length = Math.max(single ? daysInMonth(y, m) : current.length, previous.length);
  const ticks = single
    ? [1, 8, 15, 22, length].map((d) => ({ i: d - 1, label: String(d) }))
    : current.filter((p) => dubaiParts(p.date).d === 1).map((p) => ({ i: p.i, label: SHORT[dubaiParts(p.date).m] }));
  const prevMonth = dubaiParts(period.prevStart).m;
  const labels = single
    ? [SHORT[m], SHORT[prevMonth]]
    : period.key === 'ytd'
      ? [String(y), String(y - 1)]
      : [period.label, `Previous ${period.months} months`];
  return { current, previous, length, ticks, currentLabel: labels[0], previousLabel: labels[1] };
}

/**
 * Stacked-bar buckets that follow the period: weeks for 3 months, months for longer
 * periods (both clipped to the window, so they add up to the headline), and the six
 * months up to the selected one for a single month, with that month highlighted.
 * Returns { unit, buckets: [{ label, fullLabel, total, parts }], highlight, average }.
 */
export function spendSeries(transactions, period, now = new Date()) {
  const sum = (from, to) => {
    const parts = {};
    let total = 0;
    for (const t of transactions) {
      if (!inRange(t, from, to)) continue;
      const v = spendOf(t);
      parts[t.account_id] = (parts[t.account_id] || 0) + v;
      total += v;
    }
    return { total, parts };
  };
  if (isSingleMonth(period)) {
    const months = lastMonths(6, new Date(period.start.getTime() + DAY));
    const buckets = months.map((mo) => ({ label: mo.label, fullLabel: mo.fullLabel, ...sum(mo.start, mo.end) }));
    return { unit: 'month', buckets, highlight: buckets.length - 1, average: buckets.reduce((a, b) => a + b.total, 0) / buckets.length };
  }
  const end = new Date(Math.min(period.end.getTime(), now.getTime() + 60 * 1000));
  const unit = period.key === '3m' ? 'week' : 'month';
  const edges = [period.start];
  let cursor = dubaiDay(period.start);
  while (true) {
    const { y, m, dow } = dubaiParts(cursor);
    cursor = unit === 'week'
      ? new Date(cursor.getTime() + (((8 - dow) % 7) || 7) * DAY) // next Monday
      : dubaiDate(y, m + 1, 1);
    if (cursor >= end) break;
    edges.push(cursor);
  }
  edges.push(end);
  const buckets = edges.slice(0, -1).map((from, k) => {
    const to = edges[k + 1];
    const a = dubaiParts(from);
    const b = dubaiParts(new Date(to.getTime() - 1));
    const wholeMonth = unit === 'month' && a.d === 1 && b.d === daysInMonth(b.y, b.m);
    const fullLabel = unit === 'week'
      ? (a.m === b.m ? `${a.d}–${b.d} ${SHORT[b.m]}` : `${a.d} ${SHORT[a.m]} – ${b.d} ${SHORT[b.m]}`)
      : wholeMonth ? monthLabel(a.y, a.m) : `${a.d}–${b.d} ${SHORT[a.m]} ${a.y}`;
    return { label: unit === 'week' ? `${a.d} ${SHORT[a.m]}` : SHORT[a.m], fullLabel, ...sum(from, to) };
  });
  const total = buckets.reduce((s, x) => s + x.total, 0);
  const units = unit === 'week' ? (end - period.start) / (7 * DAY) : period.months;
  return { unit, buckets, highlight: null, average: total / Math.max(1, units) };
}
