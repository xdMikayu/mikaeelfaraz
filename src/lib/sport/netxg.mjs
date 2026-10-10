// Net xG: one number for how much xG a player should get in a gameweek, built from several xG
// measures that each nudge it up or down. Every factor is a multiplier, so the breakdown reads
// left to right: start from his usual rate, then form, opponent, venue, position, history, minutes.
//
//   base     his xG per 90: this season's Opta numbers, his last two years from match data, and
//            his position's average, weighted by minutes (newcomers lean on the average)
//   form     his last five matches against his usual rate, pulled to 1 for small samples
//   defence  how much xG the opponent concedes, from team ratings since 2023/24
//   venue    home or away, from the league's home advantage
//   position the share of the opponent's concessions that goes to his position (matchups.mjs)
//   history  his own xG against this opponent before, heavily shrunk: a few matches say little
//   minutes  his likely minutes from starts so far and FPL's availability flag

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const per90 = (x, min) => (min > 0 ? (x / min) * 90 : null);
// Pull a ratio towards 1 with k minutes' worth of "nothing unusual".
const shrink = (ratio, minutes, k) => (ratio == null || !Number.isFinite(ratio) ? 1 : (ratio * minutes + k) / (minutes + k));

/**
 * nx: netxg.json's record for this player ({ l, r, v } of [minutes, xG, xA]).
 * kit: the forecast kit (ratings, fplTeams, roleFactor). which: 'xg' or 'xa'.
 * Returns { value, factors: [{ key, label, x, note }], base90, mins }.
 */
export function netFor(el, f, ctx, kit, nx, which = 'xg') {
  const i = which === 'xg' ? 1 : 2;
  const model = ctx.model;
  const home = f.home === el.team;
  const oppFpl = home ? f.away : f.home;
  const opp = kit.fplTeams[oppFpl];
  const pos = model.pos[el.type] ?? { xg: 0, xa: 0 };
  const posRate = pos[which];

  // Base: this season (Opta), the last two years (match data), his position (prior).
  const seasonMin = el.minutes ?? 0;
  const season90 = per90(el[which] ?? 0, seasonMin) ?? 0;
  const longMin = Math.min(nx?.l?.[0] ?? 0, 1800);
  const long90 = per90(nx?.l?.[i] ?? 0, nx?.l?.[0] ?? 0);
  const base90 = (seasonMin * season90 + (long90 != null ? longMin * long90 : 0) + 450 * posRate) / (seasonMin + (long90 != null ? longMin : 0) + 450);

  // Form: last five matches against his two-year rate.
  const recent90 = per90(nx?.r?.[i] ?? 0, nx?.r?.[0] ?? 0);
  const form = long90 && recent90 != null ? clamp(shrink(recent90 / long90, nx.r[0], 450), 0.7, 1.4) : 1;

  // Opponent's defence against this season's twenty.
  const r = kit.ratings;
  const current = kit.ix.current;
  const meanDef = current.reduce((t, id) => t + (r.def[id] ?? 1), 0) / current.length;
  const defence = opp && r.def[opp] != null ? r.def[opp] / meanDef : 1;
  const venue = home ? Math.sqrt(r.baseH / r.baseA) : Math.sqrt(r.baseA / r.baseH);
  const position = model.roleFactor?.(el.id, oppFpl) ?? 1;

  // History against this opponent.
  const vs = opp ? nx?.v?.[opp] : null;
  const vs90 = vs ? per90(vs[i], vs[0]) : null;
  const history = vs && long90 ? clamp(shrink(vs90 / long90, vs[0], 900), 0.8, 1.25) : 1;

  // Minutes.
  const team = model.teams[el.team] ?? { n: 0 };
  const n = Math.max(1, Math.round(team.n));
  const avail = el.playing == null ? 1 : el.playing / 100;
  const starts = el.starts ?? 0;
  const pStart = Math.min(1, starts / n) * avail;
  const perStart = starts > 0 ? Math.min(90, seasonMin / starts) : 0;
  const pSub = seasonMin > 0 ? (1 - Math.min(1, starts / n)) * 0.3 * avail : 0;
  const mins = pStart * perStart + pSub * 20;

  const factors = [
    { key: 'form', label: 'Form', x: form, note: recent90 != null && long90 ? `last 5: ${recent90.toFixed(2)}/90 v usual ${long90.toFixed(2)}` : 'not enough matches' },
    { key: 'defence', label: 'Opponent', x: defence, note: 'xG they concede v an average side' },
    { key: 'venue', label: home ? 'Home' : 'Away', x: venue, note: 'league home advantage' },
    { key: 'position', label: 'Position', x: position, note: 'share of their concessions his position gets' },
    { key: 'history', label: 'History', x: history, note: vs ? `${vs[0]}′ v them: ${(vs90 ?? 0).toFixed(2)}/90` : 'never faced them' },
    { key: 'minutes', label: 'Minutes', x: mins / 90, note: `about ${Math.round(mins)}′ expected` },
  ];
  const value = factors.reduce((t, fx) => t * fx.x, base90);
  return { value, factors, base90, mins };
}

/** Net xG, xA and xGI for every player with a fixture in the gameweek (doubles add up). */
export function netBoard(elements, fixtures, gw, ctx, kit, nxAll) {
  const byTeam = {};
  for (const f of fixtures) {
    if (f.event !== gw || f.started) continue;
    (byTeam[f.home] ??= []).push(f);
    (byTeam[f.away] ??= []).push(f);
  }
  const out = [];
  for (const el of elements) {
    const fx = byTeam[el.team];
    if (!fx || el.type === 1 || el.status === 'u') continue;
    const nx = nxAll[el.id];
    const parts = fx.map((f) => ({ f, g: netFor(el, f, ctx, kit, nx, 'xg'), a: netFor(el, f, ctx, kit, nx, 'xa') }));
    const xg = parts.reduce((t, p) => t + p.g.value, 0);
    const xa = parts.reduce((t, p) => t + p.a.value, 0);
    out.push({ id: el.id, el, xg, xa, xgi: xg + xa, parts });
  }
  return out;
}
