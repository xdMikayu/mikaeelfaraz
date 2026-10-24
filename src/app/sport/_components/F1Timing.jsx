'use client';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { lapText } from '@/lib/sport/f1.mjs';
import { heat } from './fplbits';
import { Mark } from './f1bits';
import { COMPOUND, SHADE } from './F1Charts';

// Qualifying and practice, lap by lap: where each car is on its lap (F1's mini-sectors, in F1's own
// purple, green and yellow), what kind of lap it is, where a flying lap is heading, and the order
// moving as the times come in, so a jump from 16th to 9th is seen happening, not just found after.

export const TYRE = { SOFT: 'soft', MEDIUM: 'medium', HARD: 'hard', INTERMEDIATE: 'intermediate', WET: 'wet' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const laps = (n) => `${n} ${n === 1 ? 'lap' : 'laps'}`;
const ordinal = (n) => `${n}${n % 100 > 10 && n % 100 < 14 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th'}`;
const secs = (x) => `+${x.toFixed(3)}`;

/** What kind of lap a car is on, as the tower says it. */
export const PHASE = { push: 'Flying lap', out: 'Out lap', in: 'In lap', slow: 'Slow lap', done: 'Flag taken', track: 'On track', pit: 'In the pits' };
const ON_TRACK = ['push', 'out', 'in', 'slow', 'track'];
const onTrack = (d) => ON_TRACK.includes(d.lap?.phase);

/** A sector's colour: the best of anyone, the driver's best, or slower. */
const colourOf = (x) => (x ? (x.fastest ? 'p' : x.pb ? 'g' : 'y') : null);

/** The tyre: its compound in ink (more for softer, wet ones outlined) and the laps it has done. */
export function Tyre({ tyre }) {
  if (!tyre) return <span className="sp-muted">–</span>;
  const wet = tyre.c === 'INTERMEDIATE' || tyre.c === 'WET';
  return (
    <span className="sp-f1-tyre-now" title={`${cap(TYRE[tyre.c] ?? tyre.c)}, ${tyre.new ? 'new' : 'used'} set, ${laps(tyre.age)}`}>
      <i style={wet ? { boxShadow: 'inset 0 0 0 1.5px var(--sp-ink)' } : heat(SHADE[tyre.c] ?? 0)}>{COMPOUND[tyre.c] ?? '?'}</i>
      <span className="sp-num">
        {tyre.age}
        {tyre.new ? '' : '*'}
      </span>
    </span>
  );
}

/** The mini-sectors in words, for screen readers: "12 of 22 done: 2 fastest of anyone, 4 personal bests". */
function stripWords(segs) {
  const all = segs.join('');
  const done = all.replace(/\./g, '');
  const n = (c) => [...done].filter((x) => x === c).length;
  const bits = [n('p') && `${n('p')} fastest of anyone`, n('g') && `${n('g')} personal ${n('g') === 1 ? 'best' : 'bests'}`, n('b') && 'in the pit lane'].filter(Boolean);
  return `${done.length} of ${all.length} mini-sectors done${bits.length ? `: ${bits.join(', ')}` : ''}`;
}

/**
 * The lap so far as F1 draws it: each sector's mini-sectors, lit as the car passes them, purple for
 * the best of anyone, green for the driver's best, yellow for slower, blue in the pit lane. With
 * `times`, each sector's time under it, in its colour.
 */
export function LapStrip({ segs, times = null, big = false, dim = false }) {
  return (
    <span className={`sp-f1-strip${big ? ' sp-f1-strip-big' : ''}${dim ? ' sp-f1-strip-dim' : ''}`} role="img" aria-label={stripWords(segs)}>
      {segs.map((s, i) => (
        <span key={i} className="sp-f1-strip-sec" style={{ flexGrow: s.length || 1 }}>
          <span className="sp-f1-strip-segs">
            {[...s].map((c, j) => (
              <i key={j} className={`sp-f1-seg sp-f1-seg-${c === '.' ? 'n' : c}`} />
            ))}
          </span>
          {times && (
            <small className={`sp-num sp-f1-strip-time${times[i] ? ` sp-f1-st-${colourOf(times[i])}` : ''}`}>
              {times[i] ? lapText(times[i].s) : `S${i + 1}`}
            </small>
          )}
        </span>
      ))}
    </span>
  );
}

/** A car's time in this part of qualifying, or its best of the session in practice. */
const timeIn = (d, t) => (t.part ? d.q?.[t.part.now - 1] : d.bestLap?.s) ?? null;
const ageOf = (e, t) => Math.max(0, Math.round((Date.parse(t.at) - Date.parse(e.at)) / 1000));

/**
 * The lap that set a time, as the strip draws it. F1 clears a lap's mini-sectors once the car is into
 * the next, so they're taken from this state if they're still whole, else from the state before, its
 * last mini-sectors in the colour F1 gave their sector; the sector times likewise.
 */
function finishedLap(d, w) {
  const sectors = d.sectors.map((x, i) => x ?? w?.lap?.sectors?.[i] ?? null);
  const whole = (segs) => segs?.length && segs.every((x) => x && !x.includes('.'));
  const segs = whole(d.lap?.segs) ? d.lap.segs : (w?.lap?.segs?.map((x, i) => x.replace(/\./g, colourOf(sectors[i]) ?? 'y')) ?? null);
  return { segs, sectors };
}

/**
 * Times that moved the order, newest first: who set a time in this part (practice: the session), where
 * they were and where it put them, with the lap that did it. Kept for this visit, from the states
 * shown, so a TV delay holds them back too.
 */
export function useImprovements(t) {
  const prev = useRef(null);
  const [list, setList] = useState([]);
  useEffect(() => {
    const p = prev.current;
    prev.current = t;
    if (!p || p.at === t.at || p.session.key !== t.session.key || p.part?.now !== t.part?.now) return;
    const was = new Map(p.drivers.map((d) => [d.n, d]));
    const fresh = [];
    for (const d of t.drivers) {
      const w = was.get(d.n);
      const now = timeIn(d, t);
      const before = w ? timeIn(w, p) : null;
      if (!w || now == null || (before != null && now >= before)) continue;
      const lap = finishedLap(d, w);
      fresh.push({ n: d.n, at: t.at, part: t.part?.now ?? null, time: now, by: before != null ? before - now : null, from: before != null && w.shown ? w.pos : null, to: d.pos, lap, sectors: lap.sectors.map(colourOf) });
    }
    if (fresh.length) setList((l) => [...fresh.sort((a, b) => a.to - b.to), ...l].slice(0, 12));
  }, [t]);
  return list;
}

/** The latest time a car set, if it's from the last `within` seconds. */
const recent = (events, n, t, within) => events.find((e) => e.n === n && ageOf(e, t) <= within) ?? null;

/**
 * Slides rows from where they were to where they are now when the order changes (FLIP: measure the
 * old place, let the row move, animate it back from there). Those moving up pass over the others.
 * Returns a ref for each row by key.
 */
function useSlide() {
  const els = useRef(new Map());
  const tops = useRef(new Map());
  const refs = useRef(new Map());
  useLayoutEffect(() => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const next = new Map();
    for (const [k, el] of els.current) {
      const top = el.offsetTop;
      next.set(k, top);
      const was = tops.current.get(k);
      if (still || was == null || Math.abs(was - top) < 1 || !el.animate) continue;
      const dy = was - top;
      const a = el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: Math.min(1200, 420 + Math.abs(dy) * 1.2), easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
      if (dy > 0) {
        el.style.zIndex = '2';
        a.onfinish = a.oncancel = () => (el.style.zIndex = '');
      }
    }
    tops.current = next;
  });
  return (k) => {
    let f = refs.current.get(k);
    if (!f) {
      f = (el) => {
        if (el) els.current.set(k, el);
        else els.current.delete(k);
      };
      refs.current.set(k, f);
    }
    return f;
  };
}

