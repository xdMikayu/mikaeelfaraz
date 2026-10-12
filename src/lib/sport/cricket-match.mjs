// One cricket match in full, for the match page: from ESPN's summary (each innings' score, every
// player's batting and bowling, the fall of wickets, who's in and who's bowling) and its ball-by-ball
// commentary (each over, the partnerships, how each batter was out, the last few balls). Pure
// functions over ESPN's JSON, so they can be tested.

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const decode = (s) =>
  String(s ?? '')
    .replace(/&dagger;/g, '†')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// "Abdul Malik(1)": ESPN's tag for two players of one name.
const tidyName = (s) => decode(s).replace(/\s*\(\d+\)$/, '');

/** A roster line's numbers and words: { runs: 118, dismissalCard: 'not out', ... }. */
function statsOf(line) {
  const out = {};
  for (const s of line?.statistics?.categories?.[0]?.stats ?? []) {
    const n = num(s.value);
    out[s.name] = n != null && s.displayValue !== '' && !Number.isNaN(Number(s.displayValue)) ? n : (s.displayValue ?? n);
  }
  return out;
}

/** Overs as cricket writes them from balls: 229 → "38.1". */
export const oversFrom = (balls) => `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ''}`;
const ballsFrom = (overs) => {
  const [o, b = '0'] = String(overs ?? 0).split('.');
  return Number(o) * 6 + Number(b);
};

/**
 * A bowler's most overs in an innings of `ballLimit` balls: a fifth of them, whole overs, rounded up
 * (4 in a T20, 10 in a one-day match). None in a match without an overs limit.
 */
export const quotaOf = (ballLimit) => (ballLimit > 0 ? Math.ceil(ballLimit / 30) * 6 : null);

/**
 * The match from ESPN's summary (/apis/site/v2/sports/cricket/{league}/summary?event={id}):
 * { id, title, series, format, state, summary, session, toss, venue, start, teams, innings, players }.
 *   innings  [{ number, team, runs, wickets, overs, balls, ballLimit, target, current, extras,
 *              batting: [{ id, pos, runs, balls, fours, sixes, out, card, now }], yetToBat: [id],
 *              bowling: [{ id, order, balls, maidens, runs, wickets, dots, wides, noballs, fours, sixes, now }],
 *              fow: [{ n, runs, balls, id, batterRuns, batterBalls }],
 *              partnerships: [{ n, runs, balls, ended }] }]
 *   players  { [id]: { name, short, team, role, batStyle, bowlStyle, captain, keeper, now } }
 * now is 'striker', 'non-striker', 'bowling' or 'bowled last' while the match is on.
 */
