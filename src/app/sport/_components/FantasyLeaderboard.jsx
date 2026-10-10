'use client';
import { useMemo, useState } from 'react';
import { projectAhead } from '@/lib/sport/fpl.mjs';
import { ROLE_SHORT } from '@/lib/sport/matchups.mjs';
import { shirt, heat, one } from './fplbits';

const COLS = [
  ['xg', 'xG'],
  ['xa', 'xA'],
  ['xgi', 'xGI'],
  ['xp', 'Pts'],
];

/**
 * Everyone's projected xG for one gameweek: his own rate and likely minutes, how open the match
 * should be, and how much his opponent allows his position. Ranked, top 40.
 */
export default function Leaderboard({ st, fixtures, gw, ctx, teams }) {
  const [sortBy, setSortBy] = useState('xg');
  const [pos, setPos] = useState(0);
  const all = useMemo(() => {
    const ids = st.elements.filter((e) => e.status !== 'u' && e.type > 1).map((e) => e.id);
    const ahead = projectAhead(ids, fixtures, [gw], ctx);
    return ids
      .map((id) => {
        const c = ahead[id]?.per[gw];
        if (!c?.fx.length) return null;
        return { id, el: ctx.elements[id], xg: c.xg, xa: c.xa, xgi: c.xg + c.xa, xp: c.xp, fx: c.fx };
      })
      .filter(Boolean);
  }, [st, fixtures, gw, ctx]);
  const list = all
    .filter((p) => !pos || p.el.type === pos)
    .sort((a, b) => b[sortBy] - a[sortBy])
    .slice(0, 40);
  const max = Object.fromEntries(COLS.map(([k]) => [k, Math.max(...list.map((p) => p[k]), 0.01)]));

  if (!all.length) return <p className="sp-empty">No matches left to project in gameweek {gw}.</p>;
  return (
    <section className="sp-group" style={{ marginTop: 6 }}>
      <header className="sp-ghead">
        <h2 className="sp-h3">Projected leaders</h2>
        <div className="sp-tabs" role="radiogroup" aria-label="Position" style={{ border: 0, gap: 10 }}>
          {[[0, 'All'], [2, 'DEF'], [3, 'MID'], [4, 'FWD']].map(([k, l]) => (
            <button key={k} role="radio" aria-checked={pos === k} onClick={() => setPos(k)} style={{ height: 26, fontSize: 12.5 }}>{l}</button>
          ))}
        </div>
      </header>
      <div className="sp-heat-wrap">
        <table className="sp-stat-t sp-lb">
          <thead>
            <tr>
              <th className="l">Player</th>
              {COLS.map(([k, l]) => (
                <th key={k}>
                  <button onClick={() => setSortBy(k)} aria-pressed={sortBy === k}>{l}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((p, i) => {
              const role = ctx.model.role?.(p.id);
              const f = p.fx[0];
              const rf = f?.roleF ?? 1;
              return (
                <tr key={p.id}>
                  <th className="l">
                    <span className="sp-lb-who">
                      <span className="sp-num sp-muted sp-lb-n">{i + 1}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={shirt(teams[p.el.team]?.code)} alt="" width="18" height="18" />
                      <span style={{ minWidth: 0 }}>
                        <b>{p.el.name}</b>
                        <small>
                          v {p.fx.map((x) => `${teams[x.opp]?.short}${x.home ? '' : ' (A)'}`).join(', ')}
                          {role ? ` · ${ROLE_SHORT[role]}` : ''}
                          {role && Math.abs(rf - 1) >= 0.03 ? ` · ${rf > 1 ? '+' : '−'}${Math.round(Math.abs(rf - 1) * 100)}%` : ''}
                        </small>
                      </span>
                    </span>
                  </th>
                  {COLS.map(([k]) => (
                    <td key={k} className="sp-num" style={heat((p[k] / max[k]) * (k === sortBy ? 1 : 0.7))}>{k === 'xp' ? one(p[k]) : p[k].toFixed(2)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sp-tiny sp-muted sp-pad" style={{ margin: '8px 0 0' }}>
        Projected for gameweek {gw}: each player’s xG and xA per 90 (pulled towards his position’s average until he has played enough), times his likely minutes, times how many goals his side should score in this match, times how much this opponent allows his position. The percentage beside the position is that last factor: +12% means the opponent gives that position 12% more than an average team, weighing this season and the last two and shrunk for small samples. Matches already played this gameweek aren’t counted. Our estimate.
      </p>
    </section>
  );
}
