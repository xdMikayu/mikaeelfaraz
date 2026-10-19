'use client';
import { Ball, Boot, Card, In, Out } from './glyphs';
import { inkOn } from './colors';
import Crest from './Crest';
import { RatingPlate } from './Ratings';
import Disc from './PlayerDisc';

// The lineups: both XIs on one pitch, each team's end under a bar in its kit colour, and the benches
// below. A player is a disc in the kit colour with the face in it where we have one (the Premier
// League's photos), else the shirt number; the rating on the disc's top-right corner, a card top left,
// goals and assists bottom left, the minute they went off bottom right, the name underneath.

// Spacing, in px from a disc's centre. A chip reaches 27 above it (the rating) and 41 below (the
// name), so the bottom keeper sits further from the goal line than the top one, and the top team's
// front line further from halfway than the bottom team's.
const GAP = 70; // between two lines, the least that keeps a chip clear of the next line
const ENDS = { top: [44, 48], bottom: [60, 34] }; // [from the goal line to the keeper, from the front line to halfway]
const HALF = (rows) => 94 + (rows - 1) * GAP; // the larger of the two halves' needs

/** "90'+1'" as people write it: 90+1'. */
const minute = (m) => String(m).replace(/'\+/, '+');

export default function Lineups({ lineups, colors, names, logos = {}, ratings, faces }) {
  const { home, away } = lineups;
  if (!home?.starters?.length && !away?.starters?.length) return null;
  const drawable = home?.lines && away?.lines;
  return (
    <div>
      {drawable ? (
        <div className="sp-lu">
          <TeamBar side="away" lu={away} name={names.away} logo={logos.away} color={colors.away} ratings={ratings} />
          <Pitch home={home} away={away} colors={colors} ratings={ratings} faces={faces} />
          <TeamBar side="home" lu={home} name={names.home} logo={logos.home} color={colors.home} ratings={ratings} />
        </div>
      ) : (
        <div className="sp-two">
          {[['home', home], ['away', away]].map(([k, l]) => l && (
            <div key={k}>
              <h3 className="sp-h3" style={{ marginBottom: 6 }}>{names[k]} {l.formation}</h3>
              <PlayerList players={l.starters} color={colors[k]} ratings={ratings} faces={faces} />
            </div>
          ))}
        </div>
      )}
      <div className="sp-two" style={{ marginTop: 22 }}>
        {[['home', home], ['away', away]].map(([k, l]) => l && (
          <div key={k}>
            <h3 className="sp-h3" style={{ marginBottom: 4 }}>{names[k]} substitutes</h3>
            <PlayerList players={l.bench} bench color={colors[k]} ratings={ratings} faces={faces} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A team's end of the pitch: its crest, name and formation in its kit colour, and its average rating. */
function TeamBar({ side, lu, name, logo, color, ratings }) {
  const rated = ratings ? Object.values(ratings.players).filter((r) => r.side === side) : [];
  const avg = rated.length ? rated.reduce((t, r) => t + r.rating, 0) / rated.length : null;
  return (
    <div className={`sp-lu-bar sp-lu-bar-${side}`} style={{ background: color, color: inkOn(color) }}>
      <span className="sp-lu-crest">
        <Crest src={logo} size={20} light />
      </span>
      <b className="sp-lu-team">{name}</b>
      <span className="sp-lu-form sp-num">{lu.formation}</span>
      {avg != null && (
        <span className="sp-lu-avg">
          Rating <b className="sp-num">{avg.toFixed(1)}</b>
        </span>
      )}
    </div>
  );
}

function Pitch({ home, away, colors, ratings, faces }) {
  // Tall enough that no line of players runs into the next, however many lines a side plays in.
  const half = HALF(Math.max(home.lines.length, away.lines.length));
  return (
    <div className="sp-lu-pitch" style={{ height: 2 * half }}>
      <span className="sp-lu-mow" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} />
        ))}
      </span>
      <Markings />
      <Half lines={away.lines} color={colors.away} top half={half} ratings={ratings} faces={faces} />
      <Half lines={home.lines} color={colors.home} half={half} ratings={ratings} faces={faces} />
    </div>
  );
}

// The markings at their true size against the pitch's width, however tall it is drawn: the box,
// the six-yard box, the spot and the arc at each end, the centre circle, all in metres of a 68m pitch.
const END = (
  <>
    <rect x="13.84" y="-1" width="40.32" height="17.5" />
    <rect x="24.84" y="-1" width="18.32" height="6.5" />
    <circle cx="34" cy="11" r="0.32" className="sp-lu-spot" />
    <path d="M26.69 16.5A9.15 9.15 0 0 0 41.31 16.5" />
  </>
);
function Markings() {
  return (
    <span className="sp-lu-field" aria-hidden>
      <span className="sp-lu-halfway" />
      <svg className="sp-lu-centre" viewBox="0 0 68 20">
        <circle cx="34" cy="10" r="9.15" />
        <circle cx="34" cy="10" r="0.32" className="sp-lu-spot" />
      </svg>
      <svg className="sp-lu-end" viewBox="0 0 68 21">
        {END}
      </svg>
      <svg className="sp-lu-end sp-lu-end-bottom" viewBox="0 0 68 21">
        {END}
      </svg>
    </span>
  );
}

function Half({ lines, color, top, half, ratings, faces }) {
  const n = lines.length;
  const [goal, mid] = ENDS[top ? 'top' : 'bottom'];
  const step = (half - goal - mid) / Math.max(1, n - 1);
  return lines.map((line, j) => {
    const y = goal + j * step;
    // Facing down the page, the away team's left is the viewer's right.
    const row = top ? [...line].reverse() : line;
    // Each chip as wide as its share of the row (for the name), centred on its spot without a
    // transform, so the badges on one player can sit over the next one's disc.
    const w = `min(96px, calc(${100 / (row.length + 1)}% - 4px))`;
    return row.map((p, i) => (
      <div key={p.id} className="sp-lu-player" style={{ left: `calc(${((i + 1) / (row.length + 1)) * 100}% - ${w} / 2)`, top: top ? y : 2 * half - y, width: w }}>
        <Player p={p} color={color} srcs={faces?.[p.id]} r={ratings?.players[p.id]} best={ratings?.best === p.id} />
      </div>
    ));
  });
}

function Player({ p, color, srcs, r, best }) {
  const marks = p.goals + p.assists + (p.og > 0 ? 1 : 0);
  return (
    <>
      <span className="sp-lu-chip">
        <Disc srcs={srcs} number={p.jersey} color={color} />
        {r && (
          <span className="sp-lu-rate">
            <RatingPlate r={r} best={best} size="sm" />
          </span>
        )}
        {(p.red > 0 || p.yellow > 0) && <span className="sp-lu-card">{p.red > 0 ? <Card red size={11} /> : <Card size={11} />}</span>}
        {marks > 0 && (
          <span className="sp-lu-marks">
            {Array.from({ length: p.goals }, (_, i) => (
              <span key={`g${i}`} className="sp-lu-ball">
                <Ball size={15} />
              </span>
            ))}
            {p.og > 0 && (
              <span className="sp-lu-ball">
                <Ball size={15} own />
              </span>
            )}
            {Array.from({ length: p.assists }, (_, i) => (
              <span key={`a${i}`} className="sp-lu-boot">
                <Boot size={11} />
              </span>
            ))}
          </span>
        )}
        {p.off != null && (
          <span className="sp-lu-off sp-num">
            <Out />
            {minute(p.off)}
          </span>
        )}
      </span>
      <span className="sp-lu-name" title={p.name}>
        {p.last}
      </span>
    </>
  );
}

function PlayerList({ players, bench, color, ratings, faces }) {
  if (!players.length) return <p className="sp-note">None listed.</p>;
  return (
    <ul className="sp-bench">
      {players.map((p) => (
        <li key={p.id} style={bench && p.on == null ? { color: 'var(--sp-ink-2)' } : undefined}>
          <Disc srcs={faces?.[p.id]} number={p.jersey} color={color} size={30} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.name} <span className="sp-muted sp-tiny">{p.posName && p.posName !== 'Substitute' ? p.posName : ''}</span>
          </span>
          <span className="sp-num sp-tiny" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            {ratings?.players[p.id] && <RatingPlate r={ratings.players[p.id]} best={ratings.best === p.id} size="sm" />}
            {Array.from({ length: p.goals }, (_, i) => <Ball key={`g${i}`} size={12} />)}
            {Array.from({ length: p.assists }, (_, i) => <Boot key={`a${i}`} size={12} />)}
            {p.red > 0 ? <Card red /> : p.yellow > 0 ? <Card /> : null}
            {p.on != null && <><In /> {minute(p.on)}</>}
            {p.off != null && <><Out /> {minute(p.off)}</>}
          </span>
        </li>
      ))}
    </ul>
  );
}
