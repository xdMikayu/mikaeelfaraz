'use client';
import { useEffect, useMemo, useState } from 'react';
import { shirt, heat } from './fplbits';

const loads = {};
/** A past gameweek's live data never changes, so each is fetched once per visit. */
const liveFor = (gw) => {
  loads[gw] ??= fetch(`/api/sport/fpl/live?event=${gw}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`FPL ${r.status}`))));
  loads[gw].catch(() => delete loads[gw]);
  return loads[gw];
};

const COLS = [
  ['g', 'G'],
  ['xg', 'xG'],
  ['a', 'A'],
  ['xa', 'xA'],
  ['ga', 'G+A'],
  ['xgi', 'xGI'],
];

/** Goals, assists and their expected numbers, for players and clubs, over a gameweek, four or the season. */
export default function Stats({ st, live, fixtures, ctx, teams }) {
  const cur = live.event;
  const [range, setRange] = useState('gw');
  const [sortBy, setSortBy] = useState('xgi');
  const [pos, setPos] = useState(0);
  const gws = useMemo(() => (range === 'gw' ? [cur] : range === 'last4' ? [cur - 3, cur - 2, cur - 1, cur].filter((g) => g >= 1) : null), [range, cur]);
  const [past, setPast] = useState({});
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (!gws) return;
    let on = true;
    Promise.all(gws.filter((g) => g !== cur).map((g) => liveFor(g).then((d) => [g, d]))).then(
      (list) => on && setPast((p) => ({ ...p, ...Object.fromEntries(list) })),
      (e) => on && setErr(e.message)
    );
    return () => {
      on = false;
    };
  }, [gws, cur]);

  const data = useMemo(() => {
    const per = {};
    const teamXg = {}; // gw -> team -> xG, for xG against
    if (!gws) {
      for (const e of st.elements) per[e.id] = { g: e.goals ?? 0, a: e.assists ?? 0, xg: e.xg ?? 0, xa: e.xa ?? 0 };
    } else {
      for (const g of gws) {
        const d = g === cur ? live : past[g];
        if (!d) return null;
        for (const [id, s] of Object.entries(d.elements)) {
          const p = (per[id] ??= { g: 0, a: 0, xg: 0, xa: 0 });
          p.g += s.goals ?? 0;
          p.a += s.assists ?? 0;
          p.xg += s.xg ?? 0;
          p.xa += s.xa ?? 0;
          const t = ctx.elements[id]?.team;
          if (t) ((teamXg[g] ??= {})[t] = (teamXg[g]?.[t] ?? 0) + (s.xg ?? 0));
        }
      }
    }
    const players = Object.entries(per)
      .map(([id, p]) => ({ id: Number(id), el: ctx.elements[id], ...p, ga: p.g + p.a, xgi: p.xg + p.xa }))
      .filter((p) => p.el && p.xgi + p.ga > 0);

    // Clubs: goals from the scores, xG from their players, xG against from their opponents (or, for
    // the season, from the players' xG conceded while on the pitch, eleven at a time).
    const club = Object.fromEntries(st.teams.map((t) => [t.id, { id: t.id, g: 0, xg: 0, ga: 0, xga: 0, n: 0 }]));
    const played = (fixtures ?? live.fixtures).filter((f) => f.started && (gws ? gws.includes(f.event ?? cur) : true));
    for (const f of played) {
      for (const [t, o, gf, ga] of [[f.home, f.away, f.hs, f.as], [f.away, f.home, f.as, f.hs]]) {
        if (!club[t]) continue;
        club[t].g += gf ?? 0;
        club[t].ga += ga ?? 0;
        club[t].n += 1;
        if (gws) club[t].xga += teamXg[f.event ?? cur]?.[o] ?? 0;
      }
    }
    for (const p of players) club[p.el.team] && (club[p.el.team].xg += p.xg);
    if (!gws) for (const e of st.elements) club[e.team] && (club[e.team].xga += (e.xgc ?? 0) / 11);
    return { players, clubs: Object.values(club).filter((c) => c.n > 0) };
  }, [gws, past, live, st, ctx, fixtures, cur]);

  if (err && !data) return <p className="sp-empty">Couldn’t load earlier gameweeks from FPL ({err}).</p>;
  if (!data) return <div className="sp-skel" style={{ height: 500, margin: 16 }} />;
  const top = data.players
    .filter((p) => !pos || p.el.type === pos)
    .sort((a, b) => b[sortBy] - a[sortBy] || b.xgi - a.xgi)
    .slice(0, 20);
  const scale = Object.fromEntries(COLS.map(([k]) => [k, Math.max(...top.map((p) => p[k]), 0.01)]));
  const attack = [...data.clubs].sort((a, b) => b.xg - a.xg);
  const defence = [...data.clubs].sort((a, b) => a.xga - b.xga);
  const maxXg = Math.max(...attack.map((c) => c.xg), 0.01);
  const maxXga = Math.max(...defence.map((c) => c.xga), 0.01);
  const minXga = Math.min(...defence.map((c) => c.xga));
  const rangeLabel = range === 'gw' ? `gameweek ${cur}` : range === 'last4' ? `gameweeks ${gws[0]}–${cur}` : 'the season';
  const num = (k, v) => (['g', 'a', 'ga'].includes(k) ? v : v.toFixed(2));

  return (
    <div style={{ marginTop: 12 }}>
      <div className="sp-pad">
        <div className="sp-tabs" role="radiogroup" aria-label="Period" style={{ gap: 16 }}>
          {[['gw', `GW${cur}`], ['last4', 'Last 4'], ['season', 'Season']].map(([k, l]) => (
            <button key={k} role="radio" aria-checked={range === k} onClick={() => setRange(k)} style={{ height: 34, fontSize: 14 }}>{l}</button>
          ))}
        </div>
      </div>

      <section className="sp-group" style={{ marginTop: 10 }}>
        <header className="sp-ghead">
          <h2 className="sp-h3">Players</h2>
          <div className="sp-tabs" role="radiogroup" aria-label="Position" style={{ border: 0, gap: 10 }}>
            {[[0, 'All'], [2, 'DEF'], [3, 'MID'], [4, 'FWD']].map(([k, l]) => (
              <button key={k} role="radio" aria-checked={pos === k} onClick={() => setPos(k)} style={{ height: 26, fontSize: 12.5 }}>{l}</button>
            ))}
          </div>
        </header>
        <div className="sp-heat-wrap">
          <table className="sp-stat-t">
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
              {top.map((p) => (
                <tr key={p.id}>
                  <th className="l">
                    <span className="sp-heat-name">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={shirt(teams[p.el.team]?.code, p.el.type === 1)} alt="" width="18" height="18" />
                      {p.el.name}
                    </span>
                  </th>
                  {COLS.map(([k]) => (
                    <td key={k} className="sp-num" style={heat((p[k] / scale[k]) * (k === sortBy ? 1 : 0.75))}>{num(k, p[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>Top 20 for {rangeLabel} by {COLS.find(([k]) => k === sortBy)[1]}; tap a column to re-rank. xG and xA are Opta’s, from FPL. xGI is the two together.</p>
      </section>

      <div className="sp-two" style={{ marginTop: 6 }}>
        <section className="sp-group">
          <header className="sp-ghead"><h2 className="sp-h3">Attack</h2><span className="sp-tiny sp-muted">G · xG</span></header>
          {attack.map((c) => (
            <div key={c.id} className="sp-club-stat">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shirt(teams[c.id]?.code)} alt="" width="20" height="20" />
              <b>{teams[c.id]?.short}</b>
              <span className="sp-club-bar"><i style={{ width: `${(c.xg / maxXg) * 100}%` }} /></span>
              <span className="sp-num">{c.g}</span>
              <span className="sp-num" style={{ fontWeight: 850 }}>{c.xg.toFixed(2)}</span>
            </div>
          ))}
        </section>
        <section className="sp-group">
          <header className="sp-ghead"><h2 className="sp-h3">Defence</h2><span className="sp-tiny sp-muted">GA · xGA</span></header>
          {defence.map((c) => (
            <div key={c.id} className="sp-club-stat">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shirt(teams[c.id]?.code)} alt="" width="20" height="20" />
              <b>{teams[c.id]?.short}</b>
              {/* Fewest conceded gets the longest bar: this column ranks good defending. */}
              <span className="sp-club-bar"><i style={{ width: `${maxXga > minXga ? (0.15 + (0.85 * (maxXga - c.xga)) / (maxXga - minXga)) * 100 : 100}%` }} /></span>
              <span className="sp-num">{c.ga}</span>
              <span className="sp-num" style={{ fontWeight: 850 }}>{c.xga.toFixed(2)}</span>
            </div>
          ))}
        </section>
      </div>
      <p className="sp-note sp-pad" style={{ margin: '10px 0 0' }}>
        Clubs over {rangeLabel}: goals from the scores, xG from their players’ Opta numbers. {range === 'season' ? 'Season xG against is each club’s players’ xG conceded while on the pitch, eleven at a time.' : 'xG against is their opponents’ xG in those matches.'} Bars: longer is better.
      </p>
    </div>
  );
}
