#!/usr/bin/env node
// Every player's gameweeks, for teaching the projections (scripts/sport/fit-fpl.mjs): what he had
// done before each deadline and what he then scored, part by part. Last season's also carry FPL's
// expected points as the archive recorded them, after each gameweek: they already reflect it, so
// they aren't a forecast to measure against, and nothing learns from them.
//
//   data/sport/fpl-history/2025.json   2025/26, all 38 gameweeks, from Vaastav Anand's FPL archive
//                                      (github.com/vaastav/Fantasy-Premier-League, MIT licence)
//   data/sport/fpl-history/2026.json   this season so far, from FPL's own API
//
// Each match also carries the bookmakers' expected goals, worked back from the average prices
// football-data.co.uk records before kick-off (odds.mjs fitGoals), as the live projections use
// DraftKings'. A finished season only needs building once: `node scripts/sport/build-fpl-history.mjs 2025`.
// With no argument it builds the season FPL is playing now, which the weekly job does.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fair, fitGoals } from '../../src/lib/sport/odds.mjs';
import { fplTeamFor } from '../../src/lib/sport/fplmap.mjs';
import { PART_KEYS, partsFromStats, partsFromExplain } from '../../src/lib/sport/fpl-learn.mjs';
import { ROOT, DATA, readJson } from './kit.mjs';

const OUT = join(ROOT, 'data/sport/fpl-history');
const VAASTAV = 'https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data';
const FPL = 'https://fantasy.premierleague.com/api';
const UA = { 'user-agent': 'Mozilla/5.0 (personal FPL viewer; mikaeelfaraz.com)' };
async function get(url, kind = 'json') {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: UA }).catch(() => null);
    if (res?.ok) return kind === 'json' ? res.json() : res.text();
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  throw new Error(`${url} didn't answer`);
}

/** Rows of a CSV file as objects (quoted fields allowed). */
function csv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  const [head, ...body] = rows;
  const keys = head.map((h) => h.replace(/^﻿/, ''));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]])));
}

// The season: one given (a finished one, from the archive), or the one FPL is playing now, named by
// the year it starts.
const finished = process.argv[2] ?? null;
const season = finished ?? String(new Date((await get(`${FPL}/bootstrap-static/`)).events[0].deadline_time).getUTCFullYear());
const label = `${season}-${String(Number(season) + 1).slice(2)}`;
const footballData = `https://www.football-data.co.uk/mmz4281/${season.slice(2)}${String(Number(season) + 1).slice(2)}/E0.csv`;

const n = (v) => (v == null || v === '' ? 0 : Number(v));
const r3 = (v) => Math.round(v * 1000) / 1000;

// football-data.co.uk's club names where FPL's differ.
const FD = { 'Man United': 'Man Utd', Tottenham: 'Spurs', Coventry: 'Coventry City', Hull: 'Hull City', Ipswich: 'Ipswich Town', Luton: 'Luton Town', 'Sheffield United': 'Sheffield Utd' };

/** The bookmakers' expected goals for each FPL fixture, keyed "home|away" by FPL team id; none if the prices don't come. */
async function oddsByPair(teams) {
  const byName = Object.fromEntries(teams.map((t) => [t.name, t.id]));
  const out = {};
  let missing = 0;
  let text;
  try {
    text = await get(footballData, 'text');
  } catch {
    console.log("  football-data.co.uk didn't answer; matches without prices are rated by the model");
    return out;
  }
  for (const m of csv(text)) {
    const h = byName[FD[m.HomeTeam] ?? m.HomeTeam];
    const a = byName[FD[m.AwayTeam] ?? m.AwayTeam];
    const odds = [m.AvgH, m.AvgD, m.AvgA].map(Number);
    if (!h || !a || odds.some((o) => !(o > 1))) {
      missing += 1;
      continue;
    }
    const [home, draw, away] = fair(odds.map((o) => 1 / o));
    const ou = [m['Avg>2.5'], m['Avg<2.5']].map(Number);
    const over = ou.every((o) => o > 1) ? fair(ou.map((o) => 1 / o))[0] : null;
    const g = fitGoals({ home, draw, away, over });
    out[`${h}|${a}`] = [r3(g.home), r3(g.away)];
  }
  if (missing) console.log(`  ${missing} football-data rows not matched to FPL clubs`);
  return out;
}

/** ESPN team ids for this season's FPL clubs, for the matchup data's role factors. */
async function espnIds(teams) {
  const ix = await readJson(join(DATA, 'index.json'));
  const out = {};
  for (const [espn, t] of Object.entries(ix.teams)) {
    const id = fplTeamFor(t.name, teams);
    if (id) out[id] = espn;
  }
  return out;
}

