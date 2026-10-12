'use client';
import { useMemo, useState } from 'react';
import { fixtureRates } from '@/lib/sport/fpl.mjs';
import { matchOdds } from '@/lib/sport/forecast.mjs';
import { shirt, heat } from './fplbits';
import { kickoff } from './time';
import Leaderboard from './FantasyLeaderboard';

// A chance as a whole percentage, never 0% or 100%; a dash where there's no number.
const pc = (p) => (p == null ? '–' : `${Math.min(99, Math.max(1, Math.round(p * 100)))}%`);
const two = (x) => (x == null ? '–' : x.toFixed(2));
const isDone = (f) => f.finished || f.finishedProvisional;
const span = (vals) => {
  const known = vals.filter((v) => v != null);
  const lo = Math.min(...known);
  const hi = Math.max(...known);
  return (v) => (v != null && hi > lo ? (v - lo) / (hi - lo) : 0);
};

/** A match's numbers from the bookmakers' prices (see /api/sport/odds), or null where there are none. */
function fromPrices(b) {
  if (!b) return null;
  return { provider: b.provider, r: { home: b.home, away: b.away }, o: { home: b.win[0], draw: b.win[1], away: b.win[2], csHome: b.csHome, csAway: b.csAway } };
}
const NONE = { r: { home: null, away: null }, o: { home: null, draw: null, away: null, csHome: null, csAway: null } };

/**
 * One gameweek at a glance: for every fixture, each side's expected goals and clean-sheet chance,
 * from the bookmakers' prices or our model, shaded so the best numbers stand out, or the same per
 * club ranked for picking players.
 */
