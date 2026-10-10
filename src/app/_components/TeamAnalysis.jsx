'use client';
import { useMemo } from 'react';
import { goalRates, matchOdds, rolling, slope } from '@/lib/sport/forecast.mjs';
import { allowedByRole, ROLE_NAME } from '@/lib/sport/matchups.mjs';
import { useMatchupIndex, useForecastKit, usePlayerLog } from './matchupData';

const pct = (p) => (p < 0.01 ? '<1%' : p > 0.99 ? '>99%' : `${Math.round(p * 100)}%`);
const ORDER = ['ST', 'W-L', 'AM', 'W-R', 'CM', 'FB-L', 'CB', 'FB-R'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const SHORT = { ST: 'Strikers', 'W-L': 'Left wing', AM: 'No. 10', 'W-R': 'Right wing', CM: 'Midfield', 'FB-L': 'Left-back', CB: 'Centre-backs', 'FB-R': 'Right-back' };

/** Premier League clubs: ratings, xG trend, where they leak and create chances, and the next five. */
export default function TeamAnalysis({ team, fixtures, color }) {
  const mx = useMatchupIndex();
  const kit = useForecastKit(mx.data);
  const inPl = Boolean(kit?.ix.current.includes(team.id));
  const log = usePlayerLog(inPl ? team.id : null);
  const a = useMemo(() => {
    if (!inPl) return null;
    const { ix, ratings } = kit;
    const [season] = ix.seasons;
    const games = (ix.games[team.id] ?? []).slice(-24);
    const forL = rolling(games.map((g) => g[5]), 6);
    const agL = rolling(games.map((g) => g[6]), 6);
    const ids = ix.current;
    const rank = (k, better) => [...ids].sort((x, y) => (better ? ratings[k][y] - ratings[k][x] : ratings[k][x] - ratings[k][y])).indexOf(team.id) + 1;
    const allowed = allowedByRole(ix.conceded[team.id]?.[season], ix.league[season]);
    // Their own chances by role this season, from their players' match rows.
    const own = {};
    let ownTotal = 0;
    for (const p of Object.values(log.data ?? {})) {
      for (const r of p.rows) {
        if (r[0] < `${season}-07`) continue;
        own[r[5]] = (own[r[5]] ?? 0) + r[8] + r[10];
        ownTotal += r[8] + r[10];
      }
    }
    const next = fixtures
      .filter((m) => m.league === 'eng.1' && m.status.state === 'pre')
      .slice(0, 5)
      .map((m) => {
        const rates = goalRates(ratings, m.home.id, m.away.id);
        const o = matchOdds(rates.home, rates.away);
        const home = m.home.id === team.id;
        return { m, home, opp: home ? m.away : m.home, win: home ? o.home : o.away, draw: o.draw, lose: home ? o.away : o.home, xf: home ? rates.home : rates.away, xa: home ? rates.away : rates.home };
      });
    // Against this season's twenty, not every club since 2023/24.
    const mean = (k) => ids.reduce((t, id) => t + (ratings[k][id] ?? 1), 0) / ids.length;
    return {
      att: ratings.att[team.id] / mean('att'),
      def: ratings.def[team.id] / mean('def'),
      attRank: rank('att', true),
      defRank: rank('def', false),
      n: ids.length,
      games,
      forL,
      agL,
      trend: { f: slope(forL.slice(-8)), a: slope(agL.slice(-8)) },
      allowed,
      own,
      ownTotal,
      next,
    };
  }, [inPl, kit, team.id, fixtures, log.data]);

  if (!a) return null;
  const more = (v) => `${Math.round(Math.abs(v - 1) * 100)}% ${v >= 1 ? 'more' : 'less'}`;
  const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`;
  const maxIdx = Math.max(0.3, ...ORDER.map((r) => Math.abs((a.allowed[r]?.index ?? 1) - 1)));

  return (
    <section className="sp-panel" style={{ marginTop: 14 }}>
      <div className="sp-section-head">
        <h2 className="sp-h2">The numbers</h2>
        <span className="sp-tiny sp-muted">Our estimate</span>
      </div>
      <p className="sp-small sp-ink2" style={{ margin: 0 }}>
        Creates <b style={{ color: 'var(--sp-ink)' }}>{more(a.att)}</b> than an average Premier League side ({ordinal(a.attRank)} of {a.n}) and allows <b style={{ color: 'var(--sp-ink)' }}>{more(a.def)}</b> ({ordinal(a.defRank)}). From xG and goals since 2023/24, recent matches counting most.
      </p>

      {a.games.length >= 6 && (
        <div className="sp-mu-block">
          <h3 className="sp-mu-h">
            xG trend: attack {a.trend.f > 0.02 ? 'rising' : a.trend.f < -0.02 ? 'falling' : 'steady'}, defence {a.trend.a < -0.02 ? 'tightening' : a.trend.a > 0.02 ? 'loosening' : 'steady'}
          </h3>
          <TwoLines f={a.forL} g={a.agL} color={color} />
          <p className="sp-tiny sp-ink2" style={{ margin: '4px 0 0' }}>
            Six-match averages over the last {a.games.length} league matches. <b style={{ color }}>■</b> xG for {a.forL[a.forL.length - 1].toFixed(2)} · <b style={{ color: 'var(--sp-muted)' }}>■</b> xG against {a.agL[a.agL.length - 1].toFixed(2)}.
          </p>
        </div>
      )}

      {Object.keys(a.allowed).length > 0 && (
        <div className="sp-mu-block">
          <h3 className="sp-mu-h">Where they leave chances</h3>
          <p className="sp-tiny sp-ink2" style={{ margin: '0 0 6px' }}>xG + xA they allow each opposing position per 90 this season, against the league average. Right of centre: more than average.</p>
          {ORDER.filter((r) => a.allowed[r]).map((r) => {
            const v = a.allowed[r];
            const d = v.index - 1;
            const w = (Math.abs(d) / maxIdx) * 50;
            return (
              <div key={r} className="sp-role">
                <span className="sp-tiny" style={{ fontWeight: 700 }}>{cap(ROLE_NAME[r])}</span>
                <span className="sp-div-track" style={{ marginTop: 0 }}>
                  <i className="sp-div-bar" style={{ left: d >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: 'var(--sp-ink)' }} />
                </span>
                <span className="sp-tiny sp-num" style={{ textAlign: 'right' }}>{v.xgi90.toFixed(2)} <span className="sp-muted">{d >= 0 ? '+' : '−'}{Math.round(Math.abs(d) * 100)}%</span></span>
              </div>
            );
          })}
        </div>
      )}

      {a.ownTotal > 0 && (
        <div className="sp-mu-block">
          <h3 className="sp-mu-h">Where their chances come from</h3>
          <div className="sp-share" role="img" aria-label="Share of their xG plus xA by position">
            {ORDER.filter((r) => a.own[r]).map((r) => (
              <span key={r} style={{ flex: a.own[r] }} title={`${SHORT[r]}: ${Math.round((a.own[r] / a.ownTotal) * 100)}%`}>
                <i />
                <b className="sp-num">{a.own[r] / a.ownTotal >= 0.07 ? `${Math.round((a.own[r] / a.ownTotal) * 100)}%` : ''}</b>
                <span>{a.own[r] / a.ownTotal >= 0.1 ? SHORT[r] : ''}</span>
              </span>
            ))}
          </div>
          <p className="sp-tiny sp-muted" style={{ margin: '4px 0 0' }}>Share of this season’s xG + xA by the position of the player involved.</p>
        </div>
      )}

      {a.next.length > 0 && (
        <div className="sp-mu-block">
          <h3 className="sp-mu-h">Next {a.next.length} in the league</h3>
          {a.next.map((x) => (
            <div key={x.m.id} className="sp-nx">
              <span className="sp-small" style={{ fontWeight: 700 }}>{x.opp.short} <span className="sp-muted" style={{ fontWeight: 600 }}>{x.home ? 'H' : 'A'}</span></span>
              <span className="sp-split" style={{ height: 8 }}>
                <i style={{ width: `${x.win * 100}%`, background: 'var(--sp-ink)' }} />
                <i style={{ width: `${x.draw * 100}%`, background: 'var(--sp-rule-2)' }} />
                <i style={{ width: `${x.lose * 100}%`, background: 'var(--sp-muted)' }} />
              </span>
              <span className="sp-tiny sp-num sp-ink2">W {pct(x.win)} · D {pct(x.draw)} · L {pct(x.lose)}</span>
              <span className="sp-tiny sp-num sp-muted">xG {x.xf.toFixed(1)}–{x.xa.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TwoLines({ f, g, color }) {
  const W = 320;
  const H = 90;
  const max = Math.max(...f, ...g) * 1.1 || 1;
  const x = (i) => (i / (f.length - 1)) * (W - 4) + 2;
  const y = (v) => H - 4 - (v / max) * (H - 10);
  const d = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  return (
    <svg className="sp-spark" style={{ height: 90 }} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <path d={d(g)} fill="none" stroke="var(--sp-muted)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path d={d(f)} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
