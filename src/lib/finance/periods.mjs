// Reporting periods, computed on the Dubai calendar. Each period also carries
// the comparison period it is measured against.
import { dubaiDate, dubaiParts } from './parse.mjs';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const PERIODS = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: '3m', label: 'Last 3 months' },
  { key: '6m', label: 'Last 6 months' },
  { key: 'ytd', label: 'This year' },
  { key: '12m', label: 'Last 12 months' },
];

export function monthLabel(y, m) {
  const d = new Date(Date.UTC(y, m, 1));
  return `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Returns { key, label, start, end, prevStart, prevEnd, prevLabel, months } with Date instants; end is exclusive. */
export function getPeriod(key, now = new Date()) {
  const { y, m, d, hh, mi } = dubaiParts(now);
  const end = new Date(now.getTime() + 60 * 1000);
  const rolling = (n) => {
    const start = dubaiDate(y, m - n, d, hh, mi);
    return { start, end, prevStart: dubaiDate(y, m - 2 * n, d, hh, mi), prevEnd: start, prevLabel: `previous ${n} months`, months: n };
  };
  switch (key) {
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
