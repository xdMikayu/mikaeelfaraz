#!/usr/bin/env node
// Learns Matchday's cricket model from Cricsheet's ball-by-ball history (run cricket-extract.mjs
// first), scores it on seasons it never saw, then refits it on everything for the site.
//
//   node scripts/sport/fit-cricket.mjs     # → src/lib/sport/cricket/{model,grounds,ratings,about}.json
//   DIAG=1 node scripts/sport/fit-cricket.mjs            # also prints calibration by year, stage and pool
//   VALIDATE_ONLY=1 node scripts/sport/fit-cricket.mjs   # the validation alone, writing nothing
//
// Per format (men's and women's T20 and one-day cricket):
//   levels     how many runs a first innings makes in each competition, recent seasons counting
//              most: an IPL innings is worth more than a qualifier's.
//   trend      how fast scoring in the format is rising, so par keeps up with it.
//   lean       how each ground scores against its competition's level, leaning towards none when a
//              ground has few matches. Par = level × e^lean.
//   shape      the runs a side still makes from any point, as a share of par, by balls and wickets
//              left (the curve the Duckworth–Lewis method uses), and how widely it varies.
//   chase      the chance a chasing side wins from what it can expect against what it needs, its
//              weights changing as the chase goes on; and for the last few balls, how each ball goes
//              in each situation, so the end of a chase can be worked out one ball at a time.
//   first      the chance the side batting first wins from its projected total against par.
//   ratings    Elo ratings for every team, with home advantage and the gap between the full
//              members and the associates, and how much they still matter once the match is under way.
// Plus each ground's record for the page (batting first and chasing, the toss, scoring by phase,
// recent matches), the same for Tests and first-class matches, and how fourth-innings chases of each
// size have gone in Tests.
//
// Validation is walk-forward, as a model refitted every year would run: fitted on everything before
// 1 January and scored ball by ball on that year's matches, for each of the last few years, against
// simple baselines.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVenue, sameGround } from '../../src/lib/sport/cricket-venues.mjs';
import { runsLeft, projectTotal, chaseInputs, chaseWin, firstWin, eloWin, ratingIn, withStrength, compKey, endKeys, BALL_RUNS } from '../../src/lib/sport/cricket-model.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'src/lib/sport/cricket');
const YEARS = [2024, 2025, 2026];
const DAY = 864e5;
const YEAR = 365.25 * DAY;
const FORMATS = {
  't20-male': { kind: 't20', gender: 'male', balls: 120, phases: [36, 90] },
  't20-female': { kind: 't20', gender: 'female', balls: 120, phases: [36, 90] },
  'odi-male': { kind: 'odi', gender: 'male', balls: 300, phases: [60, 240] },
  'odi-female': { kind: 'odi', gender: 'female', balls: 300, phases: [60, 240] },
};
// Matches over several days: Tests, and first-class matches between domestic sides.
const LONG = {
  'test-male': (m) => m.mt === 'Test' && m.gender === 'male',
  'test-female': (m) => m.mt === 'Test' && m.gender === 'female',
  'fc-male': (m) => m.mt === 'MDM' && m.gender === 'male',
};
// Half-lives in days: how fast old seasons stop counting towards a competition's level, the runs-left
// shape and the chase and first-innings models. Shorter ones scored no better on the seasons held out.
const HL_LEVEL = 900;
const HL_SHAPE = 1200;
const HL_CHASE = 1500;
// The last balls of a chase are worked out one at a time (lastBalls in cricket-model.mjs): on their
// own with END.from balls left or fewer, blended into the chase model up to END.to. Each situation
// leans on the coarser one by END_PRIOR balls' worth. Chosen on the seasons held out: over the last
// four overs, 3 and 18 scored best or close to it in all four formats, and nearby settings much the same.
const END = { from: 3, to: 18 };
const END_PRIOR = 20;
const r0 = Math.round;
const r1 = (x) => Math.round(x * 10) / 10;
const r3 = (x) => Math.round(x * 1000) / 1000;
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const pct = (n, d) => (d ? r0((n / d) * 100) : null);

const matches = JSON.parse(await readFile(join(ROOT, 'data/sport/cricket/matches.json'), 'utf8')).filter((m) => m.date && m.teams?.length === 2);
for (const m of matches) m.t = Date.parse(m.date);
const through = matches.at(-1).date;
console.log(`${matches.length} matches to ${through}`);

/* ------------------------------------------------------------------ grounds */

// Spellings grouped by name words and city; a spelling without a city takes its twin's.
const spell = new Map();
for (const m of matches) {
  const v = parseVenue(m.venue, m.city);
  m.vw = v;
  const k = `${v.words.join(' ')}|${v.city}`;
  const s = spell.get(k) ?? { words: v.words, city: v.city, n: 0, last: '', name: '', place: '' };
  s.n += 1;
  if (m.date >= s.last) {
    s.last = m.date;
    s.name = String(m.venue).split(',')[0].trim();
    s.place = m.city ?? s.place;
  }
  spell.set(k, s);
}
for (const s of spell.values()) {
  if (s.city) continue;
  const twins = [...spell.values()].filter((t) => t.city && t.words.join(' ') === s.words.join(' '));
  if (twins.length === 1) s.city = twins[0].city;
}
const grounds = [];
const groundOf = new Map();
for (const s of [...spell.values()].sort((a, b) => b.n - a.n)) {
  let g = grounds.find((x) => x.city === s.city && x.alias.some((a) => sameGround(a, s.words)));
  if (!g) {
    g = { id: grounds.length + 1, city: s.city, alias: [], n: 0, last: '', name: s.name, place: s.place };
    grounds.push(g);
  }
  g.alias.push(s.words);
  g.n += s.n;
  if (s.last >= g.last) {
    g.last = s.last;
    g.name = s.name;
    g.place = s.place || g.place;
  }
  groundOf.set(`${s.words.join(' ')}|${s.city}`, g);
}
for (const m of matches) {
  const s = spell.get(`${m.vw.words.join(' ')}|${m.vw.city}`);
  m.g = groundOf.get(`${s.words.join(' ')}|${s.city}`)?.id ?? null;
}
console.log(`${spell.size} spellings → ${grounds.length} grounds`);

