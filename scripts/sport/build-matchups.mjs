#!/usr/bin/env node
// Builds the Premier League matchup data the Matchday app reads as static files:
//   public/sport/data/pl/index.json         xG allowed by role, team match logs, FPL -> ESPN ids
//   public/sport/data/pl/players-<team>.json every match row for that club's current players
// Finished matches are cached in data/sport/pl-matches/<season>.json, so a weekly run only
// fetches what's new. Everything comes from ESPN's public match summaries; costs nothing.
//
//   node scripts/sport/build-matchups.mjs            # seasons 2023/24 to now
//   node scripts/sport/build-matchups.mjs --from 2024
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchMatch } from '../../src/lib/sport/espn.mjs';
import { playerRows, mainRole, ROLES } from '../../src/lib/sport/matchups.mjs';
import { fplTeamFor } from '../../src/lib/sport/fplmap.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE = join(ROOT, 'data/sport/pl-matches');
const OUT = join(ROOT, 'public/sport/data/pl');
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const WEB = 'https://site.web.api.espn.com/apis/v2/sports/soccer';
const UA = { 'user-agent': 'Mozilla/5.0 (Matchday data build; mikaeelfaraz.com)', accept: 'application/json' };

const arg = (name, d) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : d;
};
const now = new Date();
// ESPN names a season by the year it starts; a new one starts in August.
const CURRENT = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
const FROM = Number(arg('--from', CURRENT - 3));
const SEASONS = Array.from({ length: CURRENT - FROM + 1 }, (_, i) => String(FROM + i));

async function json(url, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 404 || res.status === 400) return null;
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    })
  );
  return out;
}

const readJson = async (path, d) => {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return d;
  }
};

