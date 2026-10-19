'use client';
import { Ball, Boot, Card, In, Out } from './glyphs';
import { inkOn } from './colors';
import { RatingPlate } from './Ratings';

/** Both XIs on one pitch: home attacking up from the bottom, away attacking down from the top. */
export default function Lineups({ lineups, colors, names, ratings }) {
  const { home, away } = lineups;
  if (!home?.starters?.length && !away?.starters?.length) return null;
  const drawable = home?.lines && away?.lines;
  return (
    <div>
      {drawable ? (
        <div className="sp-pitch-wrap" style={{ position: 'relative', aspectRatio: '68 / 105', minHeight: 540, maxWidth: 520, margin: '0 auto' }}>
          <PitchLines />
          <Half lines={away.lines} color={colors.away} top ratings={ratings} />
          <Half lines={home.lines} color={colors.home} ratings={ratings} />
          <span className="sp-pill" style={{ position: 'absolute', left: 10, top: 10, background: 'rgba(5,10,20,0.55)', color: '#fff' }}>{names.away} · {away.formation}</span>
          <span className="sp-pill" style={{ position: 'absolute', left: 10, bottom: 10, background: 'rgba(5,10,20,0.55)', color: '#fff' }}>{names.home} · {home.formation}</span>
        </div>
      ) : (
        <div className="sp-two">
          {[['home', home], ['away', away]].map(([k, l]) => l && (
            <div key={k}>
              <h3 className="sp-h3" style={{ marginBottom: 6 }}>{names[k]} {l.formation}</h3>
              <PlayerList players={l.starters} color={colors[k]} ratings={ratings} />
            </div>
          ))}
        </div>
      )}
      <div className="sp-two" style={{ marginTop: 18 }}>
        {[['home', home], ['away', away]].map(([k, l]) => l && (
          <div key={k}>
            <h3 className="sp-h3" style={{ marginBottom: 4 }}>{names[k]} substitutes</h3>
            <PlayerList players={l.bench} bench color={colors[k]} ratings={ratings} />
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

function Half({ lines, color, top, ratings }) {
  const n = lines.length;
  return lines.map((line, j) => {
    // Rows from just off the goal line to just short of halfway.
    const yPct = top ? 5.5 + (j * 38.5) / (n - 1) : 94.5 - (j * 38.5) / (n - 1);
    // Facing down the page, the away team's left is the viewer's right.
    const row = top ? [...line].reverse() : line;
    return row.map((p, i) => (
      <div key={p.id} style={{ position: 'absolute', left: `${((i + 1) / (row.length + 1)) * 100}%`, top: `${yPct}%`, transform: 'translate(-50%, -50%)' }}>
        <Player p={p} color={color} r={ratings?.players[p.id]} best={ratings?.best === p.id} />
      </div>
    ));
  });
}

// Everything about a player sits on the corners of the shirt, as the rating apps do it: the rating top
// right, a card top left, goals and assists bottom left, the minute they went off bottom right. The
// chip stays one shirt and a name tall, so five lines a side fit a phone's pitch without touching.
function Player({ p, color, r, best }) {
  const marks = p.goals + p.assists + (p.og > 0 ? 1 : 0);
  return (
    <div className="sp-player">
      <span className="sp-pchip">
        <span className="sp-shirt" style={{ background: color, color: inkOn(color) }}>{p.jersey}</span>
        {r && (
          <span className="sp-pb sp-pb-tr">
            <RatingPlate r={r} best={best} size="xs" />
          </span>
        )}
        {(p.red > 0 || p.yellow > 0) && <span className="sp-pb sp-pb-tl">{p.red > 0 ? <Card red size={11} /> : <Card size={11} />}</span>}
        {marks > 0 && (
          <span className="sp-pb sp-pb-bl">
            {p.goals + p.og > 0 && (
              <span className="sp-pb-balls">
                {Array.from({ length: p.goals }, (_, i) => <Ball key={`g${i}`} size={12} />)}
                {p.og > 0 && <Ball size={12} own />}
              </span>
            )}
            {p.assists > 0 && <span>{Array.from({ length: p.assists }, (_, i) => <Boot key={`a${i}`} size={12} />)}</span>}
          </span>
        )}
        {p.off != null && (
          <span className="sp-pb sp-pb-br">
            <Out />
            <span className="sp-num">{p.off}</span>
          </span>
        )}
      </span>
      <span className="sp-pname" title={p.name}>{p.last}</span>
    </div>
  );
}

function PlayerList({ players, bench, color, ratings }) {
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
            {ratings?.players[p.id] && <RatingPlate r={ratings.players[p.id]} best={ratings.best === p.id} size="sm" />}
            {Array.from({ length: p.goals }, (_, i) => <Ball key={`g${i}`} size={12} />)}
            {Array.from({ length: p.assists }, (_, i) => <Boot key={`a${i}`} size={12} />)}
            {p.red > 0 ? <Card red /> : p.yellow > 0 ? <Card /> : null}
            {p.on != null && <><In /> {p.on}</>}
            {p.off != null && <><Out /> {p.off}</>}
          </span>
        </li>
      ))}
    </ul>
  );
}
