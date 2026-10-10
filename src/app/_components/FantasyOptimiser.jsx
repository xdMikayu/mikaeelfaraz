'use client';
import { useMemo, useState } from 'react';
import { planTransfers, buildSquad, rotationPairs, bestXI, estimateFree } from '@/lib/sport/optimise.mjs';
import { shirt, one, Face } from './fplbits';

const MODES = [
  ['conservative', 'Conservative', 'never takes a hit'],
  ['balanced', 'Balanced', 'a −4 when it pays, one a week at most'],
  ['aggressive', 'Aggressive', 'up to two hits a week'],
];

function Stepper({ value, set, min, max, label }) {
  return (
    <span className="sp-step" role="group" aria-label={label}>
      <button onClick={() => set(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label}`}>−</button>
      <b className="sp-num">{value}</b>
      <button onClick={() => set(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label}`}>+</button>
    </span>
  );
}

const Mini = ({ id, els, teams, size = 26 }) => {
  const el = els[id];
  return (
    <span className="sp-opt-p">
      <Face el={el} teams={teams} size={size} />
      <span style={{ minWidth: 0 }}>
        <b className="sp-dif-name" style={{ display: 'block', fontSize: 13.5 }}>{el.name}</b>
        <span className="sp-tiny sp-muted" style={{ whiteSpace: 'nowrap' }}>{teams[el.team]?.short} · £{el.cost.toFixed(1)}m</span>
      </span>
    </span>
  );
};

/** Multi-gameweek transfer plan with free transfers, hits and three risk settings. */
export function TransferPlan({ squad, bank, entry, gws, ahead, els, teams }) {
  const estimate = useMemo(() => estimateFree(entry.history ?? [], entry.chips ?? [], gws[0] - 1), [entry, gws]);
  const [free, setFree] = useState(estimate);
  const [mode, setMode] = useState('balanced');
  const result = useMemo(() => planTransfers({ squad, bank, free, gws, ahead, els, mode }), [squad.join(','), bank, free, gws.join(','), ahead, els, mode]);
  return (
    <section className="sp-panel">
      <h2 className="sp-h2">Transfer plan, gameweeks {gws[0]}–{gws[gws.length - 1]}</h2>
      <p className="sp-small sp-ink2" style={{ margin: '4px 0 10px' }}>
        The moves that add the most projected points over the whole run, gameweek by gameweek, counting free transfers carried over (up to five), hits, your bank and three per club.
      </p>
      <div className="sp-opt-ctl">
        <span className="sp-small">
          Free transfers <Stepper value={free} set={setFree} min={0} max={5} label="free transfers" />
          <span className="sp-tiny sp-muted"> {free === estimate ? 'our estimate from your history' : `we estimated ${estimate}`}</span>
        </span>
        <div className="sp-tabs" role="radiogroup" aria-label="Risk" style={{ border: 0, gap: 12 }}>
          {MODES.map(([k, l, d]) => (
            <button key={k} role="radio" aria-checked={mode === k} onClick={() => setMode(k)} title={d} style={{ height: 30, fontSize: 13 }}>{l}</button>
          ))}
        </div>
      </div>
      <p className="sp-small" style={{ margin: '10px 0 4px' }}>
        <b className="sp-num" style={{ fontSize: 20 }}>{one(result.total)}</b> projected with this plan against {one(result.hold)} if you make no transfers:{' '}
        <b className={result.gain > 0.05 ? 'sp-up' : ''}>{result.gain > 0.05 ? `+${one(result.gain)}` : 'no gain'}</b>.
      </p>
      {result.plan.map((p) => (
        <div key={p.gw} className="sp-opt-gw">
          <span className="sp-opt-gwn">
            <b>GW{p.gw}</b>
            <span className="sp-tiny sp-muted sp-num">{one(p.points)} pts{p.hit ? `, −${p.hit}` : ''}</span>
          </span>
          <span style={{ minWidth: 0 }}>
            {p.moves.length === 0 ? (
              <span className="sp-small sp-muted">Save the transfer</span>
            ) : (
              p.moves.map((m) => (
                <span key={`${m.out}-${m.in}`} className="sp-opt-move">
                  <Mini id={m.out} els={els} teams={teams} size={24} />
                  <span className="sp-xfer-arrow" aria-hidden>→</span>
                  <Mini id={m.in} els={els} teams={teams} size={24} />
                </span>
              ))
            )}
          </span>
        </div>
      ))}
      <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>
        {MODES.find(([k]) => k === mode)[2]}. Prices are today’s: FPL keeps your selling prices private, and prices will move. Points per gameweek count your best eleven with the captain doubled.
      </p>
    </section>
  );
}

