// Matchday's cricket model at work: projected totals, win chances and par scores from the tables
// scripts/sport/fit-cricket.mjs learns from Cricsheet's ball-by-ball history. Pure functions over
// those tables, shared by the fit (to score itself on matches it never saw) and the site.
//
// One idea runs through it: from any point in an innings, how many more runs a side makes depends on
// the balls and wickets it has left, scaled to how high-scoring the match is (its par: what a first
// innings makes at that ground in that competition). Everything else is built on that.

const SQRT8PI = Math.sqrt(8 / Math.PI);
const logistic = (z) => 1 / (1 + Math.exp(-z));
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Standard normal cumulative distribution (Abramowitz and Stegun 26.2.17, error under 1e-7). */
export function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - p : p;
}

/**
 * The share of a par innings still to come with `left` balls left and `down` wickets down:
 * { mean, sd }, both as fractions of par. shape: { balls, z: [10], b: [10], sdA, sdB } from the fit,
 * where mean = z[w]·(1 − e^(−b[w]·left/balls)), the form the Duckworth–Lewis method uses.
 */
export function runsLeft(shape, left, down) {
  if (left <= 0 || down >= 10) return { mean: 0, sd: 0 };
  const w = clamp(Math.round(down), 0, 9);
  const mean = shape.z[w] * (1 - Math.exp((-shape.b[w] * left) / shape.balls));
  return { mean, sd: shape.sdA * Math.pow(mean, shape.sdB) };
}

/**
 * Where an innings is heading: { mean, sd, lo, hi } in runs, lo and hi bracketing the middle 80%.
 * state: { runs, balls (bowled), wickets }, par: the match's par first-innings score.
 */
export function projectTotal(shape, state, par) {
  const left = shape.balls - state.balls;
  const r = runsLeft(shape, left, state.wickets);
  const mean = state.runs + par * r.mean;
  const sd = par * r.sd;
  return { mean, sd, lo: Math.max(state.runs, mean - 1.2816 * sd), hi: mean + 1.2816 * sd };
}

/**
 * What the chase model reads from a chase: [1, u, x, x·u, t, t·u], where x is how far the runs the
 * side can expect exceed what it needs, in spreads (standard deviations), t is the target against
 * par (a big first innings says the pitch is good for batting too) and u is the share of the
 * innings still to come, so each weight can change as the chase goes on.
 * state: { need, left (balls), wickets (down), target }.
 */
export function chaseInputs(shape, state, par) {
  const r = runsLeft(shape, state.left, state.wickets);
  const x = (par * r.mean - state.need + 0.5) / Math.max(par * r.sd, 1);
  const t = state.target / par - 1;
  const u = state.left / shape.balls;
  return [1, u, x, x * u, t, t * u];
}

/**
 * The chance a chasing side wins. chase: { coef } from the fit, a weight for each of chaseInputs:
 * logit = (a0 + a1·u) + (b0 + b1·u)·x + (c0 + c1·u)·t.
 */
export function chaseWin(shape, chase, state, par) {
  if (state.need <= 0) return 1;
  if (state.left <= 0 || state.wickets >= 10) return 0;
  const z = chaseInputs(shape, state, par).reduce((s, v, i) => s + v * chase.coef[i], 0);
  return clamp(logistic(z), 0.001, 0.999);
}

/**
 * The chance the side batting first wins, from where its total is heading against par.
 * first: { a, b } from the fit: P(win | final total T) = σ(a + b·(T/par − 1)). Averaged over the
 * projected total's spread with the probit approximation of the logistic.
 * state: { runs, balls, wickets }.
 */
export function firstWin(shape, first, state, par) {
  const p = projectTotal(shape, state, par);
  const mu = first.a + first.b * (p.mean / par - 1);
  const s = (first.b * p.sd) / par;
  return clamp(normCdf(mu / Math.sqrt(SQRT8PI * SQRT8PI + s * s)), 0.001, 0.999);
}

