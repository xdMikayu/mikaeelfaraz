'use client';
import { useEffect, useMemo, useState } from 'react';
import { addSources, SOURCES, sourcePoints, POS } from '@/lib/sport/fpl.mjs';
import { shirt, heat } from './fplbits';
import { ChancesChart, DefconChart } from './FantasyCharts';

const loads = {};
/** A past gameweek's live data never changes, so each is fetched once per visit. */
const liveFor = (gw) => {
  loads[gw] ??= fetch(`/api/sport/fpl/live/${gw}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`FPL ${r.status}`))));
  loads[gw].catch(() => delete loads[gw]);
  return loads[gw];
};
/** The season so far, point sources and defensive-contribution hits for everyone (fpl-server getSeason). */
let seasonLoad = null;
const seasonFor = () => {
  seasonLoad ??= fetch('/api/sport/fpl/season').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`FPL ${r.status}`))));
  seasonLoad.catch(() => (seasonLoad = null));
  return seasonLoad;
};

// The players table: what each column holds and how it's labelled. "±" is goals and assists
// against their expected number: above nought, more than the chances were worth.
const COLS = [
  ['pts', 'Pts'],
  ['g', 'G'],
  ['a', 'A'],
  ['xg', 'xG'],
  ['xa', 'xA'],
  ['xgi', 'xGI'],
  ['diff', '±'],
  ['dc', 'DC'],
  ['own', 'Own'],
];
const SIGNED = new Set(['diff']);
const WHOLE = new Set(['pts', 'g', 'a', 'dc']);
const POSITIONS = [[0, 'All'], [1, 'GKP'], [2, 'DEF'], [3, 'MID'], [4, 'FWD']];

const signed = (v, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`;

/** Goals, assists, their expected numbers, points and where they came from, over a gameweek, four or the season. */
export default function Stats({ st, live, fixtures, ctx, teams, squad }) {
  const cur = live.event;
  const [range, setRange] = useState('gw');
  const [sortBy, setSortBy] = useState('xgi');
  const [pos, setPos] = useState(0);
  const [unit, setUnit] = useState('total');
  const [maxCost, setMaxCost] = useState(null);
  const gws = useMemo(() => (range === 'gw' ? [cur] : range === 'last4' ? [cur - 3, cur - 2, cur - 1, cur].filter((g) => g >= 1) : null), [range, cur]);
  const [past, setPast] = useState({});
  const [season, setSeason] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let on = true;
    if (!gws) {
      seasonFor().then(
        (d) => on && setSeason(d),
        (e) => on && setErr(e.message)
      );
      return () => {
        on = false;
      };
    }
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
    let sources = {};
    if (!gws) {
      for (const e of st.elements) per[e.id] = { g: e.goals ?? 0, a: e.assists ?? 0, xg: e.xg ?? 0, xa: e.xa ?? 0, min: e.minutes ?? 0, pts: e.total ?? 0, dc: e.dc ?? 0 };
      sources = season?.players ?? null;
    } else {
      for (const g of gws) {
        const d = g === cur ? live : past[g];
        if (!d) return null;
        for (const [id, s] of Object.entries(d.elements)) {
          const p = (per[id] ??= { g: 0, a: 0, xg: 0, xa: 0, min: 0, pts: 0, dc: 0 });
          p.min += s.minutes ?? 0;
          p.g += s.goals ?? 0;
          p.a += s.assists ?? 0;
          p.xg += s.xg ?? 0;
          p.xa += s.xa ?? 0;
          p.pts += s.points ?? 0;
          p.dc += s.st?.dc ?? 0;
          addSources(sources, id, s.explain);
          const t = ctx.elements[id]?.team;
          if (t) ((teamXg[g] ??= {})[t] = (teamXg[g]?.[t] ?? 0) + (s.xg ?? 0));
        }
      }
    }
    const players = Object.entries(per)
      .map(([id, p]) => ({ id: Number(id), el: ctx.elements[id], ...p, ga: p.g + p.a, xgi: p.xg + p.xa, diff: p.g + p.a - p.xg - p.xa, own: ctx.elements[id]?.owned ?? 0 }))
      .filter((p) => p.el && (p.min > 0 || p.pts));

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
    return { players, clubs: Object.values(club).filter((c) => c.n > 0), sources };
  }, [gws, past, live, st, ctx, fixtures, cur, season]);

  if (err && !data) return <p className="sp-empty">Couldn’t load earlier gameweeks from FPL ({err}).</p>;
  if (!data) return <div className="sp-skel" style={{ height: 500, margin: 16 }} />;
  // Totals, per 90 minutes (with a minimum so one cameo can't top it), or per £1m of price.
  const minMinutes = range === 'gw' ? 45 : range === 'last4' ? 180 : 360;
  const top = data.players
    .filter((p) => (!pos || p.el.type === pos) && (maxCost == null || p.el.cost <= maxCost + 1e-9) && (unit !== 'p90' || p.min >= minMinutes))
    .map((p) => {
      if (unit === 'total') return p;
      const f = unit === 'p90' ? 90 / p.min : 1 / p.el.cost;
      return { ...p, ...Object.fromEntries(COLS.filter(([k]) => k !== 'own').map(([k]) => [k, p[k] * f])) };
    })
    .sort((a, b) => b[sortBy] - a[sortBy] || b.xgi - a.xgi)
    .slice(0, 20);
  const scale = Object.fromEntries(COLS.map(([k]) => [k, Math.max(...top.map((p) => Math.abs(p[k])), 0.01)]));
  const rangeLabel = range === 'gw' ? `gameweek ${cur}` : range === 'last4' ? `gameweeks ${gws[0]}–${cur}` : 'the season';
  const num = (k, v) => (k === 'own' ? `${v.toFixed(v < 10 ? 1 : 0)}%` : SIGNED.has(k) ? signed(v, 2) : unit === 'total' && WHOLE.has(k) ? v : v.toFixed(2));

  return (
    <div style={{ marginTop: 12 }}>
      <div className="sp-pad">
        <div className="sp-tabs" role="radiogroup" aria-label="Period" style={{ gap: 16 }}>
          {[['gw', `GW${cur}`], ['last4', 'Last 4'], ['season', 'Season']].map(([k, l]) => (
            <button key={k} role="radio" aria-checked={range === k} onClick={() => setRange(k)} style={{ height: 34, fontSize: 14 }}>{l}</button>
          ))}
        </div>
        <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>
          On this page: <a className="sp-link" href="#stats-players">players</a> · <a className="sp-link" href="#stats-defcon">DEFCON and goal threat</a> ·{' '}
          <a className="sp-link" href="#stats-luck">above and below their xGI</a> · <a className="sp-link" href="#stats-points">where the points come from</a> ·{' '}
          <a className="sp-link" href="#stats-chances">club chances</a> · <a className="sp-link" href="#stats-clubs">clubs</a>
        </p>
      </div>

      <section className="sp-group" id="stats-players" style={{ marginTop: 10 }}>
        <header className="sp-ghead">
          <h2 className="sp-h3">Players</h2>
          <Positions value={pos} onChange={setPos} />
        </header>
        <div className="sp-pad sp-opt-ctl" style={{ marginBottom: 6 }}>
          <div className="sp-tabs" role="radiogroup" aria-label="Units" style={{ border: 0, gap: 12 }}>
            {[['total', 'Totals'], ['p90', 'Per 90'], ['pm', 'Per £m']].map(([k, l]) => (
              <button key={k} role="radio" aria-checked={unit === k} onClick={() => setUnit(k)} style={{ height: 28, fontSize: 13 }}>{l}</button>
            ))}
          </div>
          <span className="sp-small">
            {maxCost == null ? 'Any price' : <>Up to <b className="sp-num">£{maxCost.toFixed(1)}m</b></>}
            <span className="sp-step" role="group" aria-label="Price ceiling">
              <button onClick={() => setMaxCost((c) => Math.max(4, (c ?? 15) - 0.5))} aria-label="Cheaper">−</button>
              <button onClick={() => setMaxCost((c) => (c == null || c + 0.5 > 15 ? null : c + 0.5))} aria-label="Dearer">+</button>
            </span>
          </span>
        </div>
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
                    <Name p={p} teams={teams} />
                  </th>
                  {COLS.map(([k]) => (
                    <td key={k} className="sp-num" style={heat((Math.max(0, p[k]) / scale[k]) * (k === sortBy ? 1 : 0.75))}>{num(k, p[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>
          Top 20 for {rangeLabel} by {COLS.find(([k]) => k === sortBy)[1]}
          {unit === 'p90' ? ` per 90 (at least ${minMinutes} minutes)` : unit === 'pm' ? ' per £1m of price' : ''}
          {maxCost != null ? `, £${maxCost.toFixed(1)}m or less` : ''}; tap a column to re-rank. xG and xA are Opta’s, from FPL; xGI is the two together, and ± is goals and assists
          against it. DC is defensive contributions (clearances, blocks, interceptions and tackles, and for midfielders and forwards recoveries too). Own is the share of all FPL managers who
          own the player.
        </p>
      </section>

      <DefconChart players={data.players} sources={data.sources} teams={teams} squad={squad} range={range} label={rangeLabel} />
      <Luck players={data.players} teams={teams} pos={pos} label={rangeLabel} range={range} />
      <Sources sources={data.sources} players={data.players} ctx={ctx} teams={teams} label={rangeLabel} />
      <ChancesChart teams={teams} gws={gws} />
      <Clubs clubs={data.clubs} teams={teams} label={rangeLabel} season={range === 'season'} />
    </div>
  );
}

function Name({ p, teams, sub }) {
  return (
    <span className="sp-heat-name">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shirt(teams[p.el.team]?.code, p.el.type === 1)} alt="" width="18" height="18" />
      <span style={{ minWidth: 0 }}>
        {p.el.name}
        {sub && <small className="sp-muted" style={{ display: 'block', fontWeight: 600 }}>{sub}</small>}
      </span>
    </span>
  );
}

function Positions({ value, onChange, label = 'Position' }) {
  return (
    <div className="sp-tabs" role="radiogroup" aria-label={label} style={{ border: 0, gap: 10 }}>
      {POSITIONS.filter(([k]) => k !== 1).map(([k, l]) => (
        <button key={k} role="radio" aria-checked={value === k} onClick={() => onChange(k)} style={{ height: 26, fontSize: 12.5 }}>{l}</button>
      ))}
    </div>
  );
}

/** Running hot and due one: goals and assists against what the chances were worth, both ways. */
function Luck({ players, teams, pos, label, range }) {
  // Enough chances that a gap means something: half an xGI in a gameweek, more over longer spells.
  const floor = range === 'gw' ? 0.4 : range === 'last4' ? 0.8 : 1.5;
  const pool = players.filter((p) => (!pos || p.el.type === pos) && p.xgi + p.ga >= floor);
  const above = [...pool].sort((a, b) => b.diff - a.diff).filter((p) => p.diff > 0.2).slice(0, 8);
  const below = [...pool].sort((a, b) => a.diff - b.diff).filter((p) => p.diff < -0.2).slice(0, 8);
  const row = (p) => (
    <div key={p.id} className="sp-luck">
      <Name p={p} teams={teams} sub={`${teams[p.el.team]?.short} · ${POS[p.el.type]} · £${p.el.cost.toFixed(1)}m · ${p.own.toFixed(1)}% own`} />
      <span className="sp-num sp-tiny sp-ink2">
        <b style={{ color: 'var(--sp-ink)' }}>{p.ga}</b> from {p.xgi.toFixed(1)}
      </span>
      <b className="sp-num" style={{ fontSize: 14 }}>{signed(p.diff)}</b>
    </div>
  );
  if (!above.length && !below.length) return null;
  return (
    <section className="sp-group" id="stats-luck">
      <header className="sp-ghead" style={{ display: 'block' }}>
        <h2 className="sp-h3">Above and below their xGI</h2>
        <p className="sp-tiny sp-muted" style={{ margin: '2px 0 0' }}>
          Goals and assists over {label} against their expected goals and assists. Well above often cools off; well below, with the chances still coming, is often a return on its way.
        </p>
      </header>
      <div className="sp-two sp-pad" style={{ gap: 18 }}>
        <div>
          <h3 className="sp-mu-h" style={{ margin: '6px 0 2px' }}>Above: running hot</h3>
          {above.length ? above.map(row) : <p className="sp-small sp-muted">Nobody well above.</p>}
        </div>
        <div>
          <h3 className="sp-mu-h" style={{ margin: '6px 0 2px' }}>Below: due a return?</h3>
          {below.length ? below.map(row) : <p className="sp-small sp-muted">Nobody well below.</p>}
        </div>
      </div>
    </section>
  );
}

/** Where each player's points come from, and how often their defensive contributions pay. */
function Sources({ sources, players, ctx, teams, label }) {
  const [pos, setPos] = useState(2);
  const [sortBy, setSortBy] = useState('pts');
  if (!sources) return <div className="sp-skel" style={{ height: 300, margin: '18px 16px 0' }} />;
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const rows = Object.entries(sources)
    .map(([id, s]) => {
      const el = ctx.elements[id];
      if (!el) return null;
      const parts = Object.fromEntries(SOURCES.map(([k, , ids]) => [k, sourcePoints(s.src, ids)]));
      return { id: Number(id), el, ...s, ...parts, ppg: s.apps ? s.pts / s.apps : 0, rate: s.apps ? s.dcHits / s.apps : 0, xgi: byId[id]?.xgi ?? 0 };
    })
    .filter((r) => r && (!pos || r.el.type === pos) && r.apps > 0)
    .sort((a, b) => b[sortBy] - a[sortBy] || b.pts - a.pts)
    .slice(0, 25);
  const cols = [
    ['pts', 'Pts'],
    ['play', 'Play'],
    ['ga', 'G+A'],
    ['cs', 'CS'],
    ['dc', 'DC'],
    ['rate', 'DC hit'],
    ['bonus', 'Bonus'],
    ['saves', 'Saves'],
    ['lost', 'Lost'],
    ['ppg', 'PPG'],
  ].filter(([k]) => !(k === 'saves' && pos && pos !== 1));
  const scale = Object.fromEntries(cols.map(([k]) => [k, Math.max(...rows.map((r) => Math.abs(r[k])), 0.01)]));
  const show = (k, r) => (k === 'rate' ? `${r.dcHits}/${r.apps}` : k === 'ppg' ? r.ppg.toFixed(1) : k === 'lost' && r.lost ? `−${Math.abs(r.lost)}` : r[k]);
  return (
    <section className="sp-group" id="stats-points">
      <header className="sp-ghead">
        <h2 className="sp-h3">Where the points come from</h2>
        <Positions value={pos} onChange={setPos} label="Position for points" />
      </header>
      <div className="sp-heat-wrap">
        <table className="sp-stat-t">
          <thead>
            <tr>
              <th className="l">Player</th>
              {cols.map(([k, l]) => (
                <th key={k}>
                  <button onClick={() => setSortBy(k)} aria-pressed={sortBy === k}>{l}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th className="l">
                  <Name p={r} teams={teams} />
                </th>
                {cols.map(([k]) => (
                  <td key={k} className="sp-num" style={k === 'lost' ? undefined : heat((Math.max(0, r[k]) / scale[k]) * (k === sortBy ? 1 : 0.7))}>{show(k, r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>
        FPL’s points over {label}, split by what scored them: playing time, goals and assists, clean sheets, defensive contributions, bonus and saves, and what was lost to goals
        conceded, cards, own goals and missed penalties. DC hit is how many of their matches their defensive contributions reached FPL’s threshold for 2 points. PPG is points per match played.
      </p>
    </section>
  );
}

/** Each club's goals against its xG, at both ends. */
function Clubs({ clubs, teams, label, season }) {
  const attack = [...clubs].sort((a, b) => b.xg - a.xg);
  const defence = [...clubs].sort((a, b) => a.xga - b.xga);
  const maxXg = Math.max(...attack.map((c) => c.xg), 0.01);
  const maxXga = Math.max(...defence.map((c) => c.xga), 0.01);
  const minXga = Math.min(...defence.map((c) => c.xga));
  return (
    <section id="stats-clubs">
      <div className="sp-two" style={{ marginTop: 6 }}>
        <section className="sp-group">
          <header className="sp-ghead"><h2 className="sp-h3">Attack</h2><span className="sp-tiny sp-muted">G · xG · ±</span></header>
          {attack.map((c) => (
            <div key={c.id} className="sp-club-stat sp-club-stat-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shirt(teams[c.id]?.code)} alt="" width="20" height="20" />
              <b>{teams[c.id]?.short}</b>
              <span className="sp-club-bar"><i style={{ width: `${(c.xg / maxXg) * 100}%` }} /></span>
              <span className="sp-num">{c.g}</span>
              <span className="sp-num" style={{ fontWeight: 850 }}>{c.xg.toFixed(1)}</span>
              <span className="sp-num sp-ink2">{signed(c.g - c.xg)}</span>
            </div>
          ))}
        </section>
        <section className="sp-group">
          <header className="sp-ghead"><h2 className="sp-h3">Defence</h2><span className="sp-tiny sp-muted">GA · xGA · ±</span></header>
          {defence.map((c) => (
            <div key={c.id} className="sp-club-stat sp-club-stat-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shirt(teams[c.id]?.code)} alt="" width="20" height="20" />
              <b>{teams[c.id]?.short}</b>
              {/* Fewest conceded gets the longest bar: this column ranks good defending. */}
              <span className="sp-club-bar"><i style={{ width: `${maxXga > minXga ? (0.15 + (0.85 * (maxXga - c.xga)) / (maxXga - minXga)) * 100 : 100}%` }} /></span>
              <span className="sp-num">{c.ga}</span>
              <span className="sp-num" style={{ fontWeight: 850 }}>{c.xga.toFixed(1)}</span>
              <span className="sp-num sp-ink2">{signed(c.ga - c.xga)}</span>
            </div>
          ))}
        </section>
      </div>
      <p className="sp-note sp-pad" style={{ margin: '10px 0 0' }}>
        Clubs over {label}: goals from the scores, xG from their players’ Opta numbers. {season ? 'Season xG against is each club’s players’ xG conceded while on the pitch, eleven at a time.' : 'xG against is their opponents’ xG in those matches.'} ± is
        goals against xG: above nought in attack, finishing better than the chances; below nought in defence, conceding fewer than the chances were worth. Bars: longer is better.
      </p>
    </section>
  );
}
