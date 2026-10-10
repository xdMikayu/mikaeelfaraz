// Forecasts from match logs: team strength, single-match odds and whole-season simulations.
//
// Ratings: every team gets an attack and a defence multiplier, fitted so that
//   expected goals for home side = base_home * attack_home * defence_away (and the same for away)
// best matches a blend of xG (70%) and real goals (30%) in past matches, with older matches
// counting less (half weight after about eight months). A few matches' worth of "average team"
// keeps small samples honest; promoted sides start from a weaker prior.
// Odds: independent Poisson goals with the Dixon–Coles tweak for low scores (0–0 and 1–1
// happen a little more often than independence says).
// Season: the remaining fixtures played out thousands of times with those goal rates.

const DAY = 864e5;

/**
 * games: { team: [[date, opp, home(1/0), gf, ga, xgf, xga]] }, each match listed for both sides.
 * opts.asOf: time to weigh from; opts.newTeams: ids with no top-flight history (weaker prior).
 */
export function rateTeams(games, { asOf = Date.now(), halfLife = 240, xgWeight = 0.7, prior = 6, newTeams = [] } = {}) {
  const ms = [];
  for (const [team, list] of Object.entries(games)) {
    for (const [date, opp, home, gf, ga, xgf, xga] of list) {
      if (!home) continue;
      const age = (asOf - new Date(date).getTime()) / DAY;
      if (age < 0) continue;
      const w = 0.5 ** (age / halfLife);
      ms.push({ h: team, a: opp, w, th: xgWeight * xgf + (1 - xgWeight) * gf, ta: xgWeight * xga + (1 - xgWeight) * ga });
    }
  }
  const teams = [...new Set(ms.flatMap((m) => [m.h, m.a]).concat(Object.keys(games)))];
  const W = ms.reduce((t, m) => t + m.w, 0) || 1;
  const baseH = ms.reduce((t, m) => t + m.w * m.th, 0) / W || 1.5;
  const baseA = ms.reduce((t, m) => t + m.w * m.ta, 0) / W || 1.2;
  const fresh = new Set(newTeams.map(String));
  const att = Object.fromEntries(teams.map((t) => [t, fresh.has(t) ? 0.82 : 1]));
  const def = Object.fromEntries(teams.map((t) => [t, fresh.has(t) ? 1.22 : 1]));
  const pAtt = { ...att };
  const pDef = { ...def };
  for (let it = 0; it < 40; it++) {
    const num = {};
    const den = {};
    for (const m of ms) {
      // Attack: what a side produced against what an average attack would have, given who it faced.
      num[m.h] = (num[m.h] ?? 0) + m.w * m.th;
      den[m.h] = (den[m.h] ?? 0) + m.w * baseH * def[m.a];
      num[m.a] = (num[m.a] ?? 0) + m.w * m.ta;
      den[m.a] = (den[m.a] ?? 0) + m.w * baseA * def[m.h];
    }
    for (const t of teams) att[t] = ((num[t] ?? 0) + prior * pAtt[t]) / ((den[t] ?? 0) + prior);
    const dn = {};
    const dd = {};
    for (const m of ms) {
      dn[m.a] = (dn[m.a] ?? 0) + m.w * m.th;
      dd[m.a] = (dd[m.a] ?? 0) + m.w * baseH * att[m.h];
      dn[m.h] = (dn[m.h] ?? 0) + m.w * m.ta;
      dd[m.h] = (dd[m.h] ?? 0) + m.w * baseA * att[m.a];
    }
    for (const t of teams) def[t] = ((dn[t] ?? 0) + prior * pDef[t]) / ((dd[t] ?? 0) + prior);
    // Keep the average team at 1 so the base rates keep their meaning.
    const ma = teams.reduce((s, t) => s + att[t], 0) / teams.length;
    const md = teams.reduce((s, t) => s + def[t], 0) / teams.length;
    for (const t of teams) {
      att[t] /= ma;
      def[t] /= md;
    }
  }
  return { att, def, baseH, baseA, matches: ms.length };
}

/** Expected goals for each side of one fixture. */
export function goalRates(r, home, away) {
  return {
    home: r.baseH * (r.att[home] ?? 1) * (r.def[away] ?? 1),
    away: r.baseA * (r.att[away] ?? 1) * (r.def[home] ?? 1),
  };
}

const pmf = (l, max) => {
  const out = [Math.exp(-l)];
  for (let k = 1; k <= max; k++) out[k] = (out[k - 1] * l) / k;
  return out;
};

