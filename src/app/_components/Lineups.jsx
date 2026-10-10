'use client';
import { Ball, Card, In, Out } from './glyphs';
import { inkOn } from './colors';

/** Both XIs on one pitch: home attacking up from the bottom, away attacking down from the top. */
export default function Lineups({ lineups, colors, names }) {
  const { home, away } = lineups;
  if (!home?.starters?.length && !away?.starters?.length) return null;
  const drawable = home?.lines && away?.lines;
  return (
    <div>
      {drawable ? (
        <div className="sp-pitch-wrap" style={{ position: 'relative', aspectRatio: '68 / 105', maxWidth: 520, margin: '0 auto' }}>
          <PitchLines />
          <Half lines={away.lines} color={colors.away} top />
          <Half lines={home.lines} color={colors.home} />
          <span className="sp-pill" style={{ position: 'absolute', left: 10, top: 10, background: 'rgba(5,10,20,0.55)', color: '#fff' }}>{names.away} · {away.formation}</span>
          <span className="sp-pill" style={{ position: 'absolute', left: 10, bottom: 10, background: 'rgba(5,10,20,0.55)', color: '#fff' }}>{names.home} · {home.formation}</span>
        </div>
      ) : (
        <div className="sp-two">
          {[['home', home], ['away', away]].map(([k, l]) => l && (
            <div key={k}>
              <h3 className="sp-h3" style={{ marginBottom: 6 }}>{names[k]} {l.formation}</h3>
              <PlayerList players={l.starters} color={colors[k]} />
            </div>
          ))}
        </div>
      )}
      <div className="sp-two" style={{ marginTop: 18 }}>
        {[['home', home], ['away', away]].map(([k, l]) => l && (
          <div key={k}>
            <h3 className="sp-h3" style={{ marginBottom: 4 }}>{names[k]} substitutes</h3>
            <PlayerList players={l.bench} bench color={colors[k]} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PitchLines() {
  const s = { fill: 'none', stroke: 'var(--sp-pitch-line)', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' };
  return (
    <svg viewBox="0 0 68 105" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden>
      <rect x="1" y="1" width="66" height="103" {...s} />
      <line x1="1" y1="52.5" x2="67" y2="52.5" {...s} />
      <circle cx="34" cy="52.5" r="9" {...s} />
      <rect x={34 - 20} y="1" width="40" height="16.5" {...s} />
      <rect x={34 - 20} y={104 - 16.5} width="40" height="16.5" {...s} />
      <rect x={34 - 9} y="1" width="18" height="5.5" {...s} />
      <rect x={34 - 9} y={104 - 5.5} width="18" height="5.5" {...s} />
    </svg>
  );
}

function Half({ lines, color, top }) {
  const n = lines.length;
  return lines.map((line, j) => {
    // Rows from the goal line (4% / 96%) to just short of halfway.
    const yPct = top ? 5 + (j * 39) / (n - 1) : 95 - (j * 39) / (n - 1);
    // Facing down the page, the away team's left is the viewer's right.
    const row = top ? [...line].reverse() : line;
    return row.map((p, i) => (
      <div key={p.id} style={{ position: 'absolute', left: `${((i + 1) / (row.length + 1)) * 100}%`, top: `${yPct}%`, transform: 'translate(-50%, -50%)' }}>
        <Player p={p} color={color} />
      </div>
    ));
  });
}

function Player({ p, color }) {
  return (
    <div className="sp-player">
      <span className="sp-shirt" style={{ background: color, color: inkOn(color) }}>{p.jersey}</span>
      <span className="sp-pname" title={p.name}>{p.last}</span>
      <span className="sp-pmeta">
        {Array.from({ length: p.goals }, (_, i) => <Ball key={`g${i}`} size={11} />)}
        {p.og > 0 && <Ball size={11} own />}
        {p.red > 0 ? <Card red size={10} /> : p.yellow > 0 ? <Card size={10} /> : null}
        {p.off != null && (
          <>
            <Out />
            <span className="sp-num">{p.off}</span>
          </>
        )}
      </span>
    </div>
  );
}

function PlayerList({ players, bench, color }) {
  if (!players.length) return <p className="sp-note">None listed.</p>;
  return (
    <ul className="sp-bench">
      {players.map((p) => (
        <li key={p.id} style={bench && p.on == null ? { color: 'var(--sp-ink-2)' } : undefined}>
          <span className="sp-jersey" style={{ background: color, color: inkOn(color) }}>{p.jersey}</span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.name} <span className="sp-muted sp-tiny">{p.posName && p.posName !== 'Substitute' ? p.posName : ''}</span>
          </span>
          <span className="sp-num sp-tiny" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            {Array.from({ length: p.goals }, (_, i) => <Ball key={i} size={12} />)}
            {p.red > 0 ? <Card red /> : p.yellow > 0 ? <Card /> : null}
            {p.on != null && <><In /> {p.on}</>}
            {p.off != null && <><Out /> {p.off}</>}
          </span>
        </li>
      ))}
    </ul>
  );
}