export function matchFromSummary(sum) {
  const comp = sum?.header?.competitions?.[0] ?? {};
  const status = comp.status ?? {};
  const NOW = { striker: 'striker', 'non-striker': 'non-striker', 'current bowler': 'bowling', 'previous bowler': 'bowled last' };
  const live = status.type?.state === 'in';
  const teams = (comp.competitors ?? []).map((c) => ({
    id: String(c.team?.id ?? c.id),
    name: c.team?.displayName ?? '',
    short: c.team?.abbreviation ?? '',
    color: /^[0-9a-f]{6}$/i.test(c.team?.color ?? '') ? `#${c.team.color}` : null,
    logo: c.team?.logos?.[0]?.href ?? c.team?.logo ?? null,
    score: c.score ?? '',
    winner: c.winner === true || c.winner === 'true',
  }));

  const players = {};
  const lines = []; // [period, teamId, playerId, stats]
  for (const side of sum?.rosters ?? []) {
    const team = String(side.team?.id ?? '');
    for (const p of side.roster ?? []) {
      const a = p.athlete ?? {};
      if (!a.id) continue;
      const style = (type) => a.style?.find((s) => s.type === type)?.description ?? null;
      players[a.id] = {
        name: tidyName(a.displayName ?? a.name ?? ''),
        short: tidyName(a.battingName ?? a.shortName ?? a.displayName ?? ''),
        team,
        role: a.position?.name ?? p.position?.name ?? null,
        batStyle: style('batting'),
        bowlStyle: style('bowling'),
        captain: Boolean(p.captain),
        keeper: p.position?.abbreviation === 'WK' || a.position?.abbreviation === 'WK',
        now: live && p.active ? (NOW[p.activeName] ?? null) : null,
      };
      for (const per of p.linescores ?? []) for (const ln of per.linescores ?? []) lines.push([per.period, team, a.id, statsOf(ln)]);
    }
  }

  const innings = [];
  for (const c of comp.competitors ?? []) {
    const team = String(c.team?.id ?? c.id);
    for (const l of c.linescores ?? []) {
      if (!l.isBatting) continue;
      const s = statsOf(l);
      const ballLimit = num(s.ballLimit) || null;
      const current = l.isCurrent === 1 || l.isCurrent === true;
      const mine = lines.filter(([period, t]) => period === l.period && t === team);
      const theirs = lines.filter(([period, t]) => period === l.period && t !== team);
      const batted = mine.filter(([, , , st]) => st.batted === 1).map(([, , id, st]) => ({
        id,
        pos: num(st.battingPosition),
        runs: num(st.runs) ?? 0,
        balls: num(st.ballsFaced) ?? 0,
        fours: num(st.fours) ?? 0,
        sixes: num(st.sixes) ?? 0,
        out: num(st.outs) > 0,
        card: typeof st.dismissalCard === 'string' ? st.dismissalCard : null,
        now: current && (players[id]?.now === 'striker' || players[id]?.now === 'non-striker') ? players[id].now : null,
      }));
      const bowled = theirs
        .filter(([, , , st]) => num(st.balls) > 0 || num(st.overs) > 0)
        .map(([, , id, st]) => ({
          id,
          order: num(st.bowlingPosition),
          balls: num(st.balls) ?? ballsFrom(st.overs),
          maidens: num(st.maidens) ?? 0,
          runs: num(st.conceded) ?? 0,
          wickets: num(st.wickets) ?? 0,
          dots: num(st.dots),
          wides: num(st.wides) ?? 0,
          noballs: num(st.noballs) ?? 0,
          fours: num(st.foursConceded),
          sixes: num(st.sixesConceded),
          now: current && (players[id]?.now === 'bowling' || players[id]?.now === 'bowled last') ? players[id].now : null,
        }));
      innings.push({
        number: l.period,
        team,
        runs: num(l.runs) ?? 0,
        wickets: num(l.wickets) ?? 0,
        overs: String(l.overs ?? ''),
        balls: num(s.balls) ?? ballsFrom(l.overs),
        ballLimit,
        target: num(l.target) || null,
        current,
        declared: /\/\d+d\b/.test(String(l.score ?? '')),
        extras: { total: num(s.extras) ?? 0, byes: num(s.byes) ?? 0, legByes: num(s.legbyes) ?? 0, wides: num(s.wides) ?? 0, noBalls: num(s.noballs) ?? 0, penalties: num(s.penalties) ?? 0 },
        batting: batted.sort((a, b) => (a.pos ?? 99) - (b.pos ?? 99)),
        yetToBat: mine.filter(([, , , st]) => st.batted !== 1).map(([, , id]) => id),
        bowling: bowled.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
        fow: (l.fow ?? []).map((f) => ({ n: f.wicketNumber, runs: num(f.runs), balls: ballsFrom(f.wicketOver), id: f.athlete?.id ? String(f.athlete.id) : null, batterRuns: num(f.runsScored), batterBalls: num(f.ballsFaced) })),
        partnerships: (l.partnerships ?? []).map((p) => ({ n: p.wicketNumber, runs: num(p.runs) ?? 0, balls: ballsFrom(p.overs), ended: p.fowType === 'out' })),
      });
    }
  }
  innings.sort((a, b) => a.number - b.number);

  const note = (type) => (sum?.notes ?? []).find((n) => n.type === type)?.text ?? null;
  return {
    id: String(comp.id ?? sum?.header?.id ?? ''),
    title: decode(comp.description ?? sum?.header?.name ?? ''),
    series: sum?.header?.league?.name ?? sum?.header?.leagues?.[0]?.name ?? '',
    format: comp.class?.generalClassCard ?? null,
    international: (comp.class?.internationalClassId ?? '0') !== '0',
    limited: comp.limitedOvers === true,
    state: status.type?.state ?? 'pre',
    summary: decode(status.summary ?? status.type?.description ?? ''),
    statusWord: status.type?.description ?? '',
    session: status.session || null,
    toss: decode(note('toss')).replace(/\s+,/g, ',') || null,
    days: note('matchdays'),
    venue: venueOf(sum?.gameInfo?.venue),
    start: comp.date ?? null,
    battingTeam: status.battingTeamId != null ? String(status.battingTeamId) : null,
    teams,
    innings,
    players,
  };
}

