'use client';
import { useMemo } from 'react';
import { fetchStandings } from '@/lib/sport/espn.mjs';
import { rateTeams, goalRates, matchOdds, inPlay, winPath, shotOutcomes, ratesFromTable } from '@/lib/sport/forecast.mjs';
import { mainRole, versus, rolesFromLines, ROLE_ONE } from '@/lib/sport/matchups.mjs';
import { useLive } from './useLive';
import { useMatchupIndex, useForecastKit, usePlayerLog, useNetXgModel } from './matchupData';

const pct = (p) => (p < 0.01 ? '<1%' : p > 0.99 ? '>99%' : `${Math.round(p * 100)}%`);
const minuteOf = (label) => Number(String(label ?? '').match(/^(\d+)/)?.[1] ?? 0);

/**
 * Pre-match goal rates for this match. Premier League: our xG ratings, fitted only on matches
 * before this one. Other leagues with a table: goals for and against from the standings.
 */
export function useMatchRates(data) {
  const m = data?.match;
  const isPl = m?.league === 'eng.1';
  const mx = useMatchupIndex();
  const learned = useNetXgModel();
  const kit = useForecastKit(isPl ? mx.data : null, learned.data);
  const table = useLive((signal) => (m && !isPl ? fetchStandings(m.league, { signal }) : Promise.resolve(null)), [m?.league, isPl], { every: 3600e3, live: () => false });
  return useMemo(() => {
    if (!m) return null;
    if (isPl && kit) {
      const done = m.status.state === 'post';
      // A finished match is judged by what we'd have said before it, not after.
      const r = done ? rateTeams(kit.ix.games, { asOf: new Date(m.date).getTime() - 864e5, newTeams: [] }) : kit.ratings;
      if (r.att[m.home.id] == null || r.att[m.away.id] == null) return null;
      return { ...goalRates(r, m.home.id, m.away.id), source: 'xg', kit };
    }
    const rows = table.data?.groups?.find((g) => g.rows.some((x) => x.id === m.home.id) && g.rows.some((x) => x.id === m.away.id))?.rows;
    const r = rows && ratesFromTable(rows, m.home.id, m.away.id);
    return r ? { ...r, source: 'table' } : null;
  }, [m, isPl, kit, table.data]);
}

/** Three-way bar in the two kit colours with the draw between. */
function Split({ p, colors, names }) {
  return (
    <>
      <div className="sp-split" role="img" aria-label={`${names.home} ${pct(p.home)}, draw ${pct(p.draw)}, ${names.away} ${pct(p.away)}`}>
        <i style={{ width: `${p.home * 100}%`, background: colors.home }} />
        <i style={{ width: `${p.draw * 100}%`, background: 'var(--sp-rule-2)' }} />
        <i style={{ width: `${p.away * 100}%`, background: colors.away }} />
      </div>
      <div className="sp-split-l">
        <span><b className="sp-num">{pct(p.home)}</b> {names.home}</span>
        <span><b className="sp-num">{pct(p.draw)}</b> draw</span>
        <span><b className="sp-num">{pct(p.away)}</b> {names.away}</span>
      </div>
    </>
  );
}

