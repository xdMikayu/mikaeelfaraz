'use client';
import { useState } from 'react';
import { POS } from '@/lib/sport/fpl.mjs';
import { estimateFree } from '@/lib/sport/optimise.mjs';
import { Face, one } from './fplbits';

const CHIP = { none: 'No chip', wildcard: 'Wildcard', freehit: 'Free Hit', bboost: 'Bench Boost', '3xc': 'Triple Captain' };
const when = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * One button: Claude reads your squad, free transfers, bank and chips next to our projections and
 * the optimiser's plans, and says what to do before the deadline and why. Checked against the rules
 * on the server before it's shown.
 */
export default function Advice({ entry, gw, els, teams }) {
  const estimate = estimateFree(entry.history ?? [], entry.chips ?? [], gw - 1);
  const [free, setFree] = useState(estimate);
  const [state, setState] = useState({ loading: false, error: null, data: null });
  const ask = async () => {
    setState({ loading: true, error: null, data: null });
    try {
      const res = await fetch(`/api/sport/advice?id=${entry.id}&ft=${free}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Advice failed (${res.status})`);
      setState({ loading: false, error: null, data: body });
    } catch (e) {
      setState({ loading: false, error: e.message, data: null });
    }
  };
  const d = state.data;
  const a = d?.advice;
  const name = (id) => els[id]?.name ?? id;
  return (
    <section className="sp-panel sp-ai">
      <div className="sp-section-head">
        <h2 className="sp-h2">AI advice for gameweek {gw}</h2>
        <span className="sp-tiny sp-muted">Claude, on our numbers</span>
      </div>
      {!a && (
        <>
          <p className="sp-small sp-ink2" style={{ margin: '0 0 10px' }}>
            Claude reads your squad, bank and chips next to our projections and the transfer planner’s options, then tells you which transfers to make, who to start and captain, and whether to play a chip, with the numbers behind each call.
          </p>
          <div className="sp-opt-ctl">
            <span className="sp-small">
              Free transfers
              <span className="sp-step" role="group" aria-label="free transfers">
                <button onClick={() => setFree((v) => Math.max(0, v - 1))} disabled={free <= 0} aria-label="Fewer free transfers">−</button>
                <b className="sp-num">{free}</b>
                <button onClick={() => setFree((v) => Math.min(5, v + 1))} disabled={free >= 5} aria-label="More free transfers">+</button>
              </span>
              <span className="sp-tiny sp-muted"> {free === estimate ? 'our estimate' : `we estimated ${estimate}`}</span>
            </span>
            <button className="sp-btn sp-btn-primary" onClick={ask} disabled={state.loading}>
              {state.loading ? 'Thinking…' : 'Get advice'}
            </button>
          </div>
          {state.loading && <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>Claude is weighing your options. This usually takes 15–40 seconds.</p>}
          {state.error && <p className="sp-small" style={{ margin: '8px 0 0', color: 'var(--sp-loss)' }}>{state.error}</p>}
        </>
      )}

      {a && (
        <>
          <p className="sp-ai-head">{a.headline}</p>
          <p className="sp-small sp-ink2" style={{ margin: '4px 0 0' }}>
            <b className="sp-num" style={{ color: 'var(--sp-ink)' }}>{one(a.projected)}</b> projected this gameweek with this plan
            {a.hit ? `, after a −${a.hit} hit` : ''}, against {one(a.holdProjected)} if you change nothing. Confidence: {a.confidence}.
          </p>

          <h3 className="sp-mu-h" style={{ marginTop: 14 }}>Transfers</h3>
          {a.transfers.length === 0 ? (
            <p className="sp-small" style={{ margin: 0 }}>None: save the transfer{free > 1 ? 's' : ''}.</p>
          ) : (
            a.transfers.map((t) => (
              <div key={`${t.out}-${t.in}`} className="sp-ai-move">
                <span className="sp-opt-move">
                  <span className="sp-opt-p"><Face el={els[t.out]} teams={teams} size={26} /><b className="sp-dif-name">{name(t.out)}</b></span>
                  <span className="sp-xfer-arrow" aria-hidden>→</span>
                  <span className="sp-opt-p"><Face el={els[t.in]} teams={teams} size={26} /><b className="sp-dif-name">{name(t.in)}</b></span>
                </span>
                <span className="sp-small sp-ink2">{t.reason}</span>
              </div>
            ))
          )}
          {a.transfers.length > 0 && <p className="sp-tiny sp-muted" style={{ margin: '4px 0 0' }}>£{a.bankAfter.toFixed(1)}m left in the bank at today’s prices.</p>}

          <h3 className="sp-mu-h" style={{ marginTop: 14 }}>Chip: {CHIP[a.chip.play]}</h3>
          <p className="sp-small sp-ink2" style={{ margin: 0 }}>{a.chip.reason}</p>

          <h3 className="sp-mu-h" style={{ marginTop: 14 }}>Your eleven</h3>
          <div className="sp-ai-xi">
            {[1, 2, 3, 4].map((t) => (
              <div key={t}>
                <span className="sp-tiny sp-muted">{POS[t]}</span>
                {a.starting_xi.filter((id) => els[id]?.type === t).map((id) => (
                  <span key={id} className="sp-small">
                    <b>{name(id)}</b>
                    {id === a.captain ? <i className="sp-badge" style={{ marginLeft: 4 }}>{a.chip.play === '3xc' ? 'TC' : 'C'}</i> : id === a.vice_captain ? <i className="sp-badge sp-badge-quiet" style={{ marginLeft: 4 }}>V</i> : null}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <p className="sp-tiny sp-muted" style={{ margin: '6px 0 0' }}>Bench, in order: {a.bench.map(name).join(', ')}</p>

          <h3 className="sp-mu-h" style={{ marginTop: 14 }}>Why</h3>
          <ul className="sp-ai-list">{a.reasoning.map((r, i) => <li key={i}>{r}</li>)}</ul>
          <h3 className="sp-mu-h" style={{ marginTop: 10 }}>What could go wrong</h3>
          <ul className="sp-ai-list">{a.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>

          {a.fixes.length > 0 && (
            <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>
              Checked against the rules before showing: {a.fixes.join(' ')}
            </p>
          )}
          <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>
            Written by Claude ({d.model}) from our projections, {when(d.at)}. Deadline {when(d.deadline)}. {d.freeEstimated ? 'Free transfers estimated. ' : ''}
            FPL’s public data only shows your team as of the last deadline, so transfers you’ve made since aren’t included. Advice, not a guarantee.
          </p>
          <button className="sp-small sp-link" style={{ marginTop: 8 }} onClick={() => setState({ loading: false, error: null, data: null })}>Ask again with different free transfers</button>
        </>
      )}
    </section>
  );
}
