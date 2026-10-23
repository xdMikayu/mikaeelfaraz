#!/usr/bin/env node
// Checks Matchday's player ratings (src/lib/ratings.mjs) on this season's finished Premier
// League matches, the only league with an outside measure to hold them against: FPL's bonus point
// system (BPS), Opta's own per-player score. It prints how the ratings spread (starters by role,
// substitutes, how many reach 8 and 9), how closely they follow BPS, how often the best-rated
// player is among a match's top three for BPS, the season's best performances, and with --fit the
// scale (SCALE.k and SCALE.base) that puts every role's starters on the target average and spread.
//
//   node scripts/check-ratings.mjs                  # the report
//   node scripts/check-ratings.mjs --no-fpl         # as other leagues get them: no FPL numbers
//   MEAN=6.8 SD=0.7 node scripts/check-ratings.mjs --fit
import { join } from 'node:path';
import { fetchMatch } from '../src/lib/espn.mjs';
import { getStatic, getFixtures, getLive } from '../src/lib/fpl-server.mjs';
import { fplFixtureFor, fplPlayersFor } from '../src/lib/fplmap.mjs';
import { matchRatings } from '../src/lib/ratings.mjs';
import { DATA, readJson } from './kit.mjs';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const WEB = 'https://site.web.api.espn.com/apis/v2/sports/soccer';
const UA = { 'user-agent': 'Mozilla/5.0 (Matchday ratings check; matchday.mikaeelfaraz.com)', accept: 'application/json' };
const noFpl = process.argv.includes('--no-fpl');
const fit = process.argv.includes('--fit');
const MEAN = Number(process.env.MEAN ?? 6.8);
const SD = Number(process.env.SD ?? 0.7);

