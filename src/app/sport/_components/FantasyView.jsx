'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { projectedBonus, teamLive, leagueLive, pointChanges, buildModel, withMatchups, POS, STAT_LABEL } from '@/lib/sport/fpl.mjs';
import { usePrefs } from './prefs';
import { useLive, Freshness } from './useLive';
import { kickoff, shortDate, until } from './time';
import { shirt, photo, signed, fixturesOf, fxShort, fxLong, phase, Face } from './fplbits';
import Rival from './FantasyRival';
import Planner from './FantasyPlanner';
import Gameweek from './FantasyGameweek';
import Stats from './FantasyStats';
import MatchupPanel from './FantasyMatchup';
import { useMatchupIndex, useForecastKit } from './matchupData';

const CHIP = { bboost: 'Bench Boost', '3xc': 'Triple Captain', freehit: 'Free Hit', wildcard: 'Wildcard' };

async function api(path, signal) {
  const res = await fetch(`/api/sport/fpl/${path}`, { signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `FPL ${res.status}`);
  return json;
}

const liveGw = (live) => live?.fixtures.some((f) => (f.started && !f.finished) || (!f.started && new Date(f.kickoff) - Date.now() < 15 * 60e3 && new Date(f.kickoff) > Date.now() - 3 * 3600e3));

export default function FantasyView() {
  const { prefs, update, ready } = usePrefs();
  const entryId = prefs.fplEntry;
  const [revealed, setRevealed] = useState(false);
  const st = useLive((signal) => api('static', signal), [], { every: 300000, live: () => true });
  const gw = st.data?.current;
  const live = useLive((signal) => (gw ? api(`live?event=${gw}`, signal) : Promise.resolve(null)), [gw], { every: 30000, live: liveGw });
  const season = useLive((signal) => api('fixtures', signal), [], { every: 600000, live: () => false });
  const entry = useLive((signal) => (gw && entryId ? api(`entry?id=${entryId}&event=${gw}`, signal) : Promise.resolve(null)), [gw, entryId], {
    every: 60000,
    live: () => liveGw(live.data),
  });

  if (!ready) return null;
  if (!entryId) return <Setup onSave={(id) => update({ fplEntry: id })} />;
  if (prefs.spoilers === 'all' && !revealed) {
    return (
      <div className="sp-empty">
        <p style={{ margin: '0 0 12px' }}>Fantasy points give results away, so spoiler mode hides them.</p>
        <button className="sp-btn sp-btn-primary" onClick={() => setRevealed(true)}>Show my points</button>
      </div>
    );
  }
  if (st.error && !st.data) return <p className="sp-empty">FPL isn’t answering ({st.error}). It’s often briefly down around deadlines; this page will retry.</p>;
  if (!st.data || !live.data || (!entry.data && !entry.error)) return <FantasySkeleton />;
  if (entry.error && !entry.data)
    return (
      <div className="sp-empty">
        <p style={{ margin: '0 0 12px' }}>Couldn’t load team {entryId} ({entry.error}).</p>
        <button className="sp-btn" onClick={() => update({ fplEntry: null })}>Use a different team ID</button>
      </div>
    );
  return <Live st={st.data} live={live.data} entry={entry.data} fixtures={season.data} liveAt={live.at} liveErr={live.error} />;
}

function Live({ st, live, entry, fixtures, liveAt, liveErr }) {
  const { prefs, update } = usePrefs();
  const mx = useMatchupIndex();
  const kit = useForecastKit(mx.data);
  // FPL's season numbers first; the longer matchup history replaces them once its file has loaded.
  const model = useMemo(() => (kit ? withMatchups(buildModel(st.elements), kit) : buildModel(st.elements)), [st, kit]);
  const ctx = useMemo(
    () => ({ elements: Object.fromEntries(st.elements.map((e) => [e.id, e])), live: live.elements, fixtures: live.fixtures, bonus: projectedBonus(live.fixtures), model }),
    [st, live, model]
  );
  const teams = useMemo(() => Object.fromEntries(st.teams.map((t) => [t.id, t])), [st]);
  const gw = st.events.find((e) => e.id === live.event);
  const next = st.events.find((e) => e.next);
  const picks = entry.gw;
  const team = picks ? teamLive(picks.picks, picks.chip, picks.hit, ctx) : null;
  const feed = useFeed(ctx, picks?.picks.map((p) => p.element) ?? []);
  const [tab, setTab] = useState('team');
  const leagueId = prefs.fplLeague && entry.leagues.some((l) => l.id === prefs.fplLeague) ? prefs.fplLeague : entry.leagues[0]?.id ?? null;
  const allDone = live.fixtures.length > 0 && live.fixtures.every((f) => f.finished);
  const isLive = liveGw(live);
  // Overall rank now against last gameweek's, for the arrow.
  const prevRank = entry.history.find((h) => h.event === live.event - 1)?.overall ?? null;
  const rankNow = picks?.overall ?? null;
  const moved = prevRank && rankNow ? prevRank - rankNow : 0;
  // The counting players by where they are in their gameweek.
  const counts = { done: 0, live: 0, todo: 0 };
  for (const l of team?.lines ?? []) {
    if (!l.counts) continue;
    const k = phase(l.state, fixturesOf(ctx.elements[l.element]?.team, ctx)).kind;
    counts[k === 'live' ? 'live' : k === 'todo' || k === 'bench' ? 'todo' : 'done'] += 1;
  }

  return (
    <div className="sp-read">
      {team ? (
        <section className="sp-fhead" aria-label="Gameweek points">
          <p className="sp-small" style={{ fontWeight: 700, margin: 0 }}>
            Gameweek {live.event}
            {isLive ? <span className="sp-live-text"> · live</span> : allDone && gw?.checked ? ' · final' : ''}
          </p>
          <span className="sp-hero-num sp-num" style={{ display: 'block', marginTop: 8 }}>{team.net}</span>
          <p className="sp-small sp-ink2" style={{ margin: '6px 0 0' }}>
            {allDone && gw?.checked ? 'points' : 'points so far'}
            {team.hit ? `, after −${team.hit}` : ''} · <b style={{ color: 'var(--sp-ink)' }}>{entry.name}</b>
          </p>
          {(gw?.average || gw?.highest) && <Scale you={team.net} avg={gw.average} top={gw.highest} />}
          <Progress counts={counts} />
          <div className="sp-facts" style={{ marginTop: 10 }}>
            <span>Rank <b className="sp-num">{rankNow ? rankNow.toLocaleString() : '–'}</b>{moved !== 0 && <b className={moved > 0 ? 'sp-up' : 'sp-down'}> {moved > 0 ? '▲' : '▼'} {compactRank(Math.abs(moved))}</b>}</span>
            {picks.chip ? <span><b>{CHIP[picks.chip] ?? picks.chip}</b> played</span> : <span><b>{team.lines.filter((l) => !l.counts).reduce((t, l) => t + l.state.points, 0)}</b> on the bench</span>}
          </div>
          {next && new Date(next.deadline) > Date.now() && (
            <p className="sp-small sp-ink2" style={{ margin: '10px 0 0' }}>
              Gameweek {next.id} deadline <b style={{ color: 'var(--sp-ink)' }}>{shortDate(next.deadline)}, {kickoff(next.deadline)}</b>, {until(next.deadline)}.
            </p>
          )}
          <p className="sp-tiny sp-muted" style={{ margin: '6px 0 0' }}>
            <Freshness at={liveAt} error={liveErr} live={isLive} every={30} /> ·{' '}
            <button className="sp-link" onClick={() => update({ fplEntry: null, fplLeague: null })}>Change team</button>
          </p>
        </section>
      ) : (
        <p className="sp-empty">This team has no picks for gameweek {live.event}.</p>
      )}

      {feed.length > 0 && (
        <section className="sp-panel" style={{ borderTop: 0 }}>
          <h2 className="sp-h3" style={{ marginBottom: 4 }}>Since you opened this page</h2>
          <ul className="sp-feed">
            {feed.slice(0, 12).map((f) => {
              const el = ctx.elements[f.element];
              return (
                <li key={f.key}>
                  <span className="sp-num sp-muted sp-tiny">{new Date(f.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  <span style={{ minWidth: 0 }}>
                    <b>{el?.name}</b>
                    <span className="sp-muted sp-tiny" style={{ display: 'block' }}>{f.why.map((w) => `${STAT_LABEL[w.stat] ?? w.stat} ${signed(w.delta)}`).join(' · ')}</span>
                  </span>
                  <span className={`sp-delta ${f.delta > 0 ? 'sp-up' : 'sp-down'}`}>{signed(f.delta)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="sp-pad" style={{ marginTop: 6 }}>
        <div className="sp-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'team'} onClick={() => setTab('team')}>Pitch</button>
          <button role="tab" aria-selected={tab === 'list'} onClick={() => setTab('list')}>List</button>
          {fixtures && <button role="tab" aria-selected={tab === 'plan'} onClick={() => setTab('plan')}>Planner</button>}
          {leagueId && <button role="tab" aria-selected={tab === 'league'} onClick={() => setTab('league')}>League</button>}
          <button role="tab" aria-selected={tab === 'fixtures'} onClick={() => setTab('fixtures')}>Gameweek</button>
          <button role="tab" aria-selected={tab === 'stats'} onClick={() => setTab('stats')}>Stats</button>
        </div>
      </div>

      {tab === 'team' && team && <Pitch team={team} ctx={ctx} teams={teams} forecast={kit} fixtures={fixtures} />}
      {tab === 'plan' && fixtures && picks && <Planner st={st} ctx={ctx} teams={teams} picks={picks.picks} bank={picks.bank ?? 0} fixtures={fixtures} kit={kit} />}
      {tab === 'list' && team && <TeamList team={team} ctx={ctx} teams={teams} />}
      {tab === 'league' && leagueId && <League id={leagueId} event={live.event} entry={entry} ctx={ctx} myTeam={team} teams={teams} live={isLive} onPick={(id) => update({ fplLeague: id })} />}
      {tab === 'fixtures' && <Gameweek st={st} live={live} fixtures={fixtures} ctx={ctx} teams={teams} kit={kit} />}
      {tab === 'stats' && <Stats st={st} live={live} fixtures={fixtures} ctx={ctx} teams={teams} />}
    </div>
  );
}

/** You against the gameweek average and the top score, on one line. */
function Scale({ you, avg, top }) {
  const max = Math.max(top ?? 0, you, avg ?? 0, 1);
  const at = (v) => `${Math.min(97, Math.max(3, (v / max) * 100))}%`;
  // Your label sits under the line, the others above it, so they never collide.
  return (
    <div className="sp-scale" role="img" aria-label={`You ${you}${avg ? `, average ${avg}` : ''}${top ? `, highest ${top}` : ''}`}>
      <div className="sp-scale-bar" />
      {avg ? <div className="sp-scale-m" style={{ left: at(avg) }}>Average {avg}<i /></div> : null}
      {top ? <div className="sp-scale-m" style={{ left: at(top), transform: 'translateX(-100%)', textAlign: 'right' }}>Top {top}<i style={{ marginRight: 0 }} /></div> : null}
      <span className="sp-scale-you" style={{ left: at(you) }} />
      <span className="sp-scale-you-l" style={{ left: at(you) }}>You</span>
    </div>
  );
}

/** Eleven squares, one per counting player: played, playing now, still to play. */
function Progress({ counts }) {
  const cells = [...Array(counts.done).fill('done'), ...Array(counts.live).fill('live'), ...Array(counts.todo).fill('todo')];
  return (
    <div className="sp-prog" style={{ marginTop: 14 }}>
      <span className="sp-prog-cells" aria-hidden>
        {cells.map((c, i) => <i key={i} className={`sp-prog-${c}`} />)}
      </span>
      <span className="sp-small">
        <b>{counts.done}</b> played · <b className={counts.live ? 'sp-live-text' : ''}>{counts.live}</b> playing · <b>{counts.todo}</b> to play
      </span>
    </div>
  );
}

const firstName = (name) => (name ?? '').trim().split(/\s+/)[0] || 'Rival';

const compactRank = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n.toLocaleString());

/** Point changes between refreshes, newest first, for the players in this team. */
function useFeed(ctx, ids) {
  const prev = useRef(null);
  const [feed, setFeed] = useState([]);
  const key = ids.join(',');
  useEffect(() => {
    const now = Object.fromEntries(ids.map((id) => [id, { points: ctx.live[id]?.points ?? 0, explain: ctx.live[id]?.explain ?? [] }]));
    if (prev.current) {
      const ch = pointChanges(prev.current, now, ids);
      if (ch.length) setFeed((f) => [...ch.map((c, i) => ({ ...c, at: Date.now(), key: `${Date.now()}-${i}` })), ...f]);
    }
    prev.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.live, key]);
  return feed;
}

/** "Goal +6 · Bonus +2 (provisional)": where the points came from, minutes left out. */
function breakdown(state) {
  const sum = {};
  for (const f of state.explain ?? []) for (const s of f.stats) if (!['bonus'].includes(s.identifier) && s.points) sum[s.identifier] = (sum[s.identifier] ?? 0) + s.points;
  const out = Object.entries(sum).map(([k, v]) => ({ k, label: STAT_LABEL[k] ?? k, v }));
  if (state.bonus) out.push({ k: 'bonus', label: state.bonusProvisional ? 'Bonus (provisional)' : 'Bonus', v: state.bonus });
  return out;
}

/** The squad on a pitch: the scoring eleven (after projected autosubs) in their lines, bench below. */
function Pitch({ team, ctx, teams, forecast, fixtures }) {
  const [sel, setSel] = useState(null);
  const subIn = new Set(team.subs.map((s) => s.in));
  const subOut = new Set(team.subs.map((s) => s.out));
  const xi = team.lines.filter((l) => l.counts);
  const bench = team.lines.filter((l) => !l.counts).sort((a, b) => a.position - b.position);
  const rows = [1, 2, 3, 4].map((t) => xi.filter((l) => l.type === t));
  const cur = sel && team.lines.find((l) => l.element === sel);
  const kit = (l, onBench) => {
    const el = ctx.elements[l.element];
    const fx = fixturesOf(el.team, ctx);
    const pts = l.counts ? l.total : l.state.points;
    const ph = phase(l.state, fx);
    // Still to play and nothing scored yet: the plate shows the kick-off instead of a 0.
    const waiting = (ph.kind === 'todo' || ph.kind === 'bench') && l.state.minutes === 0 && pts === 0;
    const label = { done: 'played', live: 'playing now', bench: 'on the bench in a live match', todo: 'still to play', out: 'didn’t play', blank: 'no match' }[ph.kind];
    return (
      <button key={l.element} className={`sp-kit sp-kit-${ph.kind}${onBench && !l.counts ? ' sp-kit-out' : ''}`} onClick={() => setSel(sel === l.element ? null : l.element)} aria-pressed={sel === l.element} aria-label={`${el.name}, ${pts} points, ${label}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shirt(teams[el.team]?.code, el.type === 1)} alt="" width="52" height="52" loading="lazy" />
        {(subIn.has(l.element) || subOut.has(l.element)) && (
          <i className="sp-kit-sub" title={subIn.has(l.element) ? 'Comes on (projected)' : 'Comes off (projected)'}>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d={subIn.has(l.element) ? 'M5 9V1.5M1.8 4.5 5 1.3l3.2 3.2' : 'M5 1v7.5M1.8 5.5 5 8.7l3.2-3.2'} stroke={subIn.has(l.element) ? '#0f9f5a' : '#e2394b'} strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
          </i>
        )}
        {(l.captain || l.vice || l.captainNow) && (
          <i className="sp-kit-badge">{l.captainNow ? (l.mult === 3 ? 'TC' : 'C') : l.captain ? 'C' : 'V'}</i>
        )}
        <span className="sp-kit-name">{el.name}</span>
        <span className="sp-kit-pts">{waiting ? ph.when : pts}</span>
        <span className="sp-kit-fx">
          {ph.kind === 'done' ? 'FT ' : ph.kind === 'bench' ? 'Not on · ' : ''}
          {ph.kind === 'out' ? 'Didn’t play' : fx.length ? fx.map((f) => fxShort(f, el.team, teams)).join(', ') : 'No match'}
        </span>
      </button>
    );
  };
  return (
    <>
      <div className="sp-fplpitch sp-pitch">
        <svg className="sp-fplpitch-lines" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden>
          <g fill="none" stroke="var(--sp-pitch-line)" strokeWidth="0.5" vectorEffect="non-scaling-stroke">
            <rect x="3" y="2" width="94" height="136" rx="1" />
            <rect x="22" y="2" width="56" height="20" />
            <rect x="36" y="2" width="28" height="7" />
            <path d="M3 108h94" />
            <path d="M38 108a12 12 0 0 1 24 0" />
          </g>
        </svg>
        {rows.map((r, i) => (
          <div key={i} className="sp-fplrow">{r.map((l) => kit(l, false))}</div>
        ))}
        <div className="sp-benchrow">
          <p className="sp-benchrow-label" style={{ margin: '0 0 4px' }}>Bench</p>
          <div className="sp-fplrow" style={{ padding: 0 }}>{bench.map((l) => kit(l, true))}</div>
        </div>
      </div>
      <div className="sp-legend sp-pad" aria-hidden>
        <span><i className="sp-kit-pts sp-lg-done">6</i>Played</span>
        <span><i className="sp-kit-pts sp-lg-live">2</i>Playing now</span>
        <span><i className="sp-kit-pts sp-lg-todo">Sun 16:30</i>To play</span>
      </div>
      {cur ? <PlayerCard l={cur} ctx={ctx} teams={teams} kit={forecast} fixtures={fixtures} /> : (
        <p className="sp-note sp-pad" style={{ margin: '8px 0 0' }}>
          Tap a player for his points. Arrows mark projected autosubs.
        </p>
      )}
    </>
  );
}

function PlayerCard({ l, ctx, teams, kit, fixtures }) {
  const el = ctx.elements[l.element];
  const parts = breakdown(l.state);
  const fx = fixturesOf(el.team, ctx);
  // The matchup to read about: his match in progress or next up.
  const nextFx = (fixtures ?? ctx.fixtures).filter((f) => (f.home === el.team || f.away === el.team) && !f.finished && !f.finishedProvisional).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0] ?? null;
  return (
    <section className="sp-panel" style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '72px 1fr', gap: 14 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo(el.opta, true)} alt="" width="72" height="92" style={{ objectFit: 'cover', borderRadius: 14, background: 'var(--sp-sunk)' }} loading="lazy" />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
          <div>
            <h3 className="sp-h2">{el.first} {el.second}</h3>
            <p className="sp-tiny sp-muted" style={{ margin: '2px 0 0', fontWeight: 600 }}>
              {teams[el.team]?.name} · {POS[el.type]} · £{el.cost.toFixed(1)}m · {el.owned}% owned
            </p>
          </div>
          <span className="sp-pick-pts" style={{ fontSize: 30 }}>{l.counts ? l.total : l.state.points}</span>
        </div>
        <p className="sp-tiny sp-ink2" style={{ margin: '8px 0 6px', fontWeight: 600 }}>{fx.map((f) => fxLong(f, el.team, teams)).join(' · ') || 'No match this gameweek'}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
          {parts.length ? parts.map((p) => (
            <span key={p.k} className="sp-small" style={{ fontWeight: 700 }}>{p.label} <span className={p.v > 0 ? 'sp-up' : 'sp-down'}>{signed(p.v)}</span></span>
          )) : <span className="sp-small sp-muted">No points yet</span>}
          {l.mult > 1 && <span className="sp-small" style={{ fontWeight: 800 }}>×{l.mult} {l.mult === 3 ? 'triple captain' : 'captain'}</span>}
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
        <MatchupPanel el={el} ctx={ctx} teams={teams} kit={kit} fixtures={fixtures} nextFx={nextFx} />
      </div>
    </section>
  );
}

function TeamList({ team, ctx, teams }) {
  const xi = team.lines.filter((l) => l.position <= 11);
  const bench = team.lines.filter((l) => l.position > 11);
  const subIn = Object.fromEntries(team.subs.map((s) => [s.in, s.out]));
  const subOut = Object.fromEntries(team.subs.map((s) => [s.out, s.in]));
  const row = (l) => {
    const el = ctx.elements[l.element];
    const fx = fixturesOf(el.team, ctx);
    const parts = breakdown(l.state).map((p) => `${p.label} ${signed(p.v)}`);
    const note = subOut[l.element]
      ? `Didn’t play, ${ctx.elements[subOut[l.element]].name} comes on (projected)`
      : subIn[l.element]
        ? `On for ${ctx.elements[subIn[l.element]].name} (projected)`
        : l.state.status === 'did not play' ? 'Didn’t play' : l.state.status === 'blank' ? 'No match' : '';
    const pts = l.counts ? l.total : l.state.points;
    const ph = phase(l.state, fx);
    return (
      <div key={l.element} className={`sp-pick sp-pick-${ph.kind}${l.counts ? '' : ' sp-off'}`}>
        <span className="sp-pick-pos">{POS[el.type]}</span>
        <span className="sp-pick-name">
          <b>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{el.name}</span>
            {l.captain && <span className="sp-badge" title="Captain">{l.mult === 3 ? 'TC' : 'C'}</span>}
            {l.vice && <span className={`sp-badge${team.viceUsed ? '' : ' sp-badge-quiet'}`} title="Vice-captain">V</span>}
          </b>
          <small>{fx.map((f) => fxLong(f, el.team, teams)).join(' · ') || teams[el.team]?.short}</small>
          {(note || parts.length > 0) && <small>{[note, ...parts].filter(Boolean).join(' · ')}</small>}
        </span>
        <span className="sp-pick-when">{ph.kind === 'done' || ph.kind === 'out' ? 'Played' : ph.kind === 'blank' ? '' : ph.when}</span>
        <span className="sp-pick-pts">{(ph.kind === 'todo' || ph.kind === 'bench') && l.state.minutes === 0 && pts === 0 ? '–' : pts}</span>
      </div>
    );
  };
  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
      <section className="sp-panel" style={{ paddingTop: 4, paddingBottom: 4 }}>{xi.map(row)}</section>
      <section className="sp-panel" style={{ paddingTop: 12, paddingBottom: 4 }}>
        <h2 className="sp-h3" style={{ marginBottom: 2 }}>Bench</h2>
        {bench.map(row)}
      </section>
      <p className="sp-note sp-pad" style={{ margin: 0 }}>
        Autosubs and the vice-captain are projected as if every match ended now. FPL makes them for real once the gameweek’s matches are over.
      </p>
    </div>
  );
}

function League({ id, event, entry, ctx, myTeam, teams, live, onPick }) {
  const { prefs, update } = usePrefs();
  const [comparing, setComparing] = useState(false);
  const lg = useLive((signal) => api(`league?id=${id}&event=${event}`, signal), [id, event], { every: 90000, live: () => true });
  const result = useMemo(() => (lg.data ? leagueLive(lg.data.rows, ctx) : null), [lg.data, ctx]);
  useEffect(() => setComparing(false), [id]);
  if (!lg.data) return lg.error ? <p className="sp-empty">Couldn’t load this league ({lg.error}).</p> : <div className="sp-skel" style={{ height: 400, margin: 16 }} />;
  const me = result.table.find((r) => r.entry === entry.id);
  // Outside the first 50 of a big league you aren't in the table we load; your own team stands in.
  const meRow = me ?? (myTeam && { entry: entry.id, team: entry.name, manager: entry.manager, live: myTeam, total: null, eventTotal: null });
  const rivalId = prefs.fplRival?.[id];
  const rival = result.table.find((r) => r.entry === rivalId && r.entry !== entry.id && r.live);
  const compare = (r) => {
    update((p) => ({ fplRival: { ...p.fplRival, [id]: r.entry } }));
    setComparing(true);
    window.scrollTo?.({ top: 0 });
  };
  if (comparing && rival && meRow?.live) return <Rival me={meRow} them={rival} ctx={ctx} teams={teams} live={live} onBack={() => setComparing(false)} />;
  const myMult = Object.fromEntries((me?.live?.lines ?? myTeam?.lines ?? []).map((l) => [l.element, l.mult]));
  // Who moves you: big gaps between your multiplier and the league's average one.
  const swings = result.ownership
    .map((o) => ({ ...o, mine: myMult[o.element] ?? 0, gap: (myMult[o.element] ?? 0) - o.eo / 100 }))
    .concat(Object.keys(myMult).filter((e) => !result.ownership.some((o) => o.element === Number(e))).map((e) => ({ element: Number(e), eo: 0, owners: 0, captains: 0, mine: myMult[e], gap: myMult[e] })))
    .filter((o) => Math.abs(o.gap) >= 0.25)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 10);
  const maxGap = Math.max(1, ...swings.map((o) => Math.abs(o.gap)));
  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
      {entry.leagues.length > 1 && (
        <div className="sp-pad">
          <label className="sp-sr" htmlFor="lgpick">League</label>
          <select id="lgpick" className="sp-select" style={{ width: '100%' }} value={id} onChange={(e) => onPick(Number(e.target.value))}>
            {entry.leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}
      {rival && meRow?.live && (
        <button className="sp-h2h-link" onClick={() => compare(rival)}>
          <span>
            <span className="sp-tiny sp-muted" style={{ display: 'block', fontWeight: 700 }}>Head to head</span>
            <b>You {meRow.live.net}–{rival.live.net} {firstName(rival.manager)}</b>
          </span>
          <span className="sp-small" style={{ fontWeight: 700 }}>Compare →</span>
        </button>
      )}
      <section className="sp-group" style={{ marginTop: 0 }}>
        <header className="sp-ghead">
          <h2 className="sp-h3">{lg.data.name}</h2>
          <Freshness at={lg.at} error={lg.error} />
        </header>
        {result.table.map((r) => {
          const moved = r.rank - r.liveRank;
          const cap = r.live && ctx.elements[r.live.captain];
          const mineRow = r.entry === entry.id;
          const Row = mineRow || !r.live || !meRow?.live ? 'div' : 'button';
          return (
            <Row key={r.entry} className={`sp-lrow${mineRow ? ' sp-mine' : ''}`} {...(Row === 'button' ? { onClick: () => compare(r), 'aria-label': `Compare with ${r.team}, ${r.manager}` } : {})}>
              <span className="sp-lrank">
                <b>{r.liveRank}</b>
                {moved !== 0 && <span className={moved > 0 ? 'sp-up' : 'sp-down'}>{moved > 0 ? `▲${moved}` : `▼${-moved}`}</span>}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14.5 }}>{r.team}</b>
                  {r.chip && <span className="sp-tiny" style={{ fontWeight: 800, flex: 'none' }}>{CHIP[r.chip] ?? r.chip}</span>}
                </span>
                <span className="sp-tiny sp-muted" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.manager}</span>
                  {cap && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flex: 'none' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={shirt(teams[cap.team]?.code, cap.type === 1)} alt="" width="16" height="16" />
                      <b style={{ color: 'var(--sp-ink-2)' }}>{cap.name}</b>
                    </span>
                  )}
                  {r.hit ? <span className="sp-down" style={{ flex: 'none' }}>−{r.hit}</span> : null}
                </span>
              </span>
              <span className="sp-lpts">
                <b>{r.liveTotal}</b>
                <span>GW {r.gw}{r.live ? ` · ${r.live.toPlay} left` : ''}</span>
              </span>
            </Row>
          );
        })}
        <p className="sp-tiny sp-muted" style={{ margin: 0, padding: '10px 16px 12px' }}>
          Tap a manager to compare your teams head to head. Live from each manager’s picks and FPL’s live points; arrows compare with FPL’s last official table.
          {lg.data.more ? ' Only the top 50 managers are included.' : ''}
        </p>
      </section>

      {swings.length > 0 && (
        <section className="sp-panel">
          <h2 className="sp-h2">Who moves you in this league</h2>
          <p className="sp-small sp-ink2" style={{ margin: '4px 0 12px' }}>
            Green: every point they score lifts you against your rivals. Red: it lifts your rivals more than you. Bar length is how much, from your multiplier minus the league’s average one.
          </p>
          {swings.map((o) => {
            const el = ctx.elements[o.element];
            const pts = ctx.live[o.element]?.points ?? 0;
            const w = (Math.abs(o.gap) / maxGap) * 50;
            const up = o.gap > 0;
            return (
              <div key={o.element} className="sp-div">
                <Face el={el} teams={teams} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <b style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{el.name}</b>
                    <b className={`sp-num ${up ? 'sp-up' : 'sp-down'}`} style={{ fontSize: 14 }}>{up ? '+' : '−'}{Math.abs(o.gap).toFixed(2)}</b>
                  </span>
                  <span className="sp-tiny sp-muted sp-num" style={{ display: 'block' }}>EO {Math.round(o.eo)}% · {o.captains} captained · you ×{o.mine} · {pts} pts</span>
                  <span className="sp-div-track" role="img" aria-label={`${up ? 'Helps' : 'Costs'} you ${Math.abs(o.gap).toFixed(2)} per point`}>
                    <i className="sp-div-bar" style={{ left: up ? '50%' : `${50 - w}%`, width: `${w}%`, background: up ? 'var(--sp-win)' : 'var(--sp-loss)' }} />
                  </span>
                </span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function FantasySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading fantasy">
      <div className="sp-skel" style={{ height: 220, margin: '12px 16px 0' }} />
      <div className="sp-skel" style={{ height: 460, margin: '14px 0 0' }} />
    </div>
  );
}

function Setup({ onSave }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    const id = Number(v.trim().match(/(\d{1,10})/)?.[1]);
    if (!id) return setErr('That doesn’t look like a team ID. It’s the number in your FPL points page address.');
    setBusy(true);
    setErr(null);
    try {
      const st = await api('static');
      await api(`entry?id=${id}&event=${st.current}`);
      onSave(id);
    } catch (e2) {
      setErr(`FPL didn’t find team ${id} (${e2.message}).`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sp-read">
      <section className="sp-pad" style={{ paddingTop: 16 }}>
        <h1 className="sp-h1">Your team, live</h1>
        <p className="sp-ink2" style={{ margin: '8px 0 0', maxWidth: '46ch' }}>
          Fantasy Premier League points as they happen, bonus as it stands, projected autosubs, and which players move you against your mini-league.
        </p>
      </section>
      <form onSubmit={save} className="sp-panel" style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <label htmlFor="fplid" style={{ fontWeight: 700 }}>Your FPL team ID</label>
        <input id="fplid" className="sp-input" inputMode="numeric" autoComplete="off" placeholder="e.g. 1234567" value={v} onChange={(e) => setV(e.target.value)} />
        <p className="sp-tiny sp-muted" style={{ margin: 0 }}>
          On fantasy.premierleague.com, open Points. The address reads /entry/<b>1234567</b>/event/6; the number after “entry” is your ID. You can paste the whole address.
        </p>
        {err && <p className="sp-small" style={{ margin: 0, color: 'var(--sp-loss)' }}>{err}</p>}
        <button className="sp-btn sp-btn-primary" style={{ height: 46 }} disabled={busy}>{busy ? 'Checking…' : 'Show my team'}</button>
      </form>
      <p className="sp-tiny sp-muted sp-pad" style={{ marginTop: 12 }}>The ID stays in this browser. FPL team pages are public, so no password is needed or asked for.</p>
    </div>
  );
}
