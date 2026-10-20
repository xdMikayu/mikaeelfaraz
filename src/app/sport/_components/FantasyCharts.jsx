'use client';
import { useEffect, useMemo, useState } from 'react';
import { DC_NEED } from '@/lib/sport/fpl.mjs';
import { clubChances } from '@/lib/sport/chances.mjs';
import { defconRows, pointsPerXgi, samePointsLevels, samePointsLine } from '@/lib/sport/defcon.mjs';
import Scatter from './Scatter';
import { shirt } from './fplbits';

// Two charts for Fantasy › Stats. DEFCON and goal threat: defenders' (or midfielders') defensive
// contributions per 90 against their xGI per 90, with curves through the players the two make worth
// the same in FPL points. Club chances: every club's non-penalty xG and big chances per match at either
// end, the chart that goes round FPL Twitter, in Opta's numbers.

let chancesLoad = null;
/** public/sport/data/pl/chances.json (scripts/sport/build-chances.mjs), once per visit. */
const chancesFor = () => {
  chancesLoad ??= fetch('/sport/data/pl/chances.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`chances ${r.status}`))));
  chancesLoad.catch(() => (chancesLoad = null));
  return chancesLoad;
};

const range2 = (gws) => (gws.length === 1 ? `gameweek ${gws[0]}` : `gameweeks ${gws[0]}–${gws[gws.length - 1]}`);
const shortDate = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function Toggle({ value, onChange, options, label }) {
  return (
    <div className="sp-tabs" role="radiogroup" aria-label={label} style={{ border: 0, gap: 12 }}>
      {options.map(([k, l]) => (
        <button key={k} role="radio" aria-checked={value === k} onClick={() => onChange(k)} style={{ height: 28, fontSize: 13 }}>{l}</button>
      ))}
    </div>
  );
}

function Player({ el, teams }) {
  return (
    <span className="sp-heat-name">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shirt(teams[el.team]?.code)} alt="" width="18" height="18" />
      <span style={{ minWidth: 0 }}>{el.name}</span>
    </span>
  );
}

