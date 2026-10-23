// Players' form for the match page, from the per-format tables scripts/cricket-players.mjs
// builds from Cricsheet: averages, strike rates and economy worked out, the last few innings with
// their dates and opponents, how each player goes in each phase, and how each batter in has fared
// against each bowler. Pure functions over a table, so they can be tested.

const one = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
const dateOf = (n) => {
  const s = String(n);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
};
export const oversOf = (balls) => `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ''}`;

/**
 * A batter's record: { all, year, recent, phases }.
 *   all, year  { inns, runs, avg, sr, fifties, hundreds, best } (year: the last twelve months)
 *   recent     [{ date, runs, balls, out, opp }], newest first
 *   phases     [{ sr, avg, balls }] for the powerplay, middle and last overs (one-day formats)
 */
export function batForm(rec, teams) {
  if (!rec?.all?.[0]) return null;
  const agg = ([inns, notOuts, runs, balls, , , fifties, hundreds, best, bestNotOut]) =>
    inns ? { inns, runs, avg: one(inns - notOuts ? runs / (inns - notOuts) : null), sr: one(balls ? (runs / balls) * 100 : null), fifties, hundreds, best: `${best}${bestNotOut ? '*' : ''}` } : null;
  return {
    all: agg(rec.all),
    year: agg(rec.year),
    recent: (rec.recent ?? []).map(([d, runs, balls, out, o]) => ({ date: dateOf(d), runs, balls, out: Boolean(out), opp: teams[o] ?? null })),
    phases: rec.phases?.map(([runs, balls, outs]) => (balls ? { sr: one((runs / balls) * 100), avg: one(outs ? runs / outs : null), balls } : null)) ?? null,
  };
}

/**
 * A bowler's record: { all, year, recent, phases }.
 *   all, year  { inns, wickets, avg, econ, sr, dots (share of balls), best }
 *   recent     [{ date, overs, runs, wickets, opp }], newest first
 *   phases     [{ econ, wickets, balls }] for the powerplay, middle and last overs (one-day formats)
 */
export function bowlForm(rec, teams) {
  if (!rec?.all?.[0]) return null;
  const agg = ([inns, balls, runs, wickets, dots, , bestW, bestR]) =>
    inns ? { inns, wickets, avg: one(wickets ? runs / wickets : null), econ: one(balls ? (runs / balls) * 6 : null), sr: one(wickets ? balls / wickets : null), dots: balls ? Math.round((dots / balls) * 100) : null, best: `${bestW}/${bestR}` } : null;
  return {
    all: agg(rec.all),
    year: agg(rec.year),
    recent: (rec.recent ?? []).map(([d, balls, runs, wickets, o]) => ({ date: dateOf(d), overs: oversOf(balls), runs, wickets, opp: teams[o] ?? null })),
    phases: rec.phases?.map(([balls, runs, wickets]) => (balls ? { econ: one((runs / balls) * 6), wickets, balls } : null)) ?? null,
  };
}

/** Every player in the match with a record: { [id]: { bat, bowl } }. ids are ESPN's (Cricinfo's). */
export function formFor(ids, table) {
  const out = {};
  for (const id of ids) {
    const rec = table?.players?.[id];
    if (!rec) continue;
    const bat = batForm(rec.bat, table.teams);
    const bowl = bowlForm(rec.bowl, table.teams);
    if (bat || bowl) out[id] = { bat, bowl };
  }
  return out;
}

/**
 * How each batter has fared against each bowler, for the pairs that have met:
 * [{ batter, bowler, balls, runs, outs, dots, fours, sixes, sr }], most balls first.
 */
export function matchupsFor(batters, bowlers, table) {
  const out = [];
  for (const a of batters) {
    for (const b of bowlers) {
      const m = table?.matchups?.[`${a}|${b}`];
      if (!m) continue;
      const [balls, runs, outs, dots, fours, sixes] = m;
      out.push({ batter: a, bowler: b, balls, runs, outs, dots, fours, sixes, sr: one((runs / balls) * 100) });
    }
  }
  return out.sort((x, y) => y.balls - x.balls);
}
