'use client';
import { useMemo } from 'react';
import { allowedByRole, versus, ROLE_NAME, ROLE_ONE } from '@/lib/sport/matchups.mjs';
import { rolling, slope } from '@/lib/sport/forecast.mjs';
import { projectAhead } from '@/lib/sport/fpl.mjs';
import { usePlayerLog } from './matchupData';
import { one } from './fplbits';

const seasonLabel = (y) => `${y}/${String(Number(y) + 1).slice(2)}`;
const shortDay = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });

/** Line chart of a series with a dashed reference level; ink only. */
export function Spark({ values, level, w = 300, h = 64, label }) {
  if (values.length < 2) return null;
  const max = Math.max(level ?? 0, ...values) * 1.1 || 1;
  const x = (i) => (i / (values.length - 1)) * (w - 4) + 2;
  const y = (v) => h - 4 - (v / max) * (h - 10);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  return (
    <svg className="sp-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {level != null && <path d={`M0 ${y(level)}H${w}`} stroke="var(--sp-muted)" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      <path d={d} fill="none" stroke="var(--sp-ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3" fill="var(--sp-ink)" />
    </svg>
  );
}

/**
 * Matchup and form for one FPL player: what his next opponent allows his role, what he has done
 * against them before, his recent trend, and the next few gameweeks projected.
 */
export default function MatchupPanel({ el, ctx, teams, kit, fixtures, nextFx }) {
  const espnTeam = kit?.fplTeams[el.team];
  const espnId = kit?.ix.fpl[el.id];
  const log = usePlayerLog(espnTeam);
  const rows = log.data?.[espnId]?.rows ?? null;
  const role = kit?.roles[el.id] ?? null;
  const oppFpl = nextFx ? (nextFx.home === el.team ? nextFx.away : nextFx.home) : null;
  const opp = oppFpl ? kit?.fplTeams[oppFpl] : null;
  const oppName = oppFpl ? teams[oppFpl]?.name : null;
  const [season, lastSeason] = kit?.ix.seasons ?? [];

  const allow = useMemo(() => {
    if (!kit || !opp || !role) return null;
    const ix = kit.ix;
    const now = allowedByRole(ix.conceded[opp]?.[season], ix.league[season])[role];
    const before = allowedByRole(ix.conceded[opp]?.[lastSeason], ix.league[lastSeason])[role];
    // Where this opponent ranks among this season's clubs for that role (1 = gives up most).
    const all = ix.current.map((t) => allowedByRole(ix.conceded[t]?.[season], ix.league[season])[role]?.xgi90 ?? 0).sort((a, b) => b - a);
    const rank = now ? all.indexOf(now.xgi90) + 1 : null;
    return { now, before, rank, n: all.length, factor: kit.roleFactor(opp, role) };
  }, [kit, opp, role, season, lastSeason]);

  const vs = useMemo(() => (rows && opp ? versus(rows, opp) : null), [rows, opp]);
  const trend = useMemo(() => {
    if (!rows?.length) return null;
    const recent = rows.slice(-20);
    const per90 = recent.map((r) => (r[6] >= 20 ? ((r[8] + r[10]) / r[6]) * 90 : null)).filter((v) => v != null);
    const roll = rolling(per90, 5);
    const bySeason = {};
    for (const r of rows) {
      const y = r[0].slice(5) >= '07' ? r[0].slice(0, 4) : String(Number(r[0].slice(0, 4)) - 1);
      const s = (bySeason[y] ??= { min: 0, xg: 0, xa: 0, g: 0, a: 0 });
      s.min += r[6];
      s.xg += r[8];
      s.xa += r[10];
      s.g += r[9];
      s.a += r[11];
    }
    const usual = rows.reduce((t, r) => t + r[8] + r[10], 0) / Math.max(1, rows.reduce((t, r) => t + r[6], 0)) * 90;
    return { roll, s: slope(roll.slice(-8)), bySeason, usual };
  }, [rows]);

  const gws = useMemo(() => {
    if (!fixtures) return [];
    const next = fixtures.filter((f) => !f.started && (f.home === el.team || f.away === el.team)).map((f) => f.event);
    const first = Math.min(...next);
    return Number.isFinite(first) ? Array.from({ length: 5 }, (_, i) => first + i).filter((g) => g <= 38) : [];
  }, [fixtures, el.team]);
  const ahead = useMemo(() => (gws.length ? projectAhead([el.id], fixtures, gws, ctx)[el.id] : null), [el.id, fixtures, gws, ctx]);

  if (!kit) return <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>Loading matchup data…</p>;
  const maxAhead = Math.max(6, ...(ahead ? Object.values(ahead.per).map((c) => c.xp) : [0]));

  return (
    <div className="sp-mu">
      {ahead && (
        <div className="sp-mu-block">
          <h4 className="sp-mu-h">Next {gws.length} gameweeks, projected: <span className="sp-num">{one(ahead.total)}</span></h4>
          <div className="sp-mu-bars">
            {gws.map((g) => {
              const c = ahead.per[g];
              return (
                <div key={g} title={`GW${g}: ${one(c.xp)}`}>
                  <span className="sp-num sp-tiny" style={{ fontWeight: 800 }}>{c.fx.length ? one(c.xp) : '–'}</span>
                  <i style={{ height: `${(c.xp / maxAhead) * 44}px` }} />
                  <span className="sp-tiny sp-muted">{c.fx.map((x) => (x.home ? teams[x.opp]?.short : teams[x.opp]?.short.toLowerCase())).join(' ') || 'blank'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {role && opp && allow?.now && (
        <div className="sp-mu-block">
          <h4 className="sp-mu-h">{oppName} against {ROLE_NAME[role]}</h4>
          <p className="sp-tiny sp-ink2" style={{ margin: '0 0 6px' }}>
            {el.name} mostly plays as a {ROLE_ONE[role]}. Chances (xG + xA) {oppName} allow that position per 90 minutes:
          </p>
          <Compare label={seasonLabel(season)} v={allow.now.xgi90} avg={allow.now.leagueXgi90} />
          {allow.before && <Compare label={seasonLabel(lastSeason)} v={allow.before.xgi90} avg={allow.before.leagueXgi90} />}
          <p className="sp-tiny sp-ink2" style={{ margin: '6px 0 0' }}>
            {allow.rank ? `${ordinal(allow.rank)} most of ${allow.n} clubs this season. ` : ''}
            Weighing both seasons and the sample size: <b style={{ color: 'var(--sp-ink)' }}>{Math.abs(allow.factor - 1) < 0.02 ? 'about average' : `${Math.round(Math.abs(allow.factor - 1) * 100)}% ${allow.factor > 1 ? 'more' : 'fewer'} chances than usual`}</b> for a {ROLE_ONE[role]}.
          </p>
        </div>
      )}

      {vs && (
        <div className="sp-mu-block">
          <h4 className="sp-mu-h">{el.name} against {oppName} since 2023/24</h4>
          {vs.matches.length === 0 ? (
            <p className="sp-tiny sp-ink2" style={{ margin: 0 }}>Hasn’t played them in the Premier League in that time.</p>
          ) : (
            <>
              <p className="sp-tiny sp-ink2" style={{ margin: '0 0 6px' }}>
                {vs.matches.length} {vs.matches.length === 1 ? 'match' : 'matches'}, {vs.minutes} minutes: <b style={{ color: 'var(--sp-ink)' }}>{vs.goals} {vs.goals === 1 ? 'goal' : 'goals'}, {vs.assists} {vs.assists === 1 ? 'assist' : 'assists'}</b> from xG {vs.xg.toFixed(2)} and xA {vs.xa.toFixed(2)}.
                {vs.xgi90 != null && vs.usual90 ? ` ${vs.xgi90.toFixed(2)} xG + xA per 90 against them, ${vs.usual90.toFixed(2)} against everyone.` : ''} A handful of matches says little on its own, so the projection leans on it only lightly through the opponent’s record.
              </p>
              <table className="sp-mu-table">
                <tbody>
                  {vs.matches.slice().reverse().map((r) => (
                    <tr key={r[0]}>
                      <td className="sp-muted">{shortDay(r[0])}</td>
                      <td>{r[2] ? 'H' : 'A'} {r[3]}–{r[4]}</td>
                      <td className="sp-muted">{r[5]}</td>
                      <td className="sp-num">{r[6]}′</td>
                      <td className="sp-num">xG {r[8].toFixed(2)}</td>
                      <td className="sp-num">xA {r[10].toFixed(2)}</td>
                      <td className="sp-num" style={{ fontWeight: 800 }}>{r[9] ? `${r[9]}G` : ''}{r[11] ? ` ${r[11]}A` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {trend && trend.roll.length >= 3 && (
        <div className="sp-mu-block">
          <h4 className="sp-mu-h">
            Form: {trend.s > 0.015 ? 'rising' : trend.s < -0.015 ? 'falling' : 'steady'}
          </h4>
          <p className="sp-tiny sp-ink2" style={{ margin: '0 0 4px' }}>xG + xA per 90, five-match average over his last {trend.roll.length} matches; dashed line is his average since 2023/24 ({trend.usual.toFixed(2)}).</p>
          <Spark values={trend.roll} level={trend.usual} label={`Recent xG plus xA per 90, latest ${trend.roll[trend.roll.length - 1].toFixed(2)}`} />
          <div className="sp-mu-seasons">
            {Object.entries(trend.bySeason).map(([y, s]) => (
              <span key={y}>
                <b>{seasonLabel(y)}</b> {s.min}′ · {s.g}G {s.a}A · <span className="sp-num">{s.min ? (((s.xg + s.xa) / s.min) * 90).toFixed(2) : '–'}</span>/90
              </span>
            ))}
          </div>
        </div>
      )}
      {log.error && <p className="sp-tiny sp-muted">Couldn’t load his match history ({log.error}).</p>}
      {!espnId && <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>No Premier League match history found for him since 2023/24.</p>}
    </div>
  );
}

function Compare({ label, v, avg }) {
  const max = Math.max(v, avg) * 1.25 || 1;
  return (
    <div className="sp-cmp">
      <span className="sp-tiny sp-muted">{label}</span>
      <span className="sp-cmp-track">
        <i style={{ width: `${(v / max) * 100}%` }} />
        <b style={{ left: `${(avg / max) * 100}%` }} title="League average" />
      </span>
      <span className="sp-tiny sp-num" style={{ fontWeight: 800 }}>{v.toFixed(2)} <span className="sp-muted" style={{ fontWeight: 600 }}>avg {avg.toFixed(2)}</span></span>
    </div>
  );
}

const ordinal = (n) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`;
};
