'use client';
// The live cricket match, built to be followed at a glance: a scoreboard in the two sides' colours,
// the one sentence that says where the match stands, this over ball by ball, the batters and the
// bowler as cards, and what's happened (wickets) as a timeline. Everything a newcomer might not read
// is said in words; the long form and records wait behind a tap.

import Link from 'next/link';
import Crest from './Crest';
import { useDark } from './colors';
import { useScrolledPast, StickyBar, StickyTeam } from './Sticky';
import { situation } from '@/lib/cricket.mjs';
import { matchKits } from '@/lib/kit-colors.mjs';
import { oversOf } from '@/lib/cricket-form.mjs';
import { kickoff, shortDate } from './time';

const nth = (n) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const oneDp = (x) => (Math.round(x * 10) / 10).toFixed(1);
const sr = (runs, balls) => (balls ? Math.round((runs / balls) * 100) : null);
const econ = (runs, balls) => (balls ? oneDp((runs / balls) * 6) : '–');
const shortOf = (d, id) => d.players[id]?.short ?? d.players[id]?.name ?? 'Unknown';
const nameOf = (d, id) => d.players[id]?.name ?? 'Unknown';
/** Runs off a ball as the scorer marks it: '•' 0, '4' 4, '1wd' 1, 'W' 0. */
const runsOf = (mark) => Number.parseInt(mark, 10) || 0;

/** Each side's colours for this match, by team id: { fill, ink, white, line }. */
export function useKits(d) {
  const dark = useDark();
  const [a, b] = d.card.teams;
  if (!a || !b) return {};
  const k = matchKits(a, b, dark);
  return { [a.id]: k.home, [b.id]: k.away };
}

const fillOf = (kit) => (kit?.white ? 'var(--sp-kit-white)' : kit?.fill ?? '#3a3a3a');

/** An innings is over: all out, declared, or its overs used up. */
export const inningsDone = (inn) => Boolean(inn) && (inn.wickets >= 10 || inn.declared || (inn.ballLimit > 0 && inn.balls >= inn.ballLimit));

/**
 * The situation, corrected for the innings break of a one-day or T20 match: ESPN's score line can
 * leave out the overs limit then, so the first innings looks as if it's still going.
 */
export function settle(d, sit) {
  const inn = d.innings.at(-1);
  if (d.state !== 'in' || d.innings.length !== 1 || !inn?.ballLimit || !inningsDone(inn) || sit?.kind === 'set') return sit;
  const other = d.card.teams.find((t) => t.id !== inn.team);
  const by = d.card.teams.find((t) => t.id === inn.team);
  return { ...sit, kind: 'set', bat: null, team: other?.name, runs: inn.runs + 1, by: by?.name, maxOvers: inn.ballLimit / 6 };
}

/** The sides left to right in the order they batted (the first innings' side first). */
const ordered = (d) => {
  const first = d.innings[0]?.team;
  const teams = d.card.teams;
  return first && teams[1]?.id === first ? [teams[1], teams[0]] : teams;
};

/* ------------------------------------------------------------------ the scoreboard */

/** "19/20 ov" → "19 of 20 overs"; "45.2 ov" → "45.2 overs". */
const oversWords = (s) => {
  if (!s) return null;
  const m = String(s).match(/^([\d.]+)(?:\/(\d+))?\s*ov/);
  if (!m) return s.replace(/,?\s*target \d+/, '');
  return m[2] ? `${m[1]} of ${m[2]} overs` : `${m[1]} overs`;
};

/**
 * The top of the page: each side's half in its colours with its score in the scoreboard's type, and
 * under it, in ink, the sentence that matters: what's needed, the projected total, or the result.
 */
