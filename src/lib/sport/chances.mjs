// Every Premier League club's chances at both ends, in Opta's numbers (what FPL and most charts use):
// expected goals from FPL's players added up by club, and big chances and penalties from the Premier
// League's own match stats. scripts/sport/build-chances.mjs puts each finished match in
// public/sport/data/pl/chances.json; the Fantasy stats chart adds them up (clubChances).

// Opta's value for a penalty: FPL players whose only shot in a match was one have exactly 0.79 xG.
export const PENALTY_XG = 0.79;

// One row per finished match in chances.json, in this order.
export const MATCH_FIELDS = ['date', 'gw', 'home', 'away', 'homeGoals', 'awayGoals', 'homeXg', 'awayXg', 'homePens', 'awayPens', 'homeBigChances', 'awayBigChances'];

/**
 * Opta's xG for both sides of each fixture in one gameweek, from FPL's live data (its raw
 * /event/<gw>/live/ shape): each player's xG goes to his club's fixture, and in a double gameweek it
 * is split between his two by the minutes he played in each. `teamOf` maps FPL player id to club id;
 * a player whose club isn't in the fixture he played (he has moved clubs since) isn't counted.
 * Returns { FPL fixture id: [home xG, away xG] }.
 */
export function fixtureXg(live, teamOf, fixtures) {
  const byId = new Map(fixtures.map((f) => [f.id, f]));
  const out = {};
  for (const e of live?.elements ?? []) {
    const team = teamOf[e.id];
    const played = (e.explain ?? [])
      .map((x) => ({ f: byId.get(x.fixture), min: x.stats?.find((s) => s.identifier === 'minutes')?.value ?? 0 }))
      .filter(({ f, min }) => f && min > 0 && (f.team_h === team || f.team_a === team));
    const minutes = played.reduce((t, p) => t + p.min, 0);
    const xg = Number(e.stats?.expected_goals ?? 0) || 0;
    for (const { f, min } of played) (out[f.id] ??= [0, 0])[f.team_h === team ? 0 : 1] += (xg * min) / minutes;
  }
  return out;
}

/**
 * Big chances and penalties for both sides of one match, from the Premier League's match stats
 * (`data` from /football/stats/match/<id>: Opta's stat names per club id). Opta counts a penalty as a
 * big chance. Null when either side's stats are missing.
 */
export function matchChances(data, homeId, awayId) {
  const side = (id) => {
    const list = data?.[String(Math.round(id))]?.M;
    if (!Array.isArray(list)) return null;
    const v = Object.fromEntries(list.map((s) => [s.name, Number(s.value) || 0]));
    const pens = (v.att_pen_goal ?? 0) + (v.att_pen_miss ?? 0) + (v.att_pen_post ?? 0) + (v.att_pen_target ?? 0);
    return { bc: (v.big_chance_scored ?? 0) + (v.big_chance_missed ?? 0), pens };
  };
  const h = side(homeId);
  const a = side(awayId);
  return h && a ? { bc: [h.bc, a.bc], pens: [h.pens, a.pens] } : null;
}

/**
 * Each club's chances over some gameweeks (all of them without `gws`), from chances.json:
 * { club id: { id, n, gf, ga, npxg, npxga, bc, bca } }. Penalties come off both xG (0.79 each) and
 * big chances, so a defence isn't judged on penalties it gave away, which come and go.
 */
export function clubChances(file, gws = null) {
  const keep = gws ? new Set(gws) : null;
  const raw = {};
  const add = (id, gf, ga, xg, xga, pk, pka, bc, bca) => {
    const r = (raw[id] ??= { n: 0, gf: 0, ga: 0, xg: 0, xga: 0, pk: 0, pka: 0, bc: 0, bca: 0 });
    r.n += 1;
    r.gf += gf;
    r.ga += ga;
    r.xg += xg;
    r.xga += xga;
    r.pk += pk;
    r.pka += pka;
    r.bc += bc;
    r.bca += bca;
  };
  for (const [, gw, h, a, hg, ag, hxg, axg, hpk, apk, hbc, abc] of file?.matches ?? []) {
    if (keep && !keep.has(gw)) continue;
    add(h, hg, ag, hxg, axg, hpk, apk, hbc, abc);
    add(a, ag, hg, axg, hxg, apk, hpk, abc, hbc);
  }
  const out = {};
  for (const [id, r] of Object.entries(raw)) {
    out[id] = {
      id: Number(id),
      n: r.n,
      gf: r.gf,
      ga: r.ga,
      npxg: Math.max(0, r.xg - PENALTY_XG * r.pk),
      npxga: Math.max(0, r.xga - PENALTY_XG * r.pka),
      bc: Math.max(0, r.bc - r.pk),
      bca: Math.max(0, r.bca - r.pka),
    };
  }
  return out;
}
