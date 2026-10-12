// What the bookmakers expect from a football match, worked back from their prices: the chances of a
// home win, a draw and an away win and of more goals than the over/under line, with their margin
// taken out; then the goals each side is expected to score (the Poisson rates whose outcomes come
// closest to those chances), and from those its clean-sheet chance, both teams scoring and the
// likeliest score. Pure functions, so they can be tested; odds-feed.mjs fetches the prices.
import { fplTeamFor } from './fplmap.mjs';

/** A price in American odds ("+215", "-155") as the chance it implies, margin still in; null if not a price. */
export function implied(american) {
  const a = Number(String(american ?? '').replace('+', ''));
  if (!Number.isFinite(a) || Math.abs(a) < 100) return null;
  return a > 0 ? 100 / (a + 100) : -a / (-a + 100);
}

/** Chances that add up to one: the bookmaker's margin taken out in proportion. */
export function fair(ps) {
  const sum = ps.reduce((s, p) => s + p, 0);
  return ps.map((p) => p / sum);
}

const FACT = [1];
for (let k = 1; k <= 12; k++) FACT[k] = FACT[k - 1] * k;
const poisson = (lam, max = 12) => Array.from({ length: max + 1 }, (_, k) => (Math.exp(-lam) * lam ** k) / FACT[k]);

/**
 * Everything that follows from each side's expected goals, scored independently:
 * { home, draw, away (win chances), over (more goals than `line`), csHome, csAway, btts, likely: [h, a] }.
 */
export function outcomes(home, away, line = 2.5) {
  const ph = poisson(home);
  const pa = poisson(away);
  let h = 0;
  let d = 0;
  let a = 0;
  let over = 0;
  let best = { p: -1, score: [0, 0] };
  for (let i = 0; i < ph.length; i++) {
    for (let j = 0; j < pa.length; j++) {
      const p = ph[i] * pa[j];
      if (i > j) h += p;
      else if (i === j) d += p;
      else a += p;
      if (i + j > line) over += p;
      if (p > best.p) best = { p, score: [i, j] };
    }
  }
  return { home: h, draw: d, away: a, over, csHome: pa[0], csAway: ph[0], btts: (1 - ph[0]) * (1 - pa[0]), likely: best.score };
}

/**
 * The goals each side is expected to score, from fair chances of { home, draw, away } and, when the
 * bookmaker prices it, of { over } the goal `line`: the pair of rates whose outcomes come closest to
 * those chances (least squares), found on a grid and then refined. { home, away, miss } where miss
 * is how far the best fit still is from the prices, in probability.
 */
export function fitGoals({ home, draw, away, over = null, line = 2.5 }) {
  const err = (lh, la) => {
    const o = outcomes(lh, la, line);
    return (o.home - home) ** 2 + (o.draw - draw) ** 2 + (o.away - away) ** 2 + (over == null ? 0 : (o.over - over) ** 2);
  };
  let best = { e: Infinity, h: 1, a: 1 };
  for (let lh = 0.1; lh <= 4.51; lh += 0.1) {
    for (let la = 0.1; la <= 4.51; la += 0.1) {
      const e = err(lh, la);
      if (e < best.e) best = { e, h: lh, a: la };
    }
  }
  for (let step = 0.05; step > 0.0005; step /= 2) {
    let moved = true;
    while (moved) {
      moved = false;
      for (const [dh, da] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const lh = best.h + dh;
        const la = best.a + da;
        if (lh < 0.02 || la < 0.02) continue;
        const e = err(lh, la);
        if (e < best.e) {
          best = { e, h: lh, a: la };
          moved = true;
        }
      }
    }
  }
  return { home: best.h, away: best.a, miss: Math.sqrt(best.e / (over == null ? 3 : 4)) };
}

const pick = (side) => side?.close?.odds ?? side?.open?.odds ?? null;

/**
 * The prices ESPN carries for a match, as fair chances: { provider, home, draw, away, over, line,
 * margin } (over and line when the total is priced), or null. Takes a scoreboard competition, or
 * { odds: summary.pickcenter } from a match summary (the same prices, laid out differently).
 */
export function pricesOf(competition) {
  const o = (competition?.odds ?? []).find((x) => x?.moneyline || x?.drawOdds);
  if (!o) return null;
  const ml = o.moneyline ?? {};
  const raw = [implied(pick(ml.home) ?? o.homeTeamOdds?.moneyLine), implied(pick(ml.draw) ?? o.drawOdds?.moneyLine), implied(pick(ml.away) ?? o.awayTeamOdds?.moneyLine)];
  if (raw.some((p) => p == null)) return null;
  const [home, draw, away] = fair(raw);
  const out = { provider: o.provider?.displayName ?? o.provider?.name ?? null, home, draw, away, margin: raw.reduce((s, p) => s + p, 0) - 1 };
  const ov = implied(pick(o.total?.over) ?? o.overOdds);
  const un = implied(pick(o.total?.under) ?? o.underOdds);
  const line = Number(o.overUnder ?? String(o.total?.over?.close?.line ?? '').replace(/^o/, ''));
  if (ov != null && un != null && Number.isFinite(line) && line > 0) {
    out.over = fair([ov, un])[0];
    out.line = line;
  }
  return out;
}

/**
 * A match's prices turned into what FPL needs: { provider, home, away (expected goals), win: [h, d, a],
 * csHome, csAway, btts, over, line, likely, miss }.
 */
export function bookmakersView(prices) {
  const g = fitGoals(prices);
  const o = outcomes(g.home, g.away, prices.line ?? 2.5);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return {
    provider: prices.provider,
    home: r3(g.home),
    away: r3(g.away),
    win: [r3(prices.home), r3(prices.draw), r3(prices.away)],
    csHome: r3(o.csHome),
    csAway: r3(o.csAway),
    btts: r3(o.btts),
    ...(prices.over != null ? { over: r3(prices.over), line: prices.line } : null),
    likely: o.likely,
    miss: r3(g.miss),
  };
}

const DAY = 864e5;

/**
 * The bookmakers' view of every FPL fixture that ESPN's scoreboard events carry prices for:
 * { [FPL fixture id]: { event (gameweek), ...bookmakersView } }. Each event is matched to the FPL
 * fixture between the same home and away sides nearest its kick-off (within two days). Matches
 * under way or over are left out: their prices are no longer pre-match.
 */
export function pricedFixtures(events, teams, fixtures) {
  const out = {};
  for (const ev of events) {
    const c = ev?.competitions?.[0];
    if (!c || ev.status?.type?.state !== 'pre') continue;
    const prices = pricesOf(c);
    if (!prices) continue;
    const side = (s) => fplTeamFor(c.competitors?.find((x) => x.homeAway === s)?.team?.displayName, teams);
    const h = side('home');
    const a = side('away');
    if (!h || !a) continue;
    const at = Date.parse(ev.date);
    const f = fixtures
      .filter((x) => x.home === h && x.away === a && !x.started && x.kickoff && Math.abs(Date.parse(x.kickoff) - at) < 2 * DAY)
      .sort((x, y) => Math.abs(Date.parse(x.kickoff) - at) - Math.abs(Date.parse(y.kickoff) - at))[0];
    if (f) out[f.id] = { event: f.event, ...bookmakersView(prices) };
  }
  return out;
}
