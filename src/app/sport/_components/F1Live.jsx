'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { lapText } from '@/lib/sport/f1.mjs';
import { plain, rejoin, sameSession } from '@/lib/sport/f1-live.mjs';
import PITLOSS from '@/lib/sport/f1-pitloss.json';
import { kickoff } from './time';
import { Mark, Reveal } from './f1bits';
import { TimedSession, Tyre, TYRE } from './F1Timing';
import { useScrolledPast, StickyBar } from './Sticky';

// Live timing for one session, from /api/sport/f1/live every 3 seconds. Every answer is kept for
// three minutes, so the view can run behind live to match the viewer's TV picture, which is often
// 5–60 seconds late: the timing shouldn't tell them what they're about to see.

const POLL = 3000;
const KEEP = 180000;
const MAX_DELAY = 150;

const FLAG = {
  green: 'Green flag',
  yellow: 'Yellow flag',
  sc: 'Safety car',
  'sc-ending': 'Safety car in this lap',
  vsc: 'Virtual safety car',
  'vsc-ending': 'Virtual safety car ending',
  red: 'Red flag',
  chequered: 'Chequered flag',
};

/** Re-renders every `every` ms. */
function useTick(every) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

/** A value kept in the browser between visits (the TV delay, the driver followed). */
function useStored(key, fallback) {
  const [v, setV] = useState(fallback);
  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s != null) setV(JSON.parse(s));
    } catch {}
  }, [key]);
  const set = (x) => {
    setV(x);
    try {
      localStorage.setItem(key, JSON.stringify(x));
    } catch {}
  };
  return [v, set];
}