/* ------------------------------------------------------------------ helpers */

const compOf = (m) => compKey({ club: m.club, event: m.event, teams: m.teams });
const recency = (t, at, halfLifeDays) => Math.pow(0.5, Math.max(0, at - t) / DAY / halfLifeDays);
// A first innings that ran its course: all out or every over bowled, and no rain rules.
const complete = (m, F) =>
  m.kind === F.kind && m.gender === F.gender && !m.dl && m.result && m.result !== 'no result' && m.inns.length >= 2 && (m.inns[0].wkts >= 10 || m.inns[0].balls >= F.balls) && !(m.inns[1]?.target?.[1] && m.inns[1].target[1] * 6 < F.balls);
const won = (m, team) => (m.result === 'tie' ? 0.5 : m.winner === team ? 1 : 0);
const dot = (x, c) => x.reduce((s, v, i) => s + v * c[i], 0);
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c || !M[c][c]) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Weighted logistic regression by Newton's method: rows [{ x: [...], y, w }] → coefficients (x[0] = 1). */
function logit(rows, ridge = 1e-3) {
  const k = rows[0].x.length;
  let beta = new Array(k).fill(0);
  for (let it = 0; it < 30; it++) {
    const H = Array.from({ length: k }, () => new Array(k).fill(0));
    const g = new Array(k).fill(0);
    for (const r of rows) {
      const p = sigmoid(dot(r.x, beta));
      for (let i = 0; i < k; i++) {
        g[i] += r.w * (r.y - p) * r.x[i];
        for (let j = 0; j < k; j++) H[i][j] += r.w * p * (1 - p) * r.x[i] * r.x[j];
      }
    }
    for (let i = 0; i < k; i++) {
      H[i][i] += ridge;
      g[i] -= ridge * beta[i];
    }
    const step = solve(H, g);
    beta = beta.map((v, i) => v + step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-7) break;
  }
  return beta;
}

const logLoss = (rows) => {
  let s = 0;
  let w = 0;
  for (const r of rows) {
    const p = Math.min(1 - 1e-6, Math.max(1e-6, r.p));
    s += -(r.w ?? 1) * (r.y * Math.log(p) + (1 - r.y) * Math.log(1 - p));
    w += r.w ?? 1;
  }
  return s / w;
};
const brier = (rows) => mean(rows.map((r) => (r.p - r.y) ** 2));

/* ------------------------------------------------------------------ levels, trend and leans */

/**
 * log(total) = level[competition] + lean[ground] + trend·(years before `at`) + noise, recent matches
 * weighted most, each competition pulled towards the format's mean and each ground towards no
 * lean. Levels are as of `at`: where scoring has got to, not where it was on average.
 */
function fitLevels(rows, at) {
  const KC = 8;
  const KG = 6;
  for (const r of rows) {
    r.w = recency(r.t, at, HL_LEVEL);
    r.d = (r.t - at) / YEAR;
    r.y = Math.log(r.total);
  }
  const W = rows.reduce((s, r) => s + r.w, 0);
  const a = {};
  const v = {};
  let trend = 0;
  let mu = 0;
  for (let it = 0; it < 40; it++) {
    mu = rows.reduce((s, r) => s + r.w * (r.y - trend * r.d), 0) / W;
    const sa = {};
    for (const r of rows) {
      const e = (sa[r.comp] ??= [0, 0]);
      e[0] += r.w * (r.y - trend * r.d - (v[r.g] ?? 0));
      e[1] += r.w;
    }
    for (const [c, [s, w]] of Object.entries(sa)) a[c] = (s + KC * mu) / (w + KC);
    const sv = {};
    for (const r of rows) {
      const e = (sv[r.g] ??= [0, 0]);
      e[0] += r.w * (r.y - trend * r.d - a[r.comp]);
      e[1] += r.w;
    }
    for (const [g, [s, w]] of Object.entries(sv)) v[g] = s / (w + KG);
    let num = 0;
    let den = 1; // a little pull towards no trend
    for (const r of rows) {
      num += r.w * r.d * (r.y - a[r.comp] - v[r.g]);
      den += r.w * r.d * r.d;
    }
    trend = num / den;
  }
  // exp(mean of logs) runs low; scale back to the average total.
  const corr = rows.reduce((s, r) => s + r.w * (r.total / Math.exp(a[r.comp] + v[r.g] + trend * r.d)), 0) / W;
  const levels = Object.fromEntries(Object.entries(a).map(([c, x]) => [c, Math.exp(x) * corr]));
  levels['*'] = Math.exp(mu) * corr;
  return { levels, lean: v, trend, at };
}
/** Par for a ground in a competition at time t (by default when the levels were fitted). */
const parOf = (fit, comp, g, t = fit.at) => (fit.levels[comp] ?? fit.levels['*']) * Math.exp((fit.lean[g] ?? 0) + (fit.trend * (t - fit.at)) / YEAR);

/* ------------------------------------------------------------------ the runs-left shape */

