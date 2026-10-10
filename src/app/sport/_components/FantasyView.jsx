'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { projectedBonus, teamLive, leagueLive, pointChanges, POS, STAT_LABEL } from '@/lib/sport/fpl.mjs';
import { usePrefs } from './prefs';
import { useLive, Freshness } from './useLive';
import { kickoff, shortDate, until } from './time';

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
  const entry = useLive((signal) => (gw && entryId ? api(`entry?id=${entryId}&event=${gw}`, signal) : Promise.resolve(null)), [gw, entryId], {
    every: 60000,
    live: () => liveGw(live.data),
  });

  if (!ready) return null;
  if (!entryId) return <Setup onSave={(id) => update({ fplEntry: id })} />;
  if (prefs.spoilers === 'all' && !revealed) {
    return (
      <div className="sp-empty">
        <p style={{ margin: '0 0 10px' }}>Fantasy points give results away, so spoiler mode hides them.</p>
        <button className="sp-btn" onClick={() => setRevealed(true)}>Show my points</button>
      </div>
    );
  }
  if (st.error && !st.data) return <p className="sp-empty">FPL isn’t answering ({st.error}). It’s often briefly down around deadlines; this page will retry.</p>;
  if (!st.data || !live.data || (!entry.data && !entry.error)) return <div className="sp-skel" style={{ height: 520, margin: 16 }} />;
  if (entry.error && !entry.data)
    return (
      <div className="sp-empty">
        <p style={{ margin: '0 0 10px' }}>Couldn’t load team {entryId} ({entry.error}).</p>
        <button className="sp-btn" onClick={() => update({ fplEntry: null })}>Use a different team ID</button>
      </div>
    );
  return <Live st={st.data} live={live.data} entry={entry.data} liveAt={live.at} liveErr={live.error} />;
}

