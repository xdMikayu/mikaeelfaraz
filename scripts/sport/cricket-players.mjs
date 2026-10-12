#!/usr/bin/env node
// Every player's record from Cricsheet's ball-by-ball archive, for the cricket match page: career and
// the last twelve months in each format, the last ten innings with bat and ball, how they score or
// concede in each phase of an innings, and each batter's record against each bowler. Players are
// keyed by their Cricinfo id, which ESPN uses too, through Cricsheet's people register.
//
//   curl -L -o data/sport/cricsheet/people.csv https://cricsheet.org/register/people.csv
//   node scripts/sport/cricket-players.mjs     # → src/lib/sport/cricket/players/{format}.json
//
// Formats: t20 and odi (all 20- and 50-over cricket with six-ball overs, internationals and
// leagues together, as each player's form is one thing), Tests, and first-class matches (fc).
// Only players with a match in the last three years are kept: the page only shows current XIs.
//
// Each player: { bat, bowl }, each of those { all, year, recent, phases } where
//   bat.all and bat.year:  [innings, not outs, runs, balls, fours, sixes, fifties, hundreds, best, best not out]
//   bowl.all and bowl.year: [innings, balls, runs, wickets, dots, maidens, best wickets, best runs, 4-fors, 5-fors]
//   bat.recent:  the last ten innings, newest first, [yyyymmdd, runs, balls, out, opponent]
//   bowl.recent: the last ten, [yyyymmdd, balls, runs, wickets, opponent]
//   phases (one-day formats, last three years): bat [[runs, balls, outs] × 3], bowl [[balls, runs, wickets] × 3]
// opponent indexes the file's `teams`. matchups: { "batter|bowler": [balls, runs, outs, dots, fours, sixes] }
// for pairs that have met for at least six balls in the last five years.
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'data/sport/cricsheet');
const OUT = join(ROOT, 'src/lib/sport/cricket/players');
const DAY = 864e5;
// The overs ending the powerplay and the middle overs; the rest is the death.
const PHASES = { t20: [6, 15], odi: [10, 40] };
// Dismissals the bowler is credited with; ones that aren't dismissals at all.
const CREDITED = new Set(['bowled', 'caught', 'caught and bowled', 'lbw', 'stumped', 'hit wicket']);
const NOT_OUT = new Set(['retired hurt', 'retired not out']);

function formatOf(info) {
  if ((info.balls_per_over ?? 6) !== 6) return null;
  const mt = info.match_type;
  const g = info.gender;
  if ((mt === 'T20' || mt === 'IT20') && info.overs === 20) return `t20-${g}`;
  if ((mt === 'ODI' || mt === 'ODM') && info.overs === 50) return `odi-${g}`;
  if (mt === 'Test') return `test-${g}`;
  if (mt === 'MDM' && g === 'male') return 'fc-male';
  return null;
}