/** Who's out on track now, by the kind of lap: tap a car to follow it. */
export function OnTrack({ t, follow, setFollow }) {
  const going = t.drivers.filter((d) => !d.knockedOut && !d.out);
  const groups = [
    ['push', 'Flying lap'],
    ['out', 'Out lap'],
    ['slow', 'Slow lap'],
    ['in', 'Into the pits'],
    ['track', 'On track'],
  ]
    .map(([k, label]) => [k, label, going.filter((d) => d.lap?.phase === k)])
    .filter(([, , ds]) => ds.length);
  const pits = going.filter((d) => d.lap?.phase === 'pit').length;
  if (!groups.length && !pits) return null;
  return (
    <div className="sp-pad sp-f1-ontrack">
      {groups.map(([k, label, ds]) => (
        <div key={k} className={`sp-f1-ot-row sp-f1-ot-${k}`}>
          <span className="sp-f1-ot-label">{label}</span>
          <span className="sp-f1-ot-cars">
            {ds.map((d) => (
              <button key={d.n} className="sp-f1-car" style={{ '--team': d.color ?? 'var(--sp-rule-2)' }} aria-pressed={follow === d.n} onClick={() => setFollow(follow === d.n ? null : d.n)} title={`${follow === d.n ? 'Stop following' : 'Follow'} ${d.first} ${d.last}`}>
                {d.code}
                {k === 'push' && d.lap?.pace?.better ? <small className="sp-num">P{d.lap.pace.pos}</small> : null}
              </button>
            ))}
          </span>
        </div>
      ))}
      {pits > 0 && (
        <p className="sp-tiny sp-muted" style={{ margin: groups.length ? '6px 0 0' : 0 }}>
          {pits} in the pits{groups.length ? '' : ': nobody on track'}.
        </p>
      )}
    </div>
  );
}

