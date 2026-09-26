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
  const isRange = period.key.startsWith('range:') || Boolean(period.week);
  const unit = single || isRange ? 'day' : period.key === 'all' ? 'month' : 'week';
  let edges;
  if (isRange) {
    edges = [period.start];
    const last = period.barsEnd || period.end; // this week: the whole week, days ahead left empty
    for (let next = new Date(dubaiDay(period.start).getTime() + DAY); next < last; next = new Date(next.getTime() + DAY)) edges.push(next);
    edges.push(last);
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
  const prevEnd = period.key === 'this_month' ? period.start : period.week ? new Date(period.prevStart.getTime() + 7 * DAY) : period.prevEnd;
  const prevTotal = transactions.filter((t) => inRange(t, period.prevStart, prevEnd)).reduce((sum, t) => sum + spendOf(t), 0);
  const prevDays = (prevEnd - period.prevStart) / DAY;
  const average = prevTotal > 0 ? prevTotal / (unit === 'day' ? prevDays : prevDays / 7) : null;
  const { y } = dubaiParts(period.start);
  const averageLabel = period.week
    ? `${period.key === 'this_week' ? 'Last week' : 'Week before'} average`
    : isRange
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

/**
 * This week (Monday to now) against last week, day by day, plus the categories that moved
 * most versus the same point last week.
 */
export function weekCompare(transactions, now = new Date()) {
  const p = dubaiParts(now);
  const monday = dubaiDate(p.y, p.m, p.d - ((p.dow + 6) % 7));
  const lastMonday = new Date(monday.getTime() - 7 * DAY);
  const sinceMonday = now.getTime() - monday.getTime();
  const spend = (from, to) => transactions.filter((t) => !t.excluded && inRange(t, from, to));
  const sum = (rows) => rows.reduce((s, t) => s + spendOf(t), 0);
  const todayIdx = (p.dow + 6) % 7;
  const days = WEEKDAY.slice(1).concat(WEEKDAY[0]).map((label, i) => {
    const from = new Date(monday.getTime() + i * DAY);
    const prevFrom = new Date(lastMonday.getTime() + i * DAY);
    return {
      label, today: i === todayIdx, future: i > todayIdx,
      total: i > todayIdx ? 0 : sum(spend(from, new Date(Math.min(from.getTime() + DAY, now.getTime() + 60000)))),
      prev: sum(spend(prevFrom, new Date(prevFrom.getTime() + DAY))),
    };
  });
  const cur = spend(monday, new Date(now.getTime() + 60000));
  const prevSame = spend(lastMonday, new Date(lastMonday.getTime() + sinceMonday));
  const byCat = (rows) => rows.reduce((m, t) => m.set(t.category || 'Uncategorized', (m.get(t.category || 'Uncategorized') || 0) + spendOf(t)), new Map());
  const a = byCat(cur);
  const b = byCat(prevSame);
  const movers = [...new Set([...a.keys(), ...b.keys()])]
    .map((category) => ({ category, total: a.get(category) || 0, prev: b.get(category) || 0 }))
    .map((c) => ({ ...c, delta: c.total - c.prev }))
    .filter((c) => Math.abs(c.delta) >= 1)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, 4);
  const total = sum(cur);
  const prevSameTotal = sum(prevSame);
  return { days, total, prevSameTotal, prevWeekTotal: sum(spend(lastMonday, monday)), change: pctChange(total, prevSameTotal), movers, count: cur.length };
}

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
};

/** The `n` complete calendar months before `start`, oldest first. */
function monthsBefore(start, n) {
  const { y, m } = dubaiParts(start);
  return Array.from({ length: n }, (_, i) => {
    const k = n - i;
    return { start: dubaiDate(y, m - k, 1), end: dubaiDate(y, m - k + 1, 1), label: SHORT[dubaiParts(dubaiDate(y, m - k, 1)).m] };
  });
}

/**
 * What a normal month costs: the median of the last `n` complete months that had any
 * spending (a median, so one big trip or purchase doesn't make every month look cheap).
 */
export function typicalMonth(transactions, before, n = 6) {
  const months = monthsBefore(before, n).map((mo) => ({ ...mo, total: transactions.filter((t) => inRange(t, mo.start, mo.end)).reduce((s, t) => s + spendOf(t), 0) }));
  const live = months.filter((mo) => mo.total > 0);
  return { total: median(live.map((mo) => mo.total)), months, count: live.length };
}

/**
 * Running total through a month or week, day by day, against the period before and an even
 * pace to your typical month (or week). Also where you'll land at today's rate.
 * Returns null for periods it doesn't apply to (quarters, years).
 */