export function Scoreboard({ d, sit, kits }) {
  const [a, b] = ordered(d);
  const done = d.state === 'post';
  const [ref, away] = useScrolledPast();
  const half = (t) => {
    const kit = kits[t.id];
    const bat = sit?.bat === t.id && !['set', 'won', 'tied'].includes(sit?.kind);
    const won = done && t.winner;
    // Once the other side bats, ESPN's line for the first innings can drop its overs; the innings has them.
    const inn = d.innings.filter((x) => x.team === t.id).at(-1);
    const overs = oversWords(t.overs) ?? (inn?.overs && inn.ballLimit ? `${inn.overs} of ${inn.ballLimit / 6} overs` : null);
    return (
      <div className={`sp-csb-half${bat ? ' sp-csb-bat' : ''}`} style={{ background: fillOf(kit), color: kit?.ink ?? '#fff' }}>
        <span className="sp-csb-crest">
          <Crest src={t.logo ?? `https://a.espncdn.com/i/teamlogos/cricket/500/${t.id}.png`} size={34} light />
        </span>
        <span className="sp-csb-name">{t.name}</span>
        {t.runs ? (
          <>
            <b className="sp-csb-runs">{t.runs}</b>
            <span className="sp-csb-overs">{overs}</span>
          </>
        ) : (
          <span className="sp-csb-yet">{d.state === 'pre' ? '' : 'Yet to bat'}</span>
        )}
        {(bat || won) && <span className="sp-csb-tag">{won ? 'Won' : 'Batting'}</span>}
      </div>
    );
  };
  return (
    <>
      <header className="sp-csb" ref={ref}>
        <div className="sp-csb-halves">
          {half(a)}
          {b && half(b)}
          {d.title && <span className="sp-csb-chip">{d.title}</span>}
        </div>
        <Equation d={d} sit={sit} />
      </header>
      {d.state === 'in' && <StickyScore d={d} sit={sit} kits={kits} shown={away} />}
    </>
  );
}

/** The score kept in sight while a live match scrolls by: each side's score in its colour, and what's needed. */
function StickyScore({ d, sit, kits, shown }) {
  const teams = ordered(d).filter((t) => t?.runs);
  const words =
    sit?.kind === 'chase' ? `need ${sit.runs}${sit.balls != null ? ` off ${sit.balls}` : ''}` : sit?.kind === 'set' ? `${sit.team} need ${sit.runs}` : sit?.kind === 'rate' && d.read?.now?.projected ? `heading for ${d.read.now.projected.mean}` : null;
  return (
    <StickyBar shown={shown}>
      {teams.map((t) => (
        <StickyTeam key={t.id} fill={fillOf(kits[t.id])} ink={kits[t.id]?.ink ?? '#fff'} name={t.short || t.name} score={t.runs} />
      ))}
      {words && <span className="sp-stick-words">{words}</span>}
    </StickyBar>
  );
}

/**
 * A match in a list, as a card in the two sides' colours: each side's score and, in ink, the
 * sentence that matters. The whole card opens the match.
 */
export function CricketCard({ m }) {
  const dark = useDark();
  // The side that batted first leads. The chasing side's score line names the target; failing that,
  // the side with a score while the other bats, or the only one with a score.
  const [x, y] = m.teams;
  const chasing = m.teams.find((t) => /target/i.test(t.overs ?? ''));
  const [a, b] = chasing ? [m.teams.find((t) => t !== chasing), chasing] : y?.runs && (!x?.runs || x?.batting) ? [y, x] : [x, y];
  const k = a && b ? matchKits(a, b, dark) : null;
  const kits = k ? { [a.id]: k.home, [b.id]: k.away } : {};
  const sit = situation(m);
  const done = m.state === 'post';
  const half = (t) => {
    const kit = kits[t.id];
    const bat = sit?.bat === t.id && !['set', 'won', 'tied'].includes(sit?.kind) && !sit?.allOut && !sit?.declared;
    return (
      <div className={`sp-csb-half${bat ? ' sp-csb-bat' : ''}${done && !t.winner && m.teams.some((z) => z.winner) ? ' sp-csb-lost' : ''}`} style={{ background: fillOf(kit), color: kit?.ink ?? '#fff' }}>
        <span className="sp-csb-name">{t.name}</span>
        {t.runs ? (
          <>
            <b className="sp-csb-runs">{t.runs}</b>
            <span className="sp-csb-overs">{oversWords(t.overs)}</span>
          </>
        ) : (
          <span className="sp-csb-yet">{m.state === 'pre' ? '' : 'Yet to bat'}</span>
        )}
        {(bat || (done && t.winner)) && <span className="sp-csb-tag">{done ? 'Won' : 'Batting'}</span>}
      </div>
    );
  };
  const body = (
    <>
      <div className="sp-csb-halves">
        {half(a)}
        {b && half(b)}
      </div>
      <Equation d={{ state: m.state, card: m, read: m.read, start: m.start, summary: m.summary }} sit={sit} />
    </>
  );
  return m.league?.id ? (
    <Link className="sp-csb sp-csb-card" href={`/cricket/match?l=${m.league.id}&id=${m.id}`} aria-label={`${m.teams.map((t) => `${t.name} ${t.runs || ''}`.trim()).join(' v ')}: open the match`}>
      {body}
    </Link>
  ) : (
    <div className="sp-csb sp-csb-card">{body}</div>
  );
}

