#!/usr/bin/env node
// Our public track record. Before each deadline it saves what we projected for every player that
// gameweek (points, xG, xA, Net xG) next to FPL's own expected points; once the gameweek's matches
// are over it grades both against what happened (src/lib/sport/record.mjs). The site grades a
// finished gameweek on request too (/api/sport/fpl/record); this keeps the committed copy.
//
//   data/sport/projections/gw<N>.json     saved projections (rewritten until the deadline passes)
//   public/sport/data/pl/accuracy.json    the graded record
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getStatic, getFixtures, getLive } from '../../src/lib/sport/fpl-server.mjs';
import { projectAhead } from '../../src/lib/sport/fpl.mjs';
import { netBoard } from '../../src/lib/sport/netxg.mjs';
import { bookmakersByFixture } from '../../src/lib/sport/odds-feed.mjs';
import { buildRecord } from '../../src/lib/sport/record.mjs';
import { ROOT, DATA, readJson, loadKit, makeCtx } from './kit.mjs';

const SNAP = join(ROOT, 'data/sport/projections');
const r2 = (v) => Math.round(v * 100) / 100;
await mkdir(SNAP, { recursive: true });

const st = await getStatic();
const fixtures = await getFixtures();
const now = Date.now();

/* ------------------------------------------------------------- save this week's projections */

const target = st.events.find((e) => new Date(e.deadline).getTime() > now);
if (target) {
  const { kit, learned, nx } = await loadKit();
  // As the page projects them: the bookmakers' expected goals for the matches they've priced.
  const odds = await bookmakersByFixture(st.teams, fixtures, now).catch(() => ({ fixtures: {} }));
  const ctx = makeCtx(st, kit, undefined, odds.fixtures);
  const gw = target.id;
  const ids = st.elements.map((e) => e.id);
  const ahead = projectAhead(ids, fixtures, [gw], ctx);
  const net = Object.fromEntries(netBoard(st.elements, fixtures, gw, ctx, kit, nx.players, learned).map((p) => [p.id, p]));
  // FPL's own number for that gameweek: ep_this while it's the current one, ep_next when it's next.
  const fplEp = (e) => (target.current ? e.epThis : e.ep) ?? 0;
  const players = {};
  for (const e of st.elements) {
    const c = ahead[e.id]?.per[gw];
    if (!c?.fx.length) continue;
    players[e.id] = [r2(c.xp), r2(c.xg), r2(c.xa), r2(net[e.id]?.xg ?? 0), r2(net[e.id]?.xa ?? 0), r2(fplEp(e))];
  }
  const priced = Object.values(odds.fixtures).filter((v) => v.event === gw).length;
  await writeFile(join(SNAP, `gw${gw}.json`), JSON.stringify({ gw, deadline: target.deadline, at: new Date().toISOString(), pricedMatches: priced, fields: ['xp', 'xg', 'xa', 'netXg', 'netXa', 'fplEp'], players }));
  console.log(`Saved gameweek ${gw} projections for ${Object.keys(players).length} players (${priced} matches from bookmakers' prices)`);
}

/* ------------------------------------------------------------- grade the gameweeks played */

const files = (await readdir(SNAP)).filter((f) => /^gw\d+\.json$/.test(f));
const snaps = (await Promise.all(files.map((f) => readJson(join(SNAP, f))))).filter(Boolean);
const record = await buildRecord({ snaps, st, live: getLive, now });
await writeFile(join(DATA, 'accuracy.json'), JSON.stringify(record, null, 1));
const { weeks, awaiting, pending } = record;
const prov = weeks.filter((w) => w.provisional).map((w) => w.gw);
console.log(`Graded ${weeks.length} gameweek(s)${prov.length ? ` (GW${prov.join(', GW')} provisional)` : ''}${awaiting.length ? `; still being played: GW${awaiting.map((a) => a.gw).join(', GW')}` : ''}; saving: ${pending ? `GW${pending.gw}` : 'none'}`);
