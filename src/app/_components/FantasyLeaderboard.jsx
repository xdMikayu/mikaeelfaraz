'use client';
import { useMemo, useState } from 'react';
import { netBoard } from '@/lib/sport/netxg.mjs';
import { ROLE_SHORT } from '@/lib/sport/matchups.mjs';
import { useNetXgData } from './matchupData';
import { shirt } from './fplbits';

const SORTS = [
  ['xg', 'Net xG'],
  ['xa', 'Net xA'],
  ['xgi', 'Net xGI'],
];
const times = (x) => `×${x.toFixed(2)}`;

/**
 * Net xG leaderboard for one gameweek: each player's usual xG rate, moved up or down by form, the
 * opponent's defence, venue, how much of the opponent's concessions go to his position, his own
 * record against them, and his likely minutes. Tap a player for the step-by-step breakdown.
 */
export default function Leaderboard({ st, fixtures, gw, ctx, teams, kit }) {
  const nx = useNetXgData();
  const [sortBy, setSortBy] = useState('xg');
  const [pos, setPos] = useState(0);
  const [open, setOpen] = useState(null);
  const all = useMemo(() => (kit && nx.data ? netBoard(st.elements, fixtures, gw, ctx, kit, nx.data.players) : null), [kit, nx.data, st, fixtures, gw, ctx]);

  if (nx.error) return <p className="sp-empty">Couldn’t load the Net xG data ({nx.error}).</p>;
  if (!all) return <div className="sp-skel" style={{ height: 500, margin: 16 }} />;
  if (!all.length) return <p className="sp-empty">No matches left to project in gameweek {gw}.</p>;
  const list = all
    .filter((p) => !pos || p.el.type === pos)
    .sort((a, b) => b[sortBy] - a[sortBy])
    .slice(0, 30);
  const top = list[0]?.[sortBy] || 1;
  const which = sortBy === 'xa' ? 'a' : 'g';

  return (
    <section className="sp-group" style={{ marginTop: 6 }}>
      <header className="sp-ghead" style={{ display: 'block' }}>
        <h2 className="sp-h3">Net xG, gameweek {gw}</h2>
        <p className="sp-tiny sp-muted" style={{ margin: '2px 0 0' }}>
          One number for the xG each player should get this week: his usual rate, then form, opponent, venue, position, history and minutes. Tap a player to see each step.
        </p>
      </header>
      <div className="sp-pad sp-lb-ctl">
        <div className="sp-tabs" role="radiogroup" aria-label="Rank by" style={{ border: 0, gap: 12 }}>
          {SORTS.map(([k, l]) => (
            <button key={k} role="radio" aria-checked={sortBy === k} onClick={() => setSortBy(k)} style={{ height: 30, fontSize: 13.5 }}>{l}</button>
          ))}
        </div>
        <div className="sp-tabs" role="radiogroup" aria-label="Position" style={{ border: 0, gap: 10 }}>
          {[[0, 'All'], [2, 'DEF'], [3, 'MID'], [4, 'FWD']].map(([k, l]) => (
            <button key={k} role="radio" aria-checked={pos === k} onClick={() => setPos(k)} style={{ height: 30, fontSize: 12.5 }}>{l}</button>
          ))}
        </div>
      </div>

      {list.map((p, i) => {
        const role = ctx.model.role?.(p.id);
        const first = p.parts[0];
        const fs = first[which].factors;
        const isOpen = open === p.id;
        return (
          <div key={p.id} className="sp-nx-row">
            <button className="sp-nx-head" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}>
              <span className="sp-num sp-muted sp-lb-n">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shirt(teams[p.el.team]?.code)} alt="" width="22" height="22" />
              <span style={{ minWidth: 0 }}>
                <b className="sp-dif-name" style={{ display: 'block' }}>{p.el.name}</b>
                <span className="sp-tiny sp-muted sp-dif-line">
                  v {p.parts.map((x) => `${teams[x.f.home === p.el.team ? x.f.away : x.f.home]?.short} (${x.f.home === p.el.team ? 'H' : 'A'})`).join(', ')}
                  {role ? ` · ${ROLE_SHORT[role]}` : ''}
                </span>
                <span className="sp-nx-chips">
                  {fs.filter((f) => f.key !== 'minutes').map((f) => (
                    <span key={f.key} className={f.x >= 1.05 ? 'up' : f.x <= 0.95 ? 'down' : ''}>{f.label} {times(f.x)}</span>
                  ))}
                </span>
              </span>
              <span className="sp-nx-val">
                <b className="sp-num">{p[sortBy].toFixed(2)}</b>
                <span className="sp-nx-bar"><i style={{ width: `${(p[sortBy] / top) * 100}%` }} /></span>
                <span className="sp-tiny sp-muted sp-num">{sortBy === 'xg' ? `xA ${p.xa.toFixed(2)}` : `xG ${p.xg.toFixed(2)}`}</span>
              </span>
            </button>
            {isOpen && <Breakdown parts={p.parts} which={which} teams={teams} el={p.el} />}
          </div>
        );
      })}
      <p className="sp-tiny sp-muted sp-pad" style={{ margin: '10px 0 0' }}>
        How it’s built. Base: his {sortBy === 'xa' ? 'xA' : 'xG'} per 90 from this season’s Opta numbers, his last two years of match data and his position’s average, weighted by minutes. Form: his last five matches against his usual rate. Opponent: how much xG they concede, from team ratings since 2023/24. Venue: the league’s home advantage. Position: how much of what they concede goes to his position, regardless of how much they concede overall. History: his record against them, heavily shrunk. Minutes: from his starts and FPL’s availability flag. Each factor is pulled towards ×1.00 when its sample is small. Matches already played this gameweek aren’t counted. Our estimate.
      </p>
    </section>
  );
}

/** Step by step from his usual rate to this week's number, as a running bar. */
function Breakdown({ parts, which, teams, el }) {
  return (
    <div className="sp-nx-break">
      {parts.map(({ f, ...rest }) => {
        const r = rest[which];
        let run = r.base90;
        const steps = [{ label: 'Usual rate', x: null, note: 'per 90 minutes', v: run }];
        for (const fx of r.factors) {
          run *= fx.x;
          steps.push({ label: fx.label, x: fx.x, note: fx.note, v: run });
        }
        const max = Math.max(...steps.map((s) => s.v), 0.01);
        return (
          <div key={f.id}>
            {parts.length > 1 && <p className="sp-tiny" style={{ margin: '6px 0 2px', fontWeight: 800 }}>v {teams[f.home === el.team ? f.away : f.home]?.name}</p>}
            {steps.map((s, i) => (
              <div key={s.label} className="sp-wf">
                <span className="sp-tiny" style={{ fontWeight: 750 }}>{s.label}</span>
                <span className="sp-tiny sp-num sp-wf-x">{s.x == null ? '' : times(s.x)}</span>
                <span className="sp-wf-track"><i style={{ width: `${(s.v / max) * 100}%`, opacity: i === steps.length - 1 ? 1 : 0.45 }} /></span>
                <span className="sp-tiny sp-num" style={{ fontWeight: i === steps.length - 1 ? 900 : 650 }}>{s.v.toFixed(2)}</span>
                <span className="sp-tiny sp-muted sp-wf-note">{s.note}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