/** Where a flying lap is heading, in a few words: "P3 pace", or that it isn't quicker; once done, where it put the car. */
function paceWords(pace) {
  if (!pace) return null;
  if (pace.done) return pace.better ? `P${pace.pos}` : 'no quicker';
  return pace.better ? `P${pace.pos} pace` : 'no quicker';
}

/**
 * The running order for qualifying and practice. Each car on track shows its lap as it goes (the
 * mini-sectors, what kind of lap, where a flying lap is heading); rows slide to their new places as
 * times come in, and a car that has just gained places says how many.
 */
export function TimingTower({ t, follow, setFollow, open, setOpen, events, renderDetails }) {
  const [only, setOnly] = useState(false);
  const slide = useSlide();
  const kind = t.session.kind;
  const q = /sprint/i.test(t.session.name ?? '') ? 'SQ' : 'Q';
  const over = ['final', 'finished'].includes(t.session.status);
  let rows = t.drivers;
  let cutAfter = null;
  const outIn = {};
  if (kind === 'quali' && t.part) {
    const going = rows.filter((d) => !d.knockedOut);
    const out = rows.filter((d) => d.knockedOut);
    for (const d of out) outIn[d.n] = t.part.entries?.[1] && d.pos > t.part.entries[1] ? 1 : 2;
    rows = [...going, ...out];
    if (t.part.cut && going.length > t.part.cut && !over) cutAfter = going[t.part.cut - 1]?.n;
  }
  const qTime = (d) => (kind === 'quali' && t.part ? d.q?.[(outIn[d.n] ?? t.part.now) - 1] : d.bestLap?.s) ?? null;
  const top = Math.min(...rows.filter((d) => !outIn[d.n]).map((d) => qTime(d) ?? Infinity));
  const running = rows.filter((d) => onTrack(d) && !outIn[d.n]);
  const shown = only ? rows.filter((d) => (onTrack(d) && !outIn[d.n]) || d.n === follow) : rows;

  return (
    <section className="sp-section">
      <div className="sp-pad sp-f1-tower-head">
        <div className="sp-tabs" role="radiogroup" aria-label="Which cars">
          <button role="radio" aria-checked={!only} onClick={() => setOnly(false)}>
            Everyone
          </button>
          <button role="radio" aria-checked={only} onClick={() => setOnly(true)}>
            On track{running.length ? ` (${running.length})` : ''}
          </button>
        </div>
      </div>
      <div className="sp-f1-tt" role="table" aria-label="Running order">
        <div className="sp-f1-trow sp-f1-thead" role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">Driver</span>
          <span role="columnheader">{kind === 'quali' && t.part ? `${q}${t.part.now}` : 'Best'}</span>
          <span role="columnheader">Gap</span>
          <span role="columnheader">Tyre</span>
          <span role="columnheader" className="sp-f1-tlaps">
            Laps
          </span>
        </div>
        {shown.map((d, i) => {
          const prev = shown[i - 1];
          const label = outIn[d.n] && outIn[d.n] !== outIn[prev?.n] ? `Out in ${q}${outIn[d.n]}` : null;
          const isOpen = open === d.n;
          const gained = recent(events, d.n, t, 30);
          const jump = gained?.from && gained.from > gained.to ? gained.from - gained.to : 0;
          const fresh = recent(events, d.n, t, 6);
          const phase = d.lap?.phase;
          const lapLine = !outIn[d.n] && !d.out && d.lap?.segs && onTrack(d);
          const cls = [
            'sp-f1-trow',
            d.n === follow ? 'sp-f1-trow-mine' : '',
            d.out || outIn[d.n] ? 'sp-f1-gone' : '',
            isOpen ? 'sp-f1-open' : '',
            fresh ? (d.n === follow ? 'sp-f1-trow-gain' : 'sp-f1-trow-new') : '',
          ]
            .filter(Boolean)
            .join(' ');
          const time = qTime(d);
          return (
            <Fragment key={d.n}>
              {label && (
                <div ref={slide(`label${outIn[d.n]}`)} className="sp-f1-tcut">
                  {label}
                </div>
              )}
              <div ref={slide(d.n)} className={cls} role="row" style={{ '--team': d.color ?? 'var(--sp-rule-2)' }} onClick={() => setOpen(isOpen ? null : d.n)}>
                <span className="sp-f1-tpos" role="cell">
                  <span className="sp-num">{d.out ? 'Out' : d.shown ? d.pos : '–'}</span>
                  {jump > 0 && (
                    <small key={gained.at} className="sp-num sp-f1-jump" aria-label={`up ${jump} from ${ordinal(gained.from)}`}>
                      ▲{jump}
                    </small>
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
                    {phase === 'pit' && !outIn[d.n] && !over && <small className="sp-f1-tag">Pits</small>}
                  </button>
                </span>
                <span role="cell" className="sp-num">
                  {time ? (
                    <span key={time} className={`${time === top && !outIn[d.n] ? 'sp-f1-fastest' : ''}${fresh ? ' sp-f1-newtime' : ''}`.trim() || undefined}>
                      {lapText(time)}
                    </span>
                  ) : (
                    <span className="sp-muted">–</span>
                  )}
                </span>
                <span role="cell" className="sp-num sp-muted">
                  {!outIn[d.n] && d.gap?.s ? secs(d.gap.s) : ''}
                </span>
                <span role="cell">
                  <Tyre tyre={d.tyre} />
                </span>
                <span role="cell" className="sp-num sp-f1-tlaps">
                  {d.laps ?? 0}
                </span>
                {lapLine && (
                  <span className={`sp-f1-tlap sp-f1-tlap-${phase}`}>
                    <span className="sp-f1-tphase">{PHASE[phase]}</span>
                    <LapStrip segs={d.lap.segs} dim={phase !== 'push'} />
                    <span className="sp-num sp-f1-tpace">{phase === 'push' ? paceWords(d.lap.pace) : ''}</span>
                  </span>
                )}
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
              {cutAfter === d.n && (
                <div ref={slide('cut')} className="sp-f1-tcut sp-f1-tzone">
                  The drop zone: out if it ended now
                </div>
              )}
            </Fragment>
          );
        })}
        {only && !running.length && <p className="sp-note sp-pad">Nobody’s on track right now.</p>}
      </div>
      <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>
        Each car’s lap as it goes, in F1’s colours: <i className="sp-f1-key sp-f1-seg-p" /> fastest of anyone, <i className="sp-f1-key sp-f1-seg-g" /> the driver’s best, <i className="sp-f1-key sp-f1-seg-y" /> slower, <i className="sp-f1-key sp-f1-seg-b" /> pit lane. “P3 pace”: where a flying lap
        is heading once two sectors are done, if the last goes as they did. ▲: places just gained. Tap a driver for more.
      </p>
    </section>
  );
}

/** The car's place against the cut in qualifying: how far inside it, or how much it needs. */
function cutWords(d, t) {
  if (!t.part?.cut || d.knockedOut) return null;
  const going = t.drivers.filter((x) => !x.knockedOut);
  if (going.length <= t.part.cut) return null;
  const mine = timeIn(d, t);
  if (mine == null) return `The top ${t.part.cut} go through`;
  const i = going.indexOf(d);
  if (i < t.part.cut) {
    const firstOut = going[t.part.cut];
    const theirs = firstOut && timeIn(firstOut, t);
    return theirs != null ? `${(theirs - mine).toFixed(3)} s inside the cut` : `Inside the cut, ${ordinal(d.pos)} of the top ${t.part.cut}`;
  }
  const lastIn = going[t.part.cut - 1];
  const theirs = lastIn && timeIn(lastIn, t);
  return theirs != null ? `Needs ${(mine - theirs).toFixed(3)} s to get into the top ${t.part.cut}` : null;
}

/** A new time in words: "Up to 10th from 16th with 1:35.755, 0.764 s quicker". */
function newsOf(e) {
  const time = <b className="sp-num">{lapText(e.time)}</b>;
  const by = e.by ? `, ${e.by.toFixed(3)} s quicker` : '';
  if (e.from == null) return <>Sets <b>{ordinal(e.to)}</b> with {time}.</>;
  if (e.from > e.to) return <>Up to <b>{ordinal(e.to)}</b> from {ordinal(e.from)} with {time}{by}.</>;
  return <>Quicker with {time}{by}, still <b>{ordinal(e.to)}</b>.</>;
}

/**
 * The driver followed, in qualifying and practice: the place, the lap under way drawn large with its
 * sector times, where it's heading, and the margin to the cut. For twenty seconds after a new time
 * it shows that lap instead, with the places it gained.
 */
export function FollowLap({ d, t, events, onStop }) {
  const phase = d.lap?.phase;
  const gained = recent(events, d.n, t, 20);
  const jump = gained?.from && gained.from > gained.to ? gained.from - gained.to : 0;
  const pace = d.lap?.pace;
  const time = timeIn(d, t);
  let doing = PHASE[phase] ?? null;
  // A projection, so to a tenth and "about".
  const about = (x) => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, '0')}`;
  if (phase === 'push' && pace && !pace.done) doing = `Flying lap: heading for about ${about(pace.s)}, ${pace.better ? ordinal(pace.pos) : 'no quicker than the time so far'}`;
  if (d.out) doing = d.out === 'retired' ? 'Out of the session' : 'Stopped';
  const facts = [time ? `Best ${lapText(time)}${t.part ? ` in ${/sprint/i.test(t.session.name ?? '') ? 'SQ' : 'Q'}${t.part.now}` : ''}` : 'No time yet', d.gap?.s ? `${d.gap.s.toFixed(3)} s off the top` : null, cutWords(d, t)].filter(Boolean);
  return (
    <section className="sp-pad" style={{ marginTop: 12 }}>
      <div className={`sp-f1-follow-card sp-f1-fl${jump ? ' sp-f1-fl-gain' : ''}`} style={{ '--team': d.color ?? 'var(--sp-rule-2)' }}>
        <div className="sp-f1-fl-main">
          <div className="sp-f1-fl-top">
            <span key={d.pos} className="sp-num sp-f1-fl-pos">
              {d.shown ? `P${d.pos}` : '–'}
            </span>
            <span className="sp-f1-fl-name">
              <span className="sp-f1-star" aria-hidden="true">
                ★
              </span>{' '}
              <b className="sp-f1-strong">{d.last}</b>
              {d.team && <span className="sp-muted"> {d.team}</span>}
            </span>
            {jump > 0 && (
              <span key={gained.at} className="sp-num sp-f1-fl-jump">
                ▲{jump}
              </span>
            )}
          </div>
          {gained ? (
            <>
              <p key={gained.at} className="sp-small sp-f1-fl-news">
                {newsOf(gained)}
              </p>
              {gained.lap.segs && <LapStrip segs={gained.lap.segs} times={gained.lap.sectors} big />}
            </>
          ) : (
            <>
              {doing && <p className="sp-small sp-ink2 sp-f1-fl-doing">{doing}.</p>}
              {d.lap?.segs && onTrack(d) && <LapStrip segs={d.lap.segs} times={d.lap.sectors} big dim={phase !== 'push'} />}
            </>
          )}
          <p className="sp-tiny sp-ink2" style={{ margin: '8px 0 0' }}>
            {facts.join(' · ')}.
          </p>
        </div>
        <button className="sp-btn sp-btn-quiet sp-f1-unfollow" onClick={onStop} aria-label={`Stop following ${d.last}`}>
          ×
        </button>
      </div>
    </section>
  );
}

/**
 * Qualifying and practice under the status card: the driver followed, who's out on track, the order
 * with each car's lap, and the latest times.
 */
export function TimedSession({ t, follow, setFollow, open, setOpen, renderDetails }) {
  const events = useImprovements(t);
  const followed = t.drivers.find((d) => d.n === follow);
  return (
    <>
      {followed && <FollowLap d={followed} t={t} events={events} onStop={() => setFollow(null)} />}
      {['running', 'suspended'].includes(t.session.status) && <OnTrack t={t} follow={follow} setFollow={setFollow} />}
      <TimingTower t={t} follow={follow} setFollow={setFollow} open={open} setOpen={setOpen} events={events} renderDetails={renderDetails} />
      <LatestLaps events={events} t={t} />
    </>
  );
}

/** The times that moved the order, newest first, with the places each gained. */
export function LatestLaps({ events, t }) {
  const [all, setAll] = useState(false);
  if (!events.length) return null;
  const who = Object.fromEntries(t.drivers.map((d) => [d.n, d]));
  const q = /sprint/i.test(t.session.name ?? '') ? 'SQ' : 'Q';
  const list = all ? events : events.slice(0, 5);
  return (
    <section className="sp-section">
      <div className="sp-pad sp-section-head">
        <h2 className="sp-h2">Latest times</h2>
        <span className="sp-tiny sp-muted">Since you opened the page</span>
      </div>
      <ul className="sp-f1-list sp-f1-latest">
        {list.map((e) => {
          const d = who[e.n];
          const age = ageOf(e, t);
          return (
            <li key={`${e.n}${e.at}`}>
              <span className="sp-num sp-muted">{e.part !== t.part?.now && e.part ? `${q}${e.part}` : age < 60 ? `${age} s ago` : `${Math.round(age / 60)} min ago`}</span>
              <span className="sp-f1-latest-row">
                <span className="sp-f1-name-mark">
                  <Mark color={d?.color} />
                  <b>{d?.last ?? e.n}</b>
                </span>
                <b className="sp-num">{lapText(e.time)}</b>
                <span className="sp-f1-latest-secs" aria-hidden="true">
                  {e.sectors.map((c, i) => (
                    <i key={i} className={`sp-f1-key sp-f1-seg-${c ?? 'n'}`} />
                  ))}
                </span>
                <span className="sp-num sp-ink2">
                  {e.from ? (e.from > e.to ? <><b className="sp-f1-up">▲{e.from - e.to}</b> {ordinal(e.from)} → {ordinal(e.to)}</> : `stays ${ordinal(e.to)}`) : `first time, ${ordinal(e.to)}`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {events.length > 5 && (
        <div className="sp-pad">
          <button className="sp-btn sp-btn-quiet" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => setAll(!all)}>
            {all ? 'Fewer' : `All ${events.length}`}
          </button>
        </div>
      )}
    </section>
  );
}