/** Runs still to come as a share of par, cell by cell (balls left × wickets down), then the curve. */
function fitShape(innings, F) {
  const N = F.balls;
  const cells = new Map();
  for (const { inn, par, w } of innings) {
    for (let b = 0; b < N; b++) {
      if (b > inn.c.length) break;
      const down = b ? inn.w[b - 1] : 0;
      if (down >= 10) break;
      const so = b ? inn.c[b - 1] : 0;
      const y = (inn.runs - so) / par;
      const key = (N - b) * 10 + down;
      const c = cells.get(key) ?? [0, 0, 0];
      c[0] += w;
      c[1] += w * y;
      c[2] += w * y * y;
      cells.set(key, c);
    }
  }
  const z = [];
  const bs = [];
  for (let d = 0; d < 10; d++) {
    const pts = [...cells.entries()].filter(([k]) => k % 10 === d).map(([k, c]) => ({ left: Math.floor(k / 10), n: c[0], m: c[1] / c[0] })).filter((p) => p.n > 2);
    let best = { err: Infinity };
    for (let i = 0; i < 400; i++) {
      const b = 0.05 * Math.pow(1.025, i);
      let num = 0;
      let den = 0;
      for (const p of pts) {
        const f = 1 - Math.exp((-b * p.left) / N);
        num += p.n * p.m * f;
        den += p.n * f * f;
      }
      const zz = num / den;
      let err = 0;
      for (const p of pts) err += p.n * (p.m - zz * (1 - Math.exp((-b * p.left) / N))) ** 2;
      if (err < best.err) best = { err, z: zz, b };
    }
    z.push(r4(best.z));
    bs.push(r4(best.b));
  }
  // Spread: sd = A·mean^B across well-filled cells.
  const pts = [...cells.values()].filter((c) => c[0] > 40).map((c) => ({ m: c[1] / c[0], sd: Math.sqrt(Math.max(1e-6, c[2] / c[0] - (c[1] / c[0]) ** 2)), n: c[0] })).filter((p) => p.m > 0.02);
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let sw = 0;
  for (const p of pts) {
    const x = Math.log(p.m);
    const y = Math.log(p.sd);
    sx += p.n * x;
    sy += p.n * y;
    sxx += p.n * x * x;
    sxy += p.n * x * y;
    sw += p.n;
  }
  const B = (sw * sxy - sx * sy) / (sw * sxx - sx * sx);
  const A = Math.exp((sy - B * sx) / sw);
  return { balls: N, z, b: bs, sdA: r4(A), sdB: r4(B) };
}

/* ------------------------------------------------------------------ the last balls of a chase */

/**
 * How a ball goes near the end of a chase: for each situation (endKeys), the chance of each number of
 * runs (wides and no-balls bowled before it counted on it) and of wickets, as runs·3 + wickets, from
 * every legal ball of every chase with END.to balls left or fewer, recent seasons weighted most. A
 * situation with few balls of its own leans on the coarser one after it.
 */
function fitEnd(list, F, at) {
  const K = (BALL_RUNS + 1) * 3;
  const counts = new Map();
  const chains = new Map();
  for (const m of list) {
    const inn = m.inns[1];
    const target = inn.target?.[0] ?? m.inns[0].runs + 1;
    const w = recency(m.t, at, HL_CHASE);
    for (let i = F.balls - END.to; i < Math.min(inn.c.length, F.balls); i++) {
      const so = i ? inn.c[i - 1] : 0;
      const down = i ? inn.w[i - 1] : 0;
      if (down >= 10 || so >= target) break;
      const ball = Math.min(inn.c[i] - so, BALL_RUNS) * 3 + Math.min(inn.w[i] - down, 2);
      const keys = endKeys(target - so, F.balls - i, 10 - down);
      chains.set(keys[0], keys);
      for (const k of keys) {
        const c = counts.get(k) ?? new Array(K + 1).fill(0);
        c[ball] += w;
        c[K] += w;
        counts.set(k, c);
      }
    }
  }
  const rates = {};
  const smooth = ([k, ...up]) => {
    if (!rates[k]) {
      const c = counts.get(k);
      const parent = up.length ? smooth(up) : null;
      rates[k] = c.slice(0, K).map((x, i) => (parent ? (x + END_PRIOR * parent[i]) / (c[K] + END_PRIOR) : x / c[K]));
    }
    return rates[k];
  };
  for (const keys of chains.values()) smooth(keys);
  // In ten-thousandths: plenty for the sums, and shorter to store.
  return { ...END, rates: Object.fromEntries(Object.entries(rates).map(([k, p]) => [k, p.map((x) => Math.round(x * 1e4))])) };
}

/* ------------------------------------------------------------------ Elo */

const poolOf = (m) => (m.club ? compOf(m) : 'intl');

/** Hosts: per ground and pool, the side that plays there most, if it plays most of the matches there. */
function hostsOf(list) {
  const seen = new Map();
  for (const m of list) {
    const k = `${m.g}|${poolOf(m)}`;
    const c = seen.get(k) ?? { n: 0, teams: {} };
    c.n += 1;
    for (const t of m.teams) c.teams[t] = (c.teams[t] ?? 0) + 1;
    seen.set(k, c);
  }
  const host = new Map();
  for (const [k, c] of seen) {
    const [team, n] = Object.entries(c.teams).sort((a, b) => b[1] - a[1])[0];
    if (c.n >= 3 && n / c.n >= 0.6) host.set(k, team);
  }
  return host;
}
const homeOf = (m, host, team) => {
  const h = host.get(`${m.g}|${poolOf(m)}`);
  return h === team ? 1 : h && m.teams.includes(h) ? -1 : 0;
};

/**
 * Runs Elo through matches in date order; returns the ratings and each match's pre-match chance.
 * K: how far a result moves the ratings, H: home advantage, T: the full members' edge.
 */