/** The live route's answers, oldest first, each with when it arrived ("got"). Paused in a hidden tab. */
function useFeed() {
  const [state, setState] = useState({ buf: [], error: null });
  useEffect(() => {
    let timer = null;
    let busy = false;
    let gone = false;
    const run = async () => {
      clearTimeout(timer);
      if (busy || gone) return;
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(run, POLL);
        return;
      }
      busy = true;
      let wait = POLL;
      try {
        const r = await fetch('/api/sport/f1/live', { cache: 'no-store' });
        const t = await r.json().catch(() => ({}));
        if (!r.ok || !t.session) throw new Error(t.error || `it answered ${r.status}`);
        const got = Date.now();
        // Once a session is over its timing doesn't change; a minute is often enough.
        if (t.session.status === 'final') wait = 60000;
        if (!gone) setState((s) => ({ error: null, buf: s.buf.at(-1)?.at === t.at ? s.buf : [...s.buf.filter((x) => got - x.got < KEEP), { ...t, got }] }));
      } catch (e) {
        wait = 10000;
        if (!gone) setState((s) => ({ ...s, error: e.message || String(e) }));
      }
      busy = false;
      if (!gone) timer = setTimeout(run, wait);
    };
    run();
    const onVis = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      gone = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return state;
}

/** "7:42" or "1:02:05". */
const clockText = (s) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};
const secs = (x, digits = 3) => `+${x.toFixed(digits)}`;
const andList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''));
const ordinal = (n) => `${n}${n % 100 > 10 && n % 100 < 14 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th'}`;
const laps = (n) => `${n} ${n === 1 ? 'lap' : 'laps'}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** A lap time: bold for the driver's best so far, inked for the best of anyone. */
function Time({ t, fastest = t?.fastest }) {
  if (!t?.s) return <span className="sp-muted">–</span>;
  return <span className={fastest ? 'sp-f1-fastest' : t.pb ? 'sp-f1-pb' : undefined}>{lapText(t.s)}</span>;
}

/** Places gained or lost since the start: "▲3", "▼2". */
function Moved({ grid, pos }) {
  if (!grid || !pos || grid === pos) return null;
  const up = grid > pos;
  return (
    <small className="sp-num sp-f1-moved" style={{ color: up ? 'var(--sp-win)' : 'var(--sp-muted)' }}>
      {up ? '▲' : '▼'}
      {Math.abs(grid - pos)}
    </small>
  );
}

/**
 * One session's live timing. `s` is the calendar's session: the view only shows F1's feed when the
 * feed is on that session. Until then it shows `before` (the start time, the prediction).
 */
export default function F1Live({ s, hidden, reveal, before = null }) {
  const { buf, error } = useFeed();
  const now = useTick(1000);
  const [delay, setDelay] = useStored('md-f1-delay', 0);
  const [follow, setFollow] = useStored('md-f1-follow', null);
  const [open, setOpen] = useState(null);
  const [mode, setMode] = useState('int');
  const [statusRef, statusPast] = useScrolledPast();
  const history = useRef({});
  const latest = buf.at(-1);

  // Each driver's gap to the car ahead at the end of each lap, for whether it's closing: with who that
  // car was and the stops so far, and the laps run under a caution, so a pit stop, a pass or a safety
  // car isn't read as one driver catching another.
  useEffect(() => {
    if (!latest || latest.session.kind !== 'race') return;
    const ahead = {};
    const order = latest.drivers.filter((d) => !d.out).sort((a, b) => a.pos - b.pos);
    order.forEach((d, i) => (ahead[d.n] = order[i - 1]?.n ?? null));
    for (const d of latest.drivers) if (d.int?.s != null && d.laps) (history.current[d.n] ??= {})[d.laps] = { s: d.int.s, ahead: ahead[d.n], stops: d.stops, pit: Boolean(d.pit) };
    if (latest.lap?.now && latest.track !== 'green') (history.current.caution ??= {})[latest.lap.now] = true;
  }, [latest]);

  if (!latest) {
    if (now < Date.parse(s.at)) return before;
    return error ? (
      <p className="sp-note sp-pad sp-section">Couldn’t reach F1’s live timing ({error}). Trying again every 10 seconds.</p>
    ) : (
      <div className="sp-skel" style={{ height: 420, margin: 16, borderRadius: 6 }} />
    );
  }
  if (!sameSession(latest.session, s)) {
    if (now < Date.parse(s.at)) return before;
    return (
      <section className="sp-pad sp-section">
        <p className="sp-small sp-ink2" style={{ margin: 0 }}>
          F1’s live timing has moved on from {s.label.toLowerCase()}. The classification and the analysis appear here an hour or two after it ends.
        </p>
      </section>
    );
  }
  if (hidden) return <Reveal onReveal={reveal} what="live timing" />;

  // The feed's clock against the browser's: the smallest gap between a state's time and its arrival.
  const skew = Math.min(...buf.map((x) => x.got - Date.parse(x.at)));
  const feedNow = now - skew;
  const target = feedNow - delay * 1000;
  const shown = buf.findLast((x) => Date.parse(x.at) <= target);
  const age = Math.max(0, Math.round((feedNow - Date.parse(latest.at)) / 1000));

  const changeDelay = (d) => setDelay(Math.max(0, Math.min(MAX_DELAY, Math.round(d))));
  // The leader's line crossing on TV against the moment F1's timing saw it.
  const canSync = latest.session.kind === 'race' && latest.session.status === 'running' && latest.lap?.now >= 2 && latest.lap?.began;
  const sync = () => changeDelay((feedNow - Date.parse(latest.lap.began)) / 1000);
  const tv = <Delay delay={delay} onChange={changeDelay} onSync={canSync ? sync : null} />;

  if (!shown) {
    const have = (feedNow - Date.parse(buf[0].at)) / 1000;
    return (
      <section className="sp-pad sp-section">
        <div className="sp-f1-card">
          <p className="sp-small sp-ink2" style={{ margin: 0 }}>
            Holding the timing back {delay} s to match your TV: <b className="sp-num">{Math.max(1, Math.ceil(delay - have))} s</b> to go.
          </p>
          {tv}
        </div>
      </section>
    );
  }

  const t = shown;
  const names = Object.fromEntries(t.drivers.map((d) => [d.n, d.last]));
  const left = t.clock ? (t.clock.running ? t.clock.left - (target - Date.parse(t.at)) / 1000 : t.clock.left) : null;
  const followed = t.drivers.find((d) => d.n === follow);
  const loss = PITLOSS[t.session.meeting] ?? null;
  const live = ['running', 'suspended'].includes(t.session.status);
  const q = /sprint/i.test(t.session.name ?? '') ? 'SQ' : 'Q';

  return (
    <>
      <section className="sp-pad sp-section">
        <Status t={t} left={left} minutes={s.minutes} age={delay ? null : age} delay={delay} tv={tv} names={names} follow={follow} cardRef={statusRef} />
      </section>
      <StickyStatus t={t} left={left} names={names} follow={follow} shown={statusPast} />
      {t.session.kind === 'race' ? (
        <>
          {followed && <Following d={followed} t={t} loss={loss} names={names} onStop={() => setFollow(null)} />}
          <Tower t={t} mode={mode} setMode={setMode} open={open} setOpen={setOpen} follow={follow} setFollow={setFollow} loss={loss} names={names} />
        </>
      ) : (
        <TimedSession t={t} follow={follow} setFollow={setFollow} open={open} setOpen={setOpen} renderDetails={(d) => <Details d={d} t={t} q={q} follow={follow} loss={loss} names={names} />} />
      )}
      {t.session.kind === 'race' && live && <Strategy t={t} names={names} history={history.current} />}
      {t.incidents.length > 0 && <Stewards list={t.incidents} names={names} />}
      {t.messages.length > 0 && <RaceControl t={t} names={names} />}
      <p className="sp-note sp-pad" style={{ margin: '14px 0 0' }}>
        {t.weather ? `Air ${Math.round(t.weather.air)} °C, track ${Math.round(t.weather.track)} °C, ${t.weather.rain ? 'raining' : 'dry'}. ` : ''}
        {t.source === 'openf1' ? 'Timing from OpenF1, as F1’s own live timing isn’t answering.' : t.source === 'replay' ? 'A replay of F1’s archived timing.' : 'Timing from F1’s live feed, a few seconds behind the track.'}
      </p>
    </>
  );
}

const FLAG_SHORT = { yellow: 'Yellow', sc: 'Safety car', 'sc-ending': 'Safety car in', vsc: 'VSC', 'vsc-ending': 'VSC ending', red: 'Red flag' };
const gapWords = (x) => `${x < 10 ? x.toFixed(1) : Math.round(x)} s`;
const stillGoing = (t) => t.drivers.filter((d) => !d.out).sort((a, b) => a.pos - b.pos);

/**
 * Where the session stands, in one sentence: who leads and by how much with the laps left, who's in
 * the drop zone, who's on provisional pole. Nothing it says needs working out.
 * Returns { label, text } or null.
 */
export function sayF1(t, left, names, follow) {
  const { kind, status } = t.session;
  const order = stillGoing(t);
  const [first, second] = order;
  if (!first || status === 'waiting') return null;
  const over = status === 'finished' || status === 'final';
  if (kind === 'race') {
    const toGo = t.lap?.of && t.lap?.now ? t.lap.of - t.lap.now : null;
    const togo = toGo == null ? '' : toGo === 0 ? ', last lap' : `, ${toGo} ${toGo === 1 ? 'lap' : 'laps'} to go`;
    const gap = second?.int?.laps ? `a lap` : second?.int?.s != null ? gapWords(second.int.s) : null;
    if (over) return { label: 'Result', text: <><strong>{first.last}</strong> wins{gap ? <> by <b>{gap}</b></> : ''}</> };
    if (status === 'suspended' || t.track === 'red') return { label: 'The lead', text: <>The race is stopped. <strong>{first.last}</strong> leads{togo}</> };
    // Under a safety car the gaps close up and mean little; on the first lap they're guesses until the
    // cars have passed the timing points.
    if (['sc', 'sc-ending', 'vsc', 'vsc-ending'].includes(t.track) || !gap || (t.lap?.now ?? 0) <= 1) return { label: 'The lead', text: <><strong>{first.last}</strong> leads{togo}</> };
    return { label: 'The lead', text: <><strong>{first.last}</strong> leads by <b>{gap}</b>{togo}</> };
  }
  if (kind === 'quali' && t.part) {
    if (status === 'break') return null;
    const going = t.drivers.filter((d) => !d.knockedOut).sort((a, b) => a.pos - b.pos);
    const timed = going.filter((d) => d.q?.[t.part.now - 1]);
    if (over) return timed[0] ? { label: 'Pole', text: <><strong>{timed[0].last}</strong> takes pole{timed[1]?.gap?.s ? <> by <b>{timed[1].gap.s.toFixed(3)} s</b></> : ''}</> } : null;
    if (!timed.length) return null;
    const cut = t.part.cut && going.length > t.part.cut ? t.part.cut : null;
    // The drop zone means something once enough have set a time to fill the places through.
    if (cut && timed.length >= cut) {
      const out = going.slice(cut);
      const mine = out.find((d) => d.n === follow);
      return {
        label: 'The drop zone',
        text: mine ? <><strong>{mine.last}</strong> is out as it stands, {ordinal(mine.pos)}: the top {cut} go through</> : <>Out as it stands: <strong>{andList(out.map((d) => d.last))}</strong></>,
      };
    }
    if (cut) return { label: 'So far', text: <><strong>{timed[0].last}</strong> fastest; <b>{timed.length}</b> of {going.length} have set a time</> };
    return { label: 'Provisional pole', text: <><strong>{timed[0].last}</strong>{timed[1]?.gap?.s ? <>, <b>{timed[1].gap.s.toFixed(3)} s</b> clear of {timed[1].last}</> : ''}</> };
  }
  // Practice: the fastest, once two have set a time.
  const timed = t.drivers.filter((d) => d.bestLap?.s).sort((a, b) => a.bestLap.s - b.bestLap.s);
  if (timed.length < 2) return null;
  return { label: 'Fastest', text: <><strong>{timed[0].last}</strong>, <b>{(timed[1].bestLap.s - timed[0].bestLap.s).toFixed(3)} s</b> clear of {timed[1].last}</> };
}

/** The session at a glance: the flag, the lap or the clock, how far through, the last word from race control. */
function Status({ t, left, minutes, age, delay, tv, names, follow, cardRef }) {
  const said = sayF1(t, left, names, follow);
  const { kind, status, name } = t.session;
  const q = /sprint/i.test(name ?? '') ? 'SQ' : 'Q';
  const over = status === 'finished' || status === 'final';
  let big = null;
  let small = null;
  let done = null;
  if (status === 'waiting') {
    big = 'Starting soon';
    small = `at ${kickoff(t.session.start)}`;
  } else if (kind === 'race') {
    big = t.lap?.now ? `Lap ${over ? (t.lap.of ?? t.lap.now) : t.lap.now}` : 'Race';
    small = t.lap?.of ? `of ${t.lap.of}` : null;
    if (t.lap?.of) done = Math.min(1, (over ? t.lap.of : t.lap.now - 1) / t.lap.of);
  } else {
    big = kind === 'quali' && t.part ? `${q}${t.part.now}` : (name ?? 'Practice');
    if (status === 'break') small = 'break before the next part';
    else if (over) small = 'finished';
    else if (left != null) small = `${clockText(left)} left`;
    if (kind === 'practice' && minutes && left != null && !over) done = Math.min(1, Math.max(0, 1 - left / (minutes * 60)));
  }
  // Race control's latest word, if it's from this lap or the last: the flags and the stewards, and
  // notices such as the chance of rain before the start.
  const word = t.messages.find((m) => ['sc', 'red', 'chequered', 'stewards', ...(status === 'waiting' ? ['info'] : [])].includes(m.kind));
  const fresh = word && (kind !== 'race' || !t.lap?.now || (word.lap ?? 0) >= t.lap.now - 1);
  const flag = status === 'suspended' && t.track !== 'red' ? 'red' : t.track;
  return (
    <div className="sp-f1-card" ref={cardRef}>
      {flag !== 'green' && <div className={`sp-f1-band sp-f1-band-${flag}`}>{status === 'suspended' && t.track !== 'red' ? 'Session stopped' : FLAG[flag]}</div>}
      <div className="sp-f1-status">
        <div>
          <b className="sp-f1-big sp-num">{big}</b>
          {small && <span className="sp-f1-of sp-num">{small}</span>}
        </div>
        <span className="sp-tiny sp-muted sp-num" aria-live="polite">
          {delay ? (
            `${delay} s behind live`
          ) : age != null && ['running', 'suspended', 'break'].includes(status) ? (
            age > 20 ? (
              <span className="sp-live-text">No update for {age} s</span>
            ) : (
              <span className="sp-f1-live">
                <i className="sp-dot" aria-hidden="true" /> Live
              </span>
            )
          ) : null}
        </span>
      </div>
      {kind === 'race' && t.lap?.of ? (
        <Laps now={over ? t.lap.of + 1 : status === 'waiting' ? 0 : t.lap.now} of={t.lap.of} />
      ) : (
        done != null && (
          <div className="sp-f1-progress" aria-hidden="true">
            <i style={{ width: `${done * 100}%` }} />
          </div>
        )
      )}
      {kind === 'quali' && t.part?.cut && status === 'running' && (
        <p className="sp-tiny sp-muted" style={{ margin: '6px 0 0' }}>
          The top {t.part.cut} go through to {q}
          {t.part.now + 1}.
        </p>
      )}
      {said && (
        <div className="sp-band sp-band-f1" aria-live="polite">
          <span className="sp-band-label">{said.label}</span>
          <span className="sp-band-main">{said.text}</span>
        </div>
      )}
      {fresh && (
        <p className="sp-f1-word">
          <span className="sp-num sp-muted">{word.lap ? `Lap ${word.lap}` : kickoff(word.at)}</span>
          <span>{plain(word.text, names)}</span>
        </p>
      )}
      {tv}
    </div>
  );
}

/**
 * The session kept in sight while the page scrolls: the lap or the clock, the flag when it isn't
 * green, and the one sentence. Only while the session is on.
 */
function StickyStatus({ t, left, names, follow, shown }) {
  const { kind, status } = t.session;
  if (!['running', 'suspended'].includes(status)) return null;
  const q = /sprint/i.test(t.session.name ?? '') ? 'SQ' : 'Q';
  const said = sayF1(t, left, names, follow);
  const flag = status === 'suspended' && t.track !== 'red' ? 'red' : t.track;
  return (
    <StickyBar shown={shown}>
      <span className="sp-stick-team sp-stick-ink">
        {kind === 'race' ? (
          <>
            Lap{' '}
            <b>
              {t.lap?.now ?? 1}
              {t.lap?.of ? `/${t.lap.of}` : ''}
            </b>
          </>
        ) : (
          <>
            {kind === 'quali' && t.part ? `${q}${t.part.now}` : 'Left'}
            {left != null && <b>{clockText(left)}</b>}
          </>
        )}
      </span>
      {FLAG_SHORT[flag] && <span className={`sp-stick-team sp-f1-band-${flag}`}>{FLAG_SHORT[flag]}</span>}
      {said && <span className="sp-stick-words">{said.text}</span>}
    </StickyBar>
  );
}

/** The race as a row of laps, one tick each: run, under way, to go. */
function Laps({ now, of }) {
  return (
    <div className="sp-f1-laps" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${of}, minmax(0, 1fr))` }}>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i + 1 < now ? 'sp-f1-lap-done' : i + 1 === now ? 'sp-f1-lap-now' : undefined} />
      ))}
    </div>
  );
}

