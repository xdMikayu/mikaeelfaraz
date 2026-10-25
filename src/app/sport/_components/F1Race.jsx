'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { lapText } from '@/lib/sport/f1.mjs';
import { Mark } from './f1bits';
import { LapStrip, Tyre, TYRE, useSlide } from './F1Timing';

// The race as it moves: rows slide as cars pass each other and pit, the moves themselves are listed
// (passes, stops, the fastest lap, retirements) and flagged on the rows for twenty seconds, and the
// driver followed has the gaps either side, the lap under way and where a stop would put them.

const ordinal = (n) => `${n}${n % 100 > 10 && n % 100 < 14 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th'}`;
const andList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''));
const secs = (x) => `+${x.toFixed(3)}`;
const ageOf = (at, t) => Math.max(0, Math.round((Date.parse(t.at) - Date.parse(at)) / 1000));
const tyres = (c) => `${TYRE[c] ?? String(c).toLowerCase()}s`;

/** A lap time in F1's colours: purple for the fastest of the race, green for the driver's best. */
export function LapTime({ t, fastest = t?.fastest }) {
  if (!t?.s) return <span className="sp-muted">–</span>;
  return <span className={fastest ? 'sp-f1-lt-p' : t.pb ? 'sp-f1-lt-g' : undefined}>{lapText(t.s)}</span>;
}

/** Places gained or lost since the start: "▲3", "▼2". */
function SinceStart({ grid, pos }) {
  if (!grid || !pos || grid === pos) return null;
  const up = grid > pos;
  return (
    <small className="sp-num sp-f1-moved" style={{ color: up ? 'var(--sp-win)' : 'var(--sp-muted)' }}>
      {up ? '▲' : '▼'}
      {Math.abs(grid - pos)}
    </small>
  );
}

/** The gap column: to the car ahead, or to the leader. */
function raceGap(d, i, mode) {
  if (d.out) return <span className="sp-muted">{d.out === 'retired' ? 'Retired' : 'Stopped'}</span>;
  if (d.pit === 'in' || d.lap?.phase === 'pit') return <span className="sp-f1-tag">In pit</span>;
  if (i === 0) return <span className="sp-muted">Leader</span>;
  const g = mode === 'int' ? d.int : d.gap;
  if (!g) return <span className="sp-muted">–</span>;
  if (g.laps) return `+${g.laps} ${g.laps === 1 ? 'lap' : 'laps'}`;
  return <span className={mode === 'int' && g.s < 1 ? 'sp-f1-close' : undefined}>{secs(g.s)}</span>;
}

const inPits = (d) => Boolean(d.pit) || d.lap?.phase === 'pit' || d.lap?.phase === 'out';
const racing = (t) => t.session.status === 'running' && ['green', 'yellow'].includes(t.track) && (t.lap?.now ?? 0) > 1;

/**
 * What happened between one state and the next, newest first:
 *   - passes on track: two cars that swapped places and are still that way round in the state after
 *     (F1's order flickers between cars a few tenths apart), neither in the pits or on an out lap,
 *     under green flags and after the first lap, when the order is still firming up;
 *   - pit stops: from what place, and once back out, where and on what tyres (F1 can name the new
 *     set a few seconds after the car rejoins);
 *   - retirements, and each new fastest lap from the third lap.
 * Kept for this visit, from the states shown, so a TV delay holds them back too.
 */