/** Elo: the chance side A beats side B. ratings in Elo points; home: +1 if A is at home, −1 if B is. */
export function eloWin(elo, ra, rb, home = 0) {
  return 1 / (1 + Math.pow(10, -(ra - rb + elo.home * home) / 400));
}

/**
 * A side's rating for one match: its Elo, plus the full members' edge in an international. Full
 * members and associates mostly play among themselves, so their ratings form two ladders; elo.tier
 * is the gap between them, learned from the matches where they meet.
 */
export function ratingIn(elo, rating, team, international) {
  return rating + (international && FULL_MEMBERS.has(nation(team)) ? (elo.tier ?? 0) : 0);
}

/**
 * Win chances with team strength: the scores' answer, nudged by the ratings while there's plenty of
 * the match left (the nudge fades as the match goes on). p: the scores' chance for the side,
 * strength: that side's rating chance, rest: the share of the match still to play (1 to 0).
 */
export function withStrength(p, strength, rest, gamma) {
  const logit = (q) => Math.log(q / (1 - q));
  return clamp(logistic(logit(p) + gamma * rest * logit(strength)), 0.001, 0.999);
}

const YEAR = 365.25 * 864e5;

/**
 * Par first-innings score for a ground in a competition: its level times the ground's own lean,
 * carried forward by the format's scoring trend for the time since the fit (at most a year).
 * model: one format's tables; ground: that ground's record in the format, if there is one.
 */
export function parFor(model, comp, ground, now = Date.now()) {
  const level = model.levels[comp] ?? model.levels['*'];
  const since = clamp((now - Date.parse(model.at)) / YEAR, 0, 1);
  return level * Math.exp((ground?.lean ?? 0) + (model.trend ?? 0) * since);
}

// The twelve full members of the ICC. A match between two of them scores differently from a
// qualifier between associates, so internationals are levelled by who's playing.
export const FULL_MEMBERS = new Set(['Afghanistan', 'Australia', 'Bangladesh', 'England', 'India', 'Ireland', 'New Zealand', 'Pakistan', 'South Africa', 'Sri Lanka', 'West Indies', 'Zimbabwe']);
const nation = (team) => String(team ?? '').replace(/\s+(Women|Wmn|W)$/i, '').trim();
const foldName = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`.]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// One competition under the names it has had over the years, and ESPN's names for it.
const SAME_COMP = {
  'natwest t20 blast': 'vitality blast',
  'vitality blast men': 'vitality blast',
  'vitality blast women': 'vitality blast',
  'royal london one day cup': 'one day cup',
  'metro bank one day cup': 'one day cup',
  'the marsh cup': 'australian one day cup',
  'marsh one day cup': 'australian one day cup',
  'one day cup australia': 'australian one day cup',
  'australian domestic one day competition': 'australian one day cup',
  'csa pro20': 'csa t20 challenge',
  'ram slam t20 challenge': 'csa t20 challenge',
  'miway t20 challenge': 'csa t20 challenge',
  'south africa domestic t20 pro20': 'csa t20 challenge',
  'mens super smash': 'super smash',
  'hrv cup': 'super smash',
  'hrv twenty20': 'super smash',
  'new zealand cricket womens twenty20': 'womens super smash',
  'rachael heyhoe flint trophy': 'ecb womens one day cup',
  'womens one day cup': 'ecb womens one day cup',
};

/**
 * The competition a match is levelled against: a league by its name without the season
 * ("Indian Premier League 2027" → "indian premier league"), internationals by who's playing
 * ("intl-full", "intl-mixed" or "intl-assoc").
 */
export function compKey({ club, event, teams = [] }) {
  if (!club) {
    const full = teams.filter((t) => FULL_MEMBERS.has(nation(t))).length;
    return `intl-${full === 2 ? 'full' : full === 1 ? 'mixed' : 'assoc'}`;
  }
  const name = foldName(event).replace(/\b(19|20)\d\d(\s+\d{2,4})?\b/g, '').replace(/\s+/g, ' ').trim();
  return SAME_COMP[name] ?? (name || 'club');
}
