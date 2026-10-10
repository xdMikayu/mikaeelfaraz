'use client';
import { useMemo } from 'react';
import { headToHead, fixtureRates } from '@/lib/sport/fpl.mjs';
import { shirt, one, fixturesOf, fxLong, phase, Face } from './fplbits';
import { kickoff } from './time';

const isDone = (f) => f.finished || f.finishedProvisional;
const firstName = (name) => (name ?? '').trim().split(/\s+/)[0] || 'Rival';
const day = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });

/** You against one manager in your league: what you share, what you don't, and how the week should end. */
export default function Rival({ me, them, ctx, teams, onBack, live }) {
  const h = useMemo(() => headToHead(me.live, them.live, ctx), [me.live, them.live, ctx]);
  const name = firstName(them.manager);
  const gap = me.live.net - them.live.net;
  const lead = (v, a, b) => (Math.round(v) === 0 ? 'level' : `${v > 0 ? a : b} by ${Math.abs(Math.round(v))}`);
  const z = 1.28; // 80% of outcomes fall within ±1.28 standard deviations
  const lo = h.diff - z * h.sd;
  const hi = h.diff + z * h.sd;
  const before = (r) => (r.total != null && r.eventTotal != null ? r.total - r.eventTotal : null);
  const seasonA = before(me) != null ? before(me) + h.a.final : null;
  const seasonB = before(them) != null ? before(them) + h.b.final : null;
  // Never claim certainty the model can't back: under 1% reads as "<1%".
  const pct = (p) => (p < 0.01 ? '<1%' : p > 0.99 ? '>99%' : `${Math.round(p * 100)}%`);
  const barMax = Math.max(4, ...[...h.onlyA, ...h.onlyB].map((r) => r.extra * Math.max(r.proj.final, r.proj.now)));
  const toPlay = (t) => t.lines.filter((l) => l.counts && l.state.left).length;

  // The single player still able to move the gap most, by multiplier difference times points to come.
  const swing = [...h.onlyA.map((r) => ({ ...r, side: 'you' })), ...h.onlyB.map((r) => ({ ...r, side: 'them' }))]
    .filter((r) => r.proj.rest > 0.3)
    .sort((a, b) => b.extra * b.proj.rest - a.extra * a.proj.rest)[0];

  const fixtures = useMemo(() => {
    const ids = new Map();
    for (const r of [...h.onlyA, ...h.onlyB]) {
      const el = ctx.elements[r.element];
      for (const f of fixturesOf(el.team, ctx)) {
        const fx = ids.get(f.id) ?? { f, a: [], b: [] };
        (r.a > r.b ? fx.a : fx.b).push(r);
        ids.set(f.id, fx);
      }
    }
    const rank = (f) => (f.started && !isDone(f) ? 0 : !f.started ? 1 : 2);
    return [...ids.values()].sort((x, y) => rank(x.f) - rank(y.f) || new Date(x.f.kickoff) - new Date(y.f.kickoff));
  }, [h, ctx]);

  return (
    <div style={{ marginTop: 12 }}>
      <div className="sp-pad" style={{ marginBottom: 10 }}>
        <button className="sp-small sp-link" style={{ fontWeight: 700 }} onClick={onBack}>← League table</button>
      </div>

      <section className="sp-vs" aria-label={`You ${me.live.net}, ${name} ${them.live.net}`}>
        <div className="sp-vs-half sp-vs-me">
          <span className="sp-vs-who">You</span>
          <b>{me.team}</b>
          <span>{toPlay(me.live)} still to play</span>
        </div>
        <div className="sp-vs-half sp-vs-them">
          <span className="sp-vs-who">{name}</span>
          <b>{them.team}</b>
          <span>{toPlay(them.live)} still to play</span>
        </div>
        <div className="sp-hero-plate">
          <b className="sp-num">{me.live.net}–{them.live.net}</b>
          <span className={live ? 'sp-on' : ''}>{live ? 'Live' : 'This gameweek'}{gap ? `, ${lead(gap, 'you', name)}` : ', level'}</span>
        </div>
      </section>

      <section className="sp-panel" style={{ borderTop: 0 }}>
        <h2 className="sp-h2">How the week should end</h2>
        <div className="sp-proj">
          <div>
            <span className="sp-proj-num sp-num">{Math.round(h.a.final)}</span>
            <span className="sp-small sp-ink2">You, projected</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="sp-proj-num sp-num">{Math.round(h.b.final)}</span>
            <span className="sp-small sp-ink2">{name}, projected</span>
          </div>
        </div>
        <div className="sp-odds" role="img" aria-label={`Chance you finish the gameweek ahead: ${pct(h.pA)}`}>
          <i style={{ width: `${h.pA * 100}%` }} />
        </div>
        <div className="sp-odds-l">
          <span><b className="sp-num">{pct(h.pA)}</b> you finish ahead</span>
          <span><b className="sp-num">{pct(1 - h.pA)}</b> {name}</span>
        </div>
        <p className="sp-small sp-ink2" style={{ margin: '12px 0 0' }}>
          Most likely gap: <b style={{ color: 'var(--sp-ink)' }}>{lead(h.diff, 'you', name)}</b>
          {h.sd >= 0.5 ? `; four times in five between ${lead(lo, 'you', name)} and ${lead(hi, 'you', name)}.` : '. Nothing left to change it.'}
          {seasonA != null && seasonB != null && (
            <> League total after the week: <b style={{ color: 'var(--sp-ink)' }} className="sp-num">{Math.round(seasonA).toLocaleString()}</b> to <b style={{ color: 'var(--sp-ink)' }} className="sp-num">{Math.round(seasonB).toLocaleString()}</b>.</>
          )}
        </p>
        {swing && (
          <p className="sp-small sp-ink2" style={{ margin: '8px 0 0' }}>
            Biggest swing still to come: <b style={{ color: 'var(--sp-ink)' }}>{ctx.elements[swing.element].name}</b>
            {swing.a && swing.b ? `, captained by ${swing.side === 'you' ? 'you' : name}` : `, only in ${swing.side === 'you' ? 'your' : `${name}’s`} team`}, worth about {one(swing.extra * swing.proj.rest)} more points to {swing.side === 'you' ? 'you' : name}.
          </p>
        )}
      </section>

      <Shared h={h} ctx={ctx} teams={teams} name={name} />

      <div className="sp-two">
        <Differentials title="Only you" rows={h.onlyA} ctx={ctx} teams={teams} other={name} max={barMax} mine />
        <Differentials title={`Only ${name}`} rows={h.onlyB} ctx={ctx} teams={teams} other="you" max={barMax} />
      </div>

      {fixtures.length > 0 && <Matches list={fixtures} ctx={ctx} teams={teams} name={name} />}

      <p className="sp-note sp-pad" style={{ margin: '14px 0 0' }}>
        Projections are our estimate, not FPL’s. Each side’s chances come from its xG for and against this season (Opta data, via FPL) with home advantage; each player’s share from his own xG and xA per 90 minutes and how often he starts. Matches in play only add what the minutes left can bring. The chance of finishing ahead treats players as independent, so it is rougher when you both depend on the same match.
      </p>
    </div>
  );
}