export function useRaceMoves(t) {
  const prev = useRef(null);
  const seen = useRef([]);
  const [list, setList] = useState([]);
  useEffect(() => {
    const p = prev.current;
    prev.current = t;
    if (!p || p.at === t.at || p.session.key !== t.session.key || Date.parse(t.at) < Date.parse(p.at) || t.session.status === 'waiting') return;
    const lap = t.lap?.now ?? null;
    const was = new Map(p.drivers.map((d) => [d.n, d]));
    const now = new Map(t.drivers.map((d) => [d.n, d]));
    const fresh = [];
    const exits = [];
    for (const d of t.drivers) {
      const w = was.get(d.n);
      if (!w) continue;
      if (d.out && !w.out) fresh.push({ kind: 'out', n: d.n, how: d.out, from: w.pos });
      else if (d.pit === 'in' && w.pit !== 'in') fresh.push({ kind: 'pit', n: d.n, from: w.pos, stints: w.stints.length });
      else if (w.pit === 'in' && d.pit !== 'in' && !d.out) exits.push({ n: d.n, to: d.pos });
    }
    // Swaps seen in the last state that still stand become passes, grouped by the car that made them.
    const stands = seen.current.filter((x) => {
      const a = now.get(x.a);
      const b = now.get(x.b);
      return a && b && !a.out && !b.out && !inPits(a) && !inPits(b) && a.pos < b.pos;
    });
    for (const n of new Set(stands.map((x) => x.a))) {
      const mine = stands.filter((x) => x.a === n);
      fresh.push({ kind: 'pass', n, passed: mine.map((x) => x.b).sort((x, y) => now.get(x).pos - now.get(y).pos), from: mine[0].from, to: now.get(n).pos, at: mine[0].at, lap: mine[0].lap });
    }
    seen.current = [];
    if (racing(t) && racing(p)) {
      const on = t.drivers.filter((d) => !d.out && !inPits(d) && was.get(d.n) && !was.get(d.n).out && !inPits(was.get(d.n)));
      for (const a of on) for (const b of on) if (a !== b && was.get(b.n).pos < was.get(a.n).pos && b.pos > a.pos) seen.current.push({ a: a.n, b: b.n, from: was.get(a.n).pos, at: t.at, lap });
    }
    if (t.fastest && (lap ?? 0) > 2 && (!p.fastest || p.fastest.n !== t.fastest.n || t.fastest.s < p.fastest.s - 1e-6)) fresh.push({ kind: 'fastest', n: t.fastest.n, s: t.fastest.s });
    // The tyres a stop went onto: the stint F1 adds after it, once it names the compound.
    const fitted = (e) => {
      const st = now.get(e.n)?.stints ?? [];
      return st.length > e.stints && TYRE[st.at(-1)[0]] ? st.at(-1)[0] : null;
    };
    setList((l) => {
      const done = l.map((e) => {
        if (e.kind !== 'pit') return e;
        const x = e.to == null ? exits.find((y) => y.n === e.n) : null;
        if (x) return { ...e, to: x.to, tyre: fitted(e), outAt: t.at };
        if (e.to != null && !e.tyre && fitted(e) && ageOf(e.outAt, t) < 180) return { ...e, tyre: fitted(e) };
        return e;
      });
      if (!fresh.length && done.every((e, i) => e === l[i])) return l;
      return [...fresh.map((e) => ({ at: t.at, lap, ...e })), ...done].slice(0, 40);
    });
  }, [t]);
  return list;
}

/** Places each car has gained (+) or lost (−) in the last `within` seconds, from passes and stops. */
function lately(moves, t, within = 20) {
  const out = {};
  for (const e of moves) {
    if (e.kind === 'pass' && ageOf(e.at, t) <= within) {
      out[e.n] = (out[e.n] ?? 0) + (e.from - e.to);
      for (const b of e.passed) out[b] = (out[b] ?? 0) - 1;
    }
    if (e.kind === 'pit' && e.outAt && ageOf(e.outAt, t) <= within) out[e.n] = (out[e.n] ?? 0) + (e.from - e.to);
  }
  return out;
}