function runElo(list, host, { K, H, T }) {
  const R = new Map();
  const n = new Map();
  const last = new Map();
  const pre = new Map();
  for (const m of list) {
    const [A, B] = m.teams;
    const ra = R.get(A) ?? 1500;
    const rb = R.get(B) ?? 1500;
    const home = homeOf(m, host, A);
    const p = eloWin({ home: H }, ratingIn({ tier: T }, ra, A, !m.club), ratingIn({ tier: T }, rb, B, !m.club), home);
    pre.set(m.id, { p, ra, rb, home });
    if (m.result !== 'win' && m.result !== 'tie') continue;
    const y = won(m, A);
    // New sides settle faster.
    const ka = K * (1 + 2 / (1 + (n.get(A) ?? 0) / 5));
    const kb = K * (1 + 2 / (1 + (n.get(B) ?? 0) / 5));
    R.set(A, ra + ka * (y - p));
    R.set(B, rb - kb * (y - p));
    for (const t of m.teams) {
      n.set(t, (n.get(t) ?? 0) + 1);
      last.set(t, m.date);
    }
  }
  return { R, n, last, pre };
}

/* ------------------------------------------------------------------ one format, fitted up to a date */

/** A match's chase after b legal balls, or null once it's over. */
function chaseState(m, b, target, F) {
  const inn = m.inns[1];
  const down = b ? inn.w[b - 1] : 0;
  const so = b ? inn.c[b - 1] : 0;
  if (down >= 10 || so >= target) return null;
  return { need: target - so, left: F.balls - b, wickets: down, target };
}
/** A match's first innings after b legal balls, or null once it's over. */
function firstState(m, b) {
  const inn = m.inns[0];
  const down = b ? inn.w[b - 1] : 0;
  if (down >= 10) return null;
  return { runs: b ? inn.c[b - 1] : 0, balls: b, wickets: down };
}
// The baseline a simple win predictor uses: the required rate, wickets down and how far along it is.
const baseInputs = (st, F) => [1, Math.min(36, (st.need / st.left) * 6), st.wickets, st.left / F.balls];

function fitFormat(key, at, { sample = 3 } = {}) {
  const F = FORMATS[key];
  const all = matches.filter((m) => m.kind === F.kind && m.gender === F.gender && m.t < at);
  const done = all.filter((m) => complete(m, F));
  const levelFit = fitLevels(done.map((m) => ({ t: m.t, total: m.inns[0].runs, comp: compOf(m), g: m.g })), at);
  const parAt = (m) => parOf(levelFit, compOf(m), m.g, m.t);
  // The shape from the last ten years (scoring patterns have changed), recent seasons weighted most.
  const recent = done.filter((m) => m.t >= at - 10 * YEAR && m.inns[0].c?.length);
  const shape = fitShape(recent.map((m) => ({ inn: m.inns[0], par: parAt(m), w: recency(m.t, at, HL_SHAPE) })), F);

  // Elo with its settings chosen on the four seasons before `at`.
  const ordered = all.filter((m) => m.result);
  const host = hostsOf(ordered);
  let elo = null;
  for (const K of [12, 18, 24, 32]) {
    for (const H of [0, 25, 50, 75, 100]) {
      for (const T of [0, 200, 400, 600, 800]) {
        const run = runElo(ordered, host, { K, H, T });
        const rows = ordered.filter((m) => m.t >= at - 4 * YEAR && (m.result === 'win' || m.result === 'tie')).map((m) => ({ p: run.pre.get(m.id).p, y: won(m, m.teams[0]) }));
        const ll = logLoss(rows);
        if (!elo || ll < elo.ll) elo = { K, H, T, ll, run };
      }
    }
  }

  // Chase: every few balls of every second innings, with the strength term for later.
  const chaseRows = [];
  const firstRows = [];
  const firstStates = [];
  for (const m of recent.filter((x) => x.inns[1]?.c?.length)) {
    const par = parAt(m);
    const target = m.inns[1].target?.[0] ?? m.inns[0].runs + 1;
    const w = recency(m.t, at, HL_CHASE);
    const chasing = m.inns[1].team;
    const s = elo.run.pre.get(m.id);
    const pChase = s ? (chasing === m.teams[0] ? s.p : 1 - s.p) : 0.5;
    const y = won(m, chasing);
    for (let b = 0; b < F.balls && b <= m.inns[1].c.length; b += sample) {
      const st = chaseState(m, b, target, F);
      if (!st) break;
      chaseRows.push({ x: chaseInputs(shape, st, par), base: baseInputs(st, F), y, w, rest: st.left / (2 * F.balls), pS: pChase, year: m.date.slice(0, 4) });
    }
    // The side batting first, from its final total against par, and how its innings went.
    firstRows.push({ x: [1, m.inns[0].runs / par - 1], y: won(m, m.inns[0].team), w });
    const pBat = s ? (m.inns[0].team === m.teams[0] ? s.p : 1 - s.p) : 0.5;
    for (let b = 0; b < F.balls && b <= m.inns[0].c.length; b += 4 * sample) {
      const st = firstState(m, b);
      if (!st) break;
      firstStates.push({ st, par, y: won(m, m.inns[0].team), w, rest: (2 * F.balls - b) / (2 * F.balls), pS: pBat });
    }
  }
  const chase = { coef: logit(chaseRows).map(r4), end: fitEnd(recent.filter((x) => x.inns[1]?.c?.length), F, at) };
  const base = logit(chaseRows.map((r) => ({ x: r.base, y: r.y, w: r.w })));
  const fc = logit(firstRows);
  const first = { a: r4(fc[0]), b: r4(fc[1]) };
  // How much team strength still counts once the match is under way, for each innings.
  const strength = (rows) => {
    let best = { g: 0, ll: Infinity };
    for (let g = 0; g <= 2.5; g += 0.05) {
      const ll = logLoss(rows.map((r) => ({ p: withStrength(r.p0, r.pS, r.rest, g), y: r.y, w: r.w })));
      if (ll < best.ll) best = { g: r3(g), ll };
    }
    return best.g;
  };
  const sampleRows = chaseRows.filter((_, i) => i % 4 === 0).map((r) => ({ ...r, p0: sigmoid(dot(r.x, chase.coef)) }));
  const gamma = { first: strength(firstStates.map((r) => ({ ...r, p0: firstWin(shape, first, r.st, r.par) }))), chase: strength(sampleRows) };
  const trainChase = sampleRows.map((r) => ({ y: r.y, year: r.year, p: r.p0 }));
  return { F, levelFit, shape, chase, base, first, gamma, elo, host, trainChase };
}