/** Win/draw/loss, likely scores and the usual markets from two goal rates. */
export function matchOdds(lh, la, { rho = -0.08, max = 10 } = {}) {
  const ph = pmf(lh, max);
  const pa = pmf(la, max);
  const tau = (i, j) =>
    i === 0 && j === 0 ? 1 - lh * la * rho : i === 0 && j === 1 ? 1 + lh * rho : i === 1 && j === 0 ? 1 + la * rho : i === 1 && j === 1 ? 1 - rho : 1;
  let home = 0;
  let draw = 0;
  let away = 0;
  let over = 0;
  let btts = 0;
  let total = 0;
  const scores = [];
  for (let i = 0; i <= max; i++) {
    for (let j = 0; j <= max; j++) {
      const p = ph[i] * pa[j] * tau(i, j);
      total += p;
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
      if (i + j > 2) over += p;
      if (i > 0 && j > 0) btts += p;
      scores.push({ h: i, a: j, p });
    }
  }
  const n = (v) => v / total;
  const csHome = scores.filter((s) => s.a === 0).reduce((t, s) => t + s.p, 0);
  const csAway = scores.filter((s) => s.h === 0).reduce((t, s) => t + s.p, 0);
  return {
    lh,
    la,
    home: n(home),
    draw: n(draw),
    away: n(away),
    over25: n(over),
    btts: n(btts),
    csHome: n(csHome),
    csAway: n(csAway),
    scores: scores.sort((a, b) => b.p - a.p).slice(0, 6).map((s) => ({ ...s, p: n(s.p) })),
  };
}

const RED_FOR = 0.7; // a side down to ten creates about 30% less
const RED_AGAINST = 1.25; // and concedes about 25% more

/**
 * Result odds from a given moment: the score so far plus Poisson goals in the minutes left.
 * Stoppage time adds about four minutes to the 90; red cards shift both rates.
 */
export function inPlay(lh, la, { minute = 0, hs = 0, as = 0, redsH = 0, redsA = 0 } = {}) {
  const left = Math.max(0, 94 - minute) / 94;
  const rh = lh * left * RED_FOR ** redsH * RED_AGAINST ** redsA;
  const ra = la * left * RED_FOR ** redsA * RED_AGAINST ** redsH;
  const ph = pmf(rh, 10);
  const pa = pmf(ra, 10);
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j <= 10; j++) {
      const p = ph[i] * pa[j];
      const d = hs + i - (as + j);
      if (d > 0) home += p;
      else if (d === 0) draw += p;
      else away += p;
    }
  }
  const t = home + draw + away;
  return { home: home / t, draw: draw / t, away: away / t };
}

/**
 * Win probability minute by minute through a match, from the pre-match rates and its events
 * ({ kind: goal|pen|og|red, side, minute: "67'" }). Returns [{ m, home, draw, away }].
 */
