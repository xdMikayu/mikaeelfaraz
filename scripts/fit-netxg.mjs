#!/usr/bin/env node
// Learns the Net xG weights from past matches and tests them on a season the fit never saw.
//
// Every Premier League match since 2023/24 is replayed in date order. Before each match day, each
// player's factors are computed from what was known at the time (nothing from that day or later):
//   base     his xG per 90 over the previous two years, pulled towards his position's average
//   form     his last five matches against that rate
//   defence  the opponent's defence rating from matches before that day
//   venue    home or away
//   position the share of the opponent's concessions going to his position (this season and last)
//   history  his xG per 90 against this opponent before, against his usual rate
// The target is the xG he actually got in the match, given the minutes he actually played (how
// many minutes he'll play is a separate question).
//
// The model: log E[xG] = log(minutes / 90) + b0 + b_base·log(base) + b_form·log(form) + ...
// a Poisson regression fitted by iteratively reweighted least squares. A weight of 1 means "apply
// the factor in full", 0 means "it predicts nothing". The small-sample shrinkage for form and
// history is chosen by grid search on the training season.
//
//   node scripts/sport/fit-netxg.mjs        # writes public/sport/data/pl/netxg-model.json
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rateTeams } from '../../src/lib/sport/forecast.mjs';
import { roleFactor, ROLES } from '../../src/lib/sport/matchups.mjs';
import { rawFactors, designRow, FEATURES } from '../../src/lib/sport/netxg.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const seasonOf = (d) => (Number(d.slice(5, 7)) >= 7 ? Number(d.slice(0, 4)) : Number(d.slice(0, 4)) - 1);
const seasons = [2023, 2024, 2025, 2026];
const matches = [];
for (const s of seasons) {
  const data = JSON.parse(await readFile(join(ROOT, `data/sport/pl-matches/${s}.json`), 'utf8').catch(() => '{}'));
  for (const [id, m] of Object.entries(data)) matches.push({ id, ...m });
}
matches.sort((a, b) => a.d.localeCompare(b.d));
console.log(`${matches.length} matches`);

// Team match logs in the shape rateTeams wants, built from the same matches.
const games = {};
for (const m of matches) {
  (games[m.h] ??= []).push([m.d, m.a, 1, m.hs, m.as, m.xh, m.xa]);
  (games[m.a] ??= []).push([m.d, m.h, 0, m.as, m.hs, m.xa, m.xh]);
}

// Running state, updated after each match day.
const player = {}; // id -> [[date, opp, min, xg, xa]]
const conceded = {}; // team -> season -> role -> [min, xg, xa, 0, 0]
const league = {}; // season -> role -> [min, xg, xa, 0, 0]
const posRate = {}; // role -> [min, xg, xa]

const rows = [];
const byDate = new Map();
for (const m of matches) (byDate.get(m.d) ?? byDate.set(m.d, []).get(m.d)).push(m);