function Live({ st, live, entry, liveAt, liveErr }) {
  const { prefs, update } = usePrefs();
  const ctx = useMemo(
    () => ({ elements: Object.fromEntries(st.elements.map((e) => [e.id, e])), live: live.elements, fixtures: live.fixtures, bonus: projectedBonus(live.fixtures) }),
    [st, live]
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

  return (
    <div>
      <header className="sp-pad" style={{ paddingTop: 16 }}>
        <div className="sp-section-head" style={{ marginBottom: 2 }}>
          <h1 className="sp-h1">Gameweek {live.event}</h1>
          <button className="sp-tiny sp-link sp-ink2" onClick={() => update({ fplEntry: null, fplLeague: null })}>Change team</button>
        </div>
        <p className="sp-small sp-ink2" style={{ margin: 0 }}>{entry.name} · {entry.manager}</p>
        <p className="sp-tiny sp-muted" style={{ margin: '4px 0 0' }}>
          <Freshness at={liveAt} error={liveErr} live={liveGw(live)} every={30} />
        </p>
      </header>

      {team ? (
        <section className="sp-panel" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
            <span className="sp-hero-num">{team.net}</span>
            <span className="sp-small sp-ink2" style={{ paddingBottom: 6 }}>
              points{allDone && gw?.checked ? '' : ', provisional'}
              {team.hit ? ` after a ${team.hit}-point hit` : ''}
            </span>
          </div>
          <div className="sp-facts" style={{ marginTop: 14 }}>
            <Fact v={team.toPlay} l={team.toPlay === 1 ? 'player still to play' : 'players still to play'} />
            {gw?.average ? <Fact v={gw.average} l="FPL average" /> : null}
            {picks.overall ? <Fact v={picks.overall.toLocaleString()} l="overall rank" /> : null}
            {picks.chip ? <Fact v={CHIP[picks.chip] ?? picks.chip} l="chip played" /> : null}
            <Fact v={team.lines.filter((l) => !l.counts).reduce((t, l) => t + l.state.points, 0)} l="on the bench" />
          </div>
          {next && new Date(next.deadline) > Date.now() && (
            <p className="sp-small sp-ink2" style={{ margin: '14px 0 0' }}>
              Gameweek {next.id} deadline: {shortDate(next.deadline)}, {kickoff(next.deadline)} ({until(next.deadline)}).
            </p>
          )}
        </section>
      ) : (
        <p className="sp-empty">This team has no picks for gameweek {live.event}.</p>
      )}

      {feed.length > 0 && (
        <section className="sp-panel" style={{ marginTop: 14 }}>
          <h2 className="sp-h2" style={{ marginBottom: 4 }}>Since you opened this page</h2>
          <ul className="sp-feed">
            {feed.slice(0, 12).map((f) => (
              <li key={f.key}>
                <span className="sp-num sp-muted">{new Date(f.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                <span>
                  <b>{ctx.elements[f.element]?.name}</b>{' '}
                  <span className={`sp-num ${f.delta > 0 ? 'sp-up' : 'sp-down'}`}>{signed(f.delta)}</span>
                  <span className="sp-muted"> {f.why.map((w) => `${STAT_LABEL[w.stat] ?? w.stat} ${signed(w.delta)}`).join(', ')}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="sp-pad" style={{ marginTop: 14 }}>
        <div className="sp-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'team'} onClick={() => setTab('team')}>My team</button>
          {leagueId && <button role="tab" aria-selected={tab === 'league'} onClick={() => setTab('league')}>Mini-league</button>}
          <button role="tab" aria-selected={tab === 'fixtures'} onClick={() => setTab('fixtures')}>Fixtures</button>
        </div>
      </div>

      {tab === 'team' && team && <Team team={team} ctx={ctx} teams={teams} />}
      {tab === 'league' && leagueId && <League id={leagueId} event={live.event} entry={entry} ctx={ctx} myTeam={team} onPick={(id) => update({ fplLeague: id })} />}
      {tab === 'fixtures' && <Fixtures live={live} teams={teams} />}
    </div>
  );
}

function Fact({ v, l }) {
  return (
    <span className="sp-fact">
      <b>{v}</b>
      <span>{l}</span>
    </span>
  );
}

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

function fixtureFor(teamId, ctx) {
  return ctx.fixtures.filter((f) => f.home === teamId || f.away === teamId);
}

function fxLabel(f, teamId, teams) {
  const home = f.home === teamId;
  const opp = teams[home ? f.away : f.home]?.short ?? '';
  const vs = `${opp} (${home ? 'H' : 'A'})`;
  // The player's own side first, so "AVL (A) 0–1" means his team is winning.
  const score = home ? `${f.hs}–${f.as}` : `${f.as}–${f.hs}`;
  if (f.finished || f.finishedProvisional) return `${vs} ${score} FT`;
  if (f.started) return `${vs} ${score}, ${f.minutes}′`;
  return `${vs} ${shortDate(f.kickoff)} ${kickoff(f.kickoff)}`;
}

const STATUS_TEXT = { 'did not play': 'Didn’t play', blank: 'No match', 'not on yet': 'Not on yet', 'to play': '', playing: '', played: '' };

const signed = (v) => (v > 0 ? `+${v}` : `−${Math.abs(v)}`);

/** "Goal +6 · Bonus +2 (provisional)": where the points came from, minutes left out. */
function breakdown(state) {
  const sum = {};
  for (const f of state.explain ?? []) for (const s of f.stats) if (!['minutes', 'bonus'].includes(s.identifier) && s.points) sum[s.identifier] = (sum[s.identifier] ?? 0) + s.points;
  const out = Object.entries(sum).map(([k, v]) => `${STAT_LABEL[k] ?? k} ${signed(v)}`);
  if (state.bonus) out.push(`Bonus ${signed(state.bonus)}${state.bonusProvisional ? ' (provisional)' : ''}`);
  return out;
}

function Team({ team, ctx, teams }) {
  const xi = team.lines.filter((l) => l.position <= 11);
  const bench = team.lines.filter((l) => l.position > 11);
  const subIn = Object.fromEntries(team.subs.map((s) => [s.in, s.out]));
  const subOut = Object.fromEntries(team.subs.map((s) => [s.out, s.in]));
  const row = (l) => {
    const el = ctx.elements[l.element];
    const fx = fixtureFor(el.team, ctx);
    const parts = breakdown(l.state);
    const note = subOut[l.element]
      ? `Didn’t play, ${ctx.elements[subOut[l.element]].name} comes on (projected)`
      : subIn[l.element]
        ? `On for ${ctx.elements[subIn[l.element]].name} (projected)`
        : STATUS_TEXT[l.state.status];
    return (
      <div key={l.element} className={`sp-pick${l.counts ? '' : ' sp-off'}`}>
        <span className="sp-pick-pos">{POS[el.type]}</span>
        <span className="sp-pick-name">
          <b>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{el.name}</span>
            {l.captain && <span className="sp-badge" title="Captain">{team.captain === l.element ? (l.mult === 3 ? 'TC' : 'C') : 'C'}</span>}
            {l.vice && <span className={`sp-badge${team.viceUsed ? '' : ' sp-badge-quiet'}`} title="Vice-captain">V</span>}
          </b>
          <small>
            {[teams[el.team]?.short, ...fx.map((f) => fxLabel(f, el.team, teams))].join(' · ')}
          </small>
          {(note || parts.length > 0) && <small>{[note, ...parts].filter(Boolean).join(' · ')}</small>}
        </span>
        <span className="sp-tiny sp-muted sp-num">{l.mult > 1 ? `×${l.mult}` : ''}</span>
        <span className="sp-pick-pts">{l.counts ? l.total : l.state.points}</span>
      </div>
    );
  };
  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
      <section className="sp-panel" style={{ paddingTop: 4, paddingBottom: 4 }}>{xi.map(row)}</section>
      <section className="sp-panel" style={{ paddingTop: 10, paddingBottom: 4 }}>
        <h2 className="sp-h3" style={{ marginBottom: 2 }}>Bench</h2>
        {bench.map(row)}
      </section>
      <p className="sp-note sp-pad" style={{ margin: 0 }}>
        Autosubs and the vice-captain are projected as if every match ended now. FPL makes them for real once the gameweek’s matches are over.
      </p>
    </div>
  );
}

function League({ id, event, entry, ctx, myTeam, onPick }) {
  const lg = useLive((signal) => api(`league?id=${id}&event=${event}`, signal), [id, event], { every: 90000, live: () => true });
  const result = useMemo(() => (lg.data ? leagueLive(lg.data.rows, ctx) : null), [lg.data, ctx]);
  if (!lg.data) return lg.error ? <p className="sp-empty">Couldn’t load this league ({lg.error}).</p> : <div className="sp-skel" style={{ height: 400, margin: 16 }} />;
  const me = result.table.find((r) => r.entry === entry.id);
  const myMult = Object.fromEntries((me?.live?.lines ?? myTeam?.lines ?? []).map((l) => [l.element, l.mult]));
  // Who moves your position: big gaps between your multiplier and the league's average one.
  const swings = result.ownership
    .map((o) => ({ ...o, mine: myMult[o.element] ?? 0, gap: (myMult[o.element] ?? 0) - o.eo / 100 }))
    .concat(Object.keys(myMult).filter((e) => !result.ownership.some((o) => o.element === Number(e))).map((e) => ({ element: Number(e), eo: 0, owners: 0, captains: 0, mine: myMult[e], gap: myMult[e] })))
    .filter((o) => Math.abs(o.gap) >= 0.25)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 10);
  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
      {entry.leagues.length > 1 && (
        <div className="sp-pad">
          <label className="sp-sr" htmlFor="lgpick">League</label>
          <select id="lgpick" className="sp-select" value={id} onChange={(e) => onPick(Number(e.target.value))}>
            {entry.leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}
      <section className="sp-group" style={{ marginTop: 0 }}>
        <header className="sp-ghead"><h2 className="sp-h3">{lg.data.name}</h2><Freshness at={lg.at} error={lg.error} /></header>
        <table className="sp-table">
          <thead>
            <tr>
              <th className="l" style={{ paddingLeft: 16 }}>#</th>
              <th className="l">Team</th>
              <th>GW</th>
              <th className="sp-hide-sm">Left</th>
              <th style={{ paddingRight: 16 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {result.table.map((r) => {
              const moved = r.rank - r.liveRank;
              const cap = r.live && ctx.elements[r.live.captain]?.name;
              return (
                <tr key={r.entry} className={r.entry === entry.id ? 'sp-mine' : ''}>
                  <td className="l sp-pos" style={{ paddingLeft: 16 }}>
                    {r.liveRank}
                    {moved !== 0 && <span className={`sp-tiny ${moved > 0 ? 'sp-up' : 'sp-down'}`} style={{ marginLeft: 3 }}>{moved > 0 ? `↑${moved}` : `↓${-moved}`}</span>}
                  </td>
                  <td className="l" style={{ maxWidth: 0, width: '100%', paddingTop: 6, paddingBottom: 6, lineHeight: 1.25 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 550 }}>{r.team}</span>
                    <span className="sp-tiny sp-muted" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.manager}{cap ? ` · C ${cap}` : ''}{r.chip ? ` · ${CHIP[r.chip] ?? r.chip}` : ''}{r.hit ? ` · −${r.hit}` : ''}
                    </span>
                  </td>
                  <td style={{ fontWeight: 650 }}>{r.gw}</td>
                  <td className="sp-hide-sm sp-ink2">{r.live?.toPlay ?? '–'}</td>
                  <td className="sp-pts" style={{ paddingRight: 16 }}>{r.liveTotal}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="sp-tiny sp-muted" style={{ margin: 0, padding: '10px 16px' }}>
          Live table from each manager’s picks and FPL’s live points; arrows compare with FPL’s last official table.
          {lg.data.more ? ' Only the top 50 managers are included.' : ''}
        </p>
      </section>

      {swings.length > 0 && (
        <section className="sp-panel">
          <h2 className="sp-h2">Who moves you in this league</h2>
          <p className="sp-small sp-ink2" style={{ margin: '4px 0 8px' }}>
            Each point these players score moves you against the league by the gap between your multiplier and the league’s average one (its effective ownership).
          </p>
          {swings.map((o) => {
            const el = ctx.elements[o.element];
            const pts = ctx.live[o.element]?.points ?? 0;
            return (
              <div key={o.element} className="sp-pick" style={{ gridTemplateColumns: '40px minmax(0,1fr) auto 64px' }}>
                <span className="sp-pick-pos">{POS[el.type]}</span>
                <span className="sp-pick-name">
                  <b>{el.name}</b>
                  <small className="sp-num">EO {Math.round(o.eo)}% · {o.captains} captained · {pts} pts</small>
                </span>
                <span className="sp-tiny sp-muted sp-num">you ×{o.mine}</span>
                <span className={`sp-pick-pts ${o.gap > 0 ? 'sp-up' : 'sp-down'}`} style={{ fontSize: 15 }}>
                  {o.gap > 0 ? '+' : '−'}{Math.abs(o.gap).toFixed(2)}
                </span>
              </div>
            );
          })}
          <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>The right-hand figure is what one point from that player is worth to you, relative to the league.</p>
        </section>
      )}
    </div>
  );
}

function Fixtures({ live, teams }) {
  const list = [...live.fixtures].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  return (
    <section className="sp-group">
      {list.map((f) => (
        <div key={f.id} className="sp-row" style={{ gridTemplateColumns: '64px 1fr auto' }}>
          <span className={`sp-row-status${f.started && !f.finished && !f.finishedProvisional ? ' sp-is-live' : ''}`}>
            {f.finished || f.finishedProvisional ? 'FT' : f.started ? `${f.minutes}′` : kickoff(f.kickoff)}
            {!f.started && <span className="sp-muted" style={{ display: 'block' }}>{shortDate(f.kickoff)}</span>}
          </span>
          <span className="sp-row-teams">
            <span className="sp-team-line">{teams[f.home]?.name}</span>
            <span className="sp-team-line">{teams[f.away]?.name}</span>
          </span>
          <span className="sp-row-score">
            <span>{f.started ? f.hs : ''}</span>
            <span>{f.started ? f.as : ''}</span>
          </span>
        </div>
      ))}
    </section>
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
    <div className="sp-pad" style={{ paddingTop: 16, maxWidth: 560 }}>
      <h1 className="sp-h1">Fantasy</h1>
      <p className="sp-ink2" style={{ margin: '6px 0 16px' }}>
        Live Fantasy Premier League points for your team and mini-league: autosubs, bonus as it stands, and which players move you against your rivals.
      </p>
      <form onSubmit={save} className="sp-panel" style={{ display: 'grid', gap: 10 }}>
        <label htmlFor="fplid" style={{ fontWeight: 600 }}>Your FPL team ID</label>
        <input id="fplid" className="sp-input" inputMode="numeric" autoComplete="off" placeholder="e.g. 1234567" value={v} onChange={(e) => setV(e.target.value)} />
        <p className="sp-tiny sp-muted" style={{ margin: 0 }}>
          On fantasy.premierleague.com, open Points. The address reads /entry/<b>1234567</b>/event/6; the number after “entry” is your ID. You can paste the whole address.
        </p>
        {err && <p className="sp-small" style={{ margin: 0, color: 'var(--sp-loss)' }}>{err}</p>}
        <button className="sp-btn sp-btn-primary" style={{ height: 40 }} disabled={busy}>{busy ? 'Checking…' : 'Show my team'}</button>
      </form>
      <p className="sp-tiny sp-muted" style={{ marginTop: 12 }}>The ID stays in this browser. FPL team pages are public, so no password is needed or asked for.</p>
    </div>
  );
}