/** "Junction Oval, Melbourne": the ground with its town, once. */
function venueOf(v) {
  if (!v?.fullName) return null;
  const city = v.address?.city;
  return city && !v.fullName.includes(city) ? `${v.fullName}, ${city}` : v.fullName;
}

/**
 * The match as the scores list has it (cricketNow's shape), for Matchday's read: format, teams with
 * their scores and who's batting, and ESPN's line under the score.
 */
export function asListMatch(sum, league) {
  const comp = sum?.header?.competitions?.[0] ?? {};
  const status = comp.status ?? {};
  const format = comp.class?.generalClassCard ?? null;
  const name = sum?.header?.league?.name ?? '';
  const teams = (comp.competitors ?? []).map((c) => {
    const m = String(c.score ?? '').trim().match(/^(.*?)\s*\(([^()]*)\)$/);
    return {
      id: String(c.team?.id ?? c.id),
      name: c.team?.displayName ?? '',
      short: c.team?.abbreviation ?? '',
      runs: m ? m[1] : String(c.score ?? '').trim(),
      overs: m ? m[2] : null,
      winner: c.winner === true || c.winner === 'true',
      batting: status.battingTeamId != null && String(status.battingTeamId) === String(c.team?.id ?? c.id),
    };
  });
  return {
    id: String(comp.id ?? ''),
    league: { id: String(league ?? ''), name },
    format,
    international: (comp.class?.internationalClassId ?? '0') !== '0',
    women: /women/i.test(format ?? '') || teams.some((t) => /\bWomen\b/i.test(t.name)) || /\bwomen\b/i.test(name),
    state: status.type?.state ?? 'pre',
    summary: status.type?.description ?? '',
    venue: venueOf(sum?.gameInfo?.venue),
    status: decode(status.summary ?? ''),
    start: comp.date ?? null,
    session: String(status.session ?? '').match(/Day \d+/)?.[0] ?? null,
    days: Number(String((sum?.notes ?? []).find((n) => n.type === 'matchdays')?.text ?? '').match(/\((\d+)-day match\)/)?.[1]) || null,
    teams,
  };
}

const LABEL = { wide: 'wd', 'no ball': 'nb', 'leg bye': 'lb', bye: 'b' };

/**
 * ESPN's ball-by-ball commentary (playbyplay?event=…, every page) as plain balls in order:
 * [{ inn, over, ball, label, runs, legal, batter, nonStriker, bowler, batRuns, faced, total, wickets, out }]
 * label is how a scorer marks it: '•', '1', '4', 'W', '1wd', '2nb', '1lb'. out: { id, how } on a wicket.
 */
export function ballsOf(items) {
  return [...(items ?? [])]
    // Commentary between balls (a quote, the close of play) comes as an item with no over and no bowler.
    .filter((it) => it.bowler?.athlete?.id && num(it.over?.number) > 0)
    .sort((a, b) => a.sequence - b.sequence)
    .map((it) => {
      const type = it.playType?.description ?? '';
      const extra = LABEL[type] ?? null;
      const runs = num(it.scoreValue) ?? 0;
      const d = it.dismissal ?? {};
      const out = d.dismissal ? { id: d.batsman?.athlete?.id ? String(d.batsman.athlete.id) : null, how: howOut(d.text), type: d.type ?? null } : null;
      return {
        inn: it.period,
        over: num(it.over?.number),
        ball: num(it.over?.ball),
        label: out ? 'W' : extra ? `${runs}${extra}` : runs === 0 ? '•' : String(runs),
        runs,
        legal: type !== 'wide' && type !== 'no ball',
        batter: it.batsman?.athlete?.id ? String(it.batsman.athlete.id) : null,
        nonStriker: it.otherBatsman?.athlete?.id ? String(it.otherBatsman.athlete.id) : null,
        bowler: it.bowler?.athlete?.id ? String(it.bowler.athlete.id) : null,
        batRuns: num(it.batsman?.runs) ?? 0,
        faced: type !== 'wide',
        total: num(it.innings?.runs),
        wickets: num(it.innings?.wickets),
        out,
      };
    });
}