/* ------------------------------------------------------------------ walk-forward validation */

/** Scores a fit on the matches from `at` up to `end`, as the site would have seen them, into acc. */
function scorePeriod(fit, at, end, acc) {
  const { F, levelFit, shape, chase, base, first, gamma, elo, host } = fit;
  const mine = (m) => m.kind === F.kind && m.gender === F.gender;
  // Ratings keep learning through the year, as they would live; each chance is pre-match.
  const run = runElo(matches.filter((m) => mine(m) && m.result && m.t < end), host, elo);
  const later = matches.filter((m) => mine(m) && m.t >= at && m.t < end);
  const test = later.filter((m) => complete(m, F) && m.inns[1]?.c?.length);
  const flat = { ...levelFit, levels: { '*': levelFit.levels['*'] }, lean: {} };
  for (const m of test) {
    const year = m.date.slice(0, 4);
    const par = parOf(levelFit, compOf(m), m.g, m.t);
    const parFlat = parOf(flat, compOf(m), m.g, m.t);
    const i1 = m.inns[0];
    const proj = (b, model, same, rate) => {
      const e = (acc.proj[b] ??= { model: [], same: [], rate: [] });
      e.model.push(Math.abs(model - i1.runs));
      e.same.push(Math.abs(same - i1.runs));
      if (rate != null) e.rate.push(Math.abs(rate - i1.runs));
    };
    proj(0, par, parFlat, null);
    (acc.bias[year] ??= []).push(Math.log(i1.runs / par));
    for (const b of acc.stages) {
      if (b > i1.c.length || i1.w[b - 1] >= 10) continue;
      const st = { runs: i1.c[b - 1], balls: b, wickets: i1.w[b - 1] };
      proj(b, projectTotal(shape, st, par).mean, projectTotal(shape, st, parFlat).mean, (st.runs / b) * F.balls);
    }
    const s = run.pre.get(m.id);
    const target = m.inns[1].target?.[0] ?? i1.runs + 1;
    const chasing = m.inns[1].team;
    const pChase = s ? (chasing === m.teams[0] ? s.p : 1 - s.p) : 0.5;
    for (let b = 0; b < F.balls && b <= m.inns[1].c.length; b += 6) {
      const st = chaseState(m, b, target, F);
      if (!st) break;
      const p = chaseWin(shape, chase, st, par);
      acc.chase.push({ y: won(m, chasing), p: withStrength(p, pChase, st.left / (2 * F.balls), gamma.chase), pNo: p, pFlat: chaseWin(shape, chase, st, parFlat), pBase: sigmoid(dot(baseInputs(st, F), base)), stage: b / F.balls, year, pool: compOf(m) });
    }
    // Every ball of the last twenty-four, with the last balls worked out one at a time and without.
    for (let b = F.balls - 24; b < F.balls && b <= m.inns[1].c.length; b++) {
      const st = chaseState(m, b, target, F);
      if (!st) break;
      acc.end.push({ y: won(m, chasing), p: chaseWin(shape, chase, st, par), pCurve: chaseWin(shape, { coef: chase.coef }, st, par), left: st.left });
    }
    const pBat = s ? (i1.team === m.teams[0] ? s.p : 1 - s.p) : 0.5;
    for (let b = 0; b < F.balls && b <= i1.c.length; b += 12) {
      const st = firstState(m, b);
      if (!st) break;
      const p = firstWin(shape, first, st, par);
      acc.first.push({ y: won(m, i1.team), p: withStrength(p, pBat, (2 * F.balls - b) / (2 * F.balls), gamma.first), pNo: p, year });
    }
  }
  for (const m of later.filter((x) => x.result === 'win')) {
    const s = run.pre.get(m.id);
    if (s) acc.pre.push({ p: s.p, y: won(m, m.teams[0]), year: m.date.slice(0, 4) });
  }
  acc.matches += test.length;
}