async function seasonMatches(season) {
  const st = await json(`${WEB}/eng.1/standings?season=${season}`);
  const teams = (st?.children?.[0]?.standings?.entries ?? []).map((e) => e.team);
  const list = new Map();
  await pool(teams, 4, async (t) => {
    const s = await json(`${SITE}/eng.1/teams/${t.id}/schedule?season=${season}`);
    for (const e of s?.events ?? []) {
      const c = e.competitions?.[0];
      if (!c?.status?.type?.completed) continue;
      list.set(String(e.id), { id: String(e.id), date: e.date });
    }
  });
  return { teams, matches: [...list.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

const teamInfo = {};
const cache = {};
for (const season of SEASONS) {
  const file = join(CACHE, `${season}.json`);
  cache[season] = await readJson(file, {});
  const { teams, matches } = await seasonMatches(season);
  for (const t of teams) teamInfo[t.id] = { name: t.displayName, abbr: t.abbreviation, short: t.shortDisplayName ?? t.displayName };
  const todo = matches.filter((m) => !cache[season][m.id]);
  console.log(`${season}: ${matches.length} finished, ${todo.length} to fetch`);
  let done = 0;
  await pool(todo, 6, async (m) => {
    const d = await fetchMatch('all', m.id).catch((e) => (console.warn(`  ${m.id}: ${e.message}`), null));
    if (!d || !d.lineups?.home || !d.hasShotData) return;
    const side = (s) => d.shots.filter((x) => x.side === s).reduce((t, x) => t + x.xg, 0);
    cache[season][m.id] = {
      d: m.date.slice(0, 10),
      h: d.match.home.id,
      a: d.match.away.id,
      hs: Number(d.match.home.score ?? 0),
      as: Number(d.match.away.score ?? 0),
      xh: Math.round(side('home') * 1000) / 1000,
      xa: Math.round(side('away') * 1000) / 1000,
      r: playerRows(d),
    };
    if (++done % 50 === 0) console.log(`  ${done}/${todo.length}`);
  });
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(cache[season]));
}

/* ------------------------------------------------------------- aggregate */

const conceded = {}; // team -> season -> role -> [minutes, xg, xa, shots, goals]
const league = {}; // season -> role -> same
const games = {}; // team -> [[date, opp, home, gf, ga, xgf, xga]]
const players = {}; // espn id -> { n, rows: [[date, opp, home, gf, ga, role, min, shots, xg, goals, xa, assists]], team, last }
const add = (row, r) => {
  for (let i = 0; i < 5; i++) row[i] += r[i];
};
for (const season of SEASONS) {
  league[season] ??= Object.fromEntries(ROLES.map((r) => [r, [0, 0, 0, 0, 0]]));
  for (const m of Object.values(cache[season])) {
    (games[m.h] ??= []).push([m.d, m.a, 1, m.hs, m.as, m.xh, m.xa]);
    (games[m.a] ??= []).push([m.d, m.h, 0, m.as, m.hs, m.xa, m.xh]);
    for (const [id, name, home, role, min, shots, xg, goals, xa, assists] of m.r) {
      const team = home ? m.h : m.a;
      const opp = home ? m.a : m.h;
      const slot = (((conceded[opp] ??= {})[season] ??= {})[role] ??= [0, 0, 0, 0, 0]);
      add(slot, [min, xg, xa, shots, goals]);
      add(league[season][role], [min, xg, xa, shots, goals]);
      const p = (players[id] ??= { n: name, rows: [], team, last: '' });
      p.rows.push([m.d, opp, home, home ? m.hs : m.as, home ? m.as : m.hs, role, min, shots, xg, goals, xa, assists]);
      if (m.d >= p.last) {
        p.last = m.d;
        p.team = team;
        p.n = name;
      }
    }
  }
}
const r3 = (v) => Math.round(v * 1000) / 1000;
for (const t of Object.values(conceded)) for (const s of Object.values(t)) for (const k of Object.keys(s)) s[k] = s[k].map(r3);
for (const s of Object.values(league)) for (const k of Object.keys(s)) s[k] = s[k].map(r3);
for (const g of Object.values(games)) g.sort((a, b) => a[0].localeCompare(b[0]));

/* ------------------------------------------------------------- FPL ids */

const norm = (s) =>
  (s ?? '')
    .replace(/ß/g, 'ss')
    .replace(/[ıİ]/g, 'i')
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[łŁ]/g, 'l')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
// FPL sometimes turns away cloud machines; then the previous build's mapping stands.
const previous = await readJson(join(OUT, 'index.json'), {});
const fpl = await json('https://fantasy.premierleague.com/api/bootstrap-static/').catch((e) => (console.warn(`FPL unavailable (${e.message}); keeping the last mapping`), null)) ?? {
  teams: [],
  elements: [],
};
const thisSeason = String(CURRENT);
const currentTeams = Object.keys(conceded).filter((id) => conceded[id][thisSeason]);
const espnOfFpl = fpl.teams.length ? {} : (previous.fplTeams ?? {});
for (const id of currentTeams) {
  const f = fplTeamFor(teamInfo[id]?.name, fpl.teams.map((t) => ({ id: t.id, name: t.name })));
  if (f) espnOfFpl[f] = id;
}
const byTeam = {};
for (const [id, p] of Object.entries(players)) (byTeam[p.team] ??= []).push([id, p]);
const fplIds = fpl.elements.length ? {} : (previous.fpl ?? {});
let matched = 0;
for (const e of fpl.elements) {
  const team = espnOfFpl[e.team];
  const full = norm(`${e.first_name} ${e.second_name}`);
  const web = norm(e.web_name);
  const lastOf = (s) => s.split(' ').pop();
  const test = ([, p]) => {
    const n = norm(p.n);
    if (n === full || n === web) return 3;
    if (lastOf(n) === lastOf(norm(e.second_name)) && n[0] === full[0]) return 2;
    if (n.endsWith(` ${web}`) || lastOf(n) === web) return 1;
    // Nicknames and shortened names: any longer name word in common, if only one player shares it.
    const mine = new Set(full.split(' ').concat(web.split(' ')).filter((w) => w.length >= 4));
    if (n.split(' ').some((w) => mine.has(w))) return 0.5;
    return 0;
  };
  const pickFrom = (list) => {
    const scored = list.map((c) => [c, test(c)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
    if (!scored.length || (scored[1] && scored[1][1] === scored[0][1])) return null;
    return scored[0][0];
  };
  const hit = pickFrom(byTeam[team] ?? []) ?? pickFrom(Object.entries(players).filter(([, p]) => norm(p.n) === full));
  if (hit) {
    fplIds[e.id] = hit[0];
    // A player who joined from another Premier League club keeps his history but files under his new club.
    if (team) hit[1].team = team;
    matched++;
  }
}
console.log(`FPL players matched: ${matched} of ${fpl.elements.length} (${fpl.elements.filter((e) => e.minutes > 0).length} have minutes)`);

await mkdir(OUT, { recursive: true });
const files = {};
for (const [id, p] of Object.entries(players)) {
  if (!currentTeams.includes(p.team)) continue;
  (files[p.team] ??= {})[id] = { n: p.n, rows: p.rows.map((r) => r.map((v) => (typeof v === 'number' ? r3(v) : v))) };
}
for (const [team, list] of Object.entries(files)) await writeFile(join(OUT, `players-${team}.json`), JSON.stringify(list));
await writeFile(
  join(OUT, 'index.json'),
  JSON.stringify({
    built: new Date().toISOString(),
    seasons: [...SEASONS].reverse(),
    teams: teamInfo,
    current: currentTeams,
    conceded,
    league,
    games,
    fplTeams: espnOfFpl,
    fpl: fplIds,
    // Each FPL player's usual role, so projections can use it without loading his match log.
    roles: Object.fromEntries(Object.entries(fplIds).map(([f, e]) => [f, mainRole(players[e].rows)]).filter(([, r]) => r)),
  })
);
// Net xG inputs for every FPL player: long-run rates (two years), his last five matches, and his
// record against each opponent. Each is [minutes, xG, xA].
const tri = (rows) => [rows.reduce((t, r) => t + r[6], 0), r3(rows.reduce((t, r) => t + r[8], 0)), r3(rows.reduce((t, r) => t + r[10], 0))];
const netxg = {};
for (const [fplId, espnId] of Object.entries(fplIds)) {
  const rows = players[espnId]?.rows;
  if (!rows?.length) continue;
  const sorted = [...rows].sort((a, b) => a[0].localeCompare(b[0]));
  const last = sorted[sorted.length - 1][0];
  const twoYears = `${Number(last.slice(0, 4)) - 2}${last.slice(4)}`;
  const vs = {};
  for (const r of sorted) (vs[r[1]] ??= []).push(r);
  netxg[fplId] = {
    l: tri(sorted.filter((r) => r[0] > twoYears)),
    r: tri(sorted.slice(-5)),
    v: Object.fromEntries(Object.entries(vs).map(([opp, list]) => [opp, tri(list)])),
  };
}
await writeFile(join(OUT, 'netxg.json'), JSON.stringify({ built: new Date().toISOString(), players: netxg }));
console.log(`Wrote ${Object.keys(files).length} player files, index.json and netxg.json (${Object.keys(netxg).length} players)`);