async function lastSeason() {
  const [merged, raw, teamRows, fixtureRows] = await Promise.all(['gws/merged_gw.csv', 'players_raw.csv', 'teams.csv', 'fixtures.csv'].map((p) => get(`${VAASTAV}/${label}/${p}`, 'text').then(csv)));
  const teams = teamRows.map((t) => ({ id: Number(t.id), name: t.name, short: t.short_name }));
  const teamId = Object.fromEntries(teams.map((t) => [t.name, t.id]));
  const odds = await oddsByPair(teams);
  const fixtures = fixtureRows.map((f) => {
    const [home, away] = [Number(f.team_h), Number(f.team_a)];
    return { id: Number(f.id), event: n(f.event) || null, kickoff: f.kickoff_time, home, away, odds: odds[`${home}|${away}`] ?? null };
  });
  const players = Object.fromEntries(raw.map((p) => [p.id, { type: Number(p.element_type), code: Number(p.code), name: p.web_name }]));
  // One row per player per gameweek; a double gameweek's two matches are added together.
  const rows = {};
  const POS = { GK: 1, GKP: 1, DEF: 2, MID: 3, FWD: 4, AM: 3 };
  for (const r of merged) {
    const gw = Number(r.GW);
    const id = Number(r.element);
    const type = players[id]?.type ?? POS[r.position];
    const key = `${gw}:${id}`;
    const row = (rows[key] ??= { gw, id, team: teamId[r.team], fixtures: [], min: 0, starts: 0, xg: 0, xa: 0, xgc: 0, saves: 0, bonus: 0, dc: 0, yc: 0, goals: 0, assists: 0, pts: 0, fplXp: 0, parts: Object.fromEntries(PART_KEYS.map((k) => [k, 0])) });
    row.fixtures.push(Number(r.fixture));
    for (const [k, col] of [['min', 'minutes'], ['starts', 'starts'], ['xg', 'expected_goals'], ['xa', 'expected_assists'], ['xgc', 'expected_goals_conceded'], ['saves', 'saves'], ['bonus', 'bonus'], ['dc', 'defensive_contribution'], ['yc', 'yellow_cards'], ['goals', 'goals_scored'], ['assists', 'assists'], ['pts', 'total_points']]) row[k] += n(r[col]);
    // FPL's xP is per gameweek: the same on both rows of a double.
    row.fplXp = n(r.xP);
    const p = partsFromStats(type, r);
    for (const k of PART_KEYS) row.parts[k] += p[k];
  }
  return { teams, fixtures, players, rows: Object.values(rows) };
}

async function thisSeason() {
  const b = await get(`${FPL}/bootstrap-static/`);
  const teams = b.teams.map((t) => ({ id: t.id, name: t.name, short: t.short_name }));
  const odds = await oddsByPair(teams);
  const fixtures = (await get(`${FPL}/fixtures/`)).map((f) => ({ id: f.id, event: f.event, kickoff: f.kickoff_time, home: f.team_h, away: f.team_a, odds: odds[`${f.team_h}|${f.team_a}`] ?? null }));
  const players = Object.fromEntries(b.elements.map((e) => [e.id, { type: e.element_type, code: e.code, name: e.web_name, team: e.team }]));
  const done = b.events.filter((e) => e.finished || (e.is_current && e.data_checked)).map((e) => e.id);
  const rows = [];
  for (const gw of done) {
    const live = await get(`${FPL}/event/${gw}/live/`);
    const played = new Set(fixtures.filter((f) => f.event === gw).map((f) => f.id));
    for (const e of live.elements) {
      const s = e.stats;
      const id = e.id;
      const type = players[id]?.type;
      if (!type) continue;
      rows.push({
        gw,
        id,
        team: players[id].team,
        fixtures: e.explain.map((x) => x.fixture).filter((f) => played.has(f)),
        min: s.minutes,
        starts: s.starts ?? 0,
        xg: n(s.expected_goals),
        xa: n(s.expected_assists),
        xgc: n(s.expected_goals_conceded),
        saves: s.saves,
        bonus: s.bonus,
        dc: s.defensive_contribution ?? 0,
        yc: s.yellow_cards,
        goals: s.goals_scored,
        assists: s.assists,
        pts: s.total_points,
        fplXp: null,
        parts: partsFromExplain(e.explain),
      });
    }
  }
  return { teams, fixtures, players, rows };
}

const data = finished ? await lastSeason() : await thisSeason();
// Some gameweeks the archive saved FPL's expected points as 0 for everyone: not recorded, not zero.
if (finished) {
  const zero = {};
  for (const r of data.rows) {
    const z = (zero[r.gw] ??= { n: 0, zero: 0 });
    z.n += 1;
    if (!r.fplXp) z.zero += 1;
  }
  for (const r of data.rows) if (zero[r.gw].zero > 0.9 * zero[r.gw].n) r.fplXp = null;
  const lost = Object.entries(zero).filter(([, z]) => z.zero > 0.9 * z.n).map(([gw]) => gw);
  if (lost.length) console.log(`  FPL's expected points not recorded for gameweek${lost.length > 1 ? 's' : ''} ${lost.join(', ')}`);
}
const espn = finished ? await espnIds(data.teams) : (await readJson(join(DATA, 'index.json'))).fplTeams;
for (const t of data.teams) t.espn = espn[t.id] ?? null;
const unmatched = data.teams.filter((t) => !t.espn).map((t) => t.name);
if (unmatched.length) console.log(`  No ESPN id for ${unmatched.join(', ')}`);
// Rows as arrays, in the order of `fields`, to keep the file small.
const FIELDS = ['gw', 'id', 'team', 'fixtures', 'min', 'starts', 'xg', 'xa', 'xgc', 'saves', 'bonus', 'dc', 'yc', 'goals', 'assists', 'pts', 'fplXp', 'parts'];
data.rows.sort((a, b) => a.gw - b.gw || a.id - b.id);
const rows = data.rows.map((r) => FIELDS.map((k) => (k === 'parts' ? PART_KEYS.map((p) => r.parts[p]) : typeof r[k] === 'number' ? r3(r[k]) : r[k])));
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, `${season}.json`), JSON.stringify({ season, built: new Date().toISOString(), fields: FIELDS, parts: PART_KEYS, teams: data.teams, fixtures: data.fixtures, players: data.players, rows }));
const gws = [...new Set(data.rows.map((r) => r.gw))];
const priced = data.fixtures.filter((f) => f.odds).length;
console.log(`${label}: ${data.rows.length} player-gameweeks over gameweeks ${Math.min(...gws)}–${Math.max(...gws)}; ${priced} of ${data.fixtures.length} matches with the bookmakers' prices`);