/** Defensive contributions against goal threat, per 90, for one position. */
export function DefconChart({ players, sources, teams, squad = [], range, label }) {
  const [pos, setPos] = useState(2);
  const [view, setView] = useState('chart');
  const [maxCost, setMaxCost] = useState(null);
  const minMinutes = range === 'gw' ? 60 : range === 'last4' ? 180 : 360;
  const need = DC_NEED[pos];
  const ceiling = pos === 2 ? 8 : 13; // the price stepper's top, below which it starts
  const all = useMemo(() => defconRows(players, pos, minMinutes, sources), [players, pos, minMinutes, sources]);
  const rows = useMemo(() => all.filter((r) => maxCost == null || r.el.cost <= maxCost + 1e-9).sort((a, b) => b.value - a.value), [all, maxCost]);
  const mine = useMemo(() => new Set(squad), [squad]);
  // The curves and axes come from everyone at the position, so the price ceiling doesn't move them.
  const chart = useMemo(() => {
    const perXgi = pointsPerXgi(all, pos);
    const xMax = Math.max(need + 2, ...all.map((r) => r.dc90)) * 1.03;
    const yMax = Math.max(0.2, ...all.map((r) => r.xgi90)) * 1.06;
    const levels = range === 'gw' ? [] : samePointsLevels(all.map((r) => r.value));
    const lines = [
      // Drawn past the axis's end and clipped, so each curve runs to the edge with its label there.
      ...levels.map((l) => ({ id: `same${l}`, pts: samePointsLine(l, pos, perXgi, xMax * 1.6), label: `${l} pts`, kind: 'iso' })),
      { id: 'line', pts: [[need, 0], [need, yMax * 2]], label: `2 pts at ${need}`, kind: 'rule' },
    ];
    const top = new Set(rows.slice(0, 6).map((r) => r.id));
    const points = rows.map((r) => ({ id: r.id, x: r.dc90, y: r.xgi90, strong: mine.has(r.id), label: mine.has(r.id) || top.has(r.id) ? r.el.name : null, priority: (mine.has(r.id) ? 10 : 0) + r.value, r }));
    return { lines, points, levels, perXgi, x: { title: 'Defensive contributions per 90', zero: true, max: xMax }, y: { title: 'xGI per 90', zero: true, max: yMax } };
  }, [all, rows, pos, need, range, mine]);

  const yours = rows.filter((r) => mine.has(r.id));
  const [a, b, c] = rows;
  const posName = pos === 2 ? 'defenders' : 'midfielders';
  const tip = ({ r }) => (
    <>
      <div>
        <b>{r.el.name}</b> <span className="sp-muted">{teams[r.el.team]?.short} · £{r.el.cost.toFixed(1)}m · {(r.el.owned ?? 0).toFixed(1)}% own</span>
      </div>
      <div className="sp-num">
        <b>{r.dc90.toFixed(1)}</b> defensive contributions per 90{r.apps ? `; reached ${need} in ${r.hits} of ${r.apps} matches` : ''}
      </div>
      <div className="sp-num">
        <b>{r.xgi90.toFixed(2)}</b> xGI per 90 (xG {r.xg90.toFixed(2)}, xA {r.xa90.toFixed(2)})
      </div>
      <div className="sp-num">
        Worth <b>{r.value.toFixed(1)}</b> pts per 90: {r.def.toFixed(1)} from DEFCON, {r.att.toFixed(1)} from goals and assists
      </div>
    </>
  );

  return (
    <section className="sp-group" id="stats-defcon">
      <header className="sp-ghead">
        <h2 className="sp-h3">DEFCON and goal threat</h2>
        <Toggle value={pos} onChange={setPos} options={[[2, 'DEF'], [3, 'MID']]} label="Position for the chart" />
      </header>
      <div className="sp-pad sp-opt-ctl" style={{ marginBottom: 6 }}>
        <Toggle value={view} onChange={setView} options={[['chart', 'Chart'], ['table', 'Table']]} label="Show as" />
        <span className="sp-small">
          {maxCost == null ? 'Any price' : <>Up to <b className="sp-num">£{maxCost.toFixed(1)}m</b></>}
          <span className="sp-step" role="group" aria-label="Price ceiling for the chart">
            <button onClick={() => setMaxCost((v) => Math.max(4, (v ?? ceiling) - 0.5))} aria-label="Cheaper">−</button>
            <button onClick={() => setMaxCost((v) => (v == null || v + 0.5 > ceiling ? null : v + 0.5))} aria-label="Dearer">+</button>
          </span>
        </span>
      </div>
      {!rows.length ? (
        <p className="sp-empty sp-pad">No {posName} with {minMinutes} minutes over {label}{maxCost != null ? ` at £${maxCost.toFixed(1)}m or less` : ''}.</p>
      ) : view === 'chart' ? (
        <div className="sp-pad">
          {yours.length > 0 && (
            <p className="sp-tiny sp-ink2" style={{ display: 'flex', gap: 14, margin: '0 0 4px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i className="sp-dot" style={{ width: 9, height: 9, background: 'var(--sp-ink)' }} />Your players</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i className="sp-dot" style={{ width: 9, height: 9, background: 'var(--sp-muted)' }} />Everyone else</span>
            </p>
          )}
          <Scatter points={chart.points} lines={chart.lines} x={chart.x} y={chart.y} tip={tip} label={`${posName} by defensive contributions and xGI per 90 over ${label}`} />
        </div>
      ) : (
        <div className="sp-heat-wrap">
          <table className="sp-stat-t">
            <thead>
              <tr>
                <th className="l">Player</th>
                <th>DC/90</th>
                <th>Reached {need}</th>
                <th>xGI/90</th>
                <th>Pts/90</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th className="l"><Player el={r.el} teams={teams} /></th>
                  <td className="sp-num">{r.dc90.toFixed(1)}</td>
                  <td className="sp-num">{r.apps ? `${r.hits}/${r.apps}` : '–'}</td>
                  <td className="sp-num">{r.xgi90.toFixed(2)}</td>
                  <td className="sp-num">{r.value.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {a && (
        <p className="sp-small sp-pad" style={{ margin: '8px 0 0' }}>
          Best at both over {label}: <b>{a.el.name}</b> ({teams[a.el.team]?.short}, £{a.el.cost.toFixed(1)}m), worth <b className="sp-num">{a.value.toFixed(1)}</b> points per 90 from defensive contributions, goals and assists
          {b ? <>, then <b>{b.el.name}</b> {b.value.toFixed(1)}{c ? <> and <b>{c.el.name}</b> {c.value.toFixed(1)}</> : null}</> : null}.
          {yours.length > 0 && (
            <> Yours: {yours.slice(0, 4).map((r, i) => <span key={r.id}>{i ? ', ' : ''}{r.el.name} <b className="sp-num">{r.value.toFixed(1)}</b></span>)}.</>
          )}
        </p>
      )}
      <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>
        Per 90 minutes over {label}, {posName} with at least {minMinutes} minutes. Defensive contributions are clearances, blocks, interceptions and tackles{pos === 3 ? ', and recoveries' : ''}; FPL gives 2 points for {need} in a match, the line on the chart.
        {chart.levels.length > 0
          ? ` Each curve joins players worth the same per 90 from the two together (${chart.levels.join(', ')} points), by FPL's scoring and the same model our projections use for reaching ${need}; an xGI is worth about ${chart.perXgi.toFixed(1)} points at this position's mix of goals and assists. Up and to the right of a curve is worth more.`
          : ' One match is too few to say how often a player reaches it, so the curves that weigh the two together need Last 4 or Season.'}{' '}
        Clean sheets are the team’s doing: see club chances below.
      </p>
    </section>
  );
}

/** Every club's non-penalty xG and big chances per match, conceded or created. */
export function ChancesChart({ teams, gws }) {
  const [file, setFile] = useState(null);
  const [err, setErr] = useState(null);
  const [side, setSide] = useState('against');
  const [view, setView] = useState('chart');
  useEffect(() => {
    let on = true;
    chancesFor().then(
      (d) => on && setFile(d),
      (e) => on && setErr(e.message)
    );
    return () => {
      on = false;
    };
  }, []);

  const data = useMemo(() => {
    if (!file?.matches?.length) return null;
    const present = [...new Set(file.matches.map((m) => m[1]))].sort((x, y) => x - y);
    // A gameweek still being played isn't in the file yet: the latest one that is stands in.
    let use = gws ? gws.filter((g) => present.includes(g)) : present;
    if (!use.length) use = [present[present.length - 1]];
    const clubs = Object.values(clubChances(file, use)).filter((c) => teams[c.id] && c.n > 0);
    const against = side === 'against';
    const per = clubs.map((c) => ({ c, x: (against ? c.npxga : c.npxg) / c.n, y: (against ? c.bca : c.bc) / c.n }));
    const n = clubs.reduce((t, c) => t + c.n, 0);
    // Every match's xG is one club's for and the other's against, so the averages are the same both ways.
    const mx = clubs.reduce((t, c) => t + (against ? c.npxga : c.npxg), 0) / n;
    const my = clubs.reduce((t, c) => t + (against ? c.bca : c.bc), 0) / n;
    const spread = (v, m, all) => Math.abs(v - m) / (Math.max(...all.map((q) => Math.abs(q - m))) || 1);
    const points = per.map(({ c, x, y }) => ({
      id: c.id,
      x,
      y,
      image: shirt(teams[c.id].code),
      label: teams[c.id].short,
      priority: spread(x, mx, per.map((q) => q.x)) + spread(y, my, per.map((q) => q.y)),
      c,
    }));
    const lines = [
      { id: 'mx', pts: [[mx, -1e3], [mx, 1e3]], label: 'Average', kind: 'mean' },
      { id: 'my', pts: [[-1e3, my], [1e3, my]], kind: 'mean' },
    ];
    const ranked = [...per].sort((p, q) => (against ? p.x - q.x : q.x - p.x));
    const last = file.matches[file.matches.length - 1][0];
    return { use, points, lines, ranked, last, x: { title: against ? 'Non-penalty xG conceded per match' : 'Non-penalty xG per match' }, y: { title: against ? 'Big chances conceded per match' : 'Big chances per match' } };
  }, [file, gws, side, teams]);

  const against = side === 'against';
  const name = (c) => teams[c.id]?.name ?? teams[c.id]?.short;
  const tip = ({ c, x, y }) => (
    <>
      <div><b>{name(c)}</b> <span className="sp-muted">{c.n} {c.n === 1 ? 'match' : 'matches'}</span></div>
      <div className="sp-num"><b>{x.toFixed(2)}</b> non-penalty xG {against ? 'conceded ' : ''}a match ({(against ? c.npxga : c.npxg).toFixed(1)} in all)</div>
      <div className="sp-num"><b>{y.toFixed(1)}</b> big chances {against ? 'conceded ' : ''}a match ({against ? c.bca : c.bc} in all)</div>
      <div className="sp-num"><b>{against ? c.ga : c.gf}</b> goals {against ? 'conceded' : 'scored'}</div>
    </>
  );

  return (
    <section className="sp-group" id="stats-chances">
      <header className="sp-ghead">
        <h2 className="sp-h3">Club chances</h2>
        <Toggle value={side} onChange={setSide} options={[['against', 'Conceded'], ['for', 'Created']]} label="Which end" />
      </header>
      <div className="sp-pad sp-opt-ctl" style={{ marginBottom: 6 }}>
        <Toggle value={view} onChange={setView} options={[['chart', 'Chart'], ['table', 'Table']]} label="Show as" />
        {data && <span className="sp-tiny sp-muted">{gws ? range2(data.use) : `The season, ${range2(data.use)}`}</span>}
      </div>
      {!data ? (
        err || file ? <p className="sp-empty sp-pad">{err ? `Couldn’t load the clubs’ chances (${err}).` : 'No matches yet this season.'}</p> : <div className="sp-skel" style={{ height: 340, margin: '0 16px' }} />
      ) : view === 'chart' ? (
        <div className="sp-pad">
          <Scatter
            points={data.points}
            lines={data.lines}
            corners={against ? { bl: 'Better', tr: 'Worse' } : { tr: 'Better', bl: 'Worse' }}
            x={data.x}
            y={data.y}
            tip={tip}
            label={`Clubs by non-penalty xG and big chances ${against ? 'conceded' : 'created'} per match`}
          />
        </div>
      ) : (
        <div className="sp-heat-wrap">
          <table className="sp-stat-t">
            <thead>
              <tr>
                <th className="l">Club</th>
                <th>Matches</th>
                <th>npxG{against ? 'A' : ''}</th>
                <th>Big chances</th>
                <th>Goals</th>
              </tr>
            </thead>
            <tbody>
              {data.ranked.map(({ c, x, y }) => (
                <tr key={c.id}>
                  <th className="l">
                    <span className="sp-heat-name">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={shirt(teams[c.id]?.code)} alt="" width="18" height="18" />
                      <span>{name(c)}</span>
                    </span>
                  </th>
                  <td className="sp-num">{c.n}</td>
                  <td className="sp-num">{x.toFixed(2)}</td>
                  <td className="sp-num">{y.toFixed(1)}</td>
                  <td className="sp-num">{((against ? c.ga : c.gf) / c.n).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <p className="sp-small sp-pad" style={{ margin: '8px 0 0' }}>
          {against ? 'Tightest' : 'Most dangerous'}: <b>{name(data.ranked[0].c)}</b>, {data.ranked[0].x.toFixed(2)} non-penalty xG and {data.ranked[0].y.toFixed(1)} big chances {against ? 'conceded ' : ''}a match. {against ? 'Loosest' : 'Least'}:{' '}
          <b>{name(data.ranked[data.ranked.length - 1].c)}</b>, {data.ranked[data.ranked.length - 1].x.toFixed(2)} and {data.ranked[data.ranked.length - 1].y.toFixed(1)}.
        </p>
      )}
      <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>
        Per match, in Opta’s numbers: xG added up from FPL’s players, big chances from the Premier League’s match stats{data ? `, every match to ${shortDate(data.last)}` : ''}. A big chance is one a player should be expected to score, usually one on one or from very close in.
        Penalties come off both (Opta counts each as a big chance worth 0.79 xG): they come and go, and say little about how a team defends. {against ? 'Down and to the left, a defence gives away less: better for its keeper’s and defenders’ clean sheets.' : 'Up and to the right, an attack makes more and better chances.'} The lines are the league’s averages.
      </p>
    </section>
  );
}