/** A CSV line's fields, with quoted fields that may hold commas. */
function fields(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

async function register() {
  const [head, ...rows] = (await readFile(join(SRC, 'people.csv'), 'utf8')).split(/\r?\n/).filter(Boolean);
  const cols = fields(head);
  const id = cols.indexOf('identifier');
  const ci = cols.indexOf('key_cricinfo');
  return new Map(rows.map(fields).filter((r) => r[ci]).map((r) => [r[id], r[ci]]));
}

const ymd = (date) => Number(date.replace(/-/g, ''));

async function main() {
  const cricinfo = await register();
  const files = (await readdir(join(SRC, 'all'))).filter((f) => f.endsWith('.json'));
  // Per format: player → { bat: [innings], bowl: [innings] }, and batter|bowler → [balls, runs, outs, dots, 4s, 6s, last date].
  const byFormat = {};
  let through = '';
  let done = 0;
  for (const f of files) {
    const j = JSON.parse(await readFile(join(SRC, 'all', f), 'utf8'));
    const info = j.info;
    const F = formatOf(info);
    if (++done % 4000 === 0) console.log(`${done} / ${files.length}`);
    if (!F || !info.dates?.length || info.teams?.length !== 2) continue;
    const date = info.dates[0];
    if (date > through) through = date;
    const ids = info.registry?.people ?? {};
    const pid = (name) => cricinfo.get(ids[name]) ?? null;
    const fmt = (byFormat[F] ??= { players: new Map(), pairs: new Map() });
    const player = (id) => {
      let p = fmt.players.get(id);
      if (!p) fmt.players.set(id, (p = { bat: [], bowl: [] }));
      return p;
    };
    const phases = PHASES[F.split('-')[0]];
    const phaseOf = (over) => (over < phases[0] ? 0 : over < phases[1] ? 1 : 2);

    for (const inn of j.innings ?? []) {
      if (inn.super_over) continue;
      const opp = info.teams.find((t) => t !== inn.team);
      const bat = new Map();
      const bowl = new Map();
      const batter = (name) => {
        let b = bat.get(name);
        if (!b) bat.set(name, (b = { runs: 0, balls: 0, fours: 0, sixes: 0, out: 0, pos: bat.size + 1, ph: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] }));
        return b;
      };
      const bowler = (name) => {
        let b = bowl.get(name);
        if (!b) bowl.set(name, (b = { balls: 0, runs: 0, wkts: 0, dots: 0, maidens: 0, ph: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] }));
        return b;
      };
      for (const over of inn.overs ?? []) {
        const p = phases ? phaseOf(over.over) : 0;
        const inOver = new Map(); // bowler → [legal balls, runs conceded]
        for (const d of over.deliveries ?? []) {
          const b = batter(d.batter);
          batter(d.non_striker);
          const bw = bowler(d.bowler);
          const x = d.extras ?? {};
          const faced = !x.wides;
          const legal = !x.wides && !x.noballs;
          const hit = d.runs?.batter ?? 0;
          const conceded = (d.runs?.total ?? 0) - (x.byes ?? 0) - (x.legbyes ?? 0) - (x.penalty ?? 0);
          b.runs += hit;
          if (faced) b.balls += 1;
          if (hit === 4 && !d.runs?.non_boundary) b.fours += 1;
          if (hit === 6) b.sixes += 1;
          b.ph[p][0] += hit;
          if (faced) b.ph[p][1] += 1;
          bw.runs += conceded;
          bw.ph[p][1] += conceded;
          if (legal) {
            bw.balls += 1;
            bw.ph[p][0] += 1;
            if (conceded === 0) bw.dots += 1;
          }
          const o = inOver.get(d.bowler) ?? [0, 0];
          o[0] += legal ? 1 : 0;
          o[1] += conceded;
          inOver.set(d.bowler, o);
          let pairOut = 0;
          for (const w of d.wickets ?? []) {
            if (NOT_OUT.has(w.kind)) continue;
            const outB = batter(w.player_out);
            outB.out = 1;
            outB.ph[p][2] += 1;
            if (CREDITED.has(w.kind)) {
              bw.wkts += 1;
              bw.ph[p][2] += 1;
              if (w.player_out === d.batter) pairOut = 1;
            }
          }
          if (faced) {
            const a = pid(d.batter);
            const c = pid(d.bowler);
            if (a && c) {
              const k = `${a}|${c}`;
              const m = fmt.pairs.get(k) ?? [0, 0, 0, 0, 0, 0, ''];
              m[0] += 1;
              m[1] += hit;
              m[2] += pairOut;
              if (hit === 0 && legal) m[3] += 1;
              if (hit === 4 && !d.runs?.non_boundary) m[4] += 1;
              if (hit === 6) m[5] += 1;
              if (date > m[6]) m[6] = date;
              fmt.pairs.set(k, m);
            }
          }
        }
        // A maiden: one bowler, the whole over, nothing conceded.
        if (inOver.size === 1) {
          const [[name, [balls, runs]]] = inOver;
          if (balls >= (info.balls_per_over ?? 6) && runs === 0) bowl.get(name).maidens += 1;
        }
      }
      for (const [name, b] of bat) {
        const id = pid(name);
        if (id) player(id).bat.push({ date, opp, ...b });
      }
      // A bowler's opponent is the side batting.
      for (const [name, b] of bowl) {
        const id = pid(name);
        if (id) player(id).bowl.push({ date, opp: inn.team, ...b });
      }
    }
  }

  const since = (years) => new Date(Date.parse(through) - years * 365.25 * DAY).toISOString().slice(0, 10);
  const active = since(3);
  const lastYear = since(1);
  const phaseFrom = since(3);
  const pairFrom = since(5);
  await mkdir(OUT, { recursive: true });
  for (const [F, fmt] of Object.entries(byFormat)) {
    const teams = [];
    const teamIx = new Map();
    const team = (name) => {
      if (!teamIx.has(name)) {
        teamIx.set(name, teams.length);
        teams.push(name);
      }
      return teamIx.get(name);
    };
    const batAgg = (list) => {
      const a = [list.length, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (const x of list) {
        a[1] += x.out ? 0 : 1;
        a[2] += x.runs;
        a[3] += x.balls;
        a[4] += x.fours;
        a[5] += x.sixes;
        if (x.runs >= 100) a[7] += 1;
        else if (x.runs >= 50) a[6] += 1;
        if (x.runs > a[8] || (x.runs === a[8] && !x.out)) {
          a[8] = x.runs;
          a[9] = x.out ? 0 : 1;
        }
      }
      return a;
    };
    const bowlAgg = (list) => {
      const a = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (const x of list) {
        if (!x.balls) continue;
        a[0] += 1;
        a[1] += x.balls;
        a[2] += x.runs;
        a[3] += x.wkts;
        a[4] += x.dots;
        a[5] += x.maidens;
        if (x.wkts > a[6] || (x.wkts === a[6] && x.runs < a[7]) || a[0] === 1) {
          a[6] = x.wkts;
          a[7] = x.runs;
        }
        if (x.wkts >= 5) a[9] += 1;
        else if (x.wkts >= 4) a[8] += 1;
      }
      return a;
    };
    const sumPhases = (list, pick) => [0, 1, 2].map((i) => list.reduce((s, x) => s.map((v, k) => v + pick(x)[i][k]), [0, 0, 0]));
    const players = {};
    for (const [id, p] of fmt.players) {
      const last = [...p.bat, ...p.bowl].reduce((m, x) => (x.date > m ? x.date : m), '');
      if (last < active) continue;
      p.bat.sort((a, b) => (a.date < b.date ? -1 : 1));
      p.bowl.sort((a, b) => (a.date < b.date ? -1 : 1));
      const bowled = p.bowl.filter((x) => x.balls);
      const rec = {};
      if (p.bat.length) {
        rec.bat = {
          all: batAgg(p.bat),
          year: batAgg(p.bat.filter((x) => x.date >= lastYear)),
          recent: p.bat.slice(-10).reverse().map((x) => [ymd(x.date), x.runs, x.balls, x.out, team(x.opp)]),
        };
        if (PHASES[F.split('-')[0]]) rec.bat.phases = sumPhases(p.bat.filter((x) => x.date >= phaseFrom), (x) => x.ph);
      }
      if (bowled.length) {
        rec.bowl = {
          all: bowlAgg(bowled),
          year: bowlAgg(bowled.filter((x) => x.date >= lastYear)),
          recent: bowled.slice(-10).reverse().map((x) => [ymd(x.date), x.balls, x.runs, x.wkts, team(x.opp)]),
        };
        if (PHASES[F.split('-')[0]]) rec.bowl.phases = sumPhases(bowled.filter((x) => x.date >= phaseFrom), (x) => x.ph);
      }
      players[id] = rec;
    }
    const matchups = {};
    for (const [k, m] of fmt.pairs) {
      const [a, c] = k.split('|');
      if (m[0] >= 6 && m[6] >= pairFrom && players[a] && players[c]) matchups[k] = m.slice(0, 6);
    }
    const body = JSON.stringify({ through, format: F, teams, players, matchups });
    await writeFile(join(OUT, `${F}.json`), body);
    console.log(`${F}: ${Object.keys(players).length} players, ${Object.keys(matchups).length} matchups, ${(body.length / 1e6).toFixed(2)} MB`);
  }
}

await main();
