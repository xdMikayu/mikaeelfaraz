#!/usr/bin/env node
// Reads Cricsheet's ball-by-ball archive and writes one compact record per match, the input to
// scripts/fit-cricket.mjs. Cricsheet (https://cricsheet.org) shares it under ODC-By 1.0.
//
//   curl -L -o data/cricsheet/all_json.zip https://cricsheet.org/downloads/all_json.zip
//   unzip -q -o data/cricsheet/all_json.zip -d data/cricsheet/all
//   node scripts/cricket-extract.mjs        # → data/cricket/matches.json (not committed)
//
// Each match: { id, date, gender, kind ('t20' | 'odi' | 'test' | null), event, club, teams, venue,
// city, toss: [team, 'bat' | 'field'], winner, result ('win' | 'tie' | 'draw' | 'no result'), dl,
// overs, inns: [{ team, runs, wkts, balls, decl, target, c, w }] }. For one-day matches c and w are
// the runs and wickets after every legal ball (wides and no-balls add to the next one).
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'data/cricsheet/all');
const OUT = join(ROOT, 'data/cricket');

// 20-over and 50-over cricket with six-ball overs; Tests and other first-class matches. The
// Hundred (five-ball sets) and the rest are kept for venue names but not modelled.
function kindOf(info) {
  const mt = info.match_type;
  if ((info.balls_per_over ?? 6) !== 6) return null;
  if ((mt === 'T20' || mt === 'IT20') && info.overs === 20) return 't20';
  if ((mt === 'ODI' || mt === 'ODM') && info.overs === 50) return 'odi';
  if (mt === 'Test' || mt === 'MDM') return 'test';
  return null;
}

// Not dismissals: the batter can come back, and scorecards don't count them as wickets.
const NOT_OUT = new Set(['retired hurt', 'retired not out']);

function innings(inn, oneDay) {
  let runs = 0;
  let wkts = 0;
  let balls = 0;
  const c = [];
  const w = [];
  for (const over of inn.overs ?? []) {
    for (const d of over.deliveries ?? []) {
      runs += d.runs?.total ?? 0;
      wkts += (d.wickets ?? []).filter((x) => !NOT_OUT.has(x.kind)).length;
      const legal = !d.extras?.wides && !d.extras?.noballs;
      if (legal) {
        balls += 1;
        if (oneDay) {
          c.push(runs);
          w.push(wkts);
        }
      }
    }
  }
  // A no-ball or wide off the last delivery adds after the last legal ball.
  if (oneDay && c.length) c[c.length - 1] = runs;
  return {
    team: inn.team,
    runs,
    wkts,
    balls,
    decl: Boolean(inn.declared),
    forf: Boolean(inn.forfeited),
    target: inn.target ? [inn.target.runs ?? null, inn.target.overs ?? null] : null,
    ...(oneDay ? { c, w } : null),
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const files = (await readdir(SRC)).filter((f) => f.endsWith('.json'));
  const out = [];
  let done = 0;
  for (const f of files) {
    const j = JSON.parse(await readFile(join(SRC, f), 'utf8'));
    const info = j.info;
    const kind = kindOf(info);
    const o = info.outcome ?? {};
    out.push({
      id: f.replace('.json', ''),
      date: info.dates?.[0] ?? null,
      gender: info.gender,
      kind,
      mt: info.match_type,
      event: info.event?.name ?? null,
      club: info.team_type === 'club',
      teams: info.teams,
      venue: info.venue ?? null,
      city: info.city ?? null,
      toss: info.toss ? [info.toss.winner, info.toss.decision] : null,
      winner: o.winner ?? null,
      result: o.winner ? 'win' : (o.result ?? null),
      by: o.by ?? null,
      dl: Boolean(o.method),
      overs: info.overs ?? null,
      inns: (j.innings ?? []).filter((i) => !i.super_over).map((i) => innings(i, kind === 't20' || kind === 'odi')),
    });
    if (++done % 2000 === 0) console.log(`${done} / ${files.length}`);
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  await writeFile(join(OUT, 'matches.json'), JSON.stringify(out));
  const by = {};
  for (const m of out) by[`${m.kind}-${m.gender}`] = (by[`${m.kind}-${m.gender}`] ?? 0) + 1;
  console.log(`${out.length} matches →`, by);
}

await main();
