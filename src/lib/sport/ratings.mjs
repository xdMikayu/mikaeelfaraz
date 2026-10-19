// Player ratings out of 10, worked out from what the match's own data says each player did. FotMob,
// SofaScore and WhoScored rate players from Opta's full event data, which isn't free; Matchday rates
// from what is: ESPN's lineups and per-player numbers, Opta's commentary on every shot (with our xG
// for it and who set it up), the result, and, in the Premier League, FPL's Opta numbers for tackles,
// clearances, blocks, interceptions, recoveries and saves.
//
// Like theirs, a rating starts from a base and each thing a player does moves it, by how much it
// tends to matter: goals and assists most, then the quality of the chances taken and made, saves,
// defending, discipline, and how the side did while the player was on. The weights are in W, the
// scale (where an ordinary 90 minutes lands, how far a great one goes) in SCALE; both are set so
// ratings spread the way people know from those apps (most starters 6 to 7.5, 8 a fine game, 9 rare)
// and are checked in ratings.test.mjs, and against FPL's own Opta-based bonus point scores (BPS) on
// this season's Premier League matches by scripts/sport/check-ratings.mjs.

import { rolesFromLines } from './matchups.mjs';

/** How much each thing is worth, in rating points before scaling. */
export const W = {
  goal: 1.05,
  penGoal: 0.6, // a penalty scored, most of its xG already counted
  assist: 0.6,
  shotXg: 0.9, // per xG of the player's shots (getting into the places goals come from)
  chanceXg: 0.85, // per xG of the shots the player set up
  onTarget: 0.06,
  bigMiss: -0.22, // a shot worth 0.35 xG or more that didn't go in (not a penalty)
  penMissed: -0.8,
  penWon: 0.35,
  penConceded: -0.6,
  fouled: 0.05,
  foul: -0.05,
  offside: -0.06,
  yellow: -0.3,
  red: -1.3,
  ownGoal: -0.9,
  // Defending, from FPL in the Premier League; elsewhere a player gets the role's average for the minutes played.
  tackle: 0.1,
  cbi: 0.07, // clearances, blocks and interceptions
  recovery: 0.035,
  // Goalkeeping.
  save: 0.18,
  savedXg: 0.7, // per xG of the shots the keeper saved
  penSaved: 1.1,
  // The team while the player was on, scaled by the share of the match played.
  win: 0.3,
  loss: -0.25,
  goalDiff: 0.08, // per goal the side outscored the other while the player was on
};

/** What conceding means by role: per goal conceded while on, a clean sheet (60+ minutes), and per xG the other side had while the player was on. */
export const BACK = {
  GK: { conceded: -0.4, clean: 0.55, xga: -0.1 },
  DEF: { conceded: -0.28, clean: 0.45, xga: -0.22 },
  MID: { conceded: -0.1, clean: 0.12, xga: -0.06 },
  ATT: { conceded: 0, clean: 0, xga: 0 },
};

/** A role's average defending per 90 minutes, for leagues without the numbers (from this season's Premier League). */
export const DEFENDING_P90 = { GK: 0.15, DEF: 0.62, MID: 0.55, ATT: 0.24 };

/**
 * The scale: each role's base (where a quiet 90 minutes lands), how far the points above move a
 * rating (k), a substitute's lower start, and the curve that keeps both ends rare: above `soft` each
 * point counts for less and less, approaching 10; below `low`, approaching 3. Fitted to this season's
 * Premier League matches by scripts/sport/check-ratings.mjs so that starters average about 6.8 in
 * every role and spread as the familiar apps' ratings do.
 */
export const SCALE = { k: 0.711, base: { GK: 6.39, DEF: 6.62, MID: 6.36, ATT: 6.12 }, subDrop: 0.15, soft: 8, low: 5 };

const GROUP = { GK: 'GK', CB: 'DEF', 'FB-L': 'DEF', 'FB-R': 'DEF', CM: 'MID', AM: 'MID', 'W-L': 'ATT', 'W-R': 'ATT', ST: 'ATT' };
const BY_POS = (pos = '') => (/^G/.test(pos) ? 'GK' : /^(CD|LB|RB|LWB|RWB|D|SW)/.test(pos) ? 'DEF' : /^(F|CF|ST|S$|LW|RW)/.test(pos) ? 'ATT' : 'MID');