export function ForecastPanel({ data, rates, colors, names }) {
  const m = data.match;
  const pre = m.status.state === 'pre';
  const odds = matchOdds(rates.home, rates.away);
  const reds = (side) => data.events.filter((e) => e.kind === 'red' && e.side === side).length;
  const now = pre ? null : inPlay(rates.home, rates.away, { minute: minuteOf(m.status.label), hs: Number(m.home.score ?? 0), as: Number(m.away.score ?? 0), redsH: reds('home'), redsA: reds('away') });
  return (
    <section className="sp-panel">
      <div className="sp-section-head">
        <h2 className="sp-h2">{pre ? 'Forecast' : 'Live forecast'}</h2>
        <span className="sp-tiny sp-muted">Our estimate</span>
      </div>
      <Split p={now ?? odds} colors={colors} names={names} />
      {now && <p className="sp-tiny sp-muted" style={{ margin: '6px 0 0' }}>From the score, the minutes left{reds('home') + reds('away') ? ' and the red cards' : ''}. Before kick-off: {pct(odds.home)} · {pct(odds.draw)} · {pct(odds.away)}.</p>}
      {pre && (
        <>
          <dl className="sp-fc-grid">
            <div><dt>Expected goals</dt><dd className="sp-num">{rates.home.toFixed(2)}–{rates.away.toFixed(2)}</dd></div>
            <div><dt>Both score</dt><dd className="sp-num">{pct(odds.btts)}</dd></div>
            <div><dt>Over 2.5 goals</dt><dd className="sp-num">{pct(odds.over25)}</dd></div>
            <div><dt>Clean sheet</dt><dd className="sp-num">{names.home} {pct(odds.csHome)} · {names.away} {pct(odds.csAway)}</dd></div>
          </dl>
          <h3 className="sp-h3" style={{ margin: '14px 0 6px' }}>Most likely scores</h3>
          <div className="sp-scores">
            {odds.scores.map((s) => (
              <div key={`${s.h}-${s.a}`}>
                <b className="sp-num">{s.h}–{s.a}</b>
                <i style={{ height: `${(s.p / odds.scores[0].p) * 34}px` }} />
                <span className="sp-tiny sp-muted sp-num">{pct(s.p)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>
        {rates.source === 'xg'
          ? 'Team ratings from every Premier League match since 2023/24, mostly xG with some weight on goals, recent matches counting more; goals as Poisson with a small correction for low scores.'
          : 'From goals for and against in the league table so far, with home advantage. Cruder than our Premier League model, which uses xG.'}
      </p>
    </section>
  );
}

/** How the odds moved through the match: one line per side in its kit colour, the draw implied. */
export function WinPathChart({ data, rates, colors, names }) {
  const m = data.match;
  const upTo = m.status.state === 'post' ? 90 : Math.min(90, minuteOf(m.status.label));
  const path = useMemo(() => winPath(rates.home, rates.away, data.events, upTo, { finished: m.status.state === 'post' }), [rates, data.events, upTo, m.status.state]);
  if (path.length < 3) return null;
  const W = 320;
  const H = 120;
  const x = (mm) => (mm / 90) * W;
  const y = (p) => H - p * H;
  const line = (k) => path.map((p, i) => `${i ? 'L' : 'M'}${x(p.m).toFixed(1)} ${y(p[k]).toFixed(1)}`).join('');
  const last = path[path.length - 1];
  return (
    <section className="sp-panel">
      <div className="sp-section-head">
        <h2 className="sp-h2">Win probability</h2>
        <span className="sp-tiny sp-muted">Minute by minute</span>
      </div>
      <svg className="sp-wp" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Now: ${names.home} ${pct(last.home)}, draw ${pct(last.draw)}, ${names.away} ${pct(last.away)}`}>
        <path d={`M0 ${y(0.5)}H${W}`} stroke="var(--sp-rule-2)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <path d={`M${x(45)} 0V${H}`} stroke="var(--sp-rule)" vectorEffect="non-scaling-stroke" />
        <path d={line('home')} fill="none" stroke={colors.home} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <path d={line('away')} fill="none" stroke={colors.away} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="sp-wp-axis sp-tiny sp-muted"><span>0′</span><span>HT</span><span>90′</span></div>
      <p className="sp-tiny sp-ink2" style={{ margin: '6px 0 0' }}>
        <b style={{ color: colors.home }}>■</b> {names.home} {pct(last.home)} · <b style={{ color: colors.away }}>■</b> {names.away} {pct(last.away)} · draw {pct(last.draw)}
        {m.status.state === 'post' ? ' at the final whistle' : ' now'}. Each goal and red card moves the lines; dashed is 50%.
      </p>
    </section>
  );
}

/** After the whistle: who the chances favoured, against the pre-match forecast and the result. */
export function Deserved({ data, rates, colors, names }) {
  const shots = data.shots;
  const d = useMemo(() => shotOutcomes(shots.filter((s) => s.side === 'home').map((s) => s.xg), shots.filter((s) => s.side === 'away').map((s) => s.xg)), [shots]);
  const odds = rates ? matchOdds(rates.home, rates.away) : null;
  const hs = Number(data.match.home.score ?? 0);
  const as = Number(data.match.away.score ?? 0);
  const result = hs > as ? names.home : hs < as ? names.away : 'Draw';
  const favoured = d.home > d.away + 0.1 ? names.home : d.away > d.home + 0.1 ? names.away : null;
  return (
    <section className="sp-panel">
      <div className="sp-section-head">
        <h2 className="sp-h2">What the chances deserved</h2>
        <span className="sp-tiny sp-muted">Our estimate</span>
      </div>
      <p className="sp-small sp-ink2" style={{ margin: '0 0 8px' }}>Each shot counted as a goal with its xG as the chance, across every combination of shots going in or not:</p>
      <Split p={d} colors={colors} names={names} />
      <p className="sp-small sp-ink2" style={{ margin: '10px 0 0' }}>
        Result: <b style={{ color: 'var(--sp-ink)' }}>{result === 'Draw' ? `a ${hs}–${as} draw` : `${result} won ${Math.max(hs, as)}–${Math.min(hs, as)}`}</b>.{' '}
        {favoured ? `The chances favoured ${favoured}${favoured === result ? ', so the result was fair' : ', so the result went against the run of play'}.` : 'The chances were close to even.'}
        {odds && ` Before kick-off we had it ${pct(odds.home)} · ${pct(odds.draw)} · ${pct(odds.away)}.`}
      </p>
    </section>
  );
}

/**
 * Premier League: each side's main attackers against what the other side allows their role.
 * From the lineups once they're out, otherwise the players who've played most lately.
 */
export function MatchupsToWatch({ data, rates, names }) {
  const m = data.match;
  const kit = rates?.kit;
  const homeLog = usePlayerLog(kit ? m.home.id : null);
  const awayLog = usePlayerLog(kit ? m.away.id : null);
  const sides = useMemo(() => {
    if (!kit || !homeLog.data || !awayLog.data) return null;
    const season = kit.ix.seasons[0];
    const pick = (side) => {
      const log = side === 'home' ? homeLog.data : awayLog.data;
      const opp = side === 'home' ? m.away.id : m.home.id;
      const lu = data.lineups[side];
      const lineupRoles = lu?.lines ? rolesFromLines(lu.lines) : null;
      const ids = lineupRoles ? Object.keys(lineupRoles) : Object.entries(log).filter(([, p]) => p.rows.some((r) => r[0] >= `${season}-07`)).map(([id]) => id);
      const teamRate = side === 'home' ? rates.home : rates.away;
      const usualRate = side === 'home' ? kit.ratings.baseH * (kit.ratings.att[m.home.id] ?? 1) : kit.ratings.baseA * (kit.ratings.att[m.away.id] ?? 1);
      return ids
        .map((id) => {
          const p = log[id];
          if (!p) return null;
          const recent = p.rows.slice(-25);
          const min = recent.reduce((t, r) => t + r[6], 0);
          if (min < 360) return null;
          const role = lineupRoles?.[id] ?? mainRole(p.rows);
          if (!['W-L', 'W-R', 'ST', 'AM', 'CM', 'FB-L', 'FB-R'].includes(role)) return null;
          const per90 = (recent.reduce((t, r) => t + r[8] + r[10], 0) / min) * 90;
          const factor = kit.roleFactor(opp, role);
          const vs = versus(p.rows, opp);
          // His usual output, scaled by how much this opponent gives his role and how open this match should be.
          const expected = per90 * factor * (teamRate / usualRate);
          return { id, name: p.n, role, per90, factor, expected, vs, lastMin: recent.slice(-5).reduce((t, r) => t + r[6], 0) };
        })
        .filter((x) => x && (lineupRoles || x.lastMin >= 200))
        .sort((a, b) => b.expected - a.expected)
        .slice(0, 3);
    };
    return { home: pick('home'), away: pick('away'), fromLineups: Boolean(data.lineups.home?.lines) };
  }, [kit, homeLog.data, awayLog.data, data.lineups, m, rates]);
  if (!kit) return null;
  if (!sides) return <section className="sp-panel"><h2 className="sp-h2">Matchups to watch</h2><div className="sp-skel" style={{ height: 120, marginTop: 10 }} /></section>;
  const row = (p, opp) => (
    <div key={p.id} className="sp-mw">
      <span style={{ minWidth: 0 }}>
        <b className="sp-dif-name" style={{ display: 'block' }}>{p.name}</b>
        <span className="sp-tiny sp-muted sp-dif-line">{ROLE_ONE[p.role]} · {p.per90.toFixed(2)} xG + xA per 90 lately</span>
        <span className="sp-tiny sp-ink2" style={{ display: 'block' }}>
          His position gets {Math.abs(p.factor - 1) < 0.03 ? 'its usual share' : `${Math.round(Math.abs(p.factor - 1) * 100)}% ${p.factor > 1 ? 'more' : 'less'}`} of what {opp} concede
          {p.vs.matches.length ? ` · v ${opp} since 2023/24: ${p.vs.goals}G ${p.vs.assists}A in ${p.vs.matches.length}` : ''}
        </span>
      </span>
      <span className="sp-mw-r">
        <b className="sp-num">{p.expected.toFixed(2)}</b>
        <span className="sp-tiny sp-muted">expected</span>
      </span>
    </div>
  );
  return (
    <section className="sp-panel">
      <div className="sp-section-head">
        <h2 className="sp-h2">Matchups to watch</h2>
        <span className="sp-tiny sp-muted">{sides.fromLineups ? 'From the lineups' : 'Likely starters'}</span>
      </div>
      <p className="sp-tiny sp-muted" style={{ margin: '0 0 6px' }}>Expected xG + xA in this match: his recent rate, times how many goals his side should score here against how many they usually do, times the share of the opponent’s concessions that usually goes to his position (both seasons, shrunk for small samples).</p>
      <h3 className="sp-h3" style={{ margin: '8px 0 2px' }}>{names.home}</h3>
      {sides.home.map((p) => row(p, names.away))}
      <h3 className="sp-h3" style={{ margin: '12px 0 2px' }}>{names.away}</h3>
      {sides.away.map((p) => row(p, names.home))}
    </section>
  );
}