let ratingsFor = null;
let ratingsDate = '';
for (const [date, list] of byDate) {
  const season = seasonOf(date);
  if (season >= 2024) {
    // Ratings from every match before this day; refit weekly to keep the run quick.
    if (!ratingsFor || date > ratingsDate) {
      const asOf = new Date(date).getTime() - 864e5;
      ratingsFor = rateTeams(games, { asOf });
      ratingsDate = new Date(asOf + 7 * 864e5).toISOString().slice(0, 10);
    }
    const r = ratingsFor;
    const teamsNow = Object.keys(games);
    const meanDef = teamsNow.reduce((t, id) => t + (r.def[id] ?? 1), 0) / teamsNow.length;
    const sList = [season, season - 1, season - 2].map(String);
    for (const m of list) {
      for (const [id, , home, role, min, , xg, , xa] of m.r) {
        if (min < 15 || role === 'GK') continue;
        const opp = home ? m.a : m.h;
        const hist = player[id] ?? [];
        const twoYears = `${Number(date.slice(0, 4)) - 2}${date.slice(4)}`;
        const recent2y = hist.filter((h) => h[0] > twoYears);
        const lMin = recent2y.reduce((t, h) => t + h[2], 0);
        const lXg = recent2y.reduce((t, h) => t + h[3], 0);
        const pr = posRate[role];
        if (!pr || !pr[0]) continue;
        const pos90 = (pr[1] / pr[0]) * 90;
        const last5 = hist.slice(-5);
        const vs = hist.filter((h) => h[1] === opp);
        rows.push({
          date,
          season,
          y: xg,
          ya: xa,
          min,
          lMin,
          lXg,
          lXa: recent2y.reduce((t, h) => t + h[4], 0),
          pos90,
          pos90a: (pr[2] / pr[0]) * 90,
          rMin: last5.reduce((t, h) => t + h[2], 0),
          rXg: last5.reduce((t, h) => t + h[3], 0),
          rXa: last5.reduce((t, h) => t + h[4], 0),
          vMin: vs.reduce((t, h) => t + h[2], 0),
          vXg: vs.reduce((t, h) => t + h[3], 0),
          vXa: vs.reduce((t, h) => t + h[4], 0),
          defence: (r.def[opp] ?? 1) / meanDef,
          home: home ? 1 : 0,
          tilt: roleFactor(conceded[opp], league, role, sList).factor,
        });
      }
    }
  }
  // Now let the day's matches into the running state.
  for (const m of list) {
    for (const [id, , home, role, min, , xg, , xa] of m.r) {
      const opp = home ? m.a : m.h;
      (player[id] ??= []).push([date, opp, min, xg, xa]);
      const add = (row) => {
        row[0] += min;
        row[1] += xg;
        row[2] += xa;
      };
      add((((conceded[opp] ??= {})[season] ??= {})[role] ??= [0, 0, 0, 0, 0]));
      add(((league[season] ??= Object.fromEntries(ROLES.map((x) => [x, [0, 0, 0, 0, 0]])))[role]));
      add((posRate[role] ??= [0, 0, 0]));
    }
  }
}
console.log(`${rows.length} player-matches with features (2024/25 on)`);

/* ------------------------------------------------------------- features */

// The same factor definitions the live page uses (src/lib/sport/netxg.mjs).
function features(x, kForm, kHist, which) {
  const xa = which === 'xa';
  return designRow(
    rawFactors(
      {
        lMin: x.lMin,
        lX: xa ? x.lXa : x.lXg,
        rMin: x.rMin,
        rX: xa ? x.rXa : x.rXg,
        vMin: x.vMin,
        vX: xa ? x.vXa : x.vXg,
        pos90: xa ? x.pos90a : x.pos90,
        defence: x.defence,
        home: x.home,
        tilt: x.tilt,
      },
      kForm,
      kHist
    )
  );
}

/* ------------------------------------------------------------- Poisson regression (IRLS) */

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

function fitPoisson(X, y, offset, ridge = 1e-4) {
  const p = X[0].length;
  let beta = new Array(p).fill(0);
  beta[0] = Math.log(y.reduce((a, b) => a + b, 0) / offset.reduce((a, o) => a + Math.exp(o), 0));
  for (let it = 0; it < 30; it++) {
    const A = Array.from({ length: p }, () => new Array(p).fill(0));
    const b = new Array(p).fill(0);
    for (let i = 0; i < X.length; i++) {
      const eta = offset[i] + X[i].reduce((t, v, j) => t + v * beta[j], 0);
      const mu = Math.exp(eta);
      const z = eta - offset[i] + (y[i] - mu) / mu;
      for (let j = 0; j < p; j++) {
        b[j] += mu * X[i][j] * z;
        for (let k = 0; k < p; k++) A[j][k] += mu * X[i][j] * X[i][k];
      }
    }
    for (let j = 1; j < p; j++) A[j][j] += ridge * X.length;
    const next = solve(A, b);
    const moved = Math.max(...next.map((v, j) => Math.abs(v - beta[j])));
    beta = next;
    if (moved < 1e-7) break;
  }
  return beta;
}

const deviance = (y, mu) => y.reduce((t, v, i) => t + 2 * ((v > 0 ? v * Math.log(v / mu[i]) : 0) - (v - mu[i])), 0) / y.length;
const mae = (y, mu) => y.reduce((t, v, i) => t + Math.abs(v - mu[i]), 0) / y.length;
const corr = (a, b) => {
  const ma = a.reduce((t, v) => t + v, 0) / a.length;
  const mb = b.reduce((t, v) => t + v, 0) / b.length;
  let n = 0;
  let da = 0;
  let db = 0;
  a.forEach((v, i) => {
    n += (v - ma) * (b[i] - mb);
    da += (v - ma) ** 2;
    db += (b[i] - mb) ** 2;
  });
  return n / Math.sqrt(da * db);
};