export function winPath(lh, la, events, upTo = 90, { finished = false } = {}) {
  const min = (e) => {
    const m = String(e.minute ?? '').match(/^(\d+)(?:'?\+(\d+))?/);
    return m ? Number(m[1]) + (m[2] ? Number(m[2]) / 10 : 0) : 0;
  };
  // Stoppage time is drawn at the 90th minute; extra time isn't modelled.
  const evs = events.filter((e) => ['goal', 'pen', 'og', 'red'].includes(e.kind) && e.side).map((e) => ({ ...e, at: Math.min(90, min(e)) }));
  const out = [];
  for (let m = 0; m <= upTo; m++) {
    // At the final whistle nothing is left to play, so the result is settled.
    const s = { minute: finished && m === upTo ? 94 : m, hs: 0, as: 0, redsH: 0, redsA: 0 };
    for (const e of evs) {
      if (e.at > m) continue;
      if (e.kind === 'red') s[e.side === 'home' ? 'redsH' : 'redsA'] += 1;
      else s[e.side === 'home' ? 'hs' : 'as'] += 1;
    }
    out.push({ m, ...inPlay(lh, la, s) });
  }
  return out;
}

/**
 * What the chances deserved: every shot scored with probability equal to its xG, all at once.
 * Exact goal distributions for each side (Poisson-binomial), then win/draw/loss.
 */
export function shotOutcomes(homeXg, awayXg) {
  const dist = (list) => {
    let d = [1];
    for (const p of list) {
      const n = new Array(d.length + 1).fill(0);
      d.forEach((v, k) => {
        n[k] += v * (1 - p);
        n[k + 1] += v * p;
      });
      d = n;
    }
    return d;
  };
  const h = dist(homeXg);
  const a = dist(awayXg);
  let home = 0;
  let draw = 0;
  let away = 0;
  h.forEach((ph, i) =>
    a.forEach((pa, j) => {
      const p = ph * pa;
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
    })
  );
  return { home, draw, away };
}

/**
 * Goal rates for any league with a table: goals for and against per game, relative to the league,
 * pulled towards average for the first few games, with home advantage. Cruder than the xG ratings.
 */
export function ratesFromTable(rows, homeId, awayId, { prior = 6 } = {}) {
  const played = rows.filter((r) => r.p > 0);
  const games = played.reduce((t, r) => t + r.p, 0);
  if (!games) return null;
  const avg = played.reduce((t, r) => t + r.gf, 0) / games; // goals per team per game
  const rate = (r, k) => (r ? (r[k] + prior * avg) / (r.p + prior) / avg : 1);
  const h = rows.find((r) => String(r.id) === String(homeId));
  const a = rows.find((r) => String(r.id) === String(awayId));
  if (!h || !a) return null;
  return { home: avg * 1.1 * rate(h, 'gf') * rate(a, 'ga'), away: (avg / 1.1) * rate(a, 'gf') * rate(h, 'ga') };
}

/** Small seeded generator so a page shows the same simulation every time it renders. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const poissonDraw = (l, rand) => {
  const L = Math.exp(-l);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L && k < 15);
  return k - 1;
};

/**
 * Plays the rest of a season n times.
 * table: [{ id, pts, gd, gf }], fixtures: [{ home, away }] still to play, r: rateTeams output.
 * Returns per team: average points, finishing-position probabilities, and title/top-4/bottom-3 odds.
 */
export function simulateSeason(table, fixtures, r, { n = 4000, seed = 7, top = 4, bottom = 3 } = {}) {
  const rand = rng(seed);
  const ids = table.map((t) => String(t.id));
  const idx = Object.fromEntries(ids.map((id, i) => [id, i]));
  const rates = fixtures.map((f) => ({ h: idx[f.home], a: idx[f.away], ...goalRates(r, String(f.home), String(f.away)) })).filter((f) => f.h != null && f.a != null);
  const pos = ids.map(() => new Array(ids.length).fill(0));
  const ptsSum = new Array(ids.length).fill(0);
  const pts = new Array(ids.length);
  const gd = new Array(ids.length);
  const gf = new Array(ids.length);
  const order = ids.map((_, i) => i);
  for (let s = 0; s < n; s++) {
    for (let i = 0; i < ids.length; i++) {
      pts[i] = table[i].pts;
      gd[i] = table[i].gd;
      gf[i] = table[i].gf;
    }
    for (const f of rates) {
      const x = poissonDraw(f.home, rand);
      const y = poissonDraw(f.away, rand);
      gd[f.h] += x - y;
      gd[f.a] += y - x;
      gf[f.h] += x;
      gf[f.a] += y;
      if (x > y) pts[f.h] += 3;
      else if (x < y) pts[f.a] += 3;
      else {
        pts[f.h] += 1;
        pts[f.a] += 1;
      }
    }
    order.sort((a, b) => pts[b] - pts[a] || gd[b] - gd[a] || gf[b] - gf[a] || rand() - 0.5);
    order.forEach((t, p) => {
      pos[t][p] += 1;
      ptsSum[t] += pts[t];
    });
  }
  const out = {};
  ids.forEach((id, i) => {
    const dist = pos[i].map((c) => c / n);
    out[id] = {
      pts: ptsSum[i] / n,
      dist,
      title: dist[0],
      top: dist.slice(0, top).reduce((a, b) => a + b, 0),
      bottom: dist.slice(ids.length - bottom).reduce((a, b) => a + b, 0),
      likely: dist.indexOf(Math.max(...dist)) + 1,
    };
  });
  return out;
}

/** Rolling average of a series (for trend lines), over the last `k` points at each step. */
export function rolling(values, k = 5) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - k + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** Least-squares slope per step, for "trending up/down" labels. */
export function slope(values) {
  const n = values.length;
  if (n < 3) return 0;
  const mx = (n - 1) / 2;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((v, i) => {
    num += (i - mx) * (v - my);
    den += (i - mx) ** 2;
  });
  return den ? num / den : 0;
}
