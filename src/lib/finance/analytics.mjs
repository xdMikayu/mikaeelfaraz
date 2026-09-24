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
const isSingleMonth = (period) => period.key === 'this_month' || period.key === 'last_month' || Boolean(period.single);

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Week edges from `start` to `end`: the first week is clipped, later ones start on Mondays. */
function weekEdges(start, end) {
  const edges = [start];
  let cursor = dubaiDay(start);
  while (true) {
    cursor = new Date(cursor.getTime() + (((8 - dubaiParts(cursor).dow) % 7) || 7) * DAY);
    if (cursor >= end) break;
    edges.push(cursor);
  }
  edges.push(end);
  return edges;
}

/**
 * Spend per day (single-month periods) or per week (longer ones), each bucket with its
 * biggest purchases, plus the comparison period's average per bucket as a reference.
 * Days after today are returned with `future: true` so the axis still spans the month.
 */
export function periodBars(transactions, period, now = new Date()) {
  const single = isSingleMonth(period);
  const end = new Date(Math.min(period.end.getTime(), now.getTime() + 60 * 1000));
  const isRange = period.key.startsWith('range:');
  const unit = single || isRange ? 'day' : period.key === 'all' ? 'month' : 'week';
  let edges;
  if (isRange) {
    edges = [period.start];
    for (let next = new Date(dubaiDay(period.start).getTime() + DAY); next < period.end; next = new Date(next.getTime() + DAY)) edges.push(next);
    edges.push(period.end);
  } else if (single) {
    const { y, m } = dubaiParts(period.start);
    edges = Array.from({ length: daysInMonth(y, m) + 1 }, (_, i) => dubaiDate(y, m, 1 + i));
  } else if (unit === 'month') {
    edges = [period.start];
    for (let { y, m } = dubaiParts(period.start), next = dubaiDate(y, m + 1, 1); next < end; next = dubaiDate(dubaiParts(next).y, dubaiParts(next).m + 1, 1)) edges.push(next);
    edges.push(end);
  } else {
    edges = weekEdges(period.start, end);
  }
  const buckets = edges.slice(0, -1).map((from, k) => {
    const to = edges[k + 1];
    const a = dubaiParts(from);
    const b = dubaiParts(new Date(to.getTime() - 1));
    const future = from >= end;
    const rows = future ? [] : transactions.filter((t) => !t.excluded && inRange(t, from, new Date(Math.min(to.getTime(), end.getTime()))));
    const total = rows.reduce((sum, t) => sum + spendOf(t), 0);
    const top = rows
      .filter((t) => spendOf(t) > 0)
      .sort((x, y) => spendOf(y) - spendOf(x))
      .slice(0, 3)
      .map((t) => ({ merchant: t.merchant || 'Unknown', amount: spendOf(t) }));
    const lastDay = daysInMonth(a.y, a.m);
    const label = unit === 'month'
      ? (k === 0 || a.m === 0 ? String(a.y) : '') // years along a multi-year axis
      : isRange
      ? `${WEEKDAY[a.dow]} ${a.d}`
      : single
      ? ([1, 8, 15, 22, lastDay].includes(a.d) ? String(a.d) : '')
      // Month names at month starts; the clipped first week only if it starts early in its month.
      : ((k === 0 && a.d <= 7) || (k > 0 && (b.d < a.d || a.d === 1)) ? SHORT[b.d < a.d ? b.m : a.m] : '');
    const fullLabel = unit === 'month'
      ? monthLabel(a.y, a.m)
      : single || isRange
      ? `${WEEKDAY[a.dow]} ${a.d} ${SHORT[a.m]}`
      : a.m === b.m ? `${a.d}–${b.d} ${SHORT[a.m]}` : `${a.d} ${SHORT[a.m]} – ${b.d} ${SHORT[b.m]}`;
    return { label, fullLabel, total, count: rows.length, top, future, start: from.toISOString(), end: to.toISOString() };
  });

  // Reference line: what a typical day/week looked like in the comparison period.
  const prevEnd = period.key === 'this_month' ? period.start : period.prevEnd;
  const prevTotal = transactions.filter((t) => inRange(t, period.prevStart, prevEnd)).reduce((sum, t) => sum + spendOf(t), 0);
  const prevDays = (prevEnd - period.prevStart) / DAY;
  const average = prevTotal > 0 ? prevTotal / (unit === 'day' ? prevDays : prevDays / 7) : null;
  const { y } = dubaiParts(period.start);
  const averageLabel = isRange
    ? 'Before this average'
    : single
    ? `${SHORT[dubaiParts(period.prevStart).m]} average`
    : period.key === 'ytd' ? `${y - 1} average` : `Previous ${period.months} months average`;
  return { unit, buckets, average, averageLabel };
}

/** The last 12 months by card, marking the months the selected period covers. */
export function monthlyContext(transactions, period, now = new Date()) {
  const buckets = monthlySeries(transactions, 12, now);
  const end = new Date(Math.min(period.end.getTime(), now.getTime() + 60 * 1000));
  const highlight = buckets.flatMap((mo, i) => (mo.end > period.start && mo.start < end ? [i] : []));
  return { buckets, highlight, average: buckets.reduce((sum, b) => sum + b.total, 0) / buckets.length };
}