function validate(key) {
  const F = FORMATS[key];
  const acc = { stages: F.balls === 120 ? [36, 60, 90] : [60, 150, 240], proj: {}, chase: [], end: [], first: [], pre: [], matches: 0, bias: {} };
  const settings = [];
  for (const Y of YEARS) {
    const at = Date.parse(`${Y}-01-01`);
    const fit = fitFormat(key, at);
    scorePeriod(fit, at, Date.parse(`${Y + 1}-01-01`), acc);
    settings.push({ year: Y, K: fit.elo.K, home: fit.elo.H, tier: fit.elo.T, gamma: fit.gamma, trend: r4(fit.levelFit.trend) });
    if (process.env.DIAG) console.log(`  ${key} fitted to ${Y}: chase ${fit.chase.coef.join(' ')}, first ${fit.first.a} ${fit.first.b}, ratings weight ${fit.gamma.first}/${fit.gamma.chase}`);
  }
  const by = (rows, f) => Object.fromEntries(Object.entries(Object.groupBy(rows, f)).sort());
  if (process.env.DIAG) {
    for (const [y, rows] of Object.entries(by(acc.chase, (r) => r.year))) {
      const avg = (f) => r0(mean(rows.map(f)) * 100);
      console.log(`  ${key} ${y} chase: predicted ${avg((r) => r.p)}% (no ratings ${avg((r) => r.pNo)}%), won ${avg((r) => r.y)}%, log loss ${r3(logLoss(rows))}`);
    }
    for (const [lo, hi, name] of [[0, 0.34, 'early'], [0.34, 0.67, 'middle'], [0.67, 1, 'late']]) console.log(`  ${key} ${name} chase:`, calibration(acc.chase.filter((r) => r.stage >= lo && r.stage < hi), (r) => r.p));
    console.log(`  ${key} first innings:`, calibration(acc.first, (r) => r.p));
    for (const [name, f] of [['full', (r) => r.pool === 'intl-full'], ['assoc', (r) => r.pool === 'intl-assoc' || r.pool === 'intl-mixed'], ['club', (r) => !r.pool.startsWith('intl')]]) {
      const rows = acc.chase.filter(f);
      if (rows.length) console.log(`  ${key} ${name} chase (${rows.length}): predicted ${r0(mean(rows.map((r) => r.pNo)) * 100)} won ${r0(mean(rows.map((r) => r.y)) * 100)} ll ${r3(logLoss(rows.map((r) => ({ ...r, p: r.pNo }))))}:`, calibration(rows, (r) => r.pNo));
    }
    for (const [band, rows] of Object.entries(endBands(acc.end))) console.log(`  ${key} last balls, ${band} left (${rows.length}): worked out ${r3(logLoss(rows))} ${calibration(rows, (r) => r.p)} | curve alone ${r3(logLoss(rows.map((r) => ({ ...r, p: r.pCurve }))))} ${calibration(rows, (r) => r.pCurve)}`);
    console.log(`  ${key} first innings against par, by year:`, Object.entries(acc.bias).map(([y, a]) => `${y}: ${(Math.exp(mean(a)) * 100 - 100).toFixed(1)}%`).join(' '));
  }
  const err = (a) => (a.length ? r1(mean(a)) : null);
  return {
    matches: acc.matches,
    projected: Object.fromEntries(Object.entries(acc.proj).map(([b, e]) => [b / 6, { model: err(e.model), sameParEverywhere: err(e.same), runRate: err(e.rate), n: e.model.length }])),
    chase: {
      states: acc.chase.length,
      logLoss: r3(logLoss(acc.chase)),
      withoutRatings: r3(logLoss(acc.chase.map((r) => ({ ...r, p: r.pNo })))),
      sameParEverywhere: r3(logLoss(acc.chase.map((r) => ({ ...r, p: r.pFlat })))),
      requiredRateOnly: r3(logLoss(acc.chase.map((r) => ({ ...r, p: r.pBase })))),
      brier: r3(brier(acc.chase)),
      calibration: bins(acc.chase),
      byYear: Object.fromEntries(Object.entries(by(acc.chase, (r) => r.year)).map(([y, rows]) => [y, { predicted: r1(mean(rows.map((r) => r.p)) * 100), won: r1(mean(rows.map((r) => r.y)) * 100), logLoss: r3(logLoss(rows)) }])),
    },
    // The last twenty-four balls of each chase, by how many are left: log loss with the last balls worked
    // out and with the curve alone.
    lastBalls: Object.fromEntries(Object.entries(endBands(acc.end)).map(([band, rows]) => [band, { states: rows.length, logLoss: r4(logLoss(rows)), curveAlone: r4(logLoss(rows.map((r) => ({ ...r, p: r.pCurve })))), calibration: bins(rows), curveCalibration: bins(rows.map((r) => ({ ...r, p: r.pCurve }))) }])),
    first: { states: acc.first.length, logLoss: r3(logLoss(acc.first)), withoutRatings: r3(logLoss(acc.first.map((r) => ({ ...r, p: r.pNo })))), brier: r3(brier(acc.first)), calibration: bins(acc.first) },
    preMatch: { matches: acc.pre.length, logLoss: r3(logLoss(acc.pre)), coinFlip: r3(Math.log(2)), favouriteWon: r1((acc.pre.filter((r) => (r.p > 0.5) === (r.y === 1)).length / acc.pre.length) * 100) },
    settings,
  };
}

/** States with 1–3, 4–6, 7–12 and 13–24 balls left. */
const endBands = (rows) => Object.fromEntries([[1, 3], [4, 6], [7, 12], [13, 24]].map(([lo, hi]) => [`${lo}-${hi}`, rows.filter((r) => r.left >= lo && r.left <= hi)]));

/** Predicted against actual, in tenths: [[mean predicted %, actual %, states], ...]. */
function bins(rows) {
  return Array.from({ length: 10 }, (_, i) => {
    const rr = rows.filter((r) => Math.min(9, Math.floor(r.p * 10)) === i);
    return rr.length ? [r1(mean(rr.map((r) => r.p)) * 100), r1(mean(rr.map((r) => r.y)) * 100), rr.length] : null;
  }).filter(Boolean);
}
const calibration = (rows, f) =>
  Array.from({ length: 10 }, (_, i) => {
    const rr = rows.filter((r) => Math.min(9, Math.floor(f(r) * 10)) === i);
    return rr.length > 30 ? `${r0(mean(rr.map(f)) * 100)}→${r0(mean(rr.map((r) => r.y)) * 100)}` : '';
  })
    .filter(Boolean)
    .join(' ');

/* ------------------------------------------------------------------ ground records for the page */