export default function Gameweek({ st, live, fixtures, ctx, teams, kit, oddsAt }) {
  const cur = live.event;
  const curDone = live.fixtures.length > 0 && live.fixtures.every(isDone);
  const [gw, setGw] = useState(curDone && cur < 38 ? cur + 1 : cur);
  const [view, setView] = useState('match');
  const [sortBy, setSortBy] = useState('goals');
  const [source, setSource] = useState('market');
  const list = useMemo(() => (fixtures ?? live.fixtures).filter((f) => (f.event ?? cur) === gw).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff)), [fixtures, live.fixtures, gw, cur]);

  // Both readings of every match: our model's, and the bookmakers' where they've priced it.
  const both = useMemo(() => {
    const ours = { ...ctx.model, byFixture: undefined };
    return list.map((f) => {
      const r = fixtureRates(f, ours);
      return { f, model: { r, o: matchOdds(r.home, r.away) }, market: fromPrices(ctx.model.byFixture?.[f.id]) };
    });
  }, [list, ctx.model]);
  // The bookmakers' numbers first whenever they've priced a match still to come in this gameweek.
  const priced = both.some((x) => x.market && !x.f.started);
  const src = priced ? source : 'model';
  const rows = both.map(({ f, model, market }) => ({ f, ...(src === 'model' ? model : market ?? NONE) }));
  const gaps = src === 'market' && rows.some((x) => x.r.home == null);
  const provider = both.find((x) => x.market?.provider)?.market.provider ?? 'the bookmakers';
  // Opta's xG from FPL's live data, for matches under way or played in the live gameweek.
  const liveXg = useMemo(() => {
    if (gw !== cur) return {};
    const out = {};
    const once = (t) => live.fixtures.filter((f) => f.home === t || f.away === t).length === 1;
    for (const [id, s] of Object.entries(ctx.live)) {
      const t = ctx.elements[id]?.team;
      if (t && once(t) && s.minutes > 0) out[t] = (out[t] ?? 0) + (s.xg ?? 0);
    }
    return out;
  }, [gw, cur, ctx, live.fixtures]);

  const goalsT = span(rows.flatMap((x) => [x.r.home, x.r.away]));
  const csT = span(rows.flatMap((x) => [x.o.csHome, x.o.csAway]));
  const ev = st.events.find((e) => e.id === gw);
  const sides = rows
    .flatMap(({ f, r, o }) => [
      { team: f.home, opp: f.away, home: true, goals: r.home, against: r.away, cs: o.csHome, win: o.home, f },
      { team: f.away, opp: f.home, home: false, goals: r.away, against: r.home, cs: o.csAway, win: o.away, f },
    ])
    .sort((a, b) => (b[sortBy] ?? -1) - (a[sortBy] ?? -1));
  // Group matches by local day, like a fixture list.
  const days = [];
  for (const x of rows) {
    const d = new Date(x.f.kickoff).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
    if (!days.length || days[days.length - 1].d !== d) days.push({ d, items: [] });
    days[days.length - 1].items.push(x);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="sp-pad sp-gw-nav">
        <button className="sp-btn sp-btn-sm" onClick={() => setGw((g) => Math.max(1, g - 1))} disabled={gw <= 1} aria-label="Previous gameweek">←</button>
        <span style={{ textAlign: 'center' }}>
          <b className="sp-h2" style={{ display: 'block' }}>Gameweek {gw}</b>
          {ev && <span className="sp-tiny sp-muted">Deadline {new Date(ev.deadline).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, {kickoff(ev.deadline)}</span>}
        </span>
        <button className="sp-btn sp-btn-sm" onClick={() => setGw((g) => Math.min(38, g + 1))} disabled={gw >= 38} aria-label="Next gameweek">→</button>
      </div>
      <div className="sp-pad">
        <div className="sp-tabs" role="radiogroup" aria-label="View" style={{ gap: 16 }}>
          <button role="radio" aria-checked={view === 'match'} onClick={() => setView('match')} style={{ height: 34, fontSize: 14 }}>By match</button>
          <button role="radio" aria-checked={view === 'team'} onClick={() => setView('team')} style={{ height: 34, fontSize: 14 }}>By club</button>
          <button role="radio" aria-checked={view === 'player'} onClick={() => setView('player')} style={{ height: 34, fontSize: 14 }}>Net xG</button>
        </div>
        {priced && view !== 'player' && (
          <div className="sp-tabs" role="radiogroup" aria-label="Numbers from" style={{ border: 0, gap: 14, alignItems: 'center' }}>
            <span className="sp-tiny sp-muted">From</span>
            {[['market', 'Bookmakers'], ['model', 'Our model']].map(([k, l]) => (
              <button key={k} role="radio" aria-checked={src === k} onClick={() => setSource(k)} style={{ height: 30, fontSize: 13 }}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {rows.length === 0 && <p className="sp-empty">No fixtures in gameweek {gw}.</p>}

      {view === 'match' && rows.length > 0 && (
        <div className="sp-heat-wrap" style={{ marginTop: 8 }}>
          <table className="sp-gw">
            <thead>
              <tr>
                <th />
                <th>CS%</th>
                <th>Goals</th>
                <th />
                <th>Goals</th>
                <th>CS%</th>
                <th />
              </tr>
            </thead>
            {days.map(({ d, items }) => (
              <tbody key={d}>
                <tr className="sp-gw-day"><td colSpan={7}>{d}</td></tr>
                {items.map(({ f, r, o }) => {
                  const done = isDone(f);
                  const on = f.started && !done;
                  const team = (id, win, right) => (
                    <td className={`sp-gw-team${right ? ' r' : ''}`}>
                      <span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {!right && <img src={shirt(teams[id]?.code)} alt="" width="22" height="22" />}
                        <b>{teams[id]?.short}</b>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {right && <img src={shirt(teams[id]?.code)} alt="" width="22" height="22" />}
                      </span>
                      <small className="sp-num">{f.started || win == null ? '' : `win ${pc(win)}`}</small>
                    </td>
                  );
                  const xgH = liveXg[f.home];
                  const xgA = liveXg[f.away];
                  return (
                    <tr key={f.id} className={done ? 'sp-gw-done' : ''}>
                      {team(f.home, o.home, false)}
                      <td className="sp-num sp-gw-v" style={heat(csT(o.csHome))}>{pc(o.csHome)}</td>
                      <td className="sp-num sp-gw-v" style={heat(goalsT(r.home))}>{two(r.home)}</td>
                      <td className="sp-gw-mid">
                        {f.started ? (
                          <>
                            <b className="sp-num">{f.hs}–{f.as}</b>
                            <small className={on ? 'sp-live-text' : ''}>{on ? `${f.minutes}′` : 'FT'}</small>
                            {xgH != null && xgA != null && <small className="sp-num sp-gw-xg">xG {xgH.toFixed(1)}–{xgA.toFixed(1)}</small>}
                          </>
                        ) : (
                          <small className="sp-num" style={{ fontWeight: 750, color: 'var(--sp-ink-2)' }}>{kickoff(f.kickoff)}</small>
                        )}
                      </td>
                      <td className="sp-num sp-gw-v" style={heat(goalsT(r.away))}>{two(r.away)}</td>
                      <td className="sp-num sp-gw-v" style={heat(csT(o.csAway))}>{pc(o.csAway)}</td>
                      {team(f.away, o.away, true)}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}

      {view === 'player' && fixtures && <Leaderboard st={st} fixtures={fixtures} gw={gw} ctx={ctx} teams={teams} kit={kit} />}

      {view === 'team' && rows.length > 0 && (
        <section className="sp-group" style={{ marginTop: 4 }}>
          <div className="sp-pad">
            <div className="sp-tabs" role="radiogroup" aria-label="Rank clubs by" style={{ border: 0, gap: 14, alignItems: 'center' }}>
              <span className="sp-tiny sp-muted">Rank by</span>
              {[['goals', 'Goals'], ['cs', 'Clean sheets'], ['win', 'Win']].map(([k, l]) => (
                <button key={k} role="radio" aria-checked={sortBy === k} onClick={() => setSortBy(k)} style={{ height: 30, fontSize: 13 }}>{l}</button>
              ))}
            </div>
          </div>
          {sides.map((s, i) => (
            <div key={`${s.f.id}-${s.team}`} className="sp-gw-club">
              <span className="sp-num sp-muted" style={{ fontWeight: 800 }}>{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shirt(teams[s.team]?.code)} alt="" width="22" height="22" />
              <span style={{ minWidth: 0 }}>
                <b>{teams[s.team]?.name}</b>
                <span className="sp-tiny sp-muted" style={{ display: 'block' }}>v {teams[s.opp]?.short} ({s.home ? 'H' : 'A'})</span>
              </span>
              <span className="sp-num" style={{ ...heat(goalsT(s.goals)), ...(sortBy === 'goals' ? { fontWeight: 900 } : null) }}>{two(s.goals)}</span>
              <span className="sp-num" style={{ ...heat(csT(s.cs)), ...(sortBy === 'cs' ? { fontWeight: 900 } : null) }}>{pc(s.cs)}</span>
              <span className="sp-num" style={sortBy === 'win' ? { fontWeight: 900 } : null}>{pc(s.win)}</span>
            </div>
          ))}
          <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>Columns: expected goals, clean-sheet chance, win chance. A club with two matches this gameweek appears twice.</p>
        </section>
      )}

      <p className="sp-note sp-pad" style={{ margin: '12px 0 0' }}>
        {src === 'market' ? (
          <>
            Prices from {provider} via ESPN{oddsAt ? ` at ${kickoff(oddsAt)}` : ''}, with the bookmaker’s margin taken out. Expected goals are the scoring rates that best fit the win, draw and over/under prices; clean sheets follow from those.
            {gaps ? ' A dash: no price yet (they come out about a week before kick-off) or the match has started.' : ''}
          </>
        ) : (
          <>
            Our estimate. Projected goals come from team ratings fitted on every Premier League match since 2023/24 (mostly xG, recent matches counting more) with home advantage; clean sheets and wins from those goal rates.
            {priced ? '' : ' The bookmakers’ prices show here once they’re out, about a week before kick-off.'}
          </>
        )}{' '}
        Darker cells are better for that side.
        {gw === cur ? ' Live and finished matches show Opta’s xG from FPL.' : ''}
      </p>
    </div>
  );
}
