// Every time on the page is the viewer's own; ESPN and FPL both send UTC.

export const kickoff = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** "18 Oct": fits the status column of a score row. */
export const dayMonth = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export const longDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export function todayYmd(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const ymdToDate = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** "Dubai time, GMT+4" from the browser's own zone. */
export function zoneLabel() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    const city = tz.split('/').pop().replace(/_/g, ' ');
    const off = -new Date().getTimezoneOffset();
    const h = Math.trunc(off / 60);
    const m = Math.abs(off % 60);
    const gmt = `GMT${off >= 0 ? '+' : '−'}${Math.abs(h)}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
    return city ? `${city} time, ${gmt}` : gmt;
  } catch {
    return '';
  }
}

/** "in 2 h 10 min", "in 25 min", or null once it's passed. */
export function until(iso, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const min = Math.round(ms / 60000);
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `in ${h} h ${min % 60} min`;
  return `in ${Math.round(h / 24)} days`;
}