/** "Tanzid Hasan c &dagger;Ikram Alikhil b Ismat Alam 83 (106m 71b 8x4 4x6) SR: 116.9" → "c †Ikram Alikhil b Ismat Alam". */
export function howOut(text) {
  const t = decode(text).replace(/\s+\d+\*?\s+\((?:\d+m\s+)?\d+b[^)]*\).*$/, '');
  const m = t.match(/\s((?:c(?:\s|&)|c&b|b\s|lbw\b|st\s|run out|hit wicket|retired|obstructing|handled|timed out|absent).*)$/);
  return m ? m[1].trim() : null;
}

/**
 * One innings ball by ball: { overs, partnerships, how, recent }.
 *   overs         [{ n, runs, wickets, total, down, balls, bowler }] per over; total, down and balls
 *                 (legal balls bowled in the innings) as they stood at its end
 *   partnerships  [{ n, runs, balls, batters: [{ id, runs, balls }] }] in order, the last one unbroken
 *                 unless the innings is over
 *   how           { [batter id]: "c Short b O'Neill" }
 *   recent        the last two overs: [{ n, bowler, balls: ['1', '•', 'W'] }]
 */
export function inningsBalls(balls, number) {
  const mine = balls.filter((b) => b.inn === number);
  const overs = [];
  const how = {};
  const partnerships = [];
  let pair = null;
  const start = (n) => (pair = { n, runs: 0, balls: 0, batters: [] });
  const member = (id) => {
    if (!id) return null;
    let m = pair.batters.find((x) => x.id === id);
    if (!m && pair.batters.length < 2) pair.batters.push((m = { id, runs: 0, balls: 0 }));
    return m;
  };
  start(1);
  let legal = 0;
  for (const b of mine) {
    let o = overs[overs.length - 1];
    if (!o || o.n !== b.over) overs.push((o = { n: b.over, runs: 0, wickets: 0, total: 0, down: 0, balls: 0, bowler: b.bowler, marks: [] }));
    if (b.legal) legal += 1;
    o.balls = legal;
    o.runs += b.runs;
    o.marks.push(b.label);
    if (b.total != null) o.total = b.total;
    if (b.wickets != null) o.down = b.wickets;
    const s = member(b.batter);
    member(b.nonStriker);
    pair.runs += b.runs;
    if (b.legal) pair.balls += 1;
    if (s) {
      s.runs += b.batRuns;
      if (b.faced) s.balls += 1;
    }
    if (b.out) {
      o.wickets += 1;
      if (b.out.id && b.out.how) how[b.out.id] = b.out.how;
      partnerships.push(pair);
      const stays = pair.batters.find((x) => x.id !== b.out.id);
      start(pair.n + 1);
      if (stays) pair.batters.push({ id: stays.id, runs: 0, balls: 0 });
    }
  }
  if (pair.batters.length && (pair.runs || pair.balls || partnerships.length === 0)) partnerships.push(pair);
  return {
    overs: overs.map(({ marks: _, ...o }) => o),
    partnerships,
    how,
    recent: overs.slice(-2).map((o) => ({ n: o.n, bowler: o.bowler, balls: o.marks })),
  };
}

/**
 * Runs and wickets in each phase of a one-day innings from its overs: powerplay, middle overs, the
 * last overs (overs 1–6, 7–15, 16–20 in a T20; 1–10, 11–40, 41–50 in a one-day match).
 */
export function phasesOf(overs, ballLimit) {
  const cut = ballLimit === 300 ? [10, 40] : ballLimit === 120 ? [6, 15] : null;
  if (!cut) return null;
  const out = [
    { runs: 0, wickets: 0, overs: 0 },
    { runs: 0, wickets: 0, overs: 0 },
    { runs: 0, wickets: 0, overs: 0 },
  ];
  for (const o of overs) {
    const p = o.n <= cut[0] ? 0 : o.n <= cut[1] ? 1 : 2;
    out[p].runs += o.runs;
    out[p].wickets += o.wickets;
    out[p].overs += 1;
  }
  return out;
}
