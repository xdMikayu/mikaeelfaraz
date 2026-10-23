// Set pieces from ESPN's commentary, which is Opta's: every attempt says how it came about
// ("Assisted by Pascal Groß with a cross following a corner", "following a set piece situation",
// "from a direct free kick", a penalty). From those come:
//  - who a team aims for: the players who get a shot or header away from corners and indirect free
//    kicks, and their share of the team's attempts from them while they were on the pitch;
//  - who delivers: the players whose balls set those attempts up;
//  - how a team does at both ends: corners, attempts, goals and xG, for and against.
// It counts attempts, not first contacts: a flick-on, or a header that's cleared, isn't in the
// commentary. Built into public/data/pl/setpieces.json by scripts/build-matchups.mjs.

import { shotTraits } from './xg.mjs';

/** How an attempt came about: 'corner', 'set' (an indirect free kick or long throw), 'free' (shot straight from a free kick), 'pen', or null for open play. */
export function situation(text = '') {
  const t = shotTraits(text);
  if (t.penalty) return 'pen';
  if (t.freeKick) return 'free';
  if (t.corner) return 'corner';
  if (t.setPiece) return 'set';
  return null;
}

const KIND = { corner: 'c', set: 's', free: 'f', pen: 'p' };
const minuteOf = (s) => {
  const m = String(s ?? '').match(/^(\d+)/);
  return m ? Math.min(90, Number(m[1])) : null;
};
const norm = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').trim();
const round3 = (v) => Math.round(v * 1000) / 1000;

/**
 * One match (fetchMatch's shape) into what the set-piece numbers need:
 *  c: corners won [home, away], null if ESPN has no count;
 *  s: every attempt from a set piece, [home 1/0, minute, shooter id, kind c/s/f/p, header 1/0, xG, goal 1/0, set up by (id or 0)];
 *  w: [on, off] minutes for each player who didn't play the whole match, so a share can count only
 *     the attempts made while he was on the pitch.
 */
export function matchSetPieces(detail) {
  const corners = detail.stats?.find((s) => s.key === 'wonCorners');
  const out = { c: corners ? [corners.home, corners.away] : null, s: [], w: {} };
  for (const side of ['home', 'away']) {
    const lu = detail.lineups?.[side];
    if (!lu?.starters?.length) continue;
    const all = [...lu.starters, ...lu.bench];
    const byName = new Map(all.map((p) => [norm(p.name), p.id]));
    for (const p of all) {
      const on = p.starter ? 0 : minuteOf(p.on);
      if (on == null) continue;
      const off = p.off != null ? minuteOf(p.off) ?? 90 : 90;
      if (on > 0 || off < 90) out.w[p.id] = [on, off];
    }
    for (const s of detail.shots.filter((x) => x.side === side)) {
      const kind = KIND[situation(s.text)];
      if (!kind) continue;
      const assister = s.text.match(/Assisted by ([^.]+?)(?: with | following |\.|$)/)?.[1];
      out.s.push([
        side === 'home' ? 1 : 0,
        minuteOf(s.minute) ?? 0,
        byName.get(norm(s.player)) ?? 0,
        kind,
        s.header ? 1 : 0,
        round3(s.xg ?? 0),
        s.outcome === 'goal' ? 1 : 0,
        (assister && byName.get(norm(assister))) || 0,
      ]);
    }
  }
  return out;
}

/** True when the attempt came from a ball played into the box: a corner or an indirect free kick. */
export const delivered = (kind) => kind === 'c' || kind === 's';

/**
 * A season's set pieces, team by team, from cached matches ({ h, a, r, sp } as build-matchups keeps
 * them; r rows are [id, name, home, role, minutes, ...]). For each team:
 *   m matches, c corners won, cc corners conceded,
 *   a / g / x / hd: attempts, goals, xG and headers from corners and indirect free kicks,
 *   aa / ga / xa: the same conceded,
 *   f / fg: shots straight from free kicks and their goals, p / pg: penalties and goals,
 *   targets: [id, name, attempts, headers, goals, xG, team attempts while he was on, minutes], most first,
 *   deliver: [id, name, attempts set up, goals set up], most first.
 */
export function seasonSetPieces(matches) {
  const teams = {};
  const team = (id) =>
    (teams[id] ??= { m: 0, c: 0, cc: 0, a: 0, g: 0, x: 0, hd: 0, aa: 0, ga: 0, xa: 0, f: 0, fg: 0, p: 0, pg: 0, who: {}, by: {} });
  for (const m of matches) {
    if (!m.sp) continue;
    const sides = [
      [1, m.h, m.a],
      [0, m.a, m.h],
    ];
    for (const [home, id, opp] of sides) {
      const t = team(id);
      t.m += 1;
      if (m.sp.c) {
        t.c += m.sp.c[home ? 0 : 1] ?? 0;
        t.cc += m.sp.c[home ? 1 : 0] ?? 0;
      }
      const mine = m.sp.s.filter((s) => s[0] === home);
      const box = mine.filter((s) => delivered(s[3]));
      const o = team(opp);
      for (const s of box) {
        t.a += 1;
        t.g += s[6];
        t.x += s[5];
        t.hd += s[4];
        o.aa += 1;
        o.ga += s[6];
        o.xa += s[5];
      }
      for (const s of mine) {
        if (s[3] === 'f') {
          t.f += 1;
          t.fg += s[6];
        }
        if (s[3] === 'p') {
          t.p += 1;
          t.pg += s[6];
        }
      }
      // Everyone who played: his minutes, and the team's attempts while he was on.
      for (const r of m.r.filter((row) => row[2] === home)) {
        const [pid, name, , , minutes] = r;
        const [on, off] = m.sp.w[pid] ?? [0, 90];
        const p = (t.who[pid] ??= { n: name, a: 0, h: 0, g: 0, x: 0, on: 0, min: 0 });
        p.n = name;
        p.min += minutes;
        p.on += box.filter((s) => s[1] >= on && s[1] <= off).length;
      }
      for (const s of box) {
        const p = t.who[s[2]];
        if (p) {
          p.a += 1;
          p.h += s[4];
          p.g += s[6];
          p.x += s[5];
        }
        const by = t.who[s[7]];
        if (by) {
          const d = (t.by[s[7]] ??= { n: by.n, k: 0, g: 0 });
          d.n = by.n;
          d.k += 1;
          d.g += s[6];
        }
      }
    }
  }
  const out = {};
  for (const [id, t] of Object.entries(teams)) {
    const { who, by, ...rest } = t;
    out[id] = {
      ...rest,
      x: round3(t.x),
      xa: round3(t.xa),
      targets: Object.entries(who)
        .filter(([, p]) => p.a > 0)
        .sort((a, b) => b[1].a - a[1].a || b[1].x - a[1].x)
        .map(([pid, p]) => [pid, p.n, p.a, p.h, p.g, round3(p.x), p.on, p.min]),
      deliver: Object.entries(by)
        .sort((a, b) => b[1].k - a[1].k || b[1].g - a[1].g)
        .map(([pid, d]) => [pid, d.n, d.k, d.g]),
    };
  }
  return out;
}
