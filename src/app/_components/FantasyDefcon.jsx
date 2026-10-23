'use client';
import { defconFixture } from '@/lib/fpl.mjs';
import { fixturesOf, fxLong, shirt } from './fplbits';

// DEFCON, live: where each of the manager's players stands against FPL's defensive-contribution line this
// gameweek (10 for defenders; 12 for midfielders and forwards, with recoveries counting), what's still
// needed and the chance of getting there in the minutes left, by the projections' own model
// (fpl.mjs defconFixture).

/** Chances never read 0% or 100% while anything is left to play. */
const pct = (p) => `${Math.min(99, Math.max(1, Math.round(p * 100)))}%`;

/** The line as small boxes, one per contribution it takes, filled as they come; green once it's reached. */
export function DefconBar({ d }) {
  return (
    <span className={`sp-dcbar${d.reached ? ' sp-dcbar-done' : ''}`} aria-hidden>
      {Array.from({ length: d.need }, (_, i) => (
        <i key={i} className={i < Math.min(d.have, d.need) ? 'on' : undefined} />
      ))}
    </span>
  );
}

/**
 * His DEFCON this gameweek, from the fixture that matters most now (the one being played, else the next,
 * else the last), with any other that week alongside: { f, need, have, ..., earlier }. Null for a
 * goalkeeper or a club with no match.
 */
export function defconNow(id, ctx) {
  const el = ctx.elements[id];
  if (!el) return null;
  const all = fixturesOf(el.team, ctx)
    .map((f) => ({ f, ...defconFixture(id, f, ctx) }))
    .filter((d) => d.need)
    .sort((a, b) => new Date(a.f.kickoff) - new Date(b.f.kickoff));
  if (!all.length) return null;
  const now = all.find((d) => d.f.started && !d.done) ?? all.find((d) => !d.f.started) ?? all[all.length - 1];
  return { ...now, others: all.filter((d) => d !== now) };
}

/** Where he stands, in words: { count (the figure on the right), text, tone }. */
export function defconWords(d, el) {
  const short = d.need - d.have;
  const count = `${d.have}/${d.need}`;
  if (d.reached) return { count: '+2', tone: 'up', text: d.paid ? `Reached ${d.need}: 2 points` : `Reached ${d.need}: FPL adds the 2 points shortly` };
  if (d.done) return { count, tone: 'muted', text: d.on ? `Finished ${short} short` : 'Didn’t play' };
  if (d.off) return { count, tone: 'muted', text: `Taken off ${short} short` };
  if (d.f.started && d.on) return { count, tone: 'live', text: `${short} more · ${pct(d.chance)} in the ${Math.max(1, Math.round(d.mins))} minutes left` };
  if (d.f.started) return { count, tone: 'muted', text: `Not on yet · ${pct(d.chance)}` };
  return { count: pct(d.chance), tone: 'todo', text: `Chance to get there, at ${(el.dc90 ?? 0).toFixed(1)} per 90 so far` };
}

/** Worth a row of its own: reached it, could still, or only just missed. The rest share one line. */
const close = (d) => d.reached || (!d.done && !d.off && d.chance >= 0.05) || ((d.done || d.off) && d.on && d.need - d.have <= 2);

/** Tackles, CBI and (for midfielders and forwards) recoveries so far this gameweek. */
function parts(el, st) {
  if (!st) return '';
  const n = (v, one, many) => (v ? `${v} ${v === 1 ? one : many}` : '');
  return [n(st.tk, 'tackle', 'tackles'), n(st.cbi, 'CBI', 'CBI'), el.type > 2 ? n(st.rec, 'recovery', 'recoveries') : ''].filter(Boolean).join(' · ');
}

const names = (list) => (list.length <= 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);

