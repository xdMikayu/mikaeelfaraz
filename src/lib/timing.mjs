// When things happen around an FPL deadline: UK clock times, the nightly price-change windows,
// international breaks and matches still to play. Pure, so the page and the server share it.

const DAY = 864e5;
const parts = (t) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'long' })
      .formatToParts(t)
      .map((x) => [x.type, x.value]),
  );
const offset = (t) => {
  const p = parts(t);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(t / 6e4) * 6e4;
};

/** A UK wall-clock time ('2026-10-16', '13:30') as a timestamp, through BST and GMT. */
export function londonToUtc(date, time = '00:00') {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const first = wall - offset(wall);
  return wall - offset(first);
}

/** UK date as 'YYYY-MM-DD'. */
export const ukDate = (t) => {
  const p = parts(t);
  return `${p.year}-${p.month}-${p.day}`;
};

/** 'Friday 16 October, 13:30 UK' (with the year when asked). */
export const ukLabel = (t, { year = false } = {}) => {
  const p = parts(t);
  const month = new Date(Date.UTC(2000, +p.month - 1, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  return `${p.weekday} ${+p.day} ${month}${year ? ` ${p.year}` : ''}, ${p.hour}:${p.minute} UK`;
};

/**
 * FPL's nightly price changes (about 01:30 UK) between now and the deadline, as timestamps. The
 * first one is "tonight" in FPL's own projections (offset 0).
 */
export function priceWindows(now, deadline) {
  const out = [];
  for (let d = 0; d <= 10; d++) {
    const t = londonToUtc(ukDate(now + d * DAY), '01:30');
    if (t > now && t < deadline) out.push(t);
  }
  return out;
}

/**
 * The first price change FPL projects for this player before the deadline: { dir: 'rise'|'fall', night }
 * (night 0 = tonight), or null. FPL projects three nights; a change happens when its progress reaches ±100%.
 */
export function priceMove(el, windows) {
  for (const [night, pct] of el.price?.nights ?? []) {
    if (night >= windows || pct == null || Math.abs(pct) < 100) continue;
    return { dir: pct > 0 ? 'rise' : 'fall', night };
  }
  return null;
}

/** Days between the last match of the previous gameweek and the first of this one; over ten is an international break. */
export function breakBefore(fixtures, gw) {
  const ko = (g) => fixtures.filter((f) => f.event === g && f.kickoff).map((f) => Date.parse(f.kickoff));
  const prev = ko(gw - 1);
  const cur = ko(gw);
  if (!prev.length || !cur.length) return null;
  const days = (Math.min(...cur) - Math.max(...prev)) / DAY;
  return { days: Math.round(days), international: days > 10 };
}

/** Matches of earlier gameweeks still to kick off before this one: injuries in them come after any advice now. */
export const matchesBefore = (fixtures, gw, now) => fixtures.filter((f) => f.event != null && f.event < gw && !f.started && f.kickoff && Date.parse(f.kickoff) > now - 3 * 3600e3);