/** "45'+2'" is still the first half, "90'+4'" is 94: the minute on the match's own clock. */
export function clockMinute(display = '') {
  const m = String(display).match(/(\d+)'?(?:\+(\d+))?/);
  if (!m) return null;
  const base = Number(m[1]);
  const extra = Number(m[2] ?? 0);
  return base === 45 && extra ? 45 + extra / 100 : base + extra;
}

const fold = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Above `soft` each point counts for less, approaching 10; below `low` each counts for less, approaching 3. */
export function squash(x) {
  const { soft, low } = SCALE;
  if (x > soft) return soft + (10 - soft) * Math.tanh((x - soft) / (10 - soft));
  if (x < low) return low - (low - 3) * Math.tanh((low - x) / (low - 3));
  return x;
}

/**
 * Every player's rating for one match (fetchMatch's shape), live or finished. `fpl` is optional:
 * { espnId: FPL live line } for Premier League matches (fplmap.mjs fplPlayersFor), which adds the
 * defending and saves Opta counts. Returns { players: { id: { rating, minutes, parts, group } }, best }.
 * Nobody is rated before 10 minutes on the pitch unless they have scored, made one or been sent off.
 */
export function matchRatings(detail, fpl = null, now = null) {
  const { match, shots = [], events = [], commentary = [], lineups } = detail;
  if (!lineups?.home?.starters?.length && !lineups?.away?.starters?.length) return { players: {}, best: null };
  const live = match.status?.state === 'in';
  // The match's last minute so far: the clock while it's on, else the latest thing that happened (at least 90).
  const lastEvent = Math.max(90, ...events.map((e) => clockMinute(e.minute) ?? 0), ...shots.map((s) => clockMinute(s.minute) ?? 0));
  const end = live ? (now ?? clockMinute(match.status?.label) ?? lastEvent) : lastEvent;
  const score = { home: Number(match.home?.score ?? 0), away: Number(match.away?.score ?? 0) };
  const goals = events.filter((e) => ['goal', 'pen', 'og'].includes(e.kind) && e.side && e.period < 5);
  const out = {};

  for (const side of ['home', 'away']) {
    const lu = lineups[side];
    if (!lu?.starters?.length) continue;
    const other = side === 'home' ? 'away' : 'home';
    const lines = lu.lines;
    const roles = lines ? rolesFromLines(lines) : {};
    // A substitute takes the role of the player replaced.
    for (const e of events.filter((x) => x.kind === 'sub' && x.side === side).sort((a, b) => a.order - b.order)) {
      const [on, off] = e.playerIds ?? [];
      if (on && off && roles[off]) roles[on] = roles[off];
    }
    const result = score[side] > score[other] ? 'win' : score[side] < score[other] ? 'loss' : 'draw';
    const all = [...lu.starters, ...lu.bench];
    const byName = new Map(all.map((p) => [fold(p.name), p]));
    for (const p of all) {
      const on = p.starter ? 0 : clockMinute(p.on);
      if (on == null) continue; // an unused substitute
      const red = events.find((e) => e.kind === 'red' && e.playerIds?.[0] === p.id);
      const offAt = p.off != null ? clockMinute(p.off) : red ? clockMinute(red.minute) : null;
      const off = Math.min(end, offAt ?? end);
      // Minutes as people count them: a full match is 90 (120 with extra time), stoppage time aside.
      const full = events.some((e) => e.period > 2) ? 120 : 90;
      const minutes = Math.max(0, Math.round(Math.min(off, full) - Math.min(on, full - 1)));
      const share = Math.min(1, minutes / 90);
      const group = GROUP[roles[p.id]] ?? BY_POS(p.pos);
      const back = BACK[group];
      const onPitch = (m) => m != null && m >= on && m <= off;
      const parts = { attack: 0, creating: 0, defending: 0, keeping: 0, discipline: 0, team: 0 };

      // Attack: goals (penalties less, their xG is most of them), the chances taken, and wasting big ones.
      const mine = shots.filter((s) => s.side === side && byName.get(fold(s.player)) === p);
      for (const s of mine) {
        const goal = s.outcome === 'goal';
        if (s.penalty) parts.attack += goal ? W.penGoal : W.penMissed;
        else {
          parts.attack += W.shotXg * (s.xg ?? 0);
          if (goal) parts.attack += W.goal;
          else if ((s.xg ?? 0) >= 0.35) parts.attack += W.bigMiss;
        }
        if (goal || s.outcome === 'saved') parts.attack += W.onTarget;
      }
      // Creating: assists, and the chances set up whether they went in or not.
      const made = shots.filter((s) => s.side === side && !s.penalty && fold(s.text.match(/Assisted by ([^.]+?)(?: with | following |\.|$)/)?.[1]) === fold(p.name));
      parts.creating += made.reduce((t, s) => t + W.chanceXg * (s.xg ?? 0), 0);
      parts.creating += W.assist * (p.assists ?? 0);
      parts.creating += W.fouled * (p.fouled ?? 0);

      // Discipline.
      parts.discipline += W.foul * (p.fouls ?? 0) + W.offside * (p.offsides ?? 0) + W.ownGoal * (p.og ?? 0);
      if (red) parts.discipline += W.red;
      else if (p.yellow) parts.discipline += W.yellow;
      // Opta's lines for penalties: "Penalty conceded by X (Club) after a foul in the penalty area.",
      // "Penalty Club. X draws a foul in the penalty area."
      for (const { text } of commentary) {
        if (text.startsWith(`Penalty conceded by ${p.name} (`)) parts.discipline += W.penConceded;
        else if (/^Penalty [^.]+\. /.test(text) && text.includes(`. ${p.name} draws a foul in the penalty area`)) parts.creating += W.penWon;
      }

      // Defending: FPL's Opta counts where there are any, else the role's average for the minutes played.
      const f = fpl?.[p.id];
      if (f?.st) parts.defending += W.tackle * f.st.tk + W.cbi * f.st.cbi + W.recovery * f.st.rec;
      else parts.defending += DEFENDING_P90[group] * share;

      // What the other side got while the player was on, by how much of it is the role's job.
      const against = goals.filter((g) => g.side === other && onPitch(clockMinute(g.minute))).length;
      const xga = shots.filter((s) => s.side === other && onPitch(clockMinute(s.minute))).reduce((t, s) => t + (s.xg ?? 0), 0);
      parts.defending += back.conceded * against + back.xga * xga;
      if (minutes >= 60 && against === 0) parts.defending += back.clean;

      // Goalkeeping: saves (FPL's count in the Premier League, else ESPN's), the xG of what was kept out, penalties saved.
      if (group === 'GK') {
        const saved = shots.filter((s) => s.side === other && s.outcome === 'saved' && s.text.includes(`by ${p.name}`));
        const count = f?.st ? f.st.sv : (p.saves ?? saved.length);
        parts.keeping += W.save * count + W.savedXg * saved.filter((s) => !s.penalty).reduce((t, s) => t + (s.xg ?? 0), 0);
        parts.keeping += W.penSaved * (f?.st?.ps ?? saved.filter((s) => s.penalty).length);
      }

      // The team: the result (as it stands, while it's on) and the goal difference while the player was on.
      const forUs = goals.filter((g) => g.side === side && onPitch(clockMinute(g.minute))).length;
      parts.team += share * (result === 'win' ? W.win : result === 'loss' ? W.loss : 0) + W.goalDiff * (forUs - against);

      const did = (p.goals ?? 0) + (p.assists ?? 0) + (red ? 1 : 0);
      if (minutes < 10 && !did) continue;
      const sum = Object.values(parts).reduce((t, v) => t + v, 0);
      const raw = SCALE.base[group] - (p.starter ? 0 : SCALE.subDrop) + SCALE.k * sum;
      out[p.id] = { rating: Math.round(squash(raw) * 10) / 10, raw, sum, minutes, parts, group, side };
    }
  }
  const ranked = Object.entries(out).sort((a, b) => b[1].raw - a[1].raw);
  return { players: out, best: ranked[0]?.[0] ?? null };
}

/** The colour band a rating falls in, as the apps people know use them: 8 and up, 7 to 8, 6 to 7, under 6. */
export const band = (r) => (r >= 8 ? 'top' : r >= 7 ? 'good' : r >= 6 ? 'fair' : 'poor');