/** Rate my team against the best squad your budget allows, plus wildcard and free-hit drafts. */
export function Chips({ squad, bank, gws, ahead, els, teams }) {
  const budget = squad.reduce((t, id) => t + els[id].cost, 0) + bank;
  const hold = useMemo(() => gws.reduce((t, gw) => t + bestXI(squad, gw, ahead, els).points, 0), [squad.join(','), gws.join(','), ahead, els]);
  const wc = useMemo(() => buildSquad({ budget, gws, ahead, els }), [budget, gws.join(','), ahead, els]);
  const fh = useMemo(() => buildSquad({ budget, gws: [gws[0]], ahead, els }), [budget, gws[0], ahead, els]);
  const holdFirst = bestXI(squad, gws[0], ahead, els).points;
  const score = Math.round((hold / wc.value) * 100);
  const draft = (s, title, note) => {
    const keep = new Set(squad);
    const by = [1, 2, 3, 4].map((t) => s.squad.filter((id) => els[id].type === t).sort((a, b) => els[b].cost - els[a].cost));
    return (
      <section className="sp-panel">
        <div className="sp-section-head">
          <h2 className="sp-h2">{title}</h2>
          <span className="sp-small sp-num">£{s.cost.toFixed(1)}m of £{budget.toFixed(1)}m</span>
        </div>
        <p className="sp-small sp-ink2" style={{ margin: '0 0 8px' }}>{note}</p>
        <div className="sp-opt-draft">
          {by.map((list, i) => (
            <div key={i}>
              <h3 className="sp-tiny sp-muted" style={{ margin: '6px 0 2px', fontWeight: 800 }}>{['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards'][i]}</h3>
              {list.map((id) => (
                <div key={id} className="sp-opt-row">
                  <Mini id={id} els={els} teams={teams} size={24} />
                  {keep.has(id) && <span className="sp-tiny sp-muted">yours</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  };
  return (
    <>
      <section className="sp-panel">
        <h2 className="sp-h2">Rate my team</h2>
        <div className="sp-rate">
          <b className="sp-num">{score}</b>
          <span className="sp-small sp-ink2">
            out of 100: your squad projects <b style={{ color: 'var(--sp-ink)' }}>{one(hold)}</b> points over gameweeks {gws[0]}–{gws[gws.length - 1]}; the best squad your £{budget.toFixed(1)}m buys projects {one(wc.value)}.
          </span>
        </div>
        <span className="sp-cmp-track" style={{ display: 'block', marginTop: 8 }}><i style={{ width: `${Math.min(100, score)}%` }} /></span>
        <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>Gameweek {gws[0]} alone: {one(holdFirst)} against {one(fh.value)} for the best free-hit team.</p>
      </section>
      {draft(wc, 'Wildcard draft', `The fifteen that project most over gameweeks ${gws[0]}–${gws[gws.length - 1]}: ${one(wc.value)} points, ${one(wc.value - hold)} more than your squad.`)}
      {draft(fh, `Free hit draft, gameweek ${gws[0]}`, `The fifteen that project most for gameweek ${gws[0]} alone: ${one(fh.value)} points, ${one(fh.value - holdFirst)} more than your squad that week.`)}
    </>
  );
}

const ROT = [
  [1, 'Goalkeepers', 4.5],
  [2, 'Defenders', 4.5],
  [3, 'Midfielders', 5.5],
  [4, 'Forwards', 6.0],
];

/** Two cheap players from clubs whose fixtures alternate: start whichever has the better week. */
export function Rotations({ gws, ahead, els, teams, teamsPlayed }) {
  const [type, setType] = useState(2);
  const preset = ROT.find((r) => r[0] === type);
  const [cap, setCap] = useState(preset[2]);
  const r = useMemo(() => rotationPairs({ type, maxCost: cap, gws, ahead, els, teamsPlayed }), [type, cap, gws.join(','), ahead, els, teamsPlayed]);
  return (
    <section className="sp-panel">
      <h2 className="sp-h2">Fixture rotation</h2>
      <p className="sp-small sp-ink2" style={{ margin: '4px 0 10px' }}>
        For the last spots in your eleven: two cheap regular starters from clubs whose fixtures alternate, so one of them always has the better week. Each week, start whichever projects higher.
      </p>
      <div className="sp-opt-ctl">
        <div className="sp-tabs" role="radiogroup" aria-label="Position" style={{ border: 0, gap: 12 }}>
          {ROT.map(([t, l, c]) => (
            <button key={t} role="radio" aria-checked={type === t} onClick={() => { setType(t); setCap(c); }} style={{ height: 30, fontSize: 13 }}>{l}</button>
          ))}
        </div>
        <span className="sp-small">
          Up to <b className="sp-num">£{cap.toFixed(1)}m</b> each{' '}
          <span className="sp-step" role="group" aria-label="Price ceiling">
            <button onClick={() => setCap((c) => Math.max(3.9, Math.round((c - 0.5) * 10) / 10))} aria-label="Cheaper">−</button>
            <button onClick={() => setCap((c) => Math.round((c + 0.5) * 10) / 10)} aria-label="Dearer">+</button>
          </span>
        </span>
      </div>
      {r.pairs.length === 0 && <p className="sp-small" style={{ marginTop: 10 }}>No pair of regular starters under £{cap.toFixed(1)}m rotates well over these gameweeks. Try a higher ceiling.</p>}
      {r.pairs.map((p, i) => (
        <div key={`${p.a}-${p.b}`} className="sp-rot">
          <div className="sp-rot-head">
            <span className="sp-num sp-muted" style={{ fontWeight: 800 }}>{i + 1}</span>
            <Mini id={p.a} els={els} teams={teams} size={24} />
            <span className="sp-muted">+</span>
            <Mini id={p.b} els={els} teams={teams} size={24} />
            <span className="sp-rot-val"><b className="sp-num">{one(p.total)}</b><span className="sp-tiny sp-muted">£{p.cost.toFixed(1)}m</span></span>
          </div>
          <div className="sp-rot-weeks">
            {p.weeks.map((w) => {
              const pick = els[w.pick];
              return (
                <span key={w.gw} title={`GW${w.gw}: ${els[p.a].name} ${one(w.a)}, ${els[p.b].name} ${one(w.b)}`}>
                  <span className="sp-tiny sp-muted">GW{w.gw}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shirt(teams[pick.team]?.code, pick.type === 1)} alt="" width="20" height="20" />
                  <b className="sp-tiny sp-num">{one(w.best)}</b>
                </span>
              );
            })}
          </div>
        </div>
      ))}
      {r.single && (
        <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>
          For comparison, the best single option under £{cap.toFixed(1)}m, {els[r.single].name} ({teams[els[r.single].team]?.short}), projects {one(r.singleTotal)} on his own
          {r.pairs[0] && r.singleTotal >= r.pairs[0].total ? ', more than any rotation, so he may be the simpler pick.' : '.'} Regular starters only: at least 60% of their club’s matches started.
        </p>
      )}
    </section>
  );
}