function Shared({ h, ctx, teams, name }) {
  const same = h.shared.filter((r) => r.a === r.b);
  const capDiff = h.shared.filter((r) => r.a !== r.b);
  return (
    <section className="sp-panel">
      <h2 className="sp-h2">{h.squadShared} of 15 players in common</h2>
      <p className="sp-small sp-ink2" style={{ margin: '4px 0 10px' }}>
        {h.shared.length} in both of your elevens. {same.length ? 'Their points cancel out' : ''}
        {capDiff.length ? `${same.length ? ', except ' : ''}${capDiff.map((r) => ctx.elements[r.element].name).join(' and ')}, captained by only one of you.` : same.length ? '.' : ''}
        {!h.shared.length && `No shared starters: every point either of you scores moves the gap.`}
      </p>
      {h.shared.length > 0 && (
        <ul className="sp-common">
          {h.shared.map((r) => {
            const el = ctx.elements[r.element];
            const ph = phase(r.proj.state, fixturesOf(el.team, ctx));
            return (
              <li key={r.element}>
                <Face el={el} teams={teams} size={28} />
                <span className="sp-common-n">{el.name}{r.a !== r.b ? <small>{r.a > r.b ? 'Your captain' : `${name}’s captain`}</small> : null}</span>
                <Status ph={ph} pts={r.proj.now} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Points with the status beside them: grey when done, red while playing, kick-off when still to come. */
function Status({ ph, pts }) {
  if (ph.kind === 'todo' || ph.kind === 'bench') return <span className="sp-st sp-st-todo">{ph.when}</span>;
  return (
    <span className={`sp-st sp-st-${ph.kind}`}>
      <b className="sp-num">{pts}</b>
      {ph.kind === 'live' ? ` ${ph.when}` : ''}
    </span>
  );
}

function Differentials({ title, rows, ctx, teams, other, max, mine }) {
  const now = rows.reduce((t, r) => t + r.extra * r.proj.now, 0);
  const proj = rows.reduce((t, r) => t + r.extra * r.proj.final, 0);
  return (
    <section className="sp-panel">
      <div className="sp-section-head" style={{ marginBottom: 2 }}>
        <h2 className="sp-h2">{title}</h2>
        <span className="sp-small sp-ink2"><b style={{ color: 'var(--sp-ink)' }} className="sp-num">{now}</b> now · <b style={{ color: 'var(--sp-ink)' }} className="sp-num">{one(proj)}</b> projected</span>
      </div>
      <p className="sp-tiny sp-muted" style={{ margin: '0 0 4px' }}>
        Points each gives {mine ? 'you' : 'them'} over {other}. Solid: scored. Outline: still expected.
      </p>
      {rows.length === 0 && <p className="sp-small sp-ink2" style={{ margin: '10px 0 0' }}>No differentials.</p>}
      {rows.map((r) => {
        const el = ctx.elements[r.element];
        const fx = fixturesOf(el.team, ctx);
        const ph = phase(r.proj.state, fx);
        const p = r.proj;
        const played = p.state.minutes > 0;
        const captainOnly = r.a && r.b;
        const stats = [
          played ? `xG ${p.xgLive.toFixed(2)} · xA ${p.xaLive.toFixed(2)}` : null,
          p.rest > 0.05 ? `${played ? 'still expected ' : 'expected '}xG ${p.xgRest.toFixed(2)} · xA ${p.xaRest.toFixed(2)}` : null,
        ].filter(Boolean);
        return (
          <div key={r.element} className={`sp-dif sp-dif-${ph.kind}`}>
            <Face el={el} teams={teams} />
            <span style={{ minWidth: 0 }}>
              <span className="sp-dif-top">
                <b className="sp-dif-name">{el.name}</b>
                {captainOnly ? <span className="sp-tiny sp-ink2" style={{ fontWeight: 700 }}>captain, ×{Math.max(r.a, r.b)} to ×{Math.min(r.a, r.b)}</span> : r.extra > 1 ? <span className="sp-tiny sp-ink2" style={{ fontWeight: 700 }}>{r.extra === 3 ? 'triple captain' : 'captain'}</span> : null}
                <span className="sp-dif-pts">
                  <b className="sp-num">{r.extra * p.now}</b>
                  {p.rest > 0.05 && <span className="sp-num"> → {one(r.extra * p.final)}</span>}
                </span>
              </span>
              <span className="sp-tiny sp-muted sp-dif-line">
                <span className={`sp-st-word sp-st-${ph.kind}`}>{{ done: 'Played', out: 'Didn’t play', live: `Playing ${ph.when}`, bench: `On the bench, ${ph.when}`, todo: 'To play', blank: 'No match' }[ph.kind]}</span>
                {' · '}
                {fx.map((f) => fxLong(f, el.team, teams)).join(' · ') || teams[el.team]?.short}
              </span>
              {stats.length > 0 && <span className="sp-tiny sp-ink2 sp-dif-line">{stats.join(' · ')}</span>}
              <span className="sp-dif-track" aria-hidden>
                <i className="sp-dif-now" style={{ width: `${Math.max(0, (r.extra * p.now) / max) * 100}%` }} />
                <i className="sp-dif-rest" style={{ width: `${((r.extra * p.rest) / max) * 100}%` }} />
              </span>
            </span>
          </div>
        );
      })}
    </section>
  );
}

/** Each side's xG in a match: Opta's live numbers once it has started, our pre-match expectation before. */
function sideXg(f, teamId, ctx) {
  if (!f.started) {
    const r = fixtureRates(f, ctx.model);
    return { v: f.home === teamId ? r.home : r.away, pre: true };
  }
  // Only safe when this is the team's only match of the gameweek: FPL's live xG is per gameweek.
  if (fixturesOf(teamId, ctx).length > 1) return null;
  let v = 0;
  for (const [id, s] of Object.entries(ctx.live)) if (ctx.elements[id]?.team === teamId && s.minutes > 0) v += s.xg ?? 0;
  return { v, pre: false };
}

function Matches({ list, ctx, teams, name }) {
  return (
    <section className="sp-group">
      <header className="sp-ghead" style={{ display: 'block' }}>
        <h2 className="sp-h3">The matches that decide it</h2>
        <p className="sp-tiny sp-muted" style={{ margin: '2px 0 0' }}>Right-hand column: xG, live from Opta once a match starts; before kick-off, our expected goals in grey.</p>
      </header>
      {list.map(({ f, a, b }) => {
        const done = isDone(f);
        const on = f.started && !done;
        const side = (id, score) => {
          const x = sideXg(f, id, ctx);
          return (
            <span className="sp-mx-side">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shirt(teams[id]?.code)} alt="" width="22" height="22" style={{ objectFit: 'contain' }} />
              <span className="sp-tn">{teams[id]?.name}</span>
              <b className="sp-num sp-mx-score">{f.started ? score : ''}</b>
              <span className={`sp-num sp-mx-xg${x?.pre ? ' sp-muted' : ''}`}>{x ? x.v.toFixed(2) : '–'}</span>
            </span>
          );
        };
        const who = (rows) => rows.map((r) => `${ctx.elements[r.element].name}${r.extra > 1 ? ` ×${r.extra}` : ''}`).join(', ');
        return (
          <div key={f.id} className="sp-mx">
            <span className="sp-row-status">
              {done ? <span className="sp-pill sp-pill-ft">FT</span> : on ? <span className="sp-pill sp-pill-live">{f.minutes}′</span> : (
                <>
                  <span className="sp-muted" style={{ fontWeight: 600 }}>{day(f.kickoff)}</span>
                  <span className="sp-pill sp-pill-time">{kickoff(f.kickoff)}</span>
                </>
              )}
            </span>
            <span style={{ minWidth: 0 }}>
              {side(f.home, f.hs)}
              {side(f.away, f.as)}
              <span className="sp-tiny sp-ink2 sp-mx-who">
                {a.length > 0 && <span><b style={{ color: 'var(--sp-ink)' }}>You:</b> {who(a)}</span>}
                {b.length > 0 && <span><b style={{ color: 'var(--sp-ink)' }}>{name}:</b> {who(b)}</span>}
              </span>
            </span>
          </div>
        );
      })}
    </section>
  );
}
