#!/usr/bin/env node
// Builds public/sport/data/pl/chances.json: every finished Premier League match this season with each
// side's goals, Opta's xG (FPL's players added up by club, src/lib/sport/chances.mjs fixtureXg), and its
// big chances and penalties from the Premier League's own match stats. Fantasy › Stats charts them.
// Finished matches are cached in data/sport/pl-chances/<season>.json, so a run only fetches what's new;
// a gameweek's xG is fetched again until FPL marks its data checked. FPL and the Premier League both
// sometimes turn cloud machines away; then whatever is cached stands, and the file waits for next run.
//
//   node scripts/sport/build-chances.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureXg, matchChances, MATCH_FIELDS, PENALTY_XG } from '../../src/lib/sport/chances.mjs';
import { fplTeamFor } from '../../src/lib/sport/fplmap.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE = join(ROOT, 'data/sport/pl-chances');
const OUT = join(ROOT, 'public/sport/data/pl/chances.json');
const FPL = 'https://fantasy.premierleague.com/api';
const PL = 'https://footballapi.pulselive.com/football';
const UA = 'Mozilla/5.0 (Matchday data build; mikaeelfaraz.com)';
// The Premier League's stats API answers its own site's pages.
const PL_HEADERS = { 'user-agent': UA, accept: 'application/json', origin: 'https://www.premierleague.com', referer: 'https://www.premierleague.com/' };

const now = new Date();
// A season is named by the year it starts; a new one starts in August.
const START = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
const SEASON = `${START}/${String(START + 1).slice(2)}`;

async function json(url, headers, tries = 3) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

const readJson = async (path, d) => {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return d;
  }
};
const r2 = (v) => Math.round(v * 100) / 100;

const cacheFile = join(CACHE, `${START}.json`);
// fixtures: { FPL fixture id: { gw, date, h, a, hg, ag, xg: [h, a], pl, bc: [h, a], pens: [h, a] } }
const cache = await readJson(cacheFile, { fixtures: {} });
const save = async () => {
  await mkdir(CACHE, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(cache));
};

/* ------------------------------------------------------------- FPL: clubs, fixtures, gameweeks */

const fplHeaders = { 'user-agent': UA, accept: 'application/json' };
const [boot, fixtures] = await Promise.all([json(`${FPL}/bootstrap-static/`, fplHeaders), json(`${FPL}/fixtures/`, fplHeaders)]).catch((e) => {
  console.warn(`FPL unavailable (${e.message}); chances.json stays as it was`);
  return [null, null];
});
if (!boot || !fixtures) process.exit(0);
// Early in July FPL can still be showing last season.
if (new Date(boot.events?.[0]?.deadline_time ?? 0).getUTCFullYear() !== START) {
  console.log(`FPL isn't on ${SEASON} yet; nothing to build`);
  process.exit(0);
}
for (const f of fixtures) {
  if (!f.finished || !f.event) continue;
  const c = (cache.fixtures[f.id] ??= {});
  Object.assign(c, { gw: f.event, date: f.kickoff_time?.slice(0, 10) ?? '', h: f.team_h, a: f.team_a, hg: f.team_h_score ?? 0, ag: f.team_a_score ?? 0 });
}

/* ------------------------------------------------------------- Opta's xG, from FPL's players */

const teamOf = Object.fromEntries(boot.elements.map((e) => [e.id, e.team]));
const checked = new Set(boot.events.filter((e) => e.data_checked).map((e) => e.id));
const needXg = [...new Set(Object.values(cache.fixtures).filter((c) => !c.xg || !checked.has(c.gw)).map((c) => c.gw))].sort((a, b) => a - b);
for (const gw of needXg) {
  const live = await json(`${FPL}/event/${gw}/live/`, fplHeaders).catch((e) => (console.warn(`  GW${gw} live: ${e.message}`), null));
  if (!live) continue;
  const xg = fixtureXg(live, teamOf, fixtures);
  for (const [id, pair] of Object.entries(xg)) if (cache.fixtures[id]) cache.fixtures[id].xg = pair.map(r2);
}
console.log(`${SEASON}: ${Object.keys(cache.fixtures).length} finished matches; xG fetched for ${needXg.length ? `GW${needXg.join(', GW')}` : 'none'}`);

/* ------------------------------------------------------------- big chances, from the Premier League */

const byClubs = new Map(Object.entries(cache.fixtures).map(([id, c]) => [`${c.h}-${c.a}`, id]));
// The Premier League's club for FPL's: the same three letters, or failing that the name.
const fplClub = (t) => boot.teams.find((x) => x.short_name === t.club?.abbr)?.id ?? fplTeamFor(t.name, boot.teams.map((x) => ({ id: x.id, name: x.name })));
let fetched = 0;
let unmatched = 0;
try {
  const seasons = await json(`${PL}/competitions/1/compseasons?page=0&pageSize=10`, PL_HEADERS);
  const label = new RegExp(`\\b${START}/(${START + 1}|${String(START + 1).slice(2)})\\b`);
  const comp = seasons?.content?.find((s) => label.test(s.label));
  if (!comp) throw new Error(`no ${SEASON} season listed`);
  const done = [];
  for (let page = 0; ; page++) {
    const r = await json(`${PL}/fixtures?comps=1&compSeasons=${Math.round(comp.id)}&page=${page}&pageSize=100&sort=asc&statuses=C`, PL_HEADERS);
    done.push(...(r?.content ?? []));
    if (!r || page + 1 >= (r.pageInfo?.numPages ?? 0)) break;
  }
  for (const m of done) {
    const [home, away] = m.teams ?? [];
    const id = byClubs.get(`${fplClub(home?.team ?? {})}-${fplClub(away?.team ?? {})}`);
    if (!id) {
      unmatched++;
      continue;
    }
    const c = cache.fixtures[id];
    if (c.bc) continue;
    const stats = await json(`${PL}/stats/match/${Math.round(m.id)}`, PL_HEADERS);
    const got = matchChances(stats?.data, home.team.id, away.team.id);
    if (!got) continue;
    Object.assign(c, { pl: Math.round(m.id), ...got });
    fetched++;
  }
} catch (e) {
  console.warn(`Premier League stats unavailable (${e.message}); using what's cached`);
}
console.log(`Big chances fetched for ${fetched} matches${unmatched ? `; ${unmatched} Premier League matches not found in FPL's fixtures` : ''}`);
await save();

/* ------------------------------------------------------------- the file the page reads */

const rows = Object.values(cache.fixtures)
  .filter((c) => c.xg && c.bc)
  .sort((x, y) => x.date.localeCompare(y.date) || x.h - y.h)
  .map((c) => [c.date, c.gw, c.h, c.a, c.hg, c.ag, c.xg[0], c.xg[1], c.pens[0], c.pens[1], c.bc[0], c.bc[1]]);
const missing = Object.values(cache.fixtures).filter((c) => !c.xg || !c.bc).length;
await mkdir(dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    built: new Date().toISOString(),
    season: SEASON,
    through: Math.max(0, ...rows.map((r) => r[1])),
    penaltyXg: PENALTY_XG,
    fields: MATCH_FIELDS,
    matches: rows,
  })
);
console.log(`Wrote chances.json: ${rows.length} matches${missing ? ` (${missing} finished but still waiting for xG or big chances)` : ''}`);
