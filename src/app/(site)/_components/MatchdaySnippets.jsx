'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { standingsNow, withScores, moveWords } from '@/lib/matchday/as-it-stands.mjs';
import { titleRace } from '@/lib/matchday/f1.mjs';

// MatchdayMini's three screens, drawn as Matchday draws them: its type, crests, kit colours, bands
// and cards (Matchday's sport.css). Each changes with a tap and says, as the app does, what it
// means: where the score leaves the table, what the chase needs, who can still take the title. The
// made-up numbers, and everything a tap can't change, come in as props worked out at build time.

const useIsoLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** After a re-order, slides each child marked data-flip from where it was to where it is now. */
function useFlip(order) {
  const box = useRef(null);
  const was = useRef(null);
  useIsoLayout(() => {
    const items = [...box.current.querySelectorAll('[data-flip]')];
    const now = new Map(items.map((el) => [el.dataset.flip, el.offsetTop]));
    if (was.current && !still()) {
      for (const el of items) {
        const dy = (was.current.get(el.dataset.flip) ?? el.offsetTop) - el.offsetTop;
        if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' });
      }
    }
    was.current = now;
  }, [order]);
  return box;
}

/** Matchday's mark, "the fixture" (SportShell.jsx). */
function Mark() {
  return (
    <svg className="mdp-mark" width="20" height="20" viewBox="0 0 512 512" aria-hidden="true">
      <rect x="8" y="8" width="496" height="496" rx="110" fill="#fff" stroke="#000" strokeOpacity=".14" strokeWidth="16" />
      <path fill="#d6001c" d="M236 96a160 160 0 0 0 0 320z" />
      <path fill="#111" d="M276 96a160 160 0 0 1 0 320z" />
    </svg>
  );
}

/** The app's header, "Matchday · Football", with a way back to the start once something's changed. */
function AppBar({ sport, changed, onAgain }) {
  return (
    <div className="mdp-bar">
      <Mark />
      <span className="mdp-word">
        <span>Matchday</span>
        <i aria-hidden="true">·</i>
        {sport}
      </span>
      <button type="button" className="mdp-again" onClick={onAgain} disabled={!changed}>
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M4.4 1.9 4.6 4.7 1.9 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Again
      </button>
    </div>
  );
}

/**
 * A club's crest. In dark mode ESPN's dark version, as in the app (the CSS shows one of the two);
 * `light` on a white disc, where the normal one reads best.
 */
function Crest({ club, size, light = false }) {
  const img = (src, cls) => (
    // ESPN's resizer returns a small PNG, as the app's crests use.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={cls} src={src} width={size} height={size} alt="" loading="lazy" decoding="async" />
  );
  return (
    <span className="mdp-crest" style={{ width: size, height: size }}>
      {light ? img(club.crest) : img(club.crest, 'mdp-lt')}
      {!light && img(club.crestDark, 'mdp-dk')}
    </span>
  );
}

const Plus = () => (
  <span className="mdp-plus" aria-hidden="true">
    +
  </span>
);

/* ------------------------------------------------------------ football: what the score means */

const NIL = { eve: 0, liv: 0, mci: 0, bha: 0 };
const live = (h, hs, a, as) => ({ id: h + a, status: { state: 'in' }, home: { id: h, score: hs }, away: { id: a, score: as } });
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

function Move({ name, move }) {
  const words = moveWords(move);
  const [, lead, place] = words.match(/^(.*?)(\d+\w\w|top)$/) ?? [null, words, ''];
  return (
    <span className="mdp-move">
      <strong>{name}</strong> {lead}
      <b>{place}</b>
    </span>
  );
}

