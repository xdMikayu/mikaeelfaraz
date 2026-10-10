#!/usr/bin/env node
// Our public track record. Before each deadline it saves what we projected for every player that
// gameweek (points, xG, xA, Net xG) next to FPL's own expected points; once the gameweek is over it
// grades both against what happened. Nothing is graded that wasn't saved before the deadline.
//
//   data/sport/projections/gw<N>.json     saved projections (rewritten until the deadline passes)
//   public/sport/data/pl/accuracy.json    the graded record the site shows
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getStatic, getFixtures, getLive } from '../../src/lib/sport/fpl-server.mjs';
import { projectAhead } from '../../src/lib/sport/fpl.mjs';
import { netBoard } from '../../src/lib/sport/netxg.mjs';
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
  const ctx = makeCtx(st, kit);
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
  await writeFile(join(SNAP, `gw${gw}.json`), JSON.stringify({ gw, deadline: target.deadline, at: new Date().toISOString(), fields: ['xp', 'xg', 'xa', 'netXg', 'netXa', 'fplEp'], players }));
  console.log(`Saved gameweek ${gw} projections for ${Object.keys(players).length} players`);
}

/* ------------------------------------------------------------- grade finished gameweeks */

const mean = (a) => (a.length ? a.reduce((t, v) => t + v, 0) / a.length : null);
const corr = (a, b) => {
  const ma = mean(a);
  const mb = mean(b);
  let n = 0;
  let da = 0;
  let db = 0;
  a.forEach((v, i) => {
    n += (v - ma) * (b[i] - mb);
    da += (v - ma) ** 2;
    db += (b[i] - mb) ** 2;
  });
  return da && db ? n / Math.sqrt(da * db) : null;
};
const topBy = (list, k, n) => [...list].sort((a, b) => b[k] - a[k]).slice(0, n);

const weeks = [];
for (const file of (await readdir(SNAP)).filter((f) => /^gw\d+\.json$/.test(f))) {
  const snap = await readJson(join(SNAP, file));
  const ev = st.events.find((e) => e.id === snap.gw);
  if (!ev?.finished) continue;
  const live = await getLive(snap.gw);
  const rows = Object.entries(snap.players).map(([id, [xp, xg, xa, nxg, nxa, ep]]) => {
    const a = live.elements[id] ?? { points: 0, minutes: 0, xg: 0, xa: 0 };
    return { id: Number(id), xp, xg, xa, nxg, nxa, ep, pts: a.points ?? 0, min: a.minutes ?? 0, axg: a.xg ?? 0, axa: a.xa ?? 0 };
  });
  // Judged on the players anyone would consider: projected at least 2 points by us or by FPL.
  const pool = rows.filter((r) => r.xp >= 2 || r.ep >= 2);
  const played = rows.filter((r) => r.min > 0);
  const name = (id) => st.elements.find((e) => e.id === id)?.name ?? String(id);
  const capOurs = topBy(pool, 'xp', 1)[0];
  const capFpl = topBy(pool, 'ep', 1)[0];
  weeks.push({
    gw: snap.gw,
    savedAt: snap.at,
    n: pool.length,
    points: {
      maeOurs: mean(pool.map((r) => Math.abs(r.xp - r.pts))),
      maeFpl: mean(pool.map((r) => Math.abs(r.ep - r.pts))),
      corrOurs: corr(pool.map((r) => r.xp), pool.map((r) => r.pts)),
      corrFpl: corr(pool.map((r) => r.ep), pool.map((r) => r.pts)),
      top10Ours: mean(topBy(pool, 'xp', 10).map((r) => r.pts)),
      top10Fpl: mean(topBy(pool, 'ep', 10).map((r) => r.pts)),
      top10Best: mean(topBy(rows, 'pts', 10).map((r) => r.pts)),
      captainOurs: capOurs && { name: name(capOurs.id), pts: capOurs.pts },
      captainFpl: capFpl && { name: name(capFpl.id), pts: capFpl.pts },
    },
    netXg: {
      n: played.length,
      corr: corr(played.map((r) => r.nxg), played.map((r) => r.axg)),
      top20: mean(topBy(played, 'nxg', 20).map((r) => r.axg)),
      top20Goals: null,
    },
  });
}
weeks.sort((a, b) => a.gw - b.gw);
const pending = target ? { gw: target.id, deadline: target.deadline } : null;
const sum = (k, f) => weeks.reduce((t, w) => t + (f(w) ?? 0), 0);
const season = weeks.length
  ? {
      weeks: weeks.length,
      maeOurs: sum('', (w) => w.points.maeOurs) / weeks.length,
      maeFpl: sum('', (w) => w.points.maeFpl) / weeks.length,
      top10Ours: sum('', (w) => w.points.top10Ours) / weeks.length,
      top10Fpl: sum('', (w) => w.points.top10Fpl) / weeks.length,
      captainOurs: sum('', (w) => w.points.captainOurs?.pts),
      captainFpl: sum('', (w) => w.points.captainFpl?.pts),
      beatFplWeeks: weeks.filter((w) => w.points.maeOurs < w.points.maeFpl).length,
    }
  : null;
await writeFile(join(DATA, 'accuracy.json'), JSON.stringify({ built: new Date().toISOString(), firstWeek: weeks[0]?.gw ?? pending?.gw ?? null, pending, season, weeks }, null, 1));
console.log(`Graded ${weeks.length} gameweek(s); next to grade: ${pending ? `GW${pending.gw}` : 'none'}`);
