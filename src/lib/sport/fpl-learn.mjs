// Teaching the projections from what happened. The model in fpl.mjs projects each player's points
// part by part (appearance, goals, assists, clean sheet, goals conceded, saves, defensive
// contributions, bonus, cards); here every past gameweek is projected again from only what was known
// before its deadline, set against what FPL actually paid for each part, and the model's
// systematic misses are measured and fitted. scripts/sport/fit-fpl.mjs runs it every week.
import { GOAL_PTS, CS_PTS, DC_NEED, buildModel, withMatchups, projectFixture, countTail } from './fpl.mjs';
import { rateTeams, goalRates } from './forecast.mjs';
import { roleFactor } from './matchups.mjs';

/** The parts of a player's score, as projectFixture splits it; "other" (own goals, penalties) isn't projected. */
export const PART_KEYS = ['app', 'goals', 'assists', 'cs', 'gc', 'saves', 'dc', 'bonus', 'cards', 'other'];

/** What FPL paid one player for one match, part by part, from that match's stats (FPL's names for them). */
export function partsFromStats(type, s) {
  const v = (k) => Number(s[k] ?? 0) || 0;
  const min = v('minutes');
  return {
    app: min >= 60 ? 2 : min > 0 ? 1 : 0,
    goals: (GOAL_PTS[type] ?? 0) * v('goals_scored'),
    assists: 3 * v('assists'),
    cs: (CS_PTS[type] ?? 0) * v('clean_sheets'),
    gc: type <= 2 ? -Math.floor(v('goals_conceded') / 2) || 0 : 0,
    saves: type === 1 ? Math.floor(v('saves') / 3) : 0,
    dc: DC_NEED[type] && v('defensive_contribution') >= DC_NEED[type] ? 2 : 0,
    bonus: v('bonus'),
    cards: -v('yellow_cards') - 3 * v('red_cards') || 0,
    other: -2 * v('own_goals') + 5 * v('penalties_saved') - 2 * v('penalties_missed') || 0,
  };
}

const FROM_FPL = { minutes: 'app', goals_scored: 'goals', assists: 'assists', clean_sheets: 'cs', goals_conceded: 'gc', saves: 'saves', defensive_contribution: 'dc', bonus: 'bonus', yellow_cards: 'cards', red_cards: 'cards' };

/** The same from FPL's own breakdown of a gameweek (its live endpoint's `explain`). */
export function partsFromExplain(explain = []) {
  const out = Object.fromEntries(PART_KEYS.map((k) => [k, 0]));
  for (const x of explain) for (const s of x.stats) out[FROM_FPL[s.identifier] ?? 'other'] += s.points;
  return out;
}

/** A season's history file (scripts/sport/build-fpl-history.mjs) with its rows as objects, by gameweek. */
export function readHistory(file) {
  const rows = file.rows.map((r) => {
    const o = Object.fromEntries(file.fields.map((k, i) => [k, r[i]]));
    o.parts = Object.fromEntries(file.parts.map((k, i) => [k, o.parts[i]]));
    o.type = file.players[o.id]?.type;
    return o;
  });
  const byGw = {};
  for (const r of rows) (byGw[r.gw] ??= []).push(r);
  const gws = Object.keys(byGw).map(Number).sort((a, b) => a - b);
  // FPL's deadline is an hour and a half before a gameweek's first kick-off.
  const deadline = {};
  for (const f of file.fixtures) if (f.event && f.kickoff) deadline[f.event] = Math.min(deadline[f.event] ?? Infinity, Date.parse(f.kickoff) - 90 * 60e3);
  return { ...file, rows, byGw, gws, deadline };
}

const TOTALS = ['min', 'starts', 'xg', 'xa', 'xgc', 'saves', 'bonus', 'dc', 'yc', 'goals', 'assists'];

/**
 * The players as FPL's API showed them before gameweek `gw`'s deadline: each one's season totals of
 * the gameweeks before it, in the fields fpl.mjs projects from. FPL's injury flags weren't kept, so
 * `out` (ids FPL had ruled out) stands in for them.
 */
export function playersBefore(h, gw, out = new Set()) {
  const sums = {};
  for (const g of h.gws) {
    if (g >= gw) break;
    for (const r of h.byGw[g]) {
      const s = (sums[r.id] ??= Object.fromEntries(TOTALS.map((k) => [k, 0])));
      for (const k of TOTALS) s[k] += r[k] ?? 0;
    }
  }
  const teamNow = Object.fromEntries((h.byGw[gw] ?? []).map((r) => [r.id, r.team]));
  // His last three matches before it, newest first: [share of the match's starts he made, minutes].
  const recent = {};
  for (let i = h.gws.indexOf(gw) - 1; i >= 0; i--) {
    for (const r of h.byGw[h.gws[i]] ?? []) {
      const list = (recent[r.id] ??= []);
      if (list.length < 3 && r.fixtures.length) list.push([r.starts / r.fixtures.length, r.min]);
    }
  }
  return Object.entries(h.players).map(([key, p]) => {
    const id = Number(key);
    const s = sums[id] ?? Object.fromEntries(TOTALS.map((k) => [k, 0]));
    return {
      id,
      name: p.name,
      type: p.type,
      team: teamNow[id] ?? p.team,
      minutes: s.min,
      starts: s.starts,
      xg: s.xg,
      xa: s.xa,
      xgc: s.xgc,
      saves: s.saves,
      bonus: s.bonus,
      yc: s.yc,
      dc90: s.min > 0 ? (s.dc / s.min) * 90 : 0,
      recent: recent[id] ?? [],
      playing: out.has(id) ? 0 : null,
    };
  });
}