/** Everton v Liverpool, with Man City v Brighton on too: tap a crest to score. */
export function Football({ clubs, standings, kits }) {
  const [score, setScore] = useState(NIL);
  const goals = score.eve + score.liv + score.mci + score.bha;
  const goal = (id) => setScore((s) => ({ ...s, [id]: s[id] + 1 }));
  const match = live('eve', score.eve, 'liv', score.liv);
  const other = live('mci', score.mci, 'bha', score.bha);
  const r = standingsNow(standings, match, [other]);
  const rows = withScores(
    standings.groups[0].rows,
    [match, other].map((m) => ({ homeId: m.home.id, awayId: m.away.id, hs: m.home.score, as: m.away.score })),
  );
  const box = useFlip(rows.map((t) => t.id).join());
  // Each live side's own score first, as live tables show it.
  const now = { eve: [score.eve, score.liv], liv: [score.liv, score.eve], mci: [score.mci, score.bha], bha: [score.bha, score.mci] };
  const half = (id, kit) => (
    <div className="mdp-half" style={{ background: kit.fill, color: kit.ink }}>
      <button type="button" className="mdp-disc" onClick={() => goal(id)} aria-label={`Goal for ${clubs[id].name}`}>
        <Crest club={clubs[id]} size={30} light />
        <Plus />
      </button>
      <span>{clubs[id].name}</span>
    </div>
  );
  const side = (id, right) => (
    <button type="button" className={`mdp-side${right ? ' mdp-side-r' : ''}`} onClick={() => goal(id)} aria-label={`Goal for ${clubs[id].name}`}>
      {right && <span>{clubs[id].name}</span>}
      <span className="mdp-tap">
        <Crest club={clubs[id]} size={20} />
        <Plus />
      </span>
      {!right && <span>{clubs[id].name}</span>}
    </button>
  );
  return (
    <>
      <AppBar sport="Football" changed={goals > 0} onAgain={() => setScore(NIL)} />
      <div className="mdp-body">
        <div className="mdp-unit">
          <div className="mdp-mcard">
            {half('eve', kits.home)}
            {half('liv', kits.away)}
            <span className="mdp-mcard-lg" style={{ color: kits.home.ink }}>
              Premier League
            </span>
            <div className="mdp-plate">
              <b key={score.eve * 100 + score.liv} className={score.eve + score.liv ? 'mdp-pop' : undefined}>
                {score.eve}–{score.liv}
              </b>
              <span>{Math.min(90, 61 + 4 * goals)}′</span>
            </div>
          </div>
          <div className="mdp-band" aria-live="polite">
            <span className="mdp-band-label">As it stands</span>
            <span className="mdp-band-main">
              <Move name={clubs.eve.name} move={r.home} />
              <Move name={clubs.liv.name} move={r.away} />
            </span>
          </div>
        </div>
        <div className="mdp-also">
          <span className="mdp-also-live">Live</span>
          {side('mci')}
          <b key={score.mci * 100 + score.bha} className={score.mci + score.bha ? 'mdp-pop' : undefined}>
            {score.mci}–{score.bha}
          </b>
          {side('bha', true)}
        </div>
        <div className="mdp-thead" aria-hidden="true">
          <span>#</span>
          <span />
          <span>Team</span>
          <span>P</span>
          <span>GD</span>
          <span>Pts</span>
        </div>
        <ol className="mdp-table" ref={box} aria-label="The table as it stands">
          {rows.map((t) => {
            const moved = t.was - t.at;
            const s = now[t.id];
            return (
              <li key={t.id} data-flip={t.id} className={t.at === 5 ? 'mdp-break' : undefined}>
                <span className="mdp-pos">
                  <i style={{ background: t.at <= 4 ? 'var(--a-ink)' : t.at === 5 ? 'var(--a-muted)' : 'transparent' }} aria-hidden="true" />
                  {t.at}
                </span>
                <span className={`mdp-mv${moved > 0 ? ' mdp-up' : ' mdp-down'}`} aria-label={moved ? `${moved > 0 ? 'up' : 'down'} ${Math.abs(moved)}` : undefined}>
                  {moved > 0 ? '▲' : moved < 0 ? '▼' : ''}
                </span>
                <span className="mdp-tteam">
                  <Crest club={clubs[t.id]} size={22} />
                  <span>{clubs[t.id].name}</span>
                  {s && (
                    <em className={`mdp-ls mdp-ls-${s[0] > s[1] ? 'w' : s[0] < s[1] ? 'l' : 'd'}`} aria-label={`live, ${s[0]}–${s[1]}`}>
                      {s[0]}–{s[1]}
                    </em>
                  )}
                </span>
                <span>{t.p}</span>
                <span>{signed(t.gd)}</span>
                <b>{t.pts}</b>
              </li>
            );
          })}
        </ol>
        <p className="mdp-key">
          <span>
            <i style={{ background: 'var(--a-ink)' }} aria-hidden="true" />
            Champions League
          </span>
          <span>
            <i style={{ background: 'var(--a-muted)' }} aria-hidden="true" />
            Europa League
          </span>
        </p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ cricket: the last over */

// How a ball in a T20's last over can go, out of 100, roughly: dot, one, two, four, six, wicket.
const ODDS = [
  ['•', 27],
  ['1', 33],
  ['2', 9],
  ['4', 13],
  ['6', 8],
  ['W', 10],
];
function nextBall() {
  let x = Math.random() * 100;
  for (const [mark, w] of ODDS) if ((x -= w) < 0) return mark;
  return '1';
}
const runsOf = (m) => (m === 'W' || m === '•' ? 0 : Number(m));
const oversOf = (balls) => `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ''}`;

/**
 * The two batters after these balls, the one on strike first, each with their share of the
 * partnership (`part`, `partBalls`): odd runs swap ends, a wicket brings in the next and starts a new
 * partnership.
 */
function crease(pair, next, balls) {
  let [on, off] = pair;
  let n = 0;
  for (const m of balls) {
    const r = runsOf(m);
    on = { ...on, runs: on.runs + r, balls: on.balls + 1, part: on.part + r, partBalls: on.partBalls + 1 };
    if (m === 'W') {
      on = { name: next[n++], runs: 0, balls: 0, part: 0, partBalls: 0 };
      off = { ...off, part: 0, partBalls: 0 };
    } else if (r % 2) [on, off] = [off, on];
  }
  return [on, off];
}

/** One ball as a chip, as in the app: wickets red, boundaries in the batting side's colour, sixes ringed too. */
function Ball({ mark, kit, fresh }) {
  const kind = mark === 'W' ? 'w' : mark === '4' || mark === '6' ? 'b' : mark === '•' ? 'dot' : 'run';
  const label = { w: 'wicket', b: `${mark}, boundary`, dot: 'no run', run: plural(Number(mark), 'run') }[kind];
  return (
    <i
      className={`mdp-cball mdp-cball-${kind}${mark === '6' ? ' mdp-cball-six' : ''}${fresh ? ' mdp-in' : ''}`}
      style={kind === 'b' ? { background: kit.fill, color: kit.ink } : undefined}
      title={label}
      aria-label={label}
    >
      {kind === 'dot' ? '' : mark}
    </i>
  );
}

/** India need 14 off the last over: bowl it a ball at a time. */
export function Cricket({ chase, kits }) {
  const [balls, setBalls] = useState([]);
  const runs = chase.runs + balls.reduce((t, m) => t + runsOf(m), 0);
  const wickets = chase.wickets + balls.filter((m) => m === 'W').length;
  const bowled = chase.balls + balls.length;
  const left = 120 - bowled;
  const need = chase.target - runs;
  const out = wickets >= 10 || left === 0;
  const result = need <= 0 ? 'won' : out ? (need === 1 ? 'tied' : 'lost') : null;
  const pair = useMemo(() => crease(chase.batters, chase.next, balls), [chase, balls]);
  const over = { runs: balls.reduce((t, m) => t + runsOf(m), 0), wickets: balls.filter((m) => m === 'W').length };
  let main;
  let side = null;
  if (result === 'won') {
    main = (
      <>
        <strong>{chase.team}</strong> win by <b>{10 - wickets}</b> {wickets === 9 ? 'wicket' : 'wickets'}
      </>
    );
    side = left ? `with ${plural(left, 'ball')} to spare` : 'off the last ball';
  } else if (result === 'tied') {
    main = (
      <>
        Scores level: a <strong>Super Over</strong>
      </>
    );
  } else if (result === 'lost') {
    main = (
      <>
        <strong>{chase.other}</strong> win by <b>{need - 1}</b> {need - 1 === 1 ? 'run' : 'runs'}
      </>
    );
  } else {
    main = (
      <>
        {chase.team} need <b>{need}</b> off <b>{left}</b> {left === 1 ? 'ball' : 'balls'}
      </>
    );
    side = `${(need / (left / 6)).toFixed(1)} an over needed · scoring ${(runs / (bowled / 6)).toFixed(1)}`;
  }
  return (
    <>
      <AppBar sport="Cricket" changed={balls.length > 0} onAgain={() => setBalls([])} />
      <div className="mdp-body">
        <p className="mdp-meta">{chase.meta}</p>
        <div className="mdp-unit">
          <div className="mdp-csb">
            <div className="mdp-csb-half" style={{ background: kits.first.fill, color: kits.first.ink }}>
              {result === 'lost' && <span className="mdp-csb-tag">Won</span>}
              <span className="mdp-csb-name">{chase.other}</span>
              <b className="mdp-csb-runs">{chase.otherScore}</b>
              <span className="mdp-csb-overs">20 overs</span>
            </div>
            <div className="mdp-csb-half" style={{ background: kits.chase.fill, color: kits.chase.ink }}>
              {result !== 'lost' && result !== 'tied' && <span className="mdp-csb-tag">{result === 'won' ? 'Won' : 'Batting'}</span>}
              <span className="mdp-csb-name">{chase.team}</span>
              <b key={runs * 100 + wickets} className={`mdp-csb-runs${balls.length ? ' mdp-pop' : ''}`}>
                {runs}/{wickets}
              </b>
              <span className="mdp-csb-overs">{left ? `${oversOf(bowled)} of 20 overs` : '20 overs'}</span>
            </div>
          </div>
          <div className="mdp-eq" aria-live="polite">
            <p className="mdp-eq-main">{main}</p>
            {side && <p className="mdp-eq-side">{side}</p>}
          </div>
        </div>
        <div className="mdp-head">
          <h3>
            20th over <span>{chase.bowler}</span>
          </h3>
          {balls.length > 0 && (
            <span className="mdp-small">
              {plural(over.runs, 'run')}
              {over.wickets ? `, ${plural(over.wickets, 'wicket')}` : ''}
            </span>
          )}
        </div>
        <div className="mdp-balls" aria-label="This over">
          {Array.from({ length: 6 }, (_, i) =>
            balls[i] ? (
              <Ball key={i} mark={balls[i]} kit={kits.chase} fresh={i === balls.length - 1} />
            ) : (
              <i key={i} className={`mdp-cball mdp-cball-todo${i === balls.length && !result ? ' mdp-cball-next' : ''}`} aria-hidden="true" />
            ),
          )}
        </div>
        <p className="mdp-prev">
          <span>
            19th over, {chase.prev.bowler}: <b>{plural(chase.prev.balls.reduce((t, m) => t + runsOf(m), 0), 'run')}</b>
          </span>
          <span className="mdp-mini">
            {chase.prev.balls.map((m, i) => (
              <Ball key={i} mark={m} kit={kits.chase} />
            ))}
          </span>
        </p>
        <div className="mdp-head">
          <h3>{result ? 'Not out' : 'At the crease'}</h3>
        </div>
        <div className="mdp-crease">
          {pair.map((b, i) => (
            <p key={b.name} className={`mdp-ccard${i === 0 && !result ? ' mdp-on' : ''}`} style={{ '--kit': kits.chase.fill }}>
              <span className="mdp-ccard-name">
                {b.name}
                {i === 0 && !result && <small> on strike</small>}
              </span>
              <span className="mdp-ccard-big">
                <b>{b.runs}</b> off {plural(b.balls, 'ball')}
              </span>
            </p>
          ))}
        </div>
        <div className="mdp-pair">
          <p className="mdp-small">
            Partnership <b>{pair[0].part + pair[1].part}</b> off {plural(pair[0].partBalls + pair[1].partBalls, 'ball')}
          </p>
          <div className="mdp-pair-bar" aria-hidden="true">
            {pair[0].part + pair[1].part > 0 &&
              pair.map((b, i) => <i key={b.name} style={{ flexGrow: b.part, background: kits.chase.fill, opacity: i ? 0.45 : 1 }} />)}
          </div>
        </div>
        <button type="button" className="mdp-cta" onClick={result ? () => setBalls([]) : () => setBalls((b) => [...b, nextBall()])}>
          {result ? 'Bowl the over again' : balls.length ? 'Bowl the next ball' : 'Bowl the first ball'}
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ F1: the title race */

// The top five's points for a race: the winner's 25, the rest finishing behind in title order.
const POINTS = [25, 18, 15, 12, 10];

/** The standings after these winners, round by round. */
function after(start, winners) {
  let rows = start;
  for (const id of winners) {
    const order = [rows.find((d) => d.id === id), ...rows.filter((d) => d.id !== id)];
    rows = order.map((d, i) => ({ ...d, points: d.points + POINTS[i] })).sort((a, b) => b.points - a.points);
  }
  return rows;
}

/** The last six races of a season: tap who wins each one. */
export function Formula1({ drivers, rounds, total, season }) {
  const [winners, setWinners] = useState([]);
  const rows = useMemo(() => after(drivers, winners), [drivers, winners]);
  const played = winners.length;
  const race = rounds[played] ?? null;
  const shown = race ?? rounds[rounds.length - 1];
  const t = titleRace(
    { drivers: rows, constructors: [] },
    rounds.map((x) => ({ round: x.round, sessions: [{ label: 'Race' }] })),
    Object.fromEntries(rounds.slice(0, played).map((x) => [x.round, true])),
    {},
  );
  const d = t.drivers;
  const top = rows[0].points;
  const box = useFlip(rows.map((x) => x.id).join());
  const lastWin = played ? `${drivers.find((x) => x.id === winners[played - 1]).last} won in ${rounds[played - 1].city}` : null;
  const pts = (n) => (n === 1 ? 'point' : 'points');
  let say;
  if (!t.racesLeft) {
    say = d.gap ? (
      <>
        <strong>{d.leader.last}</strong> wins the title by <b>{d.gap}</b> {pts(d.gap)}
      </>
    ) : (
      <>
        <strong>{d.leader.last}</strong> and {d.second.last} finish level: it goes to who won more races
      </>
    );
  } else if (d.decided) {
    say = (
      <>
        <strong>{d.leader.last}</strong> is champion: {d.second.last} can’t make up {d.gap} points with {t.most.driver} left to win
      </>
    );
  } else {
    say = (
      <>
        {d.gap ? (
          <>
            <strong>{d.leader.last}</strong> leads {d.second.last} by <b>{d.gap}</b> {pts(d.gap)}
          </>
        ) : (
          <>
            <strong>{d.leader.last}</strong> and {d.second.last} are level
          </>
        )}
        , with up to <b>{t.most.driver}</b> still to win. {d.contenders > 2 ? `${d.contenders} drivers can still take it.` : 'It’s between the two of them.'}
      </>
    );
  }
  return (
    <>
      <AppBar sport="F1" changed={played > 0} onAgain={() => setWinners([])} />
      <div className="mdp-body">
        <section className="mdp-f1h" aria-label={race ? race.name : `The ${season} season`}>
          <svg key={`track-${shown.id}`} className="mdp-f1h-track" viewBox={`-3 -3 ${shown.w + 6} ${shown.h + 6}`} role="img" aria-label={`The ${shown.circuit}`}>
            <path d={shown.path} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <p className="mdp-f1h-kicker">{race ? `Round ${race.round} of ${total} · ${race.country}` : `The ${season} season`}</p>
          <p key={`name-${shown.id}`} className="mdp-f1h-name">
            {race ? race.name : 'Season over'}
          </p>
          <p className="mdp-f1h-where">{race ? race.where : `${lastWin}, the last race`}</p>
          <div className="mdp-f1h-now" aria-live="polite">
            {race ? (
              <>
                <span className="mdp-f1h-label">Your call</span>
                <b className="mdp-f1h-ask">Who wins in {race.city}?</b>
              </>
            ) : (
              <>
                <span className="mdp-f1h-label">{d.gap ? `${season} champion` : `${season}: level on points`}</span>
                <b className="mdp-f1h-big">{d.gap ? rows[0].last : 'Tied'}</b>
              </>
            )}
          </div>
          <p className="mdp-f1h-facts">
            {!race
              ? 'Again plays the season once more'
              : lastWin
                ? `Last race: ${lastWin}`
                : `${(race.length / 1000).toFixed(1)} km a lap · first Grand Prix here ${race.firstGp}`}
          </p>
        </section>
        <ol className="mdp-f1t" ref={box} aria-label="The drivers’ title">
          {rows.map((x) => (
            <li key={x.id} data-flip={x.id}>
              <button
                type="button"
                className="mdp-f1t-bar"
                disabled={!race}
                onClick={() => setWinners((w) => [...w, x.id])}
                style={{ width: `${Math.max(40, (x.points / top) * 100)}%`, background: x.color, color: x.ink }}
                aria-label={race ? `${x.last} wins in ${race.city}` : x.last}
              >
                <b>{x.last}</b>
                <small>{x.team}</small>
              </button>
              <b key={x.points} className={`mdp-f1t-pts${played ? ' mdp-pop' : ''}`}>
                {x.points}
              </b>
              <span className="mdp-f1t-gap">{top - x.points ? `−${top - x.points}` : ''}</span>
            </li>
          ))}
        </ol>
        <div className="mdp-band mdp-band-title" aria-live="polite">
          <span className="mdp-band-main">
            <span>{say}</span>
          </span>
        </div>
      </div>
    </>
  );
}
