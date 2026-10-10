// Net xG: one number for how much xG a player should get in a gameweek.
//
// It starts from his usual xG per 90 and moves it with five factors. How much each factor counts
// is learned, not chosen: scripts/sport/fit-netxg.mjs replays every Premier League match since
// 2024/25 with only what was known before each one, fits a Poisson regression on the logs of these
// factors, and tests it on a season the fit never saw. The learned weights live in
// public/sport/data/pl/netxg-model.json; a weight of 1 applies a factor in full, 0 ignores it.
//
//   base     his xG per 90 over the last two years of match data, pulled towards his position's average
//   form     his last five matches against that rate
//   defence  how much xG the opponent concedes (team ratings since 2023/24, v this season's twenty)
//   venue    home or away
//   position the share of the opponent's concessions that goes to his position (matchups.mjs)
//   history  his own xG per 90 against this opponent, against his usual rate
//   minutes  his likely minutes, which scale the whole number

import { availability } from './fpl.mjs';

export const FEATURES = ['base', 'form', 'defence', 'venue', 'position', 'history'];
const PRIOR_BASE = 450; // minutes of position-average output mixed into his own rate

/**
 * The raw factors, defined once so the fit and the live page agree exactly.
 * s: { lMin, lX, rMin, rX, vMin, vX, pos90, defence, home, tilt }; k: shrinkage minutes for form and history.
 */
export function rawFactors(s, kForm, kHist) {
  const shrink = (ratio, m, k) => (m + k > 0 ? (ratio * m + k) / (m + k) : 1);
  const long = s.lMin > 0 ? (s.lX / s.lMin) * 90 : s.pos90;
  const recent = s.rMin > 0 ? (s.rX / s.rMin) * 90 : long;
  const versus = s.vMin > 0 ? (s.vX / s.vMin) * 90 : long;
  return {
    base: Math.max(((s.lX + (PRIOR_BASE * s.pos90) / 90) / (s.lMin + PRIOR_BASE)) * 90, 0.005),
    form: shrink((recent + 0.01) / (long + 0.01), s.rMin, kForm),
    defence: s.defence,
    venue: s.home ? 1 : 0,
    position: s.tilt,
    history: shrink((versus + 0.01) / (long + 0.01), s.vMin, kHist),
  };
}

/** The regression's inputs: logs of the factors (venue as ±0.5). */
export const designRow = (f) => [Math.log(f.base), Math.log(f.form), Math.log(f.defence), f.venue ? 0.5 : -0.5, Math.log(f.position), Math.log(f.history)];

const LABEL = { form: 'Form', defence: 'Opponent', position: 'Position', history: 'History' };

/**
 * Net xG (or xA) for one player in one fixture.
 * nx: netxg.json's record ({ l, r, v } of [minutes, xG, xA]); kit: forecast kit; mdl: netxg-model.json.
 * Returns { value, start, factors: [{ key, label, raw, x, weight, note }], mins }, where start is his
 * calibrated usual rate per 90 and value = start × each x × minutes / 90.
 */
export function netFor(el, f, ctx, kit, nx, which, mdl) {
  const i = which === 'xg' ? 1 : 2;
  const m = mdl[which];
  const model = ctx.model;
  const home = f.home === el.team;
  const oppFpl = home ? f.away : f.home;
  const opp = kit.fplTeams[oppFpl];
  const r = kit.ratings;
  const current = kit.ix.current;
  const meanDef = current.reduce((t, id) => t + (r.def[id] ?? 1), 0) / current.length;
  const pos90 = model.pos[el.type]?.[which] ?? 0.1;
  const vs = opp ? nx?.v?.[opp] : null;
  const raw = rawFactors(
    {
      lMin: nx?.l?.[0] ?? 0,
      lX: nx?.l?.[i] ?? 0,
      rMin: nx?.r?.[0] ?? 0,
      rX: nx?.r?.[i] ?? 0,
      vMin: vs?.[0] ?? 0,
      vX: vs?.[i] ?? 0,
      pos90,
      defence: opp && r.def[opp] != null ? r.def[opp] / meanDef : 1,
      home,
      // The raw tilt: the learned weight is applied below, not twice.
      tilt: kit.roles?.[el.id] && opp ? kit.roleFactorRaw(opp, kit.roles[el.id]) : 1,
    },
    m.shrink.form,
    m.shrink.history
  );
  const w = m.weights;
  const start = Math.exp(m.intercept) * raw.base ** w.base;

  // Minutes from his starts so far and FPL's availability flag.
  const team = model.teams[el.team] ?? { n: 0 };
  const n = Math.max(1, Math.round(team.n));
  const avail = availability(el, f, ctx);
  const starts = el.starts ?? 0;
  const seasonMin = el.minutes ?? 0;
  const pStart = Math.min(1, starts / n) * avail;
  const perStart = starts > 0 ? Math.min(90, seasonMin / starts) : 0;
  const pSub = seasonMin > 0 ? (1 - Math.min(1, starts / n)) * 0.3 * avail : 0;
  const mins = pStart * perStart + pSub * 20;

  const factors = [
    { key: 'form', raw: raw.form, note: nx?.r ? `last 5 matches v his usual rate` : 'not enough matches' },
    { key: 'defence', raw: raw.defence, note: 'xG they concede v an average side' },
    { key: 'venue', raw: null, note: 'learned home advantage' },
    { key: 'position', raw: raw.position, note: 'share of their concessions his position gets' },
    { key: 'history', raw: raw.history, note: vs ? `${vs[0]}′ against them before` : 'never faced them' },
  ].map((fx) => {
    const weight = w[fx.key];
    const x = fx.key === 'venue' ? Math.exp(weight * (home ? 0.5 : -0.5)) : fx.raw ** weight;
    return { ...fx, label: fx.key === 'venue' ? (home ? 'Home' : 'Away') : LABEL[fx.key], weight, x };
  });
  factors.push({ key: 'minutes', label: 'Minutes', raw: mins / 90, weight: 1, x: mins / 90, note: `about ${Math.round(mins)}′ expected` });
  const value = factors.reduce((t, fx) => t * fx.x, start);
  return { value, start, base90: raw.base, factors, mins };
}

/** Net xG, xA and xGI for every outfield player with a fixture in the gameweek (doubles add up). */
export function netBoard(elements, fixtures, gw, ctx, kit, nxAll, mdl) {
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
    const parts = fx.map((f) => ({ f, g: netFor(el, f, ctx, kit, nx, 'xg', mdl), a: netFor(el, f, ctx, kit, nx, 'xa', mdl) }));
    const xg = parts.reduce((t, p) => t + p.g.value, 0);
    const xa = parts.reduce((t, p) => t + p.a.value, 0);
    out.push({ id: el.id, el, xg, xa, xgi: xg + xa, parts });
  }
  return out;
}