/** The ink band: one sentence, its numbers big. */
function Equation({ d, sit }) {
  const read = d.read?.now;
  let main = null;
  let side = null;
  if (d.state === 'pre') {
    main = <>Starts <b>{kickoff(d.start)}</b>{new Date(d.start).toDateString() === new Date().toDateString() ? ' today' : `, ${shortDate(d.start)}`}</>;
    side = d.toss ?? null;
  } else if (d.state === 'post') {
    // "AUS Women won by 8 wickets (with 164 balls remaining)": the result in bold, the rest plain.
    const text = d.card.status || d.summary || '';
    const [, said, rest] = text.match(/^(.*?)(\s*\(.*\))?$/) ?? [null, text, ''];
    main = (
      <>
        <strong>{said}</strong>
        {rest}
      </>
    );
  } else if (sit?.kind === 'chase') {
    main = (
      <>
        {sit.team} need <b>{sit.runs}</b>
        {sit.balls != null && (
          <>
            {' '}
            off <b>{sit.balls}</b> {sit.balls === 1 ? 'ball' : 'balls'}
          </>
        )}
      </>
    );
    // The rate they're scoring at means little before an over is done (one four off one ball is 24 an over).
    side = [sit.needRate != null && `${oneDp(sit.needRate)} an over needed`, sit.rate != null && sit.bowled >= 6 && `scoring ${oneDp(sit.rate)}`].filter(Boolean).join(' · ');
  } else if (sit?.kind === 'rate') {
    main = read?.projected ? (
      <>
        Heading for <b>{read.projected.mean}</b>
      </>
    ) : (
      <>
        Scoring <b>{oneDp(sit.rate)}</b> an over
      </>
    );
    side = read?.projected ? `scoring ${oneDp(sit.rate)} an over` : d.read?.par ? `par here ${d.read.par}` : null;
  } else if (sit?.kind === 'set') {
    main = (
      <>
        {sit.team} need <b>{sit.runs}</b> to win
      </>
    );
    side = sit.maxOvers ? `from ${sit.maxOvers} overs` : null;
  } else if (sit) {
    // Multi-day matches: who leads or trails, by how much, with the wickets left.
    const runs = sit.runs;
    const word = { lead: 'lead by', trail: 'trail by', need: 'need', first: null, level: null }[sit.kind];
    main = word ? (
      <>
        {sit.team} {word} <b>{runs}</b>
      </>
    ) : (
      <>{sit.kind === 'level' ? 'Scores level' : `${sit.team} batting`}</>
    );
    side = sit.allOut ? 'all out' : sit.declared ? 'declared' : plural(sit.left, 'wicket') + ' left';
  } else {
    main = <>{d.card.status || d.summary}</>;
  }
  return (
    <div className="sp-csb-eq" role="status">
      <p className="sp-csb-eq-main">{main}</p>
      {side && <p className="sp-csb-eq-side">{side}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ this over */

/** One ball as a chip: wickets red, boundaries in the batting side's colours, dots grey, extras outlined. */
function Ball({ mark, kit }) {
  const kind = mark === 'W' ? 'w' : mark === '4' || mark === '6' ? 'b' : mark === '•' ? 'dot' : /[a-z]/.test(mark) ? 'x' : 'run';
  const style = kind === 'b' ? { background: fillOf(kit), color: kit?.ink ?? '#fff' } : undefined;
  const label = { w: 'wicket', b: `${mark}, boundary`, dot: 'no run', x: mark.replace('wd', ' wide').replace('nb', ' no-ball').replace('lb', ' leg bye').replace(/(\d)b$/, '$1 bye'), run: `${mark} run${mark === '1' ? '' : 's'}` }[kind];
  return (
    <i className={`sp-cball sp-cball-${kind}${mark === '6' ? ' sp-cball-six' : ''}`} style={style} title={label} aria-label={label}>
      {mark === '•' ? '' : mark}
    </i>
  );
}

/** The over being bowled ball by ball, big, and the one before it. */
export function ThisOver({ d, inn, kits }) {
  const overs = inn.recent ?? [];
  if (!overs.length) return null;
  const kit = kits[inn.team];
  const [now, before] = [overs.at(-1), overs.at(-2)];
  // The over being bowled is counted from the score, which is always current: the innings total now
  // less the total at the end of the over before. The ball-by-ball can be a ball or two behind.
  const current = inn.balls % 6 ? Math.floor(inn.balls / 6) + 1 : Math.floor(inn.balls / 6);
  const before0 = now.n === 1 ? { total: 0, down: 0 } : inn.byOver?.find((o) => o.n === now.n - 1);
  const fromScore = now.n === current && before0 ? { runs: inn.runs - before0.total, wickets: inn.wickets - before0.down } : null;
  const total = (o) => (o === now && fromScore ? fromScore.runs : o.balls.reduce((t, m) => t + runsOf(m), 0));
  const wkts = (o) => (o === now && fromScore ? fromScore.wickets : o.balls.filter((m) => m === 'W').length);
  const line = (o) => `${plural(total(o), 'run')}${wkts(o) ? `, ${plural(wkts(o), 'wicket')}` : ''}`;
  const lag = inn.byOver?.length > 0 && inn.balls - inn.byOver.at(-1).balls > 3;
  // Slots for the balls still to come, only while this over is the one being bowled.
  const legal = now.balls.filter((m) => !/wd|nb/.test(m)).length;
  const todo = !lag && !inningsDone(inn) && inn.balls % 6 === legal % 6 ? Math.max(0, 6 - legal) : 0;
  return (
    <section className="sp-section sp-cover">
      <div className="sp-section-head">
        <h2 className="sp-h2">
          {inningsDone(inn) ? 'Last over' : `${nth(now.n)} over`} <span className="sp-cover-who">{nameOf(d, now.bowler)}</span>
        </h2>
        {/* While the ball-by-ball lags well behind, an over's total from its balls would mislead. */}
        {(fromScore || !lag) && <span className="sp-small sp-ink2 sp-num">{line(now)}</span>}
      </div>
      <div className="sp-cover-balls">
        {now.balls.map((m, i) => (
          <Ball key={i} mark={m} kit={kit} />
        ))}
        {/* The balls still to come in a six-ball over, as empty slots. */}
        {Array.from({ length: todo }, (_, i) => (
          <i key={`e${i}`} className="sp-cball sp-cball-todo" aria-hidden="true" />
        ))}
      </div>
      {before && (
        <p className="sp-cover-prev sp-small sp-ink2">
          <span>
            {nth(before.n)} over, {nameOf(d, before.bowler)}: <b className="sp-num">{line(before)}</b>
          </span>
          <span className="sp-cover-mini">
            {before.balls.map((m, i) => (
              <Ball key={i} mark={m} kit={kit} />
            ))}
          </span>
        </p>
      )}
      {inn.byOver?.length >= 6 && (
        <p className="sp-small sp-ink2" style={{ margin: '8px 0 0' }}>
          Last 5 overs:{' '}
          <b className="sp-num" style={{ color: 'var(--sp-ink)' }}>
            {plural(
              inn.byOver.slice(-5).reduce((t, o) => t + o.runs, 0),
              'run',
            )}
            {(() => {
              const w = inn.byOver.slice(-5).reduce((t, o) => t + o.wickets, 0);
              return w ? `, ${plural(w, 'wicket')}` : '';
            })()}
          </b>
        </p>
      )}
      {lag && <p className="sp-tiny sp-muted" style={{ margin: '6px 0 0' }}>ESPN’s ball-by-ball is a few balls behind the score.</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ the batters and the bowler */

/** The two batters as cards, the striker first, and their partnership as one bar split between them. */
export function Crease({ d, inn, kits, details }) {
  const kit = kits[inn.team];
  const over = inningsDone(inn);
  const batters = inn.batting.filter((b) => !b.out && (b.balls > 0 || b.now)).sort((a, b) => (a.now === 'striker' ? -1 : b.now === 'striker' ? 1 : 0));
  if (!batters.length) return null;
  const pair = inn.partnerships.at(-1);
  const unbroken = pair && (pair.batters ? pair.batters.every((x) => batters.some((b) => b.id === x.id)) : pair.ended === false);
  const order = (id) => batters.findIndex((b) => b.id === id);
  const shares = unbroken && pair.batters?.length === 2 ? [...pair.batters].sort((x, y) => order(x.id) - order(y.id)) : null;
  return (
    <section className="sp-section">
      <h2 className="sp-h2">{over ? 'Not out' : 'At the crease'}</h2>
      <div className="sp-ccards">
        {batters.map((b) => (
          <article key={b.id} className={`sp-ccard${b.now === 'striker' && !over ? ' sp-ccard-strike' : ''}`} style={{ '--kit': kit?.line ?? 'var(--sp-ink)' }}>
            <p className="sp-ccard-name">
              {nameOf(d, b.id)}
              {b.now === 'striker' && !over && <span className="sp-ccard-striker"> on strike</span>}
            </p>
            <p className="sp-ccard-big">
              <b>{b.runs}</b>
              <span> off {plural(b.balls, 'ball')}</span>
            </p>
            <p className="sp-ccard-line">
              {plural(b.fours, 'four')} · {plural(b.sixes, 'six', 'sixes')}
              {sr(b.runs, b.balls) != null ? ` · strike rate ${sr(b.runs, b.balls)}` : ''}
            </p>
            {b.runs >= 50 && <p className="sp-ccard-mark">{b.runs >= 100 ? 'Hundred' : 'Fifty'}</p>}
            {details?.(b.id, 'bat')}
          </article>
        ))}
      </div>
      {unbroken && (
        <div className="sp-cpair">
          <p className="sp-small sp-ink2" style={{ margin: 0 }}>
            {over ? 'Unbroken partnership' : 'Partnership'} <b className="sp-num" style={{ color: 'var(--sp-ink)' }}>{pair.runs}</b> off {plural(pair.balls, 'ball')}
          </p>
          {shares && pair.runs > 0 && (
            <>
              <div className="sp-cpair-bar" role="img" aria-label={shares.map((x) => `${shortOf(d, x.id)} ${x.runs}`).join(', ')}>
                {shares.map((x, i) => (
                  <i key={x.id} style={{ width: `${(x.runs / Math.max(1, pair.runs)) * 100}%`, background: kit?.line ?? 'var(--sp-ink)', opacity: i ? 0.45 : 1 }} />
                ))}
              </div>
              <p className="sp-cpair-l sp-tiny sp-ink2">
                {shares.map((x) => (
                  <span key={x.id}>
                    {nameOf(d, x.id)} <b className="sp-num">{x.runs}</b> ({x.balls})
                  </span>
                ))}
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** The bowler on, as a card, and who bowled the over before. */
export function Bowling({ d, inn, kits, details }) {
  const bowlingSide = d.card.teams.find((t) => t.id !== inn.team);
  const kit = kits[bowlingSide?.id];
  if (inningsDone(inn)) {
    // The innings is over: its two best spells, most wickets then fewest runs an over.
    const best = [...inn.bowling].filter((b) => b.balls > 0).sort((a, b) => b.wickets - a.wickets || a.runs / a.balls - b.runs / b.balls).slice(0, 2);
    if (!best.length) return null;
    return (
      <section className="sp-section">
        <h2 className="sp-h2">Best bowling</h2>
        <div className="sp-ccards">{best.map((b) => <BowlerCard key={b.id} d={d} b={b} kit={kit} details={details} />)}</div>
      </section>
    );
  }
  const on = inn.bowling.find((b) => b.now === 'bowling');
  const last = inn.bowling.find((b) => b.now === 'bowled last');
  if (!on && !last) return null;
  return (
    <section className="sp-section">
      <h2 className="sp-h2">Bowling</h2>
      <div className="sp-ccards">
        {on && <BowlerCard d={d} b={on} kit={kit} word="bowling" details={details} />}
        {last && <BowlerCard d={d} b={last} kit={kit} word="bowled the last over" details={details} />}
      </div>
    </section>
  );
}

function BowlerCard({ d, b, kit, word, details }) {
  return (
    <article className="sp-ccard" style={{ '--kit': kit?.line ?? 'var(--sp-ink)' }}>
      <p className="sp-ccard-name">
        {nameOf(d, b.id)} {word && <span className="sp-ccard-on">{word}</span>}
      </p>
      <p className="sp-ccard-big">
        <b>
          {b.wickets}–{b.runs}
        </b>
        <span> in {oversOf(b.balls)} {b.balls === 6 ? 'over' : 'overs'}</span>
      </p>
      <p className="sp-ccard-line">
        {econ(b.runs, b.balls)} an over{b.dots != null ? ` · ${plural(b.dots, 'dot ball')}` : ''}
        {word && b.left != null ? ` · ${b.left ? `${oversOf(b.left)} left` : 'bowled out'}` : ''}
      </p>
      {details?.(b.id, 'bowl')}
    </article>
  );
}

/* ------------------------------------------------------------------ how the chase compares */

/**
 * In a one-day or T20 chase: where the chasing side is against the side that batted first at the
 * same point, said plainly. "India are 16 behind where West Indies were after 9 overs (98/1)."
 */
export function SameStage({ d, inn }) {
  const first = d.innings[0];
  if (!first || first === inn || !inn.ballLimit || !first.byOver?.length) return null;
  const overs = Math.floor(inn.balls / 6);
  if (overs < 1) return null;
  const then = first.byOver.find((o) => o.n === overs);
  const mine = inn.byOver?.find((o) => o.n === overs);
  if (!then || !mine) return null;
  const diff = mine.total - then.total;
  const us = d.card.teams.find((t) => t.id === inn.team)?.name;
  const them = d.card.teams.find((t) => t.id === first.team)?.name;
  return (
    <p className="sp-cstage">
      <b>
        {diff === 0 ? `${us} are level` : `${us} are ${Math.abs(diff)} ${diff > 0 ? 'ahead of' : 'behind'}`}
      </b>{' '}
      {diff === 0 ? 'with' : ''} where {them} were after {plural(overs, 'over')}: {then.total}/{then.down}, against {mine.total}/{mine.down} now.
    </p>
  );
}

/* ------------------------------------------------------------------ what's happened */

/** The wickets so far in this innings, latest first, each with the score it fell at and how. */
export function Wickets({ d, inn }) {
  const fow = inn.fow ?? [];
  if (!fow.length) return null;
  const how = (id) => {
    const b = inn.batting.find((x) => x.id === id);
    return b?.how ?? b?.card ?? null;
  };
  return (
    <section className="sp-section">
      <h2 className="sp-h2">Wickets</h2>
      <ol className="sp-cwk">
        {[...fow].reverse().map((w) => (
          <li key={w.n}>
            <i className="sp-cball sp-cball-w" aria-hidden="true">
              W
            </i>
            <span className="sp-cwk-who">
              <b>{nameOf(d, w.id)}</b> {w.batterRuns != null && <span className="sp-num">{w.batterRuns} ({w.batterBalls})</span>}
              {how(w.id) && <small>{how(w.id)}</small>}
            </span>
            <span className="sp-cwk-at sp-num">
              <b>
                {w.runs}/{w.n}
              </b>
              <small>{oversOf(w.balls)} ov</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