export function paceSeries(transactions, period, now = new Date()) {
  const isMonth = isSingleMonth(period);
  if (!isMonth && !period.week) return null;
  const start = period.start;
  const n = isMonth ? daysInMonth(dubaiParts(start).y, dubaiParts(start).m) : 7;
  const end = new Date(start.getTime() + n * DAY);
  const elapsed = Math.min(n, Math.max(0, Math.ceil((Math.min(now.getTime(), end.getTime()) - start.getTime()) / DAY)));
  const byDay = (from, len) => {
    const out = Array(len).fill(0);
    for (const t of transactions) {
      const i = Math.floor((new Date(t.occurred_at).getTime() - from.getTime()) / DAY);
      if (i >= 0 && i < len) out[i] += spendOf(t);
    }
    return out;
  };
  const cum = (xs) => xs.reduce((acc, v, i) => (acc.push((acc[i - 1] || 0) + v), acc), []);
  const cur = cum(byDay(start, n));
  const prevStart = isMonth ? dubaiDate(dubaiParts(start).y, dubaiParts(start).m - 1, 1) : new Date(start.getTime() - 7 * DAY);
  const prevLen = isMonth ? daysInMonth(dubaiParts(prevStart).y, dubaiParts(prevStart).m) : 7;
  const prevCum = cum(byDay(prevStart, prevLen));
  const typical = isMonth ? typicalMonth(transactions, start).total : typicalMonth(transactions, start).total * (7 / 30.44);
  const points = Array.from({ length: n }, (_, i) => {
    const d = new Date(start.getTime() + i * DAY);
    const p = dubaiParts(d);
    return {
      i, day: p.d, label: isMonth ? String(p.d) : WEEKDAY[p.dow],
      cur: i < elapsed ? cur[i] : null,
      prev: prevCum[Math.min(i, prevLen - 1)],
      even: typical ? (typical * (i + 1)) / n : null,
    };
  });
  const spent = elapsed ? cur[elapsed - 1] : 0;
  const complete = elapsed >= n;
  const projected = complete ? spent : elapsed >= 3 ? (spent / elapsed) * n : null;
  const evenNow = typical && elapsed ? (typical * elapsed) / n : null;
  return {
    unit: isMonth ? 'month' : 'week', points, elapsed, days: n, spent, projected, typical: typical || null, complete,
    prevTotal: prevCum[prevLen - 1] || 0,
    prevSame: prevCum[Math.min(Math.max(elapsed, 1), prevLen) - 1] || 0,
    // Positive: spending faster than a typical period at this point.
    aheadOfTypical: evenNow ? spent - evenNow : null,
  };
}

/**
 * For each category: its typical spend for a period this long (median of the last six
 * complete months, scaled) and a six-month trail for a sparkline.
 */
export function categoryContext(transactions, period, n = 6) {
  const months = monthsBefore(period.start, n);
  const out = new Map();
  for (const [k, mo] of months.entries()) {
    for (const t of transactions) {
      if (!inRange(t, mo.start, mo.end)) continue;
      const c = t.category || UNCATEGORIZED;
      if (!out.has(c)) out.set(c, Array(n).fill(0));
      out.get(c)[k] += spendOf(t);
    }
  }
  const scale = period.months || 1;
  const ctx = new Map();
  for (const [c, trail] of out) ctx.set(c, { usual: median(trail.filter((v) => v > 0).length >= 2 ? trail : []) * scale, trail, labels: months.map((m) => m.label) });
  return ctx;
}

/**
 * Merchants you pay every month (subscriptions, phone, gym…): charged in at least three of
 * the last four complete months. Returns [{ merchant, monthly, months }] by monthly cost.
 */
export function recurringCharges(transactions, before, n = 4) {
  const months = monthsBefore(before, n);
  const seen = new Map();
  months.forEach((mo, k) => {
    for (const t of transactions) {
      if (t.excluded || t.direction === 'credit' || !inRange(t, mo.start, mo.end)) continue;
      const m = t.merchant || t.merchant_raw;
      if (!m) continue;
      if (!seen.has(m)) seen.set(m, { merchant: m, category: t.category, byMonth: Array(n).fill(0) });
      seen.get(m).byMonth[k] += spendOf(t);
    }
  });
  return [...seen.values()]
    .map((r) => ({ ...r, months: r.byMonth.filter((v) => v > 0).length }))
    .filter((r) => r.months >= Math.min(3, n) && ['Subscriptions', 'Bills & Utilities', 'Personal Care & Fitness', 'Education'].includes(r.category))
    .map((r) => ({ merchant: r.merchant, category: r.category, months: r.months, monthly: median(r.byMonth.filter((v) => v > 0)) }))
    .sort((a, b) => b.monthly - a.monthly);
}