const score = (inn) => (inn ? [inn.runs, inn.wkts] : null);
const resultOf = (m) => (m.result === 'win' ? m.winner : m.result);

// The last five years when they hold enough matches to say something, or every year otherwise.
const FIVE_YEARS_AGO = new Date(Date.parse(through) - 5 * YEAR).toISOString().slice(0, 10);
function lately(list) {
  const recent = list.filter((m) => m.date >= FIVE_YEARS_AGO);
  return recent.filter((m) => m.result === 'win' || m.result === 'tie').length >= 8 ? recent : list;
}

/**
 * A ground's records in a one-day format: one for each kind of match played there (`of`:
 * 'intl' or a league), and one for all of them (`of`: null) when there's more than one kind.
 */
function oneDayRecords(list, F) {
  const pools = [...Map.groupBy(list, poolOf)];
  const out = pools.map(([of, ms]) => ({ of, ...oneDayRecord(lately(ms), F) }));
  // The record for them all stands in for a kind of match rarely played there; its last few matches
  // would only repeat the others'.
  if (pools.length > 1) out.push({ of: null, ...oneDayRecord(lately(list), F), last: undefined });
  return out.filter((r) => r.n);
}

/** A ground's record in a one-day format: how first and second innings go, the toss, the phases. */
function oneDayRecord(list, F) {
  const decided = list.filter((m) => m.result === 'win' || m.result === 'tie');
  if (decided.length < 3) return null;
  const full = list.filter((m) => complete(m, F));
  const firsts = full.map((m) => m.inns[0].runs);
  const seconds = full.map((m) => m.inns[1].runs);
  const tossed = decided.filter((m) => m.toss);
  // Each phase's runs and wickets in complete first innings; the three add up to the whole innings.
  const [p1, p2] = F.phases;
  const phased = full.filter((m) => m.inns[0].c?.length);
  const at = (inn, b) => (inn.c.length ? [inn.c[Math.min(b, inn.c.length) - 1], inn.w[Math.min(b, inn.w.length) - 1]] : [0, 0]);
  const phases = phased.length
    ? [
        [mean(phased.map((m) => at(m.inns[0], p1)[0])), mean(phased.map((m) => at(m.inns[0], p1)[1]))],
        [mean(phased.map((m) => at(m.inns[0], p2)[0] - at(m.inns[0], p1)[0])), mean(phased.map((m) => at(m.inns[0], p2)[1] - at(m.inns[0], p1)[1]))],
        [mean(phased.map((m) => m.inns[0].runs - at(m.inns[0], p2)[0])), mean(phased.map((m) => m.inns[0].wkts - at(m.inns[0], p2)[1]))],
      ].map(([r, w]) => [r0(r), r1(w)])
    : null;
  const high = list.flatMap((m) => m.inns.slice(0, 2).map((i) => [i.runs, i.team, m.date.slice(0, 4)])).sort((a, b) => b[0] - a[0])[0] ?? null;
  const chases = decided.filter((m) => m.inns[1] && m.winner === m.inns[1].team).map((m) => [m.inns[1].runs, m.inns[1].team, m.date.slice(0, 4)]);
  return {
    n: decided.length,
    since: list[0].date.slice(0, 4),
    first: firsts.length ? [r0(mean(firsts)), firsts.length] : null,
    second: seconds.length ? [r0(mean(seconds)), seconds.length] : null,
    batFirst: decided.filter((m) => m.winner === m.inns[0]?.team).length,
    chasing: decided.filter((m) => m.inns[1] && m.winner === m.inns[1].team).length,
    tied: decided.filter((m) => m.result === 'tie').length,
    toss: tossed.length ? { n: tossed.length, field: tossed.filter((m) => m.toss[1] === 'field').length, won: tossed.filter((m) => m.winner === m.toss[0]).length } : null,
    phases,
    high,
    bestChase: chases.sort((a, b) => b[0] - a[0])[0] ?? null,
    last: list
      .filter((m) => m.result)
      .slice(-3)
      .reverse()
      .map((m) => ({ date: m.date, a: [m.inns[0]?.team ?? m.teams[0], ...(score(m.inns[0]) ?? [])], b: [m.inns[1]?.team ?? m.teams.find((t) => t !== m.inns[0]?.team), ...(score(m.inns[1]) ?? [])], result: resultOf(m), dl: m.dl || undefined })),
  };
}

/** A ground's record in Tests or first-class matches: each innings' average and how matches ended. */
function longRecord(list) {
  const ended = list.filter((m) => m.result === 'win' || m.result === 'draw' || m.result === 'tie');
  if (ended.length < 2) return null;
  const inns = [0, 1, 2, 3].map((i) => {
    const xs = ended.filter((m) => m.inns[i] && !m.inns[i].forf).map((m) => m.inns[i].runs);
    return xs.length ? [r0(mean(xs)), xs.length] : null;
  });
  const chases = ended.filter((m) => m.inns.length === 4 && m.winner === m.inns[3].team).map((m) => [m.inns[3].runs, m.inns[3].team, m.date.slice(0, 4)]);
  return {
    n: ended.length,
    since: list[0].date.slice(0, 4),
    inns,
    batFirst: ended.filter((m) => m.winner && m.winner === m.inns[0]?.team).length,
    batSecond: ended.filter((m) => m.winner && m.winner !== m.inns[0]?.team).length,
    drawn: ended.filter((m) => m.result === 'draw').length,
    tied: ended.filter((m) => m.result === 'tie').length,
    bestChase: chases.sort((a, b) => b[0] - a[0])[0] ?? null,
    last: ended
      .slice(-3)
      .reverse()
      .map((m) => ({ date: m.date, teams: m.teams, result: resultOf(m) })),
  };
}

