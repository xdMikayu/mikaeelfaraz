'use client';
import { Ball, Boot, Card, In, Out } from './glyphs';
import Crest from './Crest';
import { RatingPlate } from './Ratings';
import Disc from './PlayerDisc';

// The lineups as FotMob draws them, the app people hold up as the standard: both XIs on one flat pitch
// (FotMob green in light mode, charcoal in dark) with faint markings, the home side at the top, each
// team named in a band at its end, and the benches below. A player is a face on a plain disc (or a
// shirt with the number), the rating as a pill on the disc's top edge, a substitution's minute over a
// coral arrow top left, a card on the left, assists bottom left and goals bottom right as white chips,
// and "47 Foden" underneath.

// Spacing in px from a disc's centre. The largest chip reaches 39 above it (a substitution's minute)
// and 44 below (the name), so lines sit 96 apart, the keepers clear of the goal lines and the two front
// lines clear of each other across halfway.
const GAP = 96;
const ENDS = { top: [58, 50], bottom: [62, 46] }; // [from the goal line to the keeper, from the front line to halfway]
const HALF = (rows) => 108 + (rows - 1) * GAP;
// Discs shrink as a line fills, so four or five across still leave room for names and pills.
const DISC_FOR = (n) => (n >= 5 ? 40 : n === 4 ? 44 : 46);

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
          <TeamHead side="home" lu={home} name={names.home} logo={logos.home} ratings={ratings} />
          <Pitch home={home} away={away} colors={colors} ratings={ratings} faces={faces} />
          <TeamHead side="away" lu={away} name={names.away} logo={logos.away} ratings={ratings} />
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
      <div className="sp-two" style={{ marginTop: 24 }}>
        {[['home', home], ['away', away]].map(([k, l]) => l && (
          <div key={k}>
            <h3 className="sp-lu-benchhead">
              <Crest src={logos[k]} size={20} /> {names[k]} <span className="sp-muted">substitutes</span>
            </h3>
            <PlayerList players={l.bench} bench color={colors[k]} ratings={ratings} faces={faces} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A team's band at its end of the pitch: the average of its players' ratings, crest, name, formation. */
function TeamHead({ side, lu, name, logo, ratings }) {
  const rated = ratings ? Object.values(ratings.players).filter((r) => r.side === side) : [];
  const avg = rated.length ? rated.reduce((t, r) => t + r.rating, 0) / rated.length : null;
  return (
    <div className="sp-lu-head">
      {avg != null && <RatingPlate r={{ rating: Math.round(avg * 10) / 10 }} size="sm" />}
      <Crest src={logo} size={20} onDark />
      <span className="sp-lu-team">{name}</span>
      <b className="sp-lu-form sp-num">{lu.formation}</b>
    </div>
  );
}

function Pitch({ home, away, colors, ratings, faces }) {
  // Tall enough that no line of players runs into the next, however many lines a side plays in.
  const half = HALF(Math.max(home.lines.length, away.lines.length));
  return (
    <div className="sp-lu-pitch" style={{ height: 2 * half }}>
      <Markings />
      <Half lines={home.lines} color={colors.home} top half={half} ratings={ratings} faces={faces} />
      <Half lines={away.lines} color={colors.away} half={half} ratings={ratings} faces={faces} />
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
    // Facing down the page, the top team's left is the viewer's right.
    const row = top ? [...line].reverse() : line;
    // Each chip as wide as its share of the row (for the name), centred on its spot without a
    // transform, so the badges on one player can sit over the next one's disc.
    const w = `min(108px, calc(${100 / (row.length + 1)}% - 6px))`;
    const size = DISC_FOR(row.length);
    const tight = row.length >= 4;
    return row.map((p, i) => (
      <div
        key={p.id}
        className={`sp-lu-player${tight ? ' sp-lu-tight' : ''}`}
        style={{ left: `calc(${((i + 1) / (row.length + 1)) * 100}% - ${w} / 2)`, top: top ? y : 2 * half - y, width: w, marginTop: -size / 2, '--r': `${size / 2}px` }}
      >
        <Player p={p} color={color} srcs={faces?.[p.id]} r={ratings?.players[p.id]} best={ratings?.best === p.id} size={size} pill={tight ? 'sm' : 'md'} />
      </div>
    ));
  });
}

function Player({ p, color, srcs, r, best, size, pill }) {
  const card = p.red > 0 ? <Card red size={11} /> : p.yellow > 0 ? <Card size={11} /> : null;
  return (
    <>
      <span className="sp-lu-chip" style={{ width: size, height: size }}>
        <Disc srcs={srcs} number={p.jersey} color={color} size={size} />
        {r && (
          <span className="sp-lu-rate">
            <RatingPlate r={r} best={best} size={pill} />
          </span>
        )}
        {p.off != null && (
          <span className="sp-lu-tl sp-lu-sub" aria-label={`off ${minute(p.off)}`}>
            <i className="sp-num">{minute(p.off)}</i>
            <b aria-hidden>
              <svg width="9" height="9" viewBox="0 0 10 10">
                <path d="M8.5 5H1.8M4.6 2 1.6 5l3 3" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </b>
          </span>
        )}
        {card && <span className="sp-lu-card">{card}</span>}
        {p.assists > 0 && (
          <span className="sp-lu-bl">
            {Array.from({ length: p.assists }, (_, i) => (
              <span key={i} className="sp-lu-ev">
                <Boot size={11} />
              </span>
            ))}
          </span>
        )}
        {p.goals + p.og > 0 && (
          <span className="sp-lu-br">
            {Array.from({ length: p.goals }, (_, i) => (
              <span key={`g${i}`} className="sp-lu-ev sp-lu-goal">
                <Ball size={15} />
              </span>
            ))}
            {p.og > 0 && (
              <span className="sp-lu-ev sp-lu-og">
                <Ball size={15} own />
              </span>
            )}
          </span>
        )}
      </span>
      <span className="sp-lu-name" title={p.name}>
        <span className="sp-lu-no sp-num">{p.jersey}</span> {p.last}
      </span>
    </>
  );
}

function PlayerList({ players, bench, color, ratings, faces }) {
  if (!players.length) return <p className="sp-note">None listed.</p>;
  return (
    <ul className="sp-bench sp-lu-bench">
      {players.map((p) => (
        <li key={p.id} className={bench && p.on == null ? 'sp-bench-unused' : undefined}>
          <Disc srcs={faces?.[p.id]} number={p.jersey} color={color} size={36} />
          <span className="sp-bench-who" title={p.posName && p.posName !== 'Substitute' ? p.posName : undefined}>
            <span className="sp-lu-no sp-num">{p.jersey}</span> {p.name}
          </span>
          <span className="sp-bench-what sp-num">
            {Array.from({ length: p.goals }, (_, i) => <Ball key={`g${i}`} size={14} />)}
            {Array.from({ length: p.assists }, (_, i) => <Boot key={`a${i}`} size={14} />)}
            {p.red > 0 ? <Card red /> : p.yellow > 0 ? <Card /> : null}
            {p.on != null && (
              <span className="sp-bench-min">
                <In /> {minute(p.on)}
              </span>
            )}
            {p.off != null && (
              <span className="sp-bench-min">
                <Out /> {minute(p.off)}
              </span>
            )}
            {ratings?.players[p.id] && <RatingPlate r={ratings.players[p.id]} best={ratings.best === p.id} />}
          </span>
        </li>
      ))}
    </ul>
  );
}