/**
 * The matchup kit as it stood before a deadline: team ratings from the matches played by then,
 * role factors from earlier seasons only (this season's are totals that include later matches),
 * and players' roles where the matchup data knows them. ix: index.json; learned: netxg-model.json.
 */
export function kitBefore(ix, h, deadline, { learned = null, roles = {} } = {}) {
  const fplTeams = Object.fromEntries(h.teams.filter((t) => t.espn).map((t) => [t.id, t.espn]));
  const seasons = ix.seasons.filter((s) => s < h.season);
  const wPos = learned?.xg?.weights?.position ?? 1;
  return {
    ratings: rateTeams(ix.games, { asOf: deadline }),
    goalRates,
    fplTeams,
    roles,
    roleFactor: (opp, role) => roleFactor(ix.conceded[opp], ix.league, role, seasons).factor ** wPos,
  };
}

/**
 * Every player's projection for gameweek `gw` from only what was known before its deadline, part by
 * part, next to what he then scored. Matches are rated by the bookmakers' prices, as live.
 * → [{ id, type, xp, parts, pApp, p60, mins, row }] for players whose club played that gameweek.
 */
export function replayWeek(h, gw, kit, { learned = null, out } = {}) {
  const elements = playersBefore(h, gw, out);
  const byId = Object.fromEntries(elements.map((e) => [e.id, e]));
  const fixtures = h.fixtures.filter((f) => f.event === gw);
  const byFixture = Object.fromEntries(fixtures.filter((f) => f.odds).map((f) => [f.id, { home: f.odds[0], away: f.odds[1] }]));
  const model = { ...withMatchups(buildModel(elements), kit), byFixture, learned };
  const ctx = { elements: byId, live: {}, fixtures: [], bonus: {}, model, from: gw, now: h.deadline[gw] };
  const out2 = [];
  for (const row of h.byGw[gw] ?? []) {
    const el = byId[row.id];
    const fx = fixtures.filter((f) => f.home === el?.team || f.away === el?.team);
    if (!el || !fx.length) continue;
    const ps = fx.map((f) => projectFixture(row.id, f, ctx));
    const parts = Object.fromEntries(PART_KEYS.map((k) => [k, ps.reduce((t, p) => t + (p.parts?.[k] ?? 0), 0)]));
    // What the minutes fit learns from, all known before the deadline: his share of his club's starts
    // so far (also who counts as a regular), his last three matches and his minutes per start.
    const teamN = Math.round(model.teams[el.team]?.n ?? 0);
    const share = el.starts / Math.max(1, teamN);
    const last = el.recent.slice(0, 3);
    const features = { teamN, share: Math.min(1, share), s1: el.recent[0]?.[0] ?? null, s3: last.length ? last.reduce((t, x) => t + x[0], 0) / last.length : null, a1: el.recent[0] ? (el.recent[0][1] > 0 ? 1 : 0) : null, perStart: el.starts > 0 ? Math.min(90, el.minutes / el.starts) : null, dc90: el.dc90 };
    out2.push({ id: row.id, type: el.type, xp: ps.reduce((t, p) => t + p.xp, 0), parts, pApp: ps.reduce((t, p) => t + p.pApp, 0), p60: ps.reduce((t, p) => t + p.p60, 0), mins: ps.reduce((t, p) => t + p.mins, 0), n: fx.length, share, features, row });
  }
  return out2;
}

/* ------------------------------------------------------------------------------- fitting */

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const dot = (b, x) => b.reduce((t, v, i) => t + v * x[i], 0);

/** Solves A x = b (Gaussian elimination with pivoting). */
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const k = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) x[r] = (M[r][n] - M[r].slice(r + 1, n).reduce((t, v, j) => t + v * x[r + 1 + j], 0)) / M[r][r];
  return x;
}

/** Logistic regression by Newton's method, with a little ridge for stability. → coefficients. */
export function logistic(X, y, { l2 = 1e-3, iters = 40 } = {}) {
  const k = X[0].length;
  let b = new Array(k).fill(0);
  for (let it = 0; it < iters; it++) {
    const g = new Array(k).fill(0);
    const H = Array.from({ length: k }, () => new Array(k).fill(0));
    X.forEach((x, i) => {
      const p = sigmoid(dot(b, x));
      const w = p * (1 - p);
      for (let a = 0; a < k; a++) {
        g[a] += (y[i] - p) * x[a];
        for (let c = 0; c < k; c++) H[a][c] += w * x[a] * x[c];
      }
    });
    for (let a = 0; a < k; a++) {
      g[a] -= l2 * b[a];
      H[a][a] += l2;
    }
    const step = solve(H, g);
    b = b.map((v, i) => v + step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-9) break;
  }
  return b;
}