/** The runs a side batting last in a Test needs: what it trails by after three innings, plus one. */
function fourthTarget(m) {
  if (m.inns.length !== 4) return null;
  const side = m.inns[3].team;
  const theirs = m.inns.slice(0, 3).reduce((s, i) => s + (i.team === side ? -i.runs : i.runs), 0);
  return theirs + 1;
}

/** How Test chases of each size have gone: [{ from, to, n, won, drawn, lost }]. */
function chaseTable(list) {
  const bands = [[0, 99], [100, 149], [150, 199], [200, 249], [250, 299], [300, 349], [350, 399], [400, Infinity]];
  const rows = list.filter((m) => m.result && m.result !== 'no result').map((m) => ({ target: fourthTarget(m), m })).filter((r) => r.target > 0);
  return bands.map(([from, to]) => {
    const rr = rows.filter((r) => r.target >= from && r.target <= to);
    const side = (r) => r.m.inns[3].team;
    return { from, to: Number.isFinite(to) ? to : null, n: rr.length, won: rr.filter((r) => r.m.winner === side(r)).length, drawn: rr.filter((r) => r.m.result === 'draw' || r.m.result === 'tie').length, lost: rr.filter((r) => r.m.winner && r.m.winner !== side(r)).length };
  });
}

/* ------------------------------------------------------------------ run */

const report = {};
for (const key of Object.keys(FORMATS)) {
  const t0 = Date.now();
  report[key] = validate(key);
  console.log(key, JSON.stringify({ ...report[key], chase: { ...report[key].chase, calibration: undefined }, lastBalls: Object.fromEntries(Object.entries(report[key].lastBalls).map(([b, x]) => [b, { ...x, calibration: undefined, curveCalibration: undefined }])), first: { ...report[key].first, calibration: undefined } }), `${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
if (process.env.VALIDATE_ONLY) process.exit(0);

// The site's model: everything refitted on every match.
const AT = Date.parse(through) + DAY;
const model = { built: new Date().toISOString().slice(0, 10), through, formats: {}, tests: {}, validation: { years: YEARS, report } };
const ratings = { through, formats: {} };
const records = new Map(grounds.map((g) => [g.id, {}]));
const byGround = (list) => Map.groupBy(list, (m) => m.g);
for (const [key, F] of Object.entries(FORMATS)) {
  const fit = fitFormat(key, AT);
  const { levelFit, shape, chase, first, gamma, elo } = fit;
  model.formats[key] = {
    at: new Date(AT).toISOString().slice(0, 10),
    balls: F.balls,
    trend: r4(levelFit.trend),
    levels: Object.fromEntries(Object.entries(levelFit.levels).map(([c, x]) => [c, r1(x)])),
    shape,
    chase,
    first,
    gamma,
    elo: { K: elo.K, home: elo.H, tier: elo.T },
  };
  // Ratings for sides that have played in the last three years.
  const active = [...elo.run.R.entries()].filter(([t]) => elo.run.last.get(t) >= new Date(AT - 3 * YEAR).toISOString().slice(0, 10));
  ratings.formats[key] = Object.fromEntries(active.sort((a, b) => b[1] - a[1]).map(([t, r]) => [t, [r0(r), elo.run.n.get(t)]]));
  for (const [g, list] of byGround(matches.filter((m) => m.kind === F.kind && m.gender === F.gender))) {
    const recs = g != null ? oneDayRecords(list, F) : [];
    if (!recs.length) continue;
    const hosts = Object.fromEntries([...fit.host.entries()].filter(([k]) => k.startsWith(`${g}|`)).map(([k, t]) => [k.slice(k.indexOf('|') + 1), t]));
    records.get(g)[key] = { lean: r3(levelFit.lean[g] ?? 0), ...(Object.keys(hosts).length ? { hosts } : null), records: recs };
  }
  console.log(`${key}: fitted to ${through}, trend ${r4(levelFit.trend)} a year, ${active.length} rated sides`);
}
for (const [key, pick] of Object.entries(LONG)) {
  const list = matches.filter(pick);
  for (const [g, ms] of byGround(list)) {
    const rec = g != null && longRecord(ms);
    if (rec) records.get(g)[key] = rec;
  }
  if (key !== 'fc-male') model.tests[key] = { chases: chaseTable(list), matches: list.length, since: list[0]?.date.slice(0, 4) };
}

const index = grounds
  .filter((g) => Object.keys(records.get(g.id)).length)
  .map((g) => ({ id: g.id, name: g.name, place: g.place, city: g.city, alias: g.alias, formats: records.get(g.id) }));
// The numbers the page quotes about how well it did on the seasons it never saw.
const about = {
  through,
  matches: matches.length,
  years: [YEARS[0], YEARS.at(-1)],
  tested: Object.fromEntries(
    Object.entries(report).map(([key, r]) => {
      const mid = FORMATS[key].balls === 120 ? 10 : 25;
      const bin = r.chase.calibration.find(([p]) => p >= 70 && p < 80);
      return [key, { matches: r.matches, overs: mid, projected: r.projected[mid].model, runRate: r.projected[mid].runRate, chase: bin && { said: r0(bin[0]), won: r0(bin[1]) }, favouriteWon: r0(r.preMatch.favouriteWon) }];
    }),
  ),
};
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'about.json'), JSON.stringify(about, null, 1));
await writeFile(join(OUT, 'model.json'), JSON.stringify(model));
await writeFile(join(OUT, 'grounds.json'), JSON.stringify({ through, grounds: index }));
await writeFile(join(OUT, 'ratings.json'), JSON.stringify(ratings));
console.log(`wrote model, ${index.length} grounds, ratings`);
