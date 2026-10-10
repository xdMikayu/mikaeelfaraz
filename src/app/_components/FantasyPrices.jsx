'use client';
import { shirt } from './fplbits';

// FPL publishes its own price-change progress for every player (100 = rises, −100 = falls) and a
// projection for tonight and the next two nights with a likelihood from −5 to 5. Prices change
// overnight, around 01:30 UK time.

const night = (e, offset) => e.price?.nights?.find((n) => n[0] === offset) ?? null;
const sure = (l) => (Math.abs(l) >= 5 ? 'very likely' : Math.abs(l) >= 3 ? 'likely' : 'possible');
const k = (n) => (Math.abs(n) >= 1000 ? `${n > 0 ? '+' : '−'}${Math.round(Math.abs(n) / 1000)}k` : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`);

/** Where each player stands: rise or fall tonight, in the next two nights, or steady. */
export function priceOutlook(e) {
  for (const offset of [0, 1, 2]) {
    const n = night(e, offset);
    if (!n || n[1] == null) continue;
    if (n[1] >= 100) return { dir: 1, offset, likelihood: n[2], pct: n[1] };
    if (n[1] <= -100) return { dir: -1, offset, likelihood: n[2], pct: n[1] };
  }
  return { dir: 0, offset: null, pct: e.price?.progress ?? 0 };
}

const WHEN = ['tonight', 'tomorrow night', 'in two nights'];

function Row({ e, o, teams, mine }) {
  const p = Math.max(-150, Math.min(150, e.price?.progress ?? 0));
  return (
    <div className="sp-price">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shirt(teams[e.team]?.code, e.type === 1)} alt="" width="22" height="22" />
      <span style={{ minWidth: 0 }}>
        <b className="sp-dif-name" style={{ display: 'block', fontSize: 14 }}>{e.name}{mine ? <span className="sp-tiny sp-muted"> · yours</span> : null}</b>
        <span className="sp-tiny sp-muted">{teams[e.team]?.short} · £{e.cost.toFixed(1)}m · {k(e.price?.net ?? 0)} net this GW</span>
      </span>
      <span className="sp-price-r">
        <span className="sp-price-bar" role="img" aria-label={`${Math.round(e.price?.progress ?? 0)}% of the way to a ${p >= 0 ? 'rise' : 'fall'}`}>
          <i style={{ left: p >= 0 ? '50%' : `${50 + p / 3}%`, width: `${Math.abs(p) / 3}%`, background: p >= 0 ? 'var(--sp-win)' : 'var(--sp-loss)' }} />
        </span>
        <span className="sp-tiny sp-num" style={{ fontWeight: 750 }}>
          {o.dir ? `${o.dir > 0 ? '▲' : '▼'} ${sure(o.likelihood)} ${WHEN[o.offset]}` : `${Math.round(e.price?.progress ?? 0)}%`}
        </span>
      </span>
    </div>
  );
}

export default function Prices({ st, teams, squad }) {
  const mine = new Set(squad);
  const all = st.elements.map((e) => ({ e, o: priceOutlook(e) }));
  const by = (dir, offset) =>
    all
      .filter((x) => x.o.dir === dir && (offset == null ? x.o.offset > 0 : x.o.offset === offset))
      .sort((a, b) => Math.abs(b.o.likelihood) - Math.abs(a.o.likelihood) || Math.abs(b.o.pct) - Math.abs(a.o.pct));
  const yours = all.filter((x) => mine.has(x.e.id) && x.o.dir !== 0).sort((a, b) => a.o.offset - b.o.offset);
  const section = (title, list, note) => (
    <section className="sp-panel">
      <div className="sp-section-head">
        <h2 className="sp-h2">{title}</h2>
        <span className="sp-tiny sp-muted">{list.length}</span>
      </div>
      {note && <p className="sp-tiny sp-muted" style={{ margin: '0 0 4px' }}>{note}</p>}
      {list.length === 0 ? <p className="sp-small sp-muted" style={{ margin: 0 }}>None.</p> : list.slice(0, 25).map((x) => <Row key={x.e.id} {...x} teams={teams} mine={mine.has(x.e.id)} />)}
    </section>
  );
  return (
    <div style={{ marginTop: 12 }}>
      {section(
        'Your players',
        yours,
        yours.length ? 'If you plan to sell a faller, doing it before tonight keeps the 0.1m; buying a riser before tonight saves it.' : 'None of your squad is close to a price change.'
      )}
      {section('Likely to rise tonight', by(1, 0))}
      {section('Likely to fall tonight', by(-1, 0))}
      {section('Next two nights', [...by(1, null), ...by(-1, null)])}
      <p className="sp-note sp-pad" style={{ margin: '10px 0 0' }}>
        FPL’s own price-change progress and projections, refreshed every few minutes. Prices change overnight, around 01:30 UK time. The bar shows how far each player is towards a rise (right) or a fall (left).
      </p>
    </div>
  );
}