/** The panel on Fantasy › Team: every outfield player who counts this gameweek, nearest the line first. */
export function DefconTracker({ team, ctx, teams }) {
  const rows = team.lines
    .filter((l) => l.counts && l.type !== 1)
    .map((l) => ({ l, el: ctx.elements[l.element], d: defconNow(l.element, ctx) }))
    .filter((r) => r.el && r.d);
  if (!rows.length) return null;
  // Being chased now, then reached, then still to play, then finished short.
  const stage = ({ d }) => (d.reached ? 1 : d.f.started && !d.done && !d.off ? 0 : !d.f.started ? 2 : 3);
  rows.sort((a, b) => stage(a) - stage(b) || (stage(a) === 0 ? a.d.need - a.d.have - (b.d.need - b.d.have) : 0) || b.d.chance - a.d.chance || b.d.have - a.d.have);
  const reached = rows.filter((r) => r.d.reached);
  const chasing = rows.filter((r) => stage(r) === 0 && r.d.on);
  const shown = rows.filter((r) => close(r.d));
  const rest = rows.filter((r) => !close(r.d));
  const started = rows.some((r) => r.d.f.started || r.d.others.some((o) => o.f.started));
  const expected = rows.reduce((t, r) => t + 2 * r.d.chance, 0);

  let summary;
  if (!started) {
    const best = [...rows].sort((a, b) => b.d.chance - a.d.chance)[0];
    summary = (
      <>
        Expected from DEFCON this gameweek: <b className="sp-num">{expected.toFixed(1)}</b> points, most likely <b>{best.el.name}</b> ({pct(best.d.chance)}).
      </>
    );
  } else if (rows.every((r) => r.d.done && r.d.others.every((o) => o.done))) {
    const miss = rows.filter((r) => !r.d.reached && r.d.on).sort((a, b) => b.d.have / b.d.need - a.d.have / a.d.need)[0];
    summary = (
      <>
        {reached.length ? (
          <>
            <b className="sp-up">+{2 * reached.length}</b> from DEFCON this gameweek ({names(reached.map((r) => r.el.name))}).
          </>
        ) : (
          'No DEFCON points this gameweek.'
        )}
        {miss && miss.d.need - miss.d.have <= 3 ? (
          <>
            {' '}
            Nearest miss: <b>{miss.el.name}</b>, {miss.d.need - miss.d.have} short.
          </>
        ) : null}
      </>
    );
  } else {
    const near = chasing[0];
    summary = (
      <>
        {reached.length ? (
          <>
            <b className="sp-up">+{2 * reached.length}</b> from DEFCON so far ({names(reached.map((r) => r.el.name))}).
          </>
        ) : (
          'No DEFCON points yet.'
        )}
        {near ? (
          <>
            {' '}
            Closest: <b>{near.el.name}</b>, {near.d.need - near.d.have} more with {Math.max(1, Math.round(near.d.mins))} minutes left ({pct(near.d.chance)}).
          </>
        ) : null}
      </>
    );
  }

  return (
    <section className="sp-panel" id="defcon" style={{ marginTop: 12 }}>
      <div className="sp-section-head" style={{ marginBottom: 4 }}>
        <h2 className="sp-h2">DEFCON</h2>
        <span className="sp-tiny sp-muted">Defensive contributions</span>
      </div>
      <p className="sp-small sp-ink2" style={{ margin: '0 0 6px' }}>{summary}</p>
      {shown.map(({ l, el, d }) => {
        const w = defconWords(d, el);
        const st = ctx.live[l.element]?.st;
        const more = parts(el, st);
        const earlier = d.others.filter((o) => o.f.started).map((o) => (o.reached ? `${fxLong(o.f, el.team, teams)}: +2` : `${fxLong(o.f, el.team, teams)}: ${o.have} of ${o.need}`));
        return (
          <div key={l.element} className={`sp-dc${w.tone === 'live' ? ' sp-dc-live' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shirt(teams[el.team]?.code)} alt="" width="22" height="22" />
            <b className="sp-dc-name">{el.name}</b>
            <DefconBar d={d} />
            <b className={`sp-dc-n${w.tone === 'up' ? ' sp-up' : w.tone === 'muted' || w.tone === 'todo' ? ' sp-muted' : ''}`} aria-label={d.reached ? '2 points' : `${d.have} of ${d.need}`}>{w.count}</b>
            <small>
              <span className={w.tone === 'live' ? 'sp-ink2' : undefined} style={w.tone === 'live' ? { fontWeight: 700 } : undefined}>{w.text}</span>
              {' · '}
              {fxLong(d.f, el.team, teams)}
              {more ? ` · ${more}` : ''}
              {earlier.length ? ` · ${earlier.join(' · ')}` : ''}
            </small>
          </div>
        );
      })}
      {rest.length > 0 && (
        <p className="sp-small sp-ink2" style={{ margin: 0, padding: '9px 0 0', borderTop: shown.length ? '1px solid var(--sp-rule)' : 0 }}>
          Not close:{' '}
          {rest.map(({ l, el, d }, i) => (
            <span key={l.element}>
              {i ? ', ' : ''}
              {el.name} <span className="sp-num sp-muted">{d.f.started || d.done ? `${d.have}/${d.need}` : pct(d.chance)}</span>
            </span>
          ))}
        </p>
      )}
      <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>
        FPL gives 2 points for 10 defensive contributions in a match from a defender (clearances, blocks, interceptions and tackles; CBI for short), or 12 from a midfielder or forward, whose
        recoveries count too. Counts are FPL’s own live numbers. The chances are our projections’ model: each player’s defensive contributions per 90 this season, over the minutes still to play.
      </p>
    </section>
  );
}
