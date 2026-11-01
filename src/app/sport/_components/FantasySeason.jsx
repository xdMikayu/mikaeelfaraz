'use client';
import { useLive } from './useLive';

// The manager's season looked back on (src/lib/sport/fpl-history.mjs, /api/sport/fpl/review): the
// moves that paid off and the ones that cost them, what each chip did, and the captain and bench
// points left behind.

export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
export const ago = (w) => (w <= 0 ? 'this gameweek' : w === 1 ? 'last gameweek' : `${w} gameweeks ago`);

async function load(id, signal) {
  const res = await fetch(`/api/sport/fpl/review/${id}`, { signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `FPL ${res.status}`);
  return json;
}

/** One move: what it gained or cost, what it was, when, and the two players' points since. */
export function Move({ m }) {
  return (
    <li style={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr)', gap: 8, alignItems: 'baseline' }}>
      <b className={`sp-num ${m.gain >= 0 ? 'sp-up' : 'sp-down'}`} style={{ fontSize: 15 }}>{signed(m.gain)}</b>
      <span style={{ minWidth: 0 }}>
        <span className="sp-small" style={{ fontWeight: 700 }}>{m.changes ? (m.wildcard ? `Wildcard, ${m.changes} changes` : `${m.changes} changes`) : `${m.out} → ${m.in}`}</span>
        <span className="sp-tiny sp-muted" style={{ display: 'block' }}>
          Gameweek {m.gw}, {ago(m.weeksAgo)} · {m.changes ? `the ${m.changes} in scored ${m.inScored}, the ${m.changes} out ${m.outScored}` : `${m.in} ${m.inScored}, ${m.out} ${m.outScored}`}
        </span>
      </span>
    </li>
  );
}

const list = { listStyle: 'none', padding: 0, margin: '6px 0 12px', display: 'grid', gap: 8 };
const b = (v) => <b style={{ color: 'var(--sp-ink)' }}>{v}</b>;

export default function SeasonReview({ entry }) {
  const r = useLive((signal) => load(entry.id, signal), [entry.id], { every: 600000, live: () => false });
  const d = r.data;
  if (!d) return r.error ? null : <div className="sp-skel" style={{ height: 260, margin: '0 16px' }} aria-label="Loading your season" />;
  const t = d.transfers;
  return (
    <section className="sp-panel sp-record">
      <div className="sp-section-head">
        <h2 className="sp-h2">Your season</h2>
        <span className="sp-tiny sp-muted">Through gameweek {d.through}</span>
      </div>
      <p className="sp-small sp-ink2" style={{ margin: '0 0 4px' }}>
        {t.made
          ? <>Your {t.made} {t.made === 1 ? 'move' : 'moves'} with free transfers or hits have made {b(signed(t.netAfterHits))} {Math.abs(t.netAfterHits) === 1 ? 'point' : 'points'}{t.hitsTaken ? `, after ${t.hitsTaken} points of hits` : ''}.</>
          : 'No transfers outside your chips yet.'}
      </p>
      {t.best.length > 0 && (
        <>
          <h3 className="sp-h3" style={{ margin: '10px 0 0' }}>What paid off</h3>
          <ul style={list}>{t.best.map((m) => <Move key={`${m.gw}-${m.in ?? m.changes}`} m={m} />)}</ul>
        </>
      )}
      {t.costliest.length > 0 && (
        <>
          <h3 className="sp-h3" style={{ margin: '10px 0 0' }}>What cost you</h3>
          <ul style={list}>{t.costliest.map((m) => <Move key={`${m.gw}-${m.in ?? m.changes}`} m={m} />)}</ul>
        </>
      )}
      {t.hits?.length > 0 && (
        <p className="sp-small sp-ink2" style={{ margin: '0 0 8px' }}>
          {b('Hits.')}{' '}
          {t.hits
            .map((h, i) => `${i ? 'gameweek' : 'Gameweek'} ${h.gw}’s −${h.cost} for ${h.moves.join(', ') || 'moves since undone'} ${h.net > 0 ? `has paid back, ${h.net} to spare` : h.net === 0 ? 'has just paid back' : `is ${-h.net} short${h.weeksAgo <= 2 ? ' so far' : ''}`}`)
            .join('; ')}
          .
        </p>
      )}
      {d.chips.length > 0 && (
        <p className="sp-small sp-ink2" style={{ margin: '0 0 8px' }}>
          {b('Chips.')}{' '}
          {d.chips.map((c, i) => (
            <span key={`${c.chip}-${c.gw}`}>
              {i ? ' · ' : ''}
              {c.chip} in gameweek {c.gw}: <b className={`sp-num ${c.gain >= 0 ? 'sp-up' : 'sp-down'}`}>{signed(c.gain)}</b>
              {c.over ? ' since' : ''}
              {c.stillBeingPlayed ? ' so far' : ''}
            </span>
          ))}
        </p>
      )}
      {d.captains.leftWithHindsight > 0 && (
        <p className="sp-small sp-ink2" style={{ margin: '0 0 8px' }}>
          {b('Captains.')} With hindsight your armband left {b(d.captains.leftWithHindsight)} points:{' '}
          {d.captains.costliest.map((c) => `gameweek ${c.gw}, ${c.chose} when ${c.best}`).join('; ')}. Nobody gets every week right.
        </p>
      )}
      {d.benchPoints > 0 && (
        <p className="sp-small sp-ink2" style={{ margin: 0 }}>
          {b('Bench.')} {d.benchPoints} points sat on your bench.
        </p>
      )}
      <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>
        Each move sets the player you bought against the one you sold, over the gameweeks you kept him; a player bought and sold again before a deadline doesn’t count. A wildcard is set against your team from before it, kept as it was. Ask Matchday AI about any of it.
      </p>
    </section>
  );
}
