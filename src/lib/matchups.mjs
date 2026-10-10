// Who creates what against whom. Every Premier League match since 2023/24 is boiled down to one
// row per player: his role in that match (from where he stood in the formation), his minutes, and
// the xG of his shots and of the shots he set up. From those rows come two things fans ask for:
//  - how much a team allows to each role ("Spurs give right wingers 0.31 xG per 90");
//  - what a player has done against one opponent before.
// The rows are built by scripts/sport/build-matchups.mjs and served as static JSON.

import { formationLines } from './espn.mjs';

export const ROLES = ['GK', 'CB', 'FB-L', 'FB-R', 'CM', 'AM', 'W-L', 'W-R', 'ST'];
export const ROLE_NAME = {
  GK: 'goalkeepers',
  CB: 'centre-backs',
  'FB-L': 'left-backs',
  'FB-R': 'right-backs',
  CM: 'central midfielders',
  AM: 'attacking midfielders',
  'W-L': 'left wingers',
  'W-R': 'right wingers',
  ST: 'strikers',
};
export const ROLE_ONE = {
  GK: 'goalkeeper',
  CB: 'centre-back',
  'FB-L': 'left-back',
  'FB-R': 'right-back',
  CM: 'central midfielder',
  AM: 'attacking midfielder',
  'W-L': 'left winger',
  'W-R': 'right winger',
  ST: 'striker',
};

export const ROLE_SHORT = { GK: 'keeper', CB: 'centre-back', 'FB-L': 'left-back', 'FB-R': 'right-back', CM: 'midfield', AM: 'No. 10', 'W-L': 'left wing', 'W-R': 'right wing', ST: 'striker' };

/**
 * Roles for a starting eleven from its formation lines (GK first, then back to front, each line
 * left to right). ESPN's own labels shift with the formation (in a 4-3-3 "RM" is a central
 * midfielder and "RF" the winger), so the role comes from the shape instead.
 */
export function rolesFromLines(lines) {
  const out = {};
  const last = lines.length - 1;
  const backThree = lines[1]?.length === 3;
  lines.forEach((line, li) => {
    const n = line.length;
    line.forEach((p, i) => {
      const side = n > 1 && i === 0 ? 'L' : n > 1 && i === n - 1 ? 'R' : null;
      let r;
      if (li === 0) r = 'GK';
      else if (li === 1) r = n >= 4 && side ? `FB-${side}` : 'CB';
      else if (li === last) r = n >= 3 && side ? `W-${side}` : 'ST';
      else if (n >= 4 && side) r = backThree && li === 2 ? `FB-${side}` : `W-${side}`; // wing-backs ahead of a back three
      else if (li === last - 1 && lines[last].length === 1 && n === 3 && side) r = `W-${side}`; // the wide men in a 4-2-3-1
      else r = li === last - 1 && li > 2 ? 'AM' : 'CM';
      out[p.id] = r;
    });
  });
  return out;
}

const BY_LABEL = { G: 'GK', GK: 'GK', LB: 'FB-L', LWB: 'FB-L', RB: 'FB-R', RWB: 'FB-R', LW: 'W-L', RW: 'W-R', AM: 'AM', 'AM-L': 'W-L', 'AM-R': 'W-R', F: 'ST', CF: 'ST', ST: 'ST', S: 'ST' };
/** When the formation can't be read: ESPN's label, best guess. */
const roleFromLabel = (pos = '') => BY_LABEL[pos] ?? (/^CD|^D|SW/.test(pos) ? 'CB' : /^CF/.test(pos) ? 'ST' : 'CM');

const minuteOf = (s) => {
  const m = String(s ?? '').match(/^(\d+)/);
  return m ? Math.min(90, Number(m[1])) : null;
};

const norm = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').trim();

/**
 * One match (fetchMatch's shape) into player rows:
 * [playerId, name, side, role, minutes, shots, xg, goals, xa, assists]
 */
