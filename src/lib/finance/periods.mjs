// Reporting periods, computed on the Dubai calendar. Each period also carries
// the comparison period it is measured against.
import { dubaiDate, dubaiParts } from './parse.mjs';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const PERIODS = [
  { key: 'this_week', label: 'This week' },
  { key: 'last_week', label: 'Last week' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: '3m', label: 'Last 3 months' },
  { key: '6m', label: 'Last 6 months' },
  { key: 'ytd', label: 'This year' },
  { key: '12m', label: 'Last 12 months' },
  { key: 'all', label: 'All time' },
];

export function monthLabel(y, m) {
  const d = new Date(Date.UTC(y, m, 1));
  return `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Returns { key, label, start, end, prevStart, prevEnd, prevLabel, months } with Date instants; end is exclusive. */
export function getPeriod(key, now = new Date(), earliest = null) {
  const { y, m, d, hh, mi } = dubaiParts(now);
  const end = new Date(now.getTime() + 60 * 1000);
  const rolling = (n) => {
    const start = dubaiDate(y, m - n, d, hh, mi);
    return { start, end, prevStart: dubaiDate(y, m - 2 * n, d, hh, mi), prevEnd: start, prevLabel: `previous ${n} months`, months: n };
  };
  // Weeks run Monday to Sunday (the UAE working week).
  const monday = dubaiDate(y, m, d - ((dubaiParts(now).dow + 6) % 7));
  const WEEK = 7 * 86400000;
  switch (key) {
    case 'this_week': {
      const prevStart = new Date(monday.getTime() - WEEK);
      return {
        key, label: 'This week', start: monday, end, barsEnd: new Date(monday.getTime() + WEEK),
        prevStart, prevEnd: new Date(prevStart.getTime() + (end.getTime() - monday.getTime())),
        prevLabel: 'same point last week', months: (end - monday) / (30.44 * 86400000), days: 7, week: true,
      };
    }
    case 'last_week': {
      const start = new Date(monday.getTime() - WEEK);
      return {
        key, label: 'Last week', start, end: monday, prevStart: new Date(start.getTime() - WEEK), prevEnd: start,
        prevLabel: 'the week before', months: 7 / 30.44, days: 7, week: true,
      };
    }
    case 'last_month': {
      return {
        key, label: monthLabel(y, m - 1),
        start: dubaiDate(y, m - 1, 1), end: dubaiDate(y, m, 1),
        prevStart: dubaiDate(y, m - 2, 1), prevEnd: dubaiDate(y, m - 1, 1),
        prevLabel: monthLabel(y, m - 2), months: 1,
      };
    }
    case '3m': return { key, label: 'Last 3 months', ...rolling(3) };
    case '6m': return { key, label: 'Last 6 months', ...rolling(6) };
    case '12m': return { key, label: 'Last 12 months', ...rolling(12) };
    case 'all': {
      // From the month of the first transaction (or five years back); nothing to compare with.
      const first = earliest ? dubaiParts(earliest) : { y: y - 5, m };
      const start = dubaiDate(first.y, first.m, 1);
      const months = Math.max(1, (y - first.y) * 12 + (m - first.m) + d / 31);
      return { key, label: 'All time', start, end, prevStart: start, prevEnd: start, prevLabel: '', months, noCompare: true };
    }
    case 'ytd': {
      const start = dubaiDate(y, 0, 1);
      const prevStart = dubaiDate(y - 1, 0, 1);
      return {
        key, label: `${y} so far`, start, end,
        prevStart, prevEnd: new Date(prevStart.getTime() + (end.getTime() - start.getTime())),
        prevLabel: `same point in ${y - 1}`, months: m + d / 31,
      };
    }
    case 'this_month':
    default: {
      const start = dubaiDate(y, m, 1);
      const prevStart = dubaiDate(y, m - 1, 1);
      // Compare month-to-date against the same number of days last month, capped at last month's end.
      const prevEnd = new Date(Math.min(prevStart.getTime() + (end.getTime() - start.getTime()), start.getTime()));
      return {
        key: 'this_month', label: monthLabel(y, m), start, end, prevStart, prevEnd,
        prevLabel: `same point in ${monthLabel(y, m - 1).split(' ')[0]}`, months: 1,
      };
    }
  }
}

/** One calendar month, opened by tapping its bar; compared with the month before. */
export function monthPeriod(y, m, now = new Date()) {
  const start = dubaiDate(y, m, 1);
  const end = new Date(Math.min(dubaiDate(y, m + 1, 1).getTime(), now.getTime() + 60 * 1000));
  const p = dubaiParts(start);
  return {
    key: `month:${p.y}-${String(p.m + 1).padStart(2, '0')}`, label: monthLabel(p.y, p.m), single: true,
    start, end, prevStart: dubaiDate(y, m - 1, 1), prevEnd: start, prevLabel: monthLabel(p.y, p.m - 1), months: 1,
  };
}

/** Any stretch of days (e.g. a week, opened from its bar); compared with the same stretch before it. */
export function rangePeriod(start, end, label) {
  const len = end.getTime() - start.getTime();
  const days = Math.round(len / 86400000);
  return {
    key: `range:${start.toISOString()}`, label, start, end, prevStart: new Date(start.getTime() - len), prevEnd: start,
    prevLabel: `the ${days} days before`, months: len / (30.44 * 86400000), days,
  };
}

/** The last `n` calendar months (oldest first) as { y, m, label, start, end }. */
export function lastMonths(n, now = new Date()) {
  const { y, m } = dubaiParts(now);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = dubaiDate(y, m - i, 1);
    const p = dubaiParts(start);
    out.push({ y: p.y, m: p.m, label: MONTH_SHORT[p.m], fullLabel: monthLabel(p.y, p.m), start, end: dubaiDate(y, m - i + 1, 1) });
  }
  return out;
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}