/** The race's running order: rows slide as cars pass and pit, and a car that has just moved says by how much. */
export function RaceTower({ t, mode, setMode, open, setOpen, follow, setFollow, moves, renderDetails }) {
  const slide = useSlide();
  const lap1 = t.session.status === 'running' && t.lap?.now <= 1;
  const moved = lately(moves, t);
  const fresh = lately(moves, t, 6);
  return (
    <section className="sp-section">
      {t.session.status === 'waiting' ? (
        <div className="sp-pad sp-section-head">
          <h2 className="sp-h2">The grid</h2>
        </div>
      ) : (
        <div className="sp-pad sp-f1-tower-head">
          <div className="sp-tabs" role="radiogroup" aria-label="Gaps">
            <button role="radio" aria-checked={mode === 'int'} onClick={() => setMode('int')}>
              Gap to the car ahead
            </button>
            <button role="radio" aria-checked={mode === 'gap'} onClick={() => setMode('gap')}>
              Gap to the leader
            </button>
          </div>
        </div>
      )}
      <div className="sp-f1-tt" role="table" aria-label="Running order">
        <div className="sp-f1-trow sp-f1-trow-race sp-f1-thead" role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">Driver</span>
          <span role="columnheader">Gap</span>
          <span role="columnheader">Last lap</span>
          <span role="columnheader">Tyre</span>
          <span role="columnheader" className="sp-f1-twide">
            Stops
          </span>
          <span role="columnheader" className="sp-f1-twide">
            Best
          </span>
        </div>
        {t.drivers.map((d, i) => {
          const isOpen = open === d.n;
          const now = moved[d.n] ?? 0;
          const cls = ['sp-f1-trow', 'sp-f1-trow-race', d.n === follow ? 'sp-f1-trow-mine' : '', d.out ? 'sp-f1-gone' : '', isOpen ? 'sp-f1-open' : '', fresh[d.n] > 0 ? (d.n === follow ? 'sp-f1-trow-gain' : 'sp-f1-trow-new') : '']
            .filter(Boolean)
            .join(' ');
          return (
            <Fragment key={d.n}>
              <div ref={slide(d.n)} className={cls} role="row" style={{ '--team': d.color ?? 'var(--sp-rule-2)' }} onClick={() => setOpen(isOpen ? null : d.n)}>
                <span className="sp-f1-tpos" role="cell">
                  <span className="sp-num">{d.out ? '–' : d.pos}</span>
                  {now ? (
                    <small key={`${now}${d.pos}`} className={`sp-num sp-f1-jump${now < 0 ? ' sp-f1-drop' : ''}`} aria-label={now > 0 ? `up ${now}` : `down ${-now}`}>
                      {now > 0 ? '▲' : '▼'}
                      {Math.abs(now)}
                    </small>
                  ) : (
                    !d.out && <SinceStart grid={d.grid} pos={d.pos} />
                  )}
                </span>
                <span role="cell" className="sp-f1-tname">
                  <button className="sp-f1-who" aria-expanded={isOpen} title={`${d.first} ${d.last}${d.team ? `, ${d.team}` : ''}`}>
                    <Mark color={d.color} />
                    <b>{d.last}</b>
                    {d.n === follow && (
                      <span className="sp-f1-star" aria-label="Following">
                        ★
                      </span>
                    )}
                    {d.lap?.phase === 'out' && !d.out && (
                      <small className="sp-f1-tag" title="Out lap, after a stop">
                        Out
                      </small>
                    )}
                  </button>
                </span>
                <span role="cell" className="sp-num">
                  {t.session.status === 'waiting' ? null : raceGap(d, i, mode)}
                </span>
                <span role="cell" className="sp-num">
                  <LapTime t={d.lastLap} />
                </span>
                <span role="cell">
                  <Tyre tyre={d.tyre} />
                </span>
                <span role="cell" className="sp-num sp-f1-twide">
                  {d.stops}
                </span>
                <span role="cell" className="sp-num sp-f1-twide">
                  <LapTime t={d.bestLap} fastest={t.fastest?.n === d.n} />
                </span>
              </div>
              {isOpen && (
                <div className="sp-f1-tmore">
                  {renderDetails(d)}
                  <button
                    className="sp-btn sp-f1-follow"
                    aria-pressed={follow === d.n}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFollow(follow === d.n ? null : d.n);
                    }}
                  >
                    {follow === d.n ? `★ Following ${d.last}` : `☆ Follow ${d.last}`}
                  </button>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
      <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>
        {lap1 ? 'Lap 1: the order firms up as the cars pass the timing points. ' : ''}Out: on the lap out of the pits. Under a position: places gained or lost since the start, or in bold, in the last few seconds. Lap times in F1’s colours: <span className="sp-f1-lt-p">purple</span> the fastest of the race,{' '}
        <span className="sp-f1-lt-g">green</span> the driver’s best. Tyres: the compound and the laps on that set (* used). Tap a driver for more.
      </p>
    </section>
  );
}

/** A move from the point of view of the driver followed. */
function followWords(e, d, name) {
  if (e.kind === 'pass' && e.n === d.n) return <>Passed {andList(e.passed.map(name))} for <b>{ordinal(e.to)}</b>.</>;
  if (e.kind === 'pass') return <>Passed by {name(e.n)}: down to <b>{ordinal(d.pos)}</b>.</>;
  if (e.kind === 'pit') return e.to == null ? <>In the pits from {ordinal(e.from)}.</> : <>Pitted from {ordinal(e.from)}: back out <b>{ordinal(e.to)}</b>{e.tyre ? ` on ${tyres(e.tyre)}` : ''}.</>;
  if (e.kind === 'fastest') return <>Fastest lap of the race: <b className="sp-num">{lapText(e.s)}</b>.</>;
  return <>{e.how === 'retired' ? 'Retired' : 'Stopped'}.</>;
}

/** A gap's trend in words, over the last three clean laps: + is the car behind closing. */
function trendWords(perLap) {
  if (perLap == null || Math.abs(perLap) < 0.05) return null;
  return <small className="sp-ink2">{perLap > 0 ? `closing ${perLap.toFixed(1)} s a lap` : `opening ${(-perLap).toFixed(1)} s a lap`}</small>;
}

/**
 * The driver followed in a race: the place (and since the start), the gaps to the cars either side
 * with which way they're going, the lap under way, the tyres and where a stop now would put them. A
 * pass, a stop or the fastest lap shows in words for twenty seconds.
 */
export function FollowRace({ d, t, moves, pit, trend, onStop }) {
  const i = t.drivers.indexOf(d);
  const ahead = i > 0 ? t.drivers[i - 1] : null;
  const behind = t.drivers.slice(i + 1).find((x) => !x.out) ?? null;
  const name = (n) => t.drivers.find((x) => x.n === n)?.last ?? n;
  const news = moves.find((e) => ageOf(e.outAt ?? e.at, t) <= 20 && (e.n === d.n || e.passed?.includes(d.n)));
  const up = news && ((news.kind === 'pass' && news.n === d.n) || (news.kind === 'pit' && news.to != null && news.to < news.from));
  const since = d.grid && !d.out ? (d.grid === d.pos ? `Started ${ordinal(d.grid)}` : `Started ${ordinal(d.grid)}: ${d.grid > d.pos ? 'up' : 'down'} ${Math.abs(d.grid - d.pos)}`) : null;
  const gap = (x) => (x?.laps ? `${x.laps} ${x.laps === 1 ? 'lap' : 'laps'}` : x?.s != null ? `${x.s.toFixed(1)} s` : '–');
  const p = pit(d);
  const facts = [TYRE[d.tyre?.c] ? `${tyres(d.tyre.c).replace(/^./, (c) => c.toUpperCase())}, ${d.tyre.age} ${d.tyre.age === 1 ? 'lap' : 'laps'} old` : null, d.stops ? `${d.stops} ${d.stops === 1 ? 'stop' : 'stops'}` : 'No stop yet', d.lastLap?.s ? `last lap ${lapText(d.lastLap.s)}` : null, d.bestLap?.s ? `best ${lapText(d.bestLap.s)}` : null].filter(Boolean);
  return (
    <section className="sp-pad" style={{ marginTop: 12 }}>
      <div className={`sp-f1-follow-card sp-f1-fl${up ? ' sp-f1-fl-gain' : ''}`} style={{ '--team': d.color ?? 'var(--sp-rule-2)' }}>
        <div className="sp-f1-fl-main">
          <div className="sp-f1-fl-top">
            <span key={d.pos} className="sp-num sp-f1-fl-pos">
              {d.out ? 'Out' : `P${d.pos}`}
            </span>
            <span className="sp-f1-fl-name">
              <span className="sp-f1-star" aria-hidden="true">
                ★
              </span>{' '}
              <b className="sp-f1-strong">{d.last}</b>
              {d.team && <span className="sp-muted"> {d.team}</span>}
            </span>
          </div>
          {news ? (
            <p key={`${news.at}${news.outAt ?? ''}`} className="sp-small sp-f1-fl-news">
              {followWords(news, d, name)}
            </p>
          ) : (
            <p className="sp-small sp-ink2 sp-f1-fl-doing">{d.lap?.phase === 'pit' || d.pit === 'in' ? 'In the pits.' : d.lap?.phase === 'out' ? 'Out lap, after the stop.' : since ? `${since}.` : ''}</p>
          )}
          {!d.out && (ahead || behind) && (
            <div className="sp-f1-gaps">
              {ahead && (
                <div>
                  <span className="sp-tiny sp-muted">Ahead: {ahead.last}</span>
                  <b className="sp-num">{gap(d.int)}</b>
                  {trendWords(trend(d.n))}
                </div>
              )}
              {behind && (
                <div>
                  <span className="sp-tiny sp-muted">
                    {ahead ? 'Behind' : 'Leading, from'}: {behind.last}
                  </span>
                  <b className="sp-num">{gap(behind.int)}</b>
                  {trendWords(trend(behind.n))}
                </div>
              )}
            </div>
          )}
          {d.lap?.segs && !d.out && <LapStrip segs={d.lap.segs} times={d.lap.sectors} big />}
          <p className="sp-tiny sp-ink2" style={{ margin: '8px 0 0' }}>
            {facts.join(' · ')}.
          </p>
          {p && (
            <p className="sp-tiny sp-ink2" style={{ margin: '4px 0 0' }}>
              {p.text}
            </p>
          )}
        </div>
        <button className="sp-btn sp-btn-quiet sp-f1-unfollow" onClick={onStop} aria-label={`Stop following ${d.last}`}>
          ×
        </button>
      </div>
    </section>
  );
}

/** A move in words for the list. */
function moveWords(e, name) {
  if (e.kind === 'pass') return <><b>{name(e.n)}</b> passes {andList(e.passed.map(name))} for <b>{ordinal(e.to)}</b></>;
  if (e.kind === 'pit') return <><b>{name(e.n)}</b> pits from {ordinal(e.from)}{e.to != null ? <>, back out <b>{ordinal(e.to)}</b>{e.tyre ? ` on ${tyres(e.tyre)}` : ''}</> : ''}</>;
  if (e.kind === 'out') return <><b>{name(e.n)}</b> {e.how === 'retired' ? 'retires' : 'stops'} from {ordinal(e.from)}</>;
  return <>Fastest lap: <b>{name(e.n)}</b>, <span className="sp-num sp-f1-lt-p">{lapText(e.s)}</span></>;
}

/** The race's moves since the page opened: passes, stops, retirements and fastest laps, newest first. */
export function LatestMoves({ moves, t }) {
  const [all, setAll] = useState(false);
  if (!moves.length) return null;
  const who = Object.fromEntries(t.drivers.map((d) => [d.n, d]));
  const name = (n) => who[n]?.last ?? n;
  const list = all ? moves : moves.slice(0, 6);
  return (
    <section className="sp-section">
      <div className="sp-pad sp-section-head">
        <h2 className="sp-h2">Latest moves</h2>
        <span className="sp-tiny sp-muted">Since you opened the page</span>
      </div>
      <ul className="sp-f1-list sp-f1-moves">
        {list.map((e, k) => (
          <li key={`${e.kind}${e.n}${e.at}${k}`}>
            <span className="sp-num sp-muted">{e.lap ? `Lap ${e.lap}` : ''}</span>
            <span className="sp-f1-move">
              <Mark color={who[e.n]?.color} />
              <span>{moveWords(e, name)}</span>
            </span>
          </li>
        ))}
      </ul>
      {moves.length > 6 && (
        <div className="sp-pad">
          <button className="sp-btn sp-btn-quiet" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => setAll(!all)}>
            {all ? 'Fewer' : `All ${moves.length}`}
          </button>
        </div>
      )}
    </section>
  );
}

/** The race under the status card: the driver followed, the moving order and the latest moves. */
export function RaceSession({ t, follow, setFollow, open, setOpen, mode, setMode, renderDetails, pit, trend }) {
  const moves = useRaceMoves(t);
  const followed = t.drivers.find((d) => d.n === follow);
  return (
    <>
      {followed && <FollowRace d={followed} t={t} moves={moves} pit={pit} trend={trend} onStop={() => setFollow(null)} />}
      <RaceTower t={t} mode={mode} setMode={setMode} open={open} setOpen={setOpen} follow={follow} setFollow={setFollow} moves={moves} renderDetails={renderDetails} />
      <LatestMoves moves={moves} t={t} />
    </>
  );
}
