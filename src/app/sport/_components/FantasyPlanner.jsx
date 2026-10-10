'use client';
import { useMemo, useState } from 'react';
import { projectAhead, returnOdds, suggestTransfers } from '@/lib/sport/fpl.mjs';
import { ROLE_NAME } from '@/lib/sport/matchups.mjs';
import { shirt, one, heat, Face } from './fplbits';

const pct = (p) => (p < 0.01 ? '<1%' : p > 0.99 ? '>99%' : `${Math.round(p * 100)}%`);
const shade = (v, max) => Math.max(0, Math.min(1, v / max));
const oppLabel = (teams, f) => `${teams[f.opp]?.short ?? ''}${f.home ? '' : ' (A)'}`;

/** The weeks ahead: projected points, captaincy, transfers and fixtures, all from our model. */
export default function Planner({ st, ctx, teams, picks, bank, fixtures, kit }) {
  const [horizon, setHorizon] = useState(5);
  const [ticker, setTicker] = useState('att');
  // Plan from the next deadline: the current gameweek once it has started, else this one.
  const cur = st.events.find((e) => e.current);
  const curStarted = fixtures.some((f) => f.event === cur?.id && f.started);
  const start = cur && !curStarted ? cur.id : (st.events.find((e) => e.next)?.id ?? (cur?.id ?? 1) + 1);
  const gws = Array.from({ length: horizon }, (_, i) => start + i).filter((g) => g <= 38);
  const squad = picks.map((p) => p.element);
  const ahead = useMemo(() => projectAhead(st.elements.map((e) => e.id), fixtures, gws, ctx), [st, fixtures, gws.join(','), ctx]);
  const transfers = useMemo(() => suggestTransfers(squad, bank, ahead, ctx), [squad.join(','), bank, ahead, ctx]);
  if (!gws.length) return <p className="sp-empty">The season is over: nothing left to plan.</p>;

  const first = gws[0];
  const rows = [...picks].sort((a, b) => a.position - b.position);
  const maxCell = 9;
  const captains = squad
    .map((id) => ({ id, a: ahead[id], g: ahead[id]?.per[first] }))
    .filter((c) => c.g?.fx.length)
    .sort((a, b) => b.g.xp - a.g.xp)
    .slice(0, 5);

  // Fixture ticker: each club's expected goals for (attackers) or against (defenders) per gameweek.
  const fxByTeam = {};
  for (const f of fixtures) {
    if (!gws.includes(f.event) || f.started) continue;
    for (const side of ['home', 'away']) {
      const t = f[side];
      const r = kit?.ratings && ctx.model.rates?.(f.home, f.away);
      const forG = r ? (side === 'home' ? r.home : r.away) : null;
      const agst = r ? (side === 'home' ? r.away : r.home) : null;
      ((fxByTeam[t] ??= {})[f.event] ??= []).push({ opp: side === 'home' ? f.away : f.home, home: side === 'home', forG, agst });
    }
  }
  const tickerRows = st.teams
    .map((t) => {
      const per = gws.map((g) => fxByTeam[t.id]?.[g] ?? []);
      const score = per.flat().reduce((s, x) => s + (ticker === 'att' ? x.forG ?? 0 : -(x.agst ?? 0)), 0);
      return { t, per, score };
    })
    .sort((a, b) => b.score - a.score);

  const watch = [1, 2, 3, 4].map((type) => ({
    type,
    list: st.elements
      .filter((e) => e.type === type && ahead[e.id] && e.status !== 'u')
      .sort((a, b) => ahead[b.id].total - ahead[a.id].total)
      .slice(0, 5),
  }));

  return (
    <div style={{ marginTop: 12 }}>
      <div className="sp-pad sp-section-head">
        <p className="sp-small sp-ink2" style={{ margin: 0 }}>
          Gameweeks <b style={{ color: 'var(--sp-ink)' }}>{gws[0]}–{gws[gws.length - 1]}</b>, projected
        </p>
        <div className="sp-tabs" role="radiogroup" aria-label="How far ahead" style={{ border: 0, gap: 14 }}>
          {[3, 5, 8].map((n) => (
            <button key={n} role="radio" aria-checked={horizon === n} onClick={() => setHorizon(n)} style={{ height: 30, fontSize: 13.5 }}>{n} GWs</button>
          ))}
        </div>
      </div>

      <section className="sp-panel">
        <h2 className="sp-h2">Captain for gameweek {first}</h2>
        <p className="sp-small sp-ink2" style={{ margin: '4px 0 6px' }}>Your players by projected points. Returns are the chance of at least one goal or assist; a haul, two or more.</p>
        {captains.map((c, i) => {
          const el = ctx.elements[c.id];
          const g = c.g;
          const odds = returnOdds(g.xg, g.xa);
          const f = g.fx[0];
          const role = kit && ctx.model.role?.(c.id);
          const rf = f?.roleF ?? 1;
          return (
            <div key={c.id} className="sp-cap">
              <span className="sp-cap-n sp-num">{i + 1}</span>
              <Face el={el} teams={teams} />
              <span style={{ minWidth: 0 }}>
                <b className="sp-dif-name" style={{ display: 'block' }}>{el.name}</b>
                <span className="sp-tiny sp-muted sp-dif-line">
                  {g.fx.map((x) => oppLabel(teams, x)).join(', ')} · xG {g.xg.toFixed(2)} · xA {g.xa.toFixed(2)}
                  {g.cs != null && el.type <= 2 ? ` · clean sheet ${pct(g.cs)}` : ''}
                </span>
                {role && Math.abs(rf - 1) >= 0.04 && (
                  <span className="sp-tiny sp-ink2" style={{ display: 'block', marginTop: 2 }}>
                    {ROLE_NAME[role]} get {Math.round(Math.abs(rf - 1) * 100)}% {rf > 1 ? 'more' : 'less'} of what {teams[f.opp]?.name} concede than usual
                  </span>
                )}
              </span>
              <span className="sp-cap-r">
                <b className="sp-num">{one(g.xp * 2)}</b>
                <span className="sp-tiny sp-muted">as captain</span>
                <span className="sp-tiny sp-ink2 sp-num">return {pct(odds.any)} · haul {pct(odds.two)}</span>
              </span>
            </div>
          );
        })}
      </section>

      <section className="sp-group">
        <header className="sp-ghead" style={{ display: 'block' }}>
          <h2 className="sp-h3">Your squad, projected</h2>
          <p className="sp-tiny sp-muted" style={{ margin: '2px 0 0' }}>Expected points per gameweek, darker is more. Opponents in capitals at home.</p>
        </header>
        <div className="sp-heat-wrap">
          <table className="sp-heat">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Player</th>
                {gws.map((g) => <th key={g}>GW{g}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const el = ctx.elements[p.element];
                const a = ahead[p.element];
                if (!el || !a) return null;
                return (
                  <tr key={p.element} className={p.position > 11 ? 'sp-off' : ''}>
                    <th>
                      <span className="sp-heat-name">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={shirt(teams[el.team]?.code, el.type === 1)} alt="" width="18" height="18" />
                        {el.name}
                      </span>
                    </th>
                    {gws.map((g) => {
                      const c = a.per[g];
                      if (!c.fx.length) return <td key={g} className="sp-heat-blank">–</td>;
                      return (
                        <td key={g} style={heat(shade(c.xp, maxCell))} title={`${c.fx.map((x) => oppLabel(teams, x)).join(', ')}: ${one(c.xp)}`}>
                          <span className="sp-heat-opp">{c.fx.map((x) => (x.home ? teams[x.opp]?.short : teams[x.opp]?.short.toLowerCase())).join(' ')}</span>
                          <b className="sp-num">{one(c.xp)}</b>
                        </td>
                      );
                    })}
                    <td className="sp-heat-total sp-num">{one(a.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sp-panel">
        <h2 className="sp-h2">Transfers worth a look</h2>
        <p className="sp-small sp-ink2" style={{ margin: '4px 0 6px' }}>
          Single swaps that add the most projected points over {gws.length} gameweeks, within your £{bank.toFixed(1)}m in the bank and three per club. Prices are today’s; FPL keeps your selling prices private.
        </p>
        {transfers.length === 0 && <p className="sp-small" style={{ margin: '8px 0 0' }}>Nothing gains half a point or more. Your squad already looks right for these fixtures.</p>}
        {transfers.map((t) => {
          const o = ctx.elements[t.out];
          const n = ctx.elements[t.in];
          return (
            <div key={`${t.out}-${t.in}`} className="sp-xfer">
              <span className="sp-xfer-p">
                <Face el={o} teams={teams} size={32} />
                <span style={{ minWidth: 0 }}>
                  <span className="sp-tiny sp-muted" style={{ display: 'block', fontWeight: 700 }}>Out</span>
                  <b className="sp-dif-name">{o.name}</b>
                  <span className="sp-tiny sp-muted sp-dif-line sp-num">{one(ahead[t.out].total)} · £{o.cost.toFixed(1)}m</span>
                </span>
              </span>
              <span className="sp-xfer-arrow" aria-hidden>→</span>
              <span className="sp-xfer-p">
                <Face el={n} teams={teams} size={32} />
                <span style={{ minWidth: 0 }}>
                  <span className="sp-tiny sp-muted" style={{ display: 'block', fontWeight: 700 }}>In · {n.owned}%</span>
                  <b className="sp-dif-name">{n.name}</b>
                  <span className="sp-tiny sp-muted sp-dif-line sp-num">{one(ahead[t.in].total)} · £{n.cost.toFixed(1)}m</span>
                </span>
              </span>
              <b className="sp-xfer-gain sp-num sp-up">+{one(t.gain)}</b>
            </div>
          );
        })}
      </section>

      <section className="sp-group">
        <header className="sp-ghead">
          <h2 className="sp-h3">Fixtures ahead</h2>
          <div className="sp-tabs" role="radiogroup" aria-label="Rank fixtures for" style={{ border: 0, gap: 14 }}>
            <button role="radio" aria-checked={ticker === 'att'} onClick={() => setTicker('att')} style={{ height: 28, fontSize: 13 }}>Attack</button>
            <button role="radio" aria-checked={ticker === 'def'} onClick={() => setTicker('def')} style={{ height: 28, fontSize: 13 }}>Defence</button>
          </div>
        </header>
        <p className="sp-tiny sp-muted sp-pad" style={{ margin: '0 0 6px' }}>
          {ticker === 'att' ? 'Goals each club is expected to score; darker is more.' : 'Goals each club is expected to concede; darker is fewer, better for clean sheets.'} From our ratings on every match since 2023/24.
        </p>
        <div className="sp-heat-wrap">
          <table className="sp-heat sp-ticker">
            <tbody>
              {tickerRows.map(({ t, per }) => (
                <tr key={t.id}>
                  <th>
                    <span className="sp-heat-name">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={shirt(t.code)} alt="" width="18" height="18" />
                      {t.short}
                    </span>
                  </th>
                  {per.map((list, i) => (
                    <td key={i} style={list.length ? heat(ticker === 'att' ? shade(list.reduce((s, x) => s + (x.forG ?? 0), 0) - 0.6, 1.6) : shade(2.2 - list.reduce((s, x) => s + (x.agst ?? 0), 0) / Math.max(1, list.length), 1.6)) : undefined} className={list.length ? '' : 'sp-heat-blank'}>
                      {list.length ? (
                        <>
                          <span className="sp-heat-opp">{list.map((x) => (x.home ? teams[x.opp]?.short : teams[x.opp]?.short.toLowerCase())).join(' ')}</span>
                          <b className="sp-num">{list.map((x) => (ticker === 'att' ? x.forG : x.agst)?.toFixed(1) ?? '–').join(' ')}</b>
                        </>
                      ) : '–'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sp-panel">
        <h2 className="sp-h2">Best projected over {gws.length} gameweeks</h2>
        <div className="sp-watch">
          {watch.map(({ type, list }) => (
            <div key={type}>
              <h3 className="sp-h3" style={{ margin: '12px 0 4px' }}>{{ 1: 'Goalkeepers', 2: 'Defenders', 3: 'Midfielders', 4: 'Forwards' }[type]}</h3>
              {list.map((e) => (
                <div key={e.id} className="sp-watch-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shirt(teams[e.team]?.code, e.type === 1)} alt="" width="22" height="22" />
                  <span className="sp-dif-name" style={{ fontSize: 14 }}>{e.name}{squad.includes(e.id) ? <span className="sp-tiny sp-muted"> · yours</span> : e.owned < 10 ? <span className="sp-tiny sp-muted"> · {e.owned}% owned</span> : null}</span>
                  <span className="sp-tiny sp-muted sp-num">£{e.cost.toFixed(1)}m</span>
                  <b className="sp-num">{one(ahead[e.id].total)}</b>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <p className="sp-note sp-pad" style={{ margin: '12px 0 0' }}>
        Our projections, not FPL’s. Goal rates come from team ratings fitted on every Premier League match since 2023/24 (xG and goals, recent matches weighted more); each player’s share from his xG and xA per 90 and how often he starts;
        {kit ? ' then tilted by how much of what each opponent concedes usually goes to his position.' : ' matchup data is still loading.'} Rotation, injuries after today and price changes aren’t modelled.
      </p>
    </div>
  );
}