/** Least squares: coefficients of y on X. */
export function linear(X, y) {
  const k = X[0].length;
  const A = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, c) => X.reduce((t, x) => t + x[a] * x[c], 0)));
  const b = Array.from({ length: k }, (_, a) => X.reduce((t, x, i) => t + x[a] * y[i], 0));
  return solve(A, b);
}

const r4 = (v) => Math.round(v * 1e4) / 1e4;

/**
 * The minutes model (fpl.mjs learnedMinutes) from replayed weeks: who started, who came on and for how
 * long, against what was known before each deadline. Single-match weeks of clubs three matches in.
 */
export function fitMinutes(rows) {
  const ex = rows.filter((r) => r.n === 1 && r.features.teamN >= 3 && r.features.s1 != null);
  const f = (r) => r.features;
  const start = logistic(ex.map((r) => [1, f(r).share, f(r).s1, f(r).s3, f(r).share * f(r).s1]), ex.map((r) => (r.row.starts > 0 ? 1 : 0)));
  const bench = ex.filter((r) => !(r.row.starts > 0));
  const sub = logistic(bench.map((r) => [1, f(r).share, f(r).a1, f(r).s3]), bench.map((r) => (r.row.min > 0 ? 1 : 0)));
  const started = ex.filter((r) => r.row.starts > 0);
  const known = started.filter((r) => f(r).perStart != null);
  const fresh = started.filter((r) => f(r).perStart == null);
  // A first start of the season plays about as long as a typical start does.
  const perStart = fresh.length >= 20 ? fresh.reduce((t, r) => t + r.row.min, 0) / fresh.length : 75;
  const minStart = linear(known.map((r) => [1, f(r).perStart]), known.map((r) => r.row.min));
  const p60 = logistic(known.map((r) => [1, f(r).perStart / 90]), known.map((r) => (r.row.min >= 60 ? 1 : 0)));
  const subs = bench.filter((r) => r.row.min > 0);
  return {
    start: start.map(r4),
    sub: sub.map(r4),
    minStart: minStart.map(r4),
    p60: p60.map(r4),
    minSub: r4(subs.reduce((t, r) => t + r.row.min, 0) / Math.max(1, subs.length)),
    perStart: r4(perStart),
    examples: ex.length,
  };
}

/**
 * How much defensive contributions bunch, by position: the negative binomial size that best explains
 * who reached FPL's line, from his rate per 90 before the match and the minutes he then played.
 */
export function fitDc(rows) {
  const out = {};
  for (const t of [2, 3, 4]) {
    const ex = rows.filter((r) => r.type === t && r.n === 1 && r.row.min > 0 && r.features.dc90 > 0);
    let best = { size: null, ll: -Infinity };
    for (const size of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 30, 50, 100]) {
      let ll = 0;
      for (const r of ex) {
        const p = Math.min(1 - 1e-9, Math.max(1e-9, countTail((r.features.dc90 * r.row.min) / 90, DC_NEED[t], size)));
        ll += r.row.parts.dc > 0 ? Math.log(p) : Math.log(1 - p);
      }
      if (ll > best.ll) best = { size, ll };
    }
    out[t] = best.size;
  }
  return out;
}

/* ------------------------------------------------------------------------------- checking */

const avg = (a) => (a.length ? a.reduce((t, v) => t + v, 0) / a.length : null);
const ranks = (a) => {
  const order = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const out = new Array(a.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    for (let k = i; k <= j; k++) out[order[k][1]] = (i + j) / 2;
    i = j + 1;
  }
  return out;
};
const pearson = (a, b) => {
  const ma = avg(a);
  const mb = avg(b);
  let n = 0;
  let da = 0;
  let db = 0;
  a.forEach((v, i) => {
    n += (v - ma) * (b[i] - mb);
    da += (v - ma) ** 2;
    db += (b[i] - mb) ** 2;
  });
  return da && db ? n / Math.sqrt(da * db) : 0;
};

/**
 * One replayed gameweek scored without letting the projections pick who's judged: squared and absolute
 * error and rank correlation over the regulars (started half their club's matches so far), and the
 * actual points of the 50 players projected highest.
 */
export function scoreWeek(rows) {
  const reg = rows.filter((r) => r.share >= 0.5);
  const pts = (r) => r.row.pts;
  return {
    sq: Math.sqrt(avg(reg.map((r) => (r.xp - pts(r)) ** 2))),
    abs: avg(reg.map((r) => Math.abs(r.xp - pts(r)))),
    rho: pearson(ranks(reg.map((r) => r.xp)), ranks(reg.map(pts))),
    top50: avg([...rows].sort((a, b) => b.xp - a.xp).slice(0, 50).map(pts)),
  };
}