/** Holding the timing back to match the viewer's TV: closed to one line until it's wanted. */
function Delay({ delay, onChange, onSync }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sp-f1-delay">
      <button className={`sp-f1-delay-btn${delay ? ' sp-f1-delay-on' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="2" y="4" width="20" height="13" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        {delay ? `Matching your TV: ${delay} s behind` : 'Watching on TV?'}
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="sp-f1-delay-panel">
          <p className="sp-tiny sp-ink2" style={{ margin: 0 }}>
            A TV picture is often 5 to 60 s behind live timing. Hold the timing back by the same amount, so it never tells you what you’re about to see.
          </p>
          <div className="sp-f1-delay-row">
            <button className="sp-btn sp-f1-step" onClick={() => onChange(delay - 5)} disabled={delay === 0} aria-label="5 seconds less">
              −5 s
            </button>
            <b className="sp-num sp-f1-delay-value">{delay ? `${delay} s` : 'Live'}</b>
            <button className="sp-btn sp-f1-step" onClick={() => onChange(delay + 5)} disabled={delay >= MAX_DELAY} aria-label="5 seconds more">
              +5 s
            </button>
            {delay > 0 && (
              <button className="sp-btn sp-btn-quiet" style={{ height: 34 }} onClick={() => onChange(0)}>
                Back to live
              </button>
            )}
          </div>
          {onSync && (
            <button className="sp-btn sp-btn-primary sp-f1-sync" onClick={onSync}>
              Tap as the leader crosses the line on your TV
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** "If they pit now": where a car would come back out, in words. */
function pitNow(t, d, loss, names) {
  if (t.session.kind !== 'race' || t.session.status !== 'running' || d.out || d.pit) return null;
  if (!['green', 'yellow'].includes(t.track)) return { text: 'A stop costs less than usual under the safety car, by an amount that varies, so there’s no estimate until the track is green.' };
  const cost = loss?.loss ?? 22;
  const r = rejoin(t.drivers, d.n, cost);
  if (!r) return null;
  const where = [r.ahead ? `${r.toAhead.toFixed(1)} s behind ${names[r.ahead]}` : null, r.behind ? `${r.toBehind.toFixed(1)} s ahead of ${names[r.behind]}` : null].filter(Boolean).join(', ');
  return {
    text: `If ${d.last} pitted now: back out about ${ordinal(r.pos)}${where ? `, ${where}` : ''}.`,
    how: loss ? `A stop here costs about ${cost.toFixed(1)} s, the middle of ${loss.stops} green-flag stops in 2024–26.` : `A stop costs about ${cost} s at a typical track; there’s no record for this one.`,
  };
}

/** The driver the viewer follows in a race, in a sentence, with a pit estimate. */
function Following({ d, t, loss, names, onStop }) {
  const i = t.drivers.indexOf(d);
  const ahead = t.drivers[i - 1];
  const behind = t.drivers[i + 1];
  const bits = [];
  if (d.out) bits.push(d.out === 'retired' ? 'out of the race' : 'stopped');
  else {
    bits.push(`${ordinal(d.pos)}${d.grid ? ` (started ${ordinal(d.grid)})` : ''}`);
    if (d.pit === 'in') bits.push('in the pits');
    else if (ahead && d.int?.s != null) bits.push(`${d.int.s.toFixed(1)} s behind ${ahead.last}`);
    if (behind && !behind.out && behind.int?.s != null && !behind.pit) bits.push(`${behind.int.s.toFixed(1)} s ahead of ${behind.last}`);
    if (d.tyre) bits.push(`${TYRE[d.tyre.c] ?? d.tyre.c}s, ${laps(d.tyre.age)} old`);
  }
  const p = pitNow(t, d, loss, names);
  return (
    <section className="sp-pad" style={{ marginTop: 12 }}>
      <div className="sp-f1-follow-card" style={{ '--team': d.color ?? 'var(--sp-rule-2)' }}>
        <div>
          <p className="sp-small" style={{ margin: 0 }}>
            <span className="sp-f1-star" aria-hidden="true">
              ★
            </span>{' '}
            <b className="sp-f1-strong">{d.last}</b> <span className="sp-ink2">{bits.join(', ')}.</span>
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

/** The race's running order: gap to the car ahead (or the leader), last lap, tyres, stops, best lap. */
function Tower({ t, mode, setMode, open, setOpen, follow, setFollow, loss, names }) {
  const lap1 = t.session.status === 'running' && t.lap?.now <= 1;
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
      <table className="sp-table sp-f1-table sp-f1-tower">
        <thead>
          <tr>
            <th className="l" style={{ paddingLeft: 16 }}>#</th>
            <th className="l">Driver</th>
            <th>Gap</th>
            <th>Last lap</th>
            <th>Tyre</th>
            <th className="sp-hide-sm">Stops</th>
            <th className="sp-hide-sm" style={{ paddingRight: 16 }}>
              Best
            </th>
          </tr>
        </thead>
        <tbody>
          {t.drivers.map((d, i) => {
            const isOpen = open === d.n;
            const cls = [d.n === follow ? 'sp-mine' : '', d.out ? 'sp-f1-gone' : '', isOpen ? 'sp-f1-open' : ''].filter(Boolean).join(' ');
            return (
              <Fragment key={d.n}>
                <tr className={cls || undefined} onClick={() => setOpen(isOpen ? null : d.n)}>
                  <td className="l sp-pos" style={{ paddingLeft: 16 }}>
                    <span className="sp-f1-pos">
                      {d.out ? 'Out' : d.pos}
                      {!d.out && <Moved grid={d.grid} pos={d.pos} />}
                    </span>
                  </td>
                  <td className="l">
                    <button className="sp-f1-who" aria-expanded={isOpen} title={`${d.first} ${d.last}${d.team ? `, ${d.team}` : ''}`}>
                      <Mark color={d.color} />
                      <b>{d.last}</b>
                      {d.n === follow && (
                        <span className="sp-f1-star" aria-label="Following">
                          ★
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="sp-num">{t.session.status === 'waiting' ? null : raceGap(d, i, mode)}</td>
                  <td className="sp-num">
                    <Time t={d.lastLap} />
                  </td>
                  <td>
                    <Tyre tyre={d.tyre} />
                  </td>
                  <td className="sp-num sp-hide-sm">{d.stops}</td>
                  <td className="sp-num sp-hide-sm" style={{ paddingRight: 16 }}>
                    <Time t={d.bestLap} fastest={t.fastest?.n === d.n} />
                  </td>
                </tr>
                {isOpen && (
                  <tr className="sp-f1-more">
                    <td colSpan={7}>
                      <Details d={d} t={t} q="Q" follow={follow} loss={loss} names={names} />
                      <button className="sp-btn sp-f1-follow" aria-pressed={follow === d.n} onClick={() => setFollow(follow === d.n ? null : d.n)}>
                        {follow === d.n ? `★ Following ${d.last}` : `☆ Follow ${d.last}`}
                      </button>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>
        {lap1 ? 'Lap 1: the order firms up as the cars pass the timing points. ' : ''}▲▼ under a position: places gained or lost since the start. Tyres: the compound and the laps on that set (* used). Bold: a personal best; black: the best of anyone. Tap a driver for more.
      </p>
    </section>
  );
}

/** The race tower's gap column: to the car ahead, or to the leader. */
function raceGap(d, i, mode) {
  if (d.out) return <span className="sp-muted">{d.out === 'retired' ? 'Retired' : 'Stopped'}</span>;
  if (d.pit === 'in') return <span className="sp-f1-tag">In pit</span>;
  if (d.pit === 'out') return <span className="sp-f1-tag">Out lap</span>;
  if (i === 0) return <span className="sp-muted">Leader</span>;
  const g = mode === 'int' ? d.int : d.gap;
  if (!g) return <span className="sp-muted">–</span>;
  if (g.laps) return `+${g.laps} ${g.laps === 1 ? 'lap' : 'laps'}`;
  return <span className={mode === 'int' && g.s < 1 ? 'sp-f1-close' : undefined}>{secs(g.s)}</span>;
}

/** What a tap on a driver shows: sectors, best lap, tyres so far, track limits, a pit estimate. */
function Details({ d, t, q, follow, loss, names }) {
  const rows = [];
  if (d.sectors.some(Boolean)) {
    rows.push([
      'Sectors',
      d.sectors.map((x, k) => (
        <Fragment key={k}>
          {k ? ' · ' : ''}
          <Time t={x} />
        </Fragment>
      )),
    ]);
  }
  if (t.session.kind === 'quali' && d.q) rows.push(['Each part', d.q.map((x, k) => `${q}${k + 1} ${x ? lapText(x) : '–'}`).join(' · ')]);
  if (d.bestLap) rows.push(['Best lap', `${lapText(d.bestLap.s)}${d.bestLap.lap ? ` on lap ${d.bestLap.lap}` : ''}${t.session.kind !== 'race' && d.laps ? ` of ${d.laps}` : ''}`]);
  if (d.stints.length) {
    const so = t.session.status === 'running' ? ' so far' : '';
    rows.push(['Tyres', d.stints.map(([c, n, isNew], k) => `${cap(TYRE[c] ?? c)}${isNew ? '' : ' (used)'}, ${laps(n)}${k === d.stints.length - 1 ? so : ''}`).join(' → ')]);
  }
  if (d.limits) rows.push(['Track limits', `${d.limits.deleted} ${d.limits.deleted === 1 ? 'lap' : 'laps'} deleted${d.limits.warned ? '; black-and-white flag shown, so the next one brings a penalty' : ''}`]);
  // Against the driver followed, by their gaps to the leader.
  const f = follow && follow !== d.n ? t.drivers.find((x) => x.n === follow) : null;
  const gapOf = (x) => (x.pos === 1 && !x.gap ? 0 : x.gap?.s);
  if (f && t.session.kind === 'race' && gapOf(f) != null && gapOf(d) != null && !d.out && !f.out) {
    const g = gapOf(d) - gapOf(f);
    rows.push([`To ${f.last}`, `${Math.abs(g).toFixed(1)} s ${g < 0 ? 'ahead' : 'behind'}`]);
  }
  const p = pitNow(t, d, loss, names);
  return (
    <>
      <dl className="sp-f1-facts">
        {rows.map(([k, v]) => (
          <Fragment key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </Fragment>
        ))}
      </dl>
      {p && (
        <p className="sp-f1-pitnow">
          {p.text}
          {p.how && <span className="sp-muted"> {p.how}</span>}
        </p>
      )}
    </>
  );
}

/**
 * How a driver's gap to the car ahead changed over the last `k` laps: { now, by, perLap }, by > 0 for
 * closing. Only over clean laps (the same car ahead at both ends, no stop by either, no caution, not
 * in the pit lane), so a pit stop, a pass or a safety car is never read as one driver catching another.
 */
function change(history, t, n, k) {
  const h = history[n];
  const d = t.drivers.find((x) => x.n === n);
  const end = d?.laps;
  const a = h?.[end - k];
  const b = h?.[end];
  if (!a || !b || a.ahead == null || a.ahead !== b.ahead || a.stops !== b.stops || a.pit || b.pit) return null;
  const front = history[b.ahead];
  const fa = front?.[end - k];
  const fb = front?.[end];
  if (fa && fb && fa.stops !== fb.stops) return null;
  for (let lap = end - k + 1; lap <= end; lap++) if (history.caution?.[lap]) return null;
  return { now: b.s, by: a.s - b.s, perLap: (a.s - b.s) / k };
}

/**
 * Gaps that have moved by a second and a half or more over five clean laps, beyond the fights within a
 * second: who is catching whom, and who is pulling away. The biggest four.
 */
function movers(history, t) {
  if ((t.lap?.now ?? 0) < 7) return [];
  const order = stillGoing(t);
  const out = [];
  order.forEach((d, i) => {
    if (!i || d.pit) return;
    const c = change(history, t, d.n, 5);
    if (!c || Math.abs(c.by) < 1.5 || c.now < 1) return;
    out.push({ n: d.n, ahead: order[i - 1].n, pos: d.pos, now: c.now, by: Math.abs(c.by), closing: c.by > 0 });
  });
  return out.sort((x, y) => y.by - x.by).slice(0, 4);
}

/** In a race: cars within a second of the one ahead (joined into trains), and who has yet to stop. */
function Strategy({ t, names, history }) {
  const trains = [];
  for (const b of t.battles) {
    const last = trains.at(-1);
    if (last && last.at(-1).behind === b.ahead) last.push(b);
    else trains.push([b]);
  }
  const color = Object.fromEntries(t.drivers.map((d) => [d.n, d.color]));
  // A trend is read only from clean laps: the same car ahead, no pit stop by either, no caution.
  const trend = (n, k = 3) => change(history, t, n, k)?.perLap ?? null;
  const moving = movers(history, t);
  // Whoever is fewer: those yet to stop, or those who have.
  const running = t.drivers.filter((d) => !d.out);
  const yet = running.filter((d) => d.stops === 0);
  const been = running.filter((d) => d.stops > 0);
  const showYet = t.lap?.now > 1 && yet.length > 0 && been.length > 0;
  if (!trains.length && !showYet && !moving.length) return null;
  const who = (n) => (
    <span className="sp-f1-name-mark">
      <Mark color={color[n]} />
      <b>{names[n]}</b>
    </span>
  );
  return (
    <section className="sp-section">
      {trains.length > 0 && (
        <>
          <div className="sp-pad sp-section-head">
            <h2 className="sp-h2">Close fights</h2>
            <span className="sp-tiny sp-muted">Within a second</span>
          </div>
          <ul className="sp-f1-list">
            {trains.map((tr) => {
              const first = tr[0];
              const r = tr.length === 1 ? trend(first.behind) : null;
              return (
                <li key={first.behind}>
                  <span className="sp-num sp-muted">{tr.length === 1 ? `P${first.pos}` : `P${first.pos - 1}–${tr.at(-1).pos}`}</span>
                  {tr.length === 1 ? (
                    <span>
                      {who(first.behind)} <span className="sp-num">{first.gap.toFixed(1)} s</span> behind {who(first.ahead)}
                      {r != null && Math.abs(r) >= 0.05 ? <span className="sp-ink2">{r > 0 ? `, closing ${r.toFixed(1)} s a lap` : `, dropping back ${(-r).toFixed(1)} s a lap`}</span> : null}
                    </span>
                  ) : (
                    <span>
                      {[first.ahead, ...tr.map((b) => b.behind)].map((n, k, all) => (
                        <Fragment key={n}>
                          {k ? (k === all.length - 1 ? ' and ' : ', ') : ''}
                          {who(n)}
                        </Fragment>
                      ))}
                      <span className="sp-ink2">, nose to tail</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>
            Within a second, the car behind gets Overtake mode: extra electric power, in place of DRS since 2026.
          </p>
        </>
      )}
      {moving.length > 0 && (
        <>
          <div className="sp-pad sp-section-head" style={trains.length ? { marginTop: 14 } : undefined}>
            <h2 className="sp-h2">Gaps on the move</h2>
            <span className="sp-tiny sp-muted">Over the last five laps</span>
          </div>
          <ul className="sp-f1-list">
            {moving.map((m) => (
              <li key={m.n}>
                <span className="sp-num sp-muted">
                  P{m.pos - 1}–{m.pos}
                </span>
                <span>
                  {m.closing ? (
                    <>
                      {who(m.n)} is catching {who(m.ahead)}
                      {m.pos === 2 ? ' for the lead' : ''}: <span className="sp-num">{gapWords(m.now)}</span> behind, <span className="sp-num">{m.by.toFixed(1)} s</span> closer than five laps ago
                    </>
                  ) : (
                    <>
                      {who(m.ahead)} is pulling away from {who(m.n)}: <span className="sp-num">{gapWords(m.now)}</span> ahead, <span className="sp-num">{m.by.toFixed(1)} s</span> more than five laps ago
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {showYet && (
        <p className="sp-small sp-ink2 sp-pad" style={{ margin: trains.length || moving.length ? '12px 0 0' : 0 }}>
          {yet.length <= been.length ? (
            <>
              <b className="sp-f1-strong">Yet to stop:</b> {andList(yet.map((d) => `${d.last}${d.tyre ? ` (${TYRE[d.tyre.c] ?? d.tyre.c}s, ${laps(d.tyre.age)})` : ''}`))}.
            </>
          ) : (
            <>
              <b className="sp-f1-strong">
                {been.length} of {running.length} have stopped:
              </b>{' '}
              {andList(been.map((d) => d.last))}.
            </>
          )}
        </p>
      )}
    </section>
  );
}

const STEP = { noted: 'Noted', investigating: 'Under investigation', dropped: 'Reviewed: no investigation', 'no action': 'No further action', served: 'Served', warning: 'Warning' };

/** Where an incident stands, as a chip: open (being looked at), a penalty, or closed. */
function standing(inc) {
  const last = inc.steps.at(-1);
  const pen = inc.steps.findLast((s) => s.what === 'penalty');
  if (last.what === 'served') return { cls: 'done', text: 'Penalty served' };
  if (pen) return { cls: 'pen', text: cap(pen.penalty.replace(/ penalty$/, '')) };
  if (last.what === 'warning') return { cls: 'done', text: 'Warning' };
  if (last.what === 'noted' || last.what === 'investigating') return { cls: 'open', text: last.what === 'noted' ? 'Noted' : 'Investigating' };
  if (last.what.startsWith('after')) return { cls: 'open', text: `After the ${last.what.split(' ').pop()}` };
  return { cls: 'done', text: 'No action' };
}

/** The stewards' incidents, each from noted to decided. */
function Stewards({ list, names }) {
  const [all, setAll] = useState(false);
  const shown = all ? list : list.slice(0, 4);
  const step = (st) => `${st.what === 'penalty' ? cap(st.penalty) : (STEP[st.what] ?? `To be looked at ${st.what}`)}${st.lap ? `, lap ${st.lap}` : ''}`;
  return (
    <section className="sp-section">
      <div className="sp-pad sp-section-head">
        <h2 className="sp-h2">Stewards</h2>
        <span className="sp-tiny sp-muted">
          {list.length} {list.length === 1 ? 'incident' : 'incidents'}
        </span>
      </div>
      <ul className="sp-f1-incidents">
        {shown.map((inc, i) => {
          const s = standing(inc);
          return (
            <li key={i}>
              <div className="sp-f1-inc-top">
                <b>
                  {andList(inc.cars.map((n) => names[n] ?? `Car ${n}`))}
                  {inc.where ? <span className="sp-muted">, {inc.where.replace(/^Turn/, 'turn')}</span> : null}
                </b>
                <span className={`sp-f1-chip sp-f1-chip-${s.cls}`}>{s.text}</span>
              </div>
              {inc.reason && (
                <p className="sp-small sp-ink2" style={{ margin: '2px 0 0' }}>
                  {inc.reason}
                  {inc.offence ? ` (${ordinal(inc.offence)} offence)` : ''}
                </p>
              )}
              <p className="sp-tiny sp-muted" style={{ margin: '3px 0 0' }}>
                {inc.steps.map(step).join(' → ')}
              </p>
            </li>
          );
        })}
      </ul>
      {list.length > 4 && (
        <div className="sp-pad">
          <button className="sp-btn sp-btn-quiet" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => setAll(!all)}>
            {all ? 'Fewer' : `All ${list.length} incidents`}
          </button>
        </div>
      )}
    </section>
  );
}

// Race control's main messages: the flags that stop or slow the session and its notices (the
// stewards' have their own list). Track-limit deletions decide qualifying places, so they count
// there; in a race they're under "Show all".
const MAIN = { race: ['sc', 'red', 'chequered', 'info'], quali: ['sc', 'red', 'chequered', 'info', 'limits'], practice: ['sc', 'red', 'chequered', 'info', 'limits'] };
// A small mark before each kind of message that has one.
const MARK = { sc: 'SC', red: '', chequered: '', yellow: '', limits: 'TL' };

function RaceControl({ t, names }) {
  const [all, setAll] = useState(false);
  const main = MAIN[t.session.kind] ?? MAIN.race;
  const list = (all ? t.messages : t.messages.filter((m) => main.includes(m.kind))).slice(0, all ? 40 : 8);
  return (
    <section className="sp-section">
      <div className="sp-pad sp-section-head">
        <h2 className="sp-h2">Race control</h2>
        <button className="sp-btn sp-btn-quiet" aria-pressed={all} onClick={() => setAll(!all)} style={{ height: 30, paddingRight: 0 }}>
          {all ? 'Main ones' : 'Show all'}
        </button>
      </div>
      {list.length ? (
        <ul className="sp-f1-list sp-f1-rc">
          {list.map((m, i) => (
            <li key={`${m.at}${i}`}>
              <span className="sp-num sp-muted">{m.lap ? `Lap ${m.lap}` : m.at ? kickoff(m.at) : ''}</span>
              <span>
                {MARK[m.kind] != null && (
                  <i className={`sp-f1-rcm sp-f1-rcm-${m.kind}`} aria-hidden="true">
                    {MARK[m.kind]}
                  </i>
                )}
                <span className={m.kind === 'sc' || m.kind === 'red' ? 'sp-f1-strong' : undefined}>{plain(m.text, names)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sp-note sp-pad">Nothing yet beyond yellow flags and track limits.</p>
      )}
    </section>
  );
}