export function playerRows(detail) {
  const rows = [];
  for (const side of ['home', 'away']) {
    const lu = detail.lineups?.[side];
    if (!lu?.starters?.length) continue;
    const lines = lu.lines ?? formationLines(lu.starters, lu.formation);
    const roles = lines ? rolesFromLines(lines) : Object.fromEntries(lu.starters.map((p) => [p.id, roleFromLabel(p.pos)]));
    // A substitute takes the role of the man he replaced.
    const subs = detail.events.filter((e) => e.kind === 'sub' && e.side === side).sort((a, b) => a.order - b.order);
    for (const e of subs) {
      const [on, off] = e.playerIds ?? [];
      if (on && off && roles[off]) roles[on] = roles[off];
    }
    const all = [...lu.starters, ...lu.bench];
    const byName = new Map(all.map((p) => [norm(p.name), p.id]));
    const stat = Object.fromEntries(all.map((p) => [p.id, { shots: 0, xg: 0, goals: 0, xa: 0, assists: 0 }]));
    for (const s of detail.shots.filter((x) => x.side === side)) {
      const id = byName.get(norm(s.player));
      if (id) {
        stat[id].shots += 1;
        stat[id].xg += s.xg;
        if (s.outcome === 'goal') stat[id].goals += 1;
      }
      const assister = s.text.match(/Assisted by ([^.]+?)(?: with | following |\.|$)/)?.[1];
      const aid = assister && byName.get(norm(assister));
      if (aid) {
        stat[aid].xa += s.xg;
        if (s.outcome === 'goal') stat[aid].assists += 1;
      }
    }
    for (const p of all) {
      const on = p.starter ? 0 : minuteOf(p.on);
      if (on == null) continue; // unused substitute
      const off = p.off != null ? minuteOf(p.off) ?? 90 : 90;
      const minutes = Math.max(1, off - on);
      const s = stat[p.id];
      rows.push([p.id, p.name, side === 'home' ? 1 : 0, roles[p.id] ?? roleFromLabel(p.pos), minutes, s.shots, round3(s.xg), s.goals, round3(s.xa), s.assists]);
    }
  }
  return rows;
}

const round3 = (v) => Math.round(v * 1000) / 1000;

/* ---------------------------------------------------------------- reading the built data */

/**
 * xG a team allows per 90 minutes of each opposing role, for one season, against the league.
 * defence: the built file's `conceded[team][season]` = { role: [minutes, xg, xa, shots, goals] }
 * league: `league[season]` in the same shape, summed over every team.
 */
export function allowedByRole(teamSeason, leagueSeason) {
  const out = {};
  for (const r of ROLES) {
    const t = teamSeason?.[r];
    const l = leagueSeason?.[r];
    if (!t || !l || !l[0]) continue;
    const per90 = (row) => (row[0] ? ((row[1] + row[2]) / row[0]) * 90 : 0); // xG + xA: chances made by that role
    const xg90 = t[0] ? (t[1] / t[0]) * 90 : 0;
    out[r] = { minutes: t[0], xg90, xgi90: per90(t), leagueXg90: (l[1] / l[0]) * 90, leagueXgi90: per90(l), index: per90(l) ? per90(t) / per90(l) : 1 };
  }
  return out;
}

/**
 * How much more (or less) than usual an opponent gives up to one role, pulled towards "average"
 * while the sample is small. 1.2 means 20% more than an average team.
 */
export function roleFactor(teamSeasons, leagueSeasons, role, seasons) {
  // This season counts double last season's; a season before that, half again.
  const weights = [1, 0.5, 0.25];
  let num = 0;
  let den = 0;
  let minutes = 0;
  seasons.forEach((s, i) => {
    const t = teamSeasons?.[s]?.[role];
    const l = leagueSeasons?.[s]?.[role];
    if (!t || !l || !l[0] || !t[0]) return;
    const lRate = (l[1] + l[2]) / l[0];
    const w = (weights[i] ?? 0) * t[0];
    num += w * ((t[1] + t[2]) / t[0] / lRate);
    den += w;
    minutes += t[0];
  });
  if (!den) return { factor: 1, raw: null, minutes: 0 };
  const raw = num / den;
  // About ten matches' worth of an average opponent keeps a hot streak from running away with it.
  const k = 900;
  const eff = Math.min(minutes, den);
  return { factor: (raw * eff + k) / (eff + k), raw, minutes };
}

/** A player's record against one opponent from his match rows: [date, opp, home, gf, ga, role, min, shots, xg, goals, xa, assists]. */
export function versus(rows, oppId) {
  const list = rows.filter((r) => r[1] === oppId);
  const sum = (i) => list.reduce((t, r) => t + r[i], 0);
  const all = (i) => rows.reduce((t, r) => t + r[i], 0);
  const min = sum(6);
  const allMin = all(6);
  return {
    matches: list,
    minutes: min,
    xg: sum(8),
    xa: sum(10),
    goals: sum(9),
    assists: sum(11),
    xgi90: min ? ((sum(8) + sum(10)) / min) * 90 : null,
    usual90: allMin ? ((all(8) + all(10)) / allMin) * 90 : null,
  };
}

/** The role he has played most, in the latest season with minutes. */
export function mainRole(rows) {
  if (!rows?.length) return null;
  const latest = rows.reduce((m, r) => (r[0] > m ? r[0] : m), '').slice(0, 4);
  const pick = (list) => {
    const m = {};
    for (const r of list) m[r[5]] = (m[r[5]] ?? 0) + r[6];
    return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const recent = rows.filter((r) => r[0] >= `${Number(latest) - 1}-07`).slice(-12);
  return pick(recent.length ? recent : rows);
}