function design(list, kForm, kHist, which) {
  return {
    X: list.map((x) => [1, ...features(x, kForm, kHist, which)]),
    y: list.map((x) => (which === 'xg' ? x.y : x.ya)),
    off: list.map((x) => Math.log(x.min / 90)),
  };
}
const predict = (X, off, beta) => X.map((row, i) => Math.exp(off[i] + row.reduce((t, v, j) => t + v * beta[j], 0)));

function evaluate(name, list, mu, which) {
  const y = list.map((x) => (which === 'xg' ? x.y : x.ya));
  return { name, deviance: deviance(y, mu), mae: mae(y, mu), corr: corr(y, mu) };
}

const train = rows.filter((x) => x.season === 2024);
const test = rows.filter((x) => x.season === 2025);
const latest = rows.filter((x) => x.season === 2026);
const report = {};
const model = { built: new Date().toISOString(), features: FEATURES };

for (const which of ['xg', 'xa']) {
  // Grid search the shrinkage on the training season, scored on its own later half (no peeking at the test season).
  const half = train.filter((x) => x.date < '2025-01-01');
  const later = train.filter((x) => x.date >= '2025-01-01');
  let best = null;
  for (const kForm of [0, 225, 450, 900, 1800, 3600, 1e9]) {
    for (const kHist of [0, 450, 900, 1800, 3600, 1e9]) {
      const d = design(half, kForm, kHist, which);
      const beta = fitPoisson(d.X, d.y, d.off);
      const v = design(later, kForm, kHist, which);
      const dev = deviance(v.y, predict(v.X, v.off, beta));
      if (!best || dev < best.dev) best = { kForm, kHist, dev };
    }
  }
  const dTrain = design(train, best.kForm, best.kHist, which);
  const beta = fitPoisson(dTrain.X, dTrain.y, dTrain.off);

  const score = (list, label) => {
    const d = design(list, best.kForm, best.kHist, which);
    // Baselines: his usual rate only (scaled to the league), and the hand-set Net xG (every factor in full).
    const usualOnly = fitPoisson(d.X.map((r) => [1, r[1]]), d.y, d.off);
    // Hand-set: every factor in full, home advantage of about 10% each way.
    const handSet = d.X.map((r, i) => Math.exp(d.off[i] + r[1] + r[2] + r[3] + r[4] * 2 * Math.log(1.1) + r[5] + r[6]));
    const handScale = d.y.reduce((a, b) => a + b, 0) / handSet.reduce((a, b) => a + b, 0);
    return {
      label,
      n: list.length,
      usualRate: evaluate('usual rate only', list, predict(d.X.map((r) => [r[0], r[1]]), d.off, usualOnly), which),
      handSet: evaluate('hand-set weights', list, handSet.map((v) => v * handScale), which),
      learned: evaluate('learned weights', list, predict(d.X, d.off, beta), which),
    };
  };
  report[which] = { shrink: { form: best.kForm, history: best.kHist }, test: score(test, '2025/26'), latest: latest.length ? score(latest, '2026/27 so far') : null };
  // Final weights for live use: refit on everything up to now.
  const all = rows;
  const dAll = design(all, best.kForm, best.kHist, which);
  const betaAll = fitPoisson(dAll.X, dAll.y, dAll.off);
  model[which] = {
    intercept: betaAll[0],
    weights: Object.fromEntries(FEATURES.map((f, i) => [f, betaAll[i + 1]])),
    trainedOn2024: Object.fromEntries(FEATURES.map((f, i) => [f, beta[i + 1]])),
    shrink: { form: best.kForm, history: best.kHist },
  };
}
model.report = report;
const gain = (t) => ({ deviance: 1 - t.learned.deviance / t.usualRate.deviance, mae: 1 - t.learned.mae / t.usualRate.mae });
model.summary = {
  test: '2025/26',
  testRows: report.xg.test.n,
  trainedOn: '2024/25',
  xgGain: gain(report.xg.test),
  xaGain: gain(report.xa.test),
  handSetWorse: report.xg.test.handSet.deviance > report.xg.test.usualRate.deviance,
};
await writeFile(join(ROOT, 'public/sport/data/pl/netxg-model.json'), JSON.stringify(model, null, 1));
console.log(JSON.stringify(report, null, 1));
console.log(JSON.stringify({ xg: model.xg.weights, xa: model.xa.weights, shrink: model.xg.shrink }, null, 1));