const json = async (url) => {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (e) {
      if (i >= 3) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
};

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

// This season's finished matches, from every club's schedule (ESPN's scoreboard takes one day at a time).
const now = new Date();
const season = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
const standings = await json(`${WEB}/eng.1/standings?season=${season}`);
const teams = (standings?.children?.[0]?.standings?.entries ?? []).map((e) => e.team);
const ids = new Set();
await pool(teams, 4, async (t) => {
  const s = await json(`${SITE}/eng.1/teams/${t.id}/schedule?season=${season}`);
  for (const e of s?.events ?? []) if (e.competitions?.[0]?.status?.type?.completed) ids.add(String(e.id));
});

const st = await getStatic();
const fixtures = await getFixtures();
const ix = await readJson(join(DATA, 'index.json'), {});
const lives = {};
const matches = [];
await pool([...ids], 5, async (id) => {
  const d = await fetchMatch('all', id).catch(() => null);
  if (!d?.lineups?.home?.starters?.length) return;
  const fx = fplFixtureFor(d.match, st.teams, fixtures);
  if (!fx) return;
  lives[fx.event] ??= getLive(fx.event);
  const fpl = fplPlayersFor(d.lineups, st, await lives[fx.event], fx, ix.fpl);
  matches.push({ d, fpl, ratings: matchRatings(d, noFpl ? null : fpl) });
});
console.log(`${matches.length} Premier League matches, ${season}/${String(season + 1).slice(2)}${noFpl ? ', without FPL’s numbers' : ''}\n`);

const rows = matches.flatMap((m) => {
  const people = Object.fromEntries(['home', 'away'].flatMap((s) => [...m.d.lineups[s].starters, ...m.d.lineups[s].bench]).map((p) => [p.id, p]));
  return Object.entries(m.ratings.players).map(([id, r]) => ({ m, id, p: people[id], ...r, bps: m.fpl[id]?.bps ?? null }));
});

const mean = (a) => a.reduce((t, v) => t + v, 0) / a.length;
const sd = (a) => Math.sqrt(mean(a.map((v) => (v - mean(a)) ** 2)));
const q = (a, f) => [...a].sort((x, y) => x - y)[Math.floor(f * (a.length - 1))];
const spread = (a) => `${String(a.length).padStart(5)}  mean ${mean(a).toFixed(2)}  sd ${sd(a).toFixed(2)}  p10 ${q(a, 0.1).toFixed(1)}  p50 ${q(a, 0.5).toFixed(1)}  p90 ${q(a, 0.9).toFixed(1)}  max ${Math.max(...a).toFixed(1)}`;
const pearson = (a, b) => {
  const ma = mean(a);
  const mb = mean(b);
  let c = 0;
  let va = 0;
  let vb = 0;
  a.forEach((x, i) => {
    c += (x - ma) * (b[i] - mb);
    va += (x - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  });
  return c / Math.sqrt(va * vb);
};
// Ranks with ties shared, for Spearman's correlation.
const ranks = (a) => {
  const order = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const r = [];
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2;
    i = j + 1;
  }
  return r;
};

const starters = rows.filter((r) => r.minutes >= 60);
const ratingsOf = (a) => a.map((r) => r.rating);
console.log('Starters (60+ minutes)', spread(ratingsOf(starters)));
for (const g of ['GK', 'DEF', 'MID', 'ATT']) console.log(`  ${g.padEnd(20)}`, spread(ratingsOf(starters.filter((r) => r.group === g))));
console.log('Substitutes          ', spread(ratingsOf(rows.filter((r) => r.minutes < 60))));
const share = (min) => ((100 * rows.filter((r) => r.rating >= min).length) / rows.length).toFixed(1);
console.log(`\n${share(8)}% of ratings are 8 or more, ${share(9)}% 9 or more.`);

const withBps = rows.filter((r) => r.bps != null && r.minutes >= 30);
const a = withBps.map((r) => r.rating);
const b = withBps.map((r) => r.bps);
console.log(`\nAgainst FPL’s BPS, players with 30+ minutes (${withBps.length}): Pearson ${pearson(a, b).toFixed(3)}, Spearman ${pearson(ranks(a), ranks(b)).toFixed(3)}`);
let top = 0;
let top3 = 0;
let n = 0;
for (const m of matches) {
  const rs = rows.filter((r) => r.m === m && r.bps != null);
  if (!rs.length) continue;
  n++;
  const best = [...rs].sort((x, y) => y.raw - x.raw)[0];
  const byBps = [...rs].sort((x, y) => y.bps - x.bps);
  if (byBps[0].id === best.id) top++;
  if (byBps.slice(0, 3).some((x) => x.id === best.id)) top3++;
}
console.log(`The best-rated player has the most BPS in ${top} of ${n} matches and is in the top three in ${top3} (${Math.round((100 * top3) / n)}%).`);

const game = (m) => `${m.d.match.home.short ?? m.d.match.home.name} ${m.d.match.home.score}-${m.d.match.away.score} ${m.d.match.away.short ?? m.d.match.away.name}`;
const line = (r) =>
  `${r.rating.toFixed(1)}  ${(r.p?.name ?? r.id).padEnd(24)} ${r.group.padEnd(3)} ${String(r.minutes).padStart(3)}'  G${r.p?.goals ?? 0} A${r.p?.assists ?? 0}  BPS ${String(r.bps ?? '-').padStart(3)}  ` +
  Object.entries(r.parts).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v.toFixed(2)}`).join(' ');
console.log('\nBest this season');
for (const r of [...rows].sort((x, y) => y.raw - x.raw).slice(0, 10)) console.log(`  ${line(r)}  | ${game(r.m)}`);
console.log('\nWorst this season (60+ minutes)');
for (const r of [...starters].sort((x, y) => x.raw - y.raw).slice(0, 6)) console.log(`  ${line(r)}  | ${game(r.m)}`);

if (fit) {
  // k so starters spread with SD within their roles before the curve, then each role's base so its starters average MEAN.
  const sums = { GK: [], DEF: [], MID: [], ATT: [] };
  for (const r of starters) sums[r.group].push(r.sum);
  const within = Math.sqrt(mean(Object.values(sums).flatMap((s) => s.map((v) => (v - mean(s)) ** 2))));
  const k = SD / within;
  const base = Object.fromEntries(Object.entries(sums).map(([g, s]) => [g, Number((MEAN - k * mean(s)).toFixed(2))]));
  console.log(`\nSCALE for starters averaging ${MEAN} with sd ${SD}: k ${k.toFixed(3)}, base ${JSON.stringify(base)}`);
}
