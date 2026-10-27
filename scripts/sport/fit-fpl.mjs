#!/usr/bin/env node
// Teaches the FPL projections from every gameweek played so far (src/lib/sport/fpl-learn.mjs): who
// starts, given his season and his last three matches, and how much defensive contributions bunch.
// Before it's used, the fit is checked the honest way: each of this season's latest weeks projected
// by a fit made without it, against the plain model. If the fit doesn't do better, it's left out.
//
//   data/sport/fpl-history/*.json         the gameweeks (scripts/sport/build-fpl-history.mjs)
//   public/sport/data/pl/fpl-model.json   what was learned, and how it tested
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readHistory, kitBefore, replayWeek, fitMinutes, fitDc, scoreWeek } from '../../src/lib/sport/fpl-learn.mjs';
import { countTail, poissonTail } from '../../src/lib/sport/fpl.mjs';
import { ROOT, DATA, readJson } from './kit.mjs';

const HIST = join(ROOT, 'data/sport/fpl-history');
const ix = await readJson(join(DATA, 'index.json'));
const netxg = await readJson(join(DATA, 'netxg-model.json'));
const files = (await readdir(HIST)).filter((f) => /^\d{4}\.json$/.test(f)).sort();
const H = {};
for (const f of files) H[f.slice(0, 4)] = readHistory(await readJson(join(HIST, f)));
const seasons = Object.keys(H).sort();
const current = seasons.at(-1);
// Roles come from the matchup data, keyed by this season's FPL ids; earlier seasons' players are
// found by FPL's code for them, which doesn't change between seasons.
const idByCode = Object.fromEntries(Object.entries(H[current].players).map(([id, p]) => [p.code, id]));
const rolesOf = (s) => (s === current ? ix.roles : Object.fromEntries(Object.entries(H[s].players).map(([id, p]) => [id, ix.roles[idByCode[p.code]]]).filter(([, r]) => r)));
const roles = Object.fromEntries(seasons.map((s) => [s, rolesOf(s)]));

// Every week from the fourth of its season, when there's a little of the season to go on.
const weeks = seasons.flatMap((s) => H[s].gws.filter((g) => g >= 4).map((gw) => [s, gw]));
const kits = {};
const replay = ([s, gw], learned = null) => replayWeek(H[s], gw, (kits[`${s}:${gw}`] ??= kitBefore(ix, H[s], H[s].deadline[gw], { learned: netxg, roles: roles[s] })), { learned }).map((r) => ({ s, gw, ...r }));
const plain = weeks.map((w) => replay(w));
const fit = (rows) => ({ minutes: fitMinutes(rows), dc: fitDc(rows) });

// The check: this season's latest weeks (up to five), each projected by a fit of everything before it.
const checks = [];
for (const i of weeks.map((w, i) => i).filter((i) => weeks[i][0] === current).slice(-5)) {
  const learned = fit(plain.slice(0, i).flat());
  checks.push({ gw: weeks[i][1], plain: scoreWeek(plain[i]), learned: scoreWeek(replay(weeks[i], learned)) });
}
const mean = (k, which) => checks.reduce((t, c) => t + c[which][k], 0) / Math.max(1, checks.length);
const summary = Object.fromEntries(['plain', 'learned'].map((w) => [w, Object.fromEntries(['sq', 'abs', 'rho', 'top50'].map((k) => [k, Math.round(mean(k, w) * 1000) / 1000]))]));
const better = checks.length > 0 && summary.learned.sq <= summary.plain.sq;

const all = plain.flat();
const learned = fit(all);
// A few things the fit says, in numbers the page can quote.
const pStart = (share, s1, s3) => 1 / (1 + Math.exp(-learned.minutes.start.reduce((t, b, i) => t + b * [1, share, s1, s3, share * s1][i], 0)));
const facts = {
  startedLastThree: pStart(0.9, 1, 1),
  droppedLastTime: pStart(0.9, 0, 2 / 3),
  noneOfLastThree: pStart(0.9, 0, 0),
  dcDefender6: { learned: countTail(6, 10, learned.dc[2]), poisson: poissonTail(6, 10) },
};
const r3 = (v) => Math.round(v * 1000) / 1000;
await writeFile(
  join(DATA, 'fpl-model.json'),
  JSON.stringify({
    built: new Date().toISOString(),
    trainedOn: { playerWeeks: all.length, weeks: weeks.length, seasons: seasons.map((s) => `${s}/${String(Number(s) + 1).slice(2)}`) },
    // Used only when it beat the plain model on the weeks it was checked on.
    use: better,
    minutes: learned.minutes,
    dc: learned.dc,
    check: { weeks: checks.map((c) => c.gw), ...summary },
    facts: { startedLastThree: r3(facts.startedLastThree), droppedLastTime: r3(facts.droppedLastTime), noneOfLastThree: r3(facts.noneOfLastThree), dcDefender6: { learned: r3(facts.dcDefender6.learned), poisson: r3(facts.dcDefender6.poisson) } },
  })
);
console.log(`Learned from ${all.length} player-gameweeks (${seasons.join(', ')}). Checked on gameweek${checks.length > 1 ? 's' : ''} ${checks.map((c) => c.gw).join(', ')}: squared error ${summary.plain.sq} → ${summary.learned.sq}, rank correlation ${summary.plain.rho} → ${summary.learned.rho}, top 50 ${summary.plain.top50} → ${summary.learned.top50}. ${better ? 'In use.' : 'Not better than the plain model, so not used.'}`);
