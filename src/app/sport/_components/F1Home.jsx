'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { nextRace, sessionEnd } from '@/lib/sport/othersports.mjs';
import { SESSION_KEY, titleRace } from '@/lib/sport/f1.mjs';
import { kickoff, shortDate, until, zoneLabel } from './time';
import { useJson, useF1Index, teamColor, teamName, Driver, Mark, shortRace } from './f1bits';

const DAY = 864e5;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const weekendHref = (season, round) => `/sport/f1/race?season=${season}&round=${round}`;

/** The viewer's time zone, named after the page loads (the server doesn't know it). */
function useZone() {
  const [zone, setZone] = useState('');
  useEffect(() => setZone(zoneLabel()), []);
  return zone;
}

/** Re-renders every so often, so "on now" moves on while the page is open. */
function useNow(every) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

/**
 * The F1 section: the next race weekend in the viewer's time zone, the last race's top ten, both
 * championships with the title maths done, and the season's calendar with each winner.
 */
export default function F1Home() {
  const cal = useJson('/api/sport/f1/season');
  const st = useJson('/api/sport/f1/standings');
  const season = cal.data?.season ?? st.data?.season ?? null;
  const ix = useF1Index(season);
  const color = (team) => teamColor(ix.data, team);
  const named = (team) => teamName(ix.data, team);
  const lastRound = st.data ? Math.max(0, ...Object.keys(st.data.winners).map(Number)) : 0;
  const last = useJson(season && lastRound ? `/api/sport/f1/round/${season}/${lastRound}` : null);
  const now = useNow(30000);
  const zone = useZone();
  const total = cal.data?.races.length ?? 0;
  return (
    <div className="sp-read">
      <div className="sp-pad" style={{ paddingTop: 14 }}>
        <div className="sp-section-head" style={{ marginBottom: 0 }}>
          <h1 className="sp-h1">Formula 1</h1>
          {season && total > 0 && st.data && <span className="sp-small sp-muted">{season}, {lastRound} of {total} rounds run</span>}
        </div>
      </div>
      <NextWeekend cal={cal} now={now} />
      {last.data?.race && <LastRace season={season} round={lastRound} data={last.data} date={cal.data?.races.find((r) => r.round === lastRound)} color={color} named={named} />}
      <Championship st={st} cal={cal.data} color={color} named={named} />
      {cal.data && st.data && <Calendar cal={cal.data} st={st.data} color={color} now={now} />}
      <p className="sp-note sp-pad" style={{ margin: '18px 0 0' }}>
        Results and standings from Jolpica, which carries on the Ergast database. Laps, tyres and pace from F1’s timing data through FastF1, an hour or two after each
        session. Unofficial: Matchday has no link with Formula 1.{zone ? ` Times in ${zone}.` : ''}
      </p>
    </div>
  );
}

function NextWeekend({ cal, now }) {
  const { data, error } = cal;
  const race = data ? nextRace(data.races, now) : null;
  const raceAt = race?.sessions[race.sessions.length - 1].at;
  const soon = race && (race.live || Date.parse(race.sessions[0].at) - now < 4 * DAY);
  // "Marina Bay Street Circuit, Singapore", not "…, Marina Bay, Singapore".
  const where = race ? [race.circuit, race.place, race.country].filter((x, i, a) => x && !a.slice(0, i).some((y) => y?.includes(x))).join(', ') : '';
  return (
    <section className="sp-pad sp-section">
      {/* The heading waits for the calendar: it's "This weekend" or "Next race" depending on the date. */}
      {!data && !error ? <div className="sp-skel" style={{ height: 330, borderRadius: 6 }} /> : <h2 className="sp-h2">{soon ? 'This weekend' : 'Next race'}</h2>}
      {!data && error && <p className="sp-note">Couldn’t load the F1 calendar just now. Try again in a minute.</p>}
      {data && !race && <p className="sp-note">The {data.season} season is over. Next year’s calendar shows here once it’s published.</p>}
      {race && (
        <>
          <div className="sp-event-top" style={{ marginTop: 8 }}>
            <b className="sp-f1-name">{race.name}</b>
            <span className="sp-tiny sp-muted">
              Round {race.round} of {data.races.length}
            </span>
          </div>
          <p className="sp-small sp-muted" style={{ margin: '2px 0 0' }}>{where}</p>
          {race.live ? (
            <Link className="sp-f1-live-link" href={`${weekendHref(data.season, race.round)}&s=${SESSION_KEY[race.live.label]}`}>
              <span className="sp-f1-live">
                <i className="sp-dot" aria-hidden="true" /> Live
              </span>
              <b>{race.live.label}: follow the timing</b>
              <span aria-hidden="true">→</span>
            </Link>
          ) : (
            Date.parse(raceAt) > now && (
              <p className="sp-small sp-ink2" style={{ margin: '6px 0 0' }}>
                Race {until(raceAt, now)}
              </p>
            )
          )}
          <ol className="sp-sessions" aria-label="Sessions">
            {race.sessions.map((s) => {
              const state = race.live?.at === s.at ? 'live' : sessionEnd(s) <= now ? 'done' : 'todo';
              return (
                <li key={`${s.label}${s.at}`} className={`sp-session sp-session-${state}`}>
                  <span>{shortDate(s.at)}</span>
                  <span className="sp-num">{kickoff(s.at)}</span>
                  <span>
                    {s.label === 'Race' ? <b>{s.label}</b> : s.label}
                    {state === 'live' && <span className="sp-live-text"> on now</span>}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="sp-small" style={{ margin: '10px 0 0' }}>
            <Link className="sp-link" href={weekendHref(data.season, race.round)}>
              The weekend: sessions, results and analysis →
            </Link>
          </p>
          {race.after && (
            <p className="sp-small sp-ink2" style={{ margin: '8px 0 0' }}>
              After this: {race.after.name}, race {shortDate(race.after.at)} at {kickoff(race.after.at)}.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function LastRace({ season, round, data, date, color, named }) {
  const raceAt = date?.sessions[date.sessions.length - 1]?.at;
  return (
    <section className="sp-section">
      <div className="sp-pad sp-section-head">
        <h2 className="sp-h2">{data.name}</h2>
        <span className="sp-tiny sp-muted">
          Round {round}
          {raceAt ? `, ${shortDate(raceAt)}` : ''}
        </span>
      </div>
      <table className="sp-table sp-f1-table">
        <thead>
          <tr>
            <th className="l" style={{ paddingLeft: 16 }}>#</th>
            <th className="l">Driver</th>
            <th>Time</th>
            <th style={{ paddingRight: 16 }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {data.race.slice(0, 10).map((r) => (
            <tr key={r.driver.id}>
              <td className="l sp-pos" style={{ paddingLeft: 16 }}>{r.pos}</td>
              <td className="l">
                <Driver d={r.driver} color={color(r.team?.id)} team={named(r.team)} />
              </td>
              <td className="sp-num">{r.time ?? r.status}</td>
              <td className="sp-pts" style={{ paddingRight: 16 }}>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sp-small sp-pad" style={{ margin: '10px 0 0' }}>
        <Link className="sp-link" href={weekendHref(season, round)}>
          All 22, with laps, tyres and pace →
        </Link>
      </p>
    </section>
  );
}

/** Where a title stands, in words: who leads by how much, what's left to win, who can still take it. */
function TitleWords({ all, kind, named }) {
  const t = all?.[kind];
  if (!t?.leader) return null;
  const name = (x) => (kind === 'drivers' ? x.driver.last : named(x.team));
  const left = [all.racesLeft && plural(all.racesLeft, 'race'), all.sprintsLeft && plural(all.sprintsLeft, 'sprint')].filter(Boolean).join(' and ');
  const most = kind === 'drivers' ? all.most.driver : all.most.team;
  if (!all.racesLeft && !all.sprintsLeft) {
    return (
      <p className="sp-small sp-ink2 sp-pad" style={{ margin: '0 0 8px' }}>
        <b className="sp-f1-strong">{name(t.leader)} won the title</b>
        {t.second ? ` by ${plural(t.gap, 'point')} from ${name(t.second)}.` : '.'}
      </p>
    );
  }
  if (t.decided) {
    return (
      <p className="sp-small sp-ink2 sp-pad" style={{ margin: '0 0 8px' }}>
        <b className="sp-f1-strong">{name(t.leader)} {kind === 'drivers' ? 'is champion' : 'are champions'}.</b> {t.second ? `${name(t.second)} can’t make up ${t.gap} points with ${most} left to win.` : ''}
      </p>
    );
  }
  return (
    <p className="sp-small sp-ink2 sp-pad" style={{ margin: '0 0 8px' }}>
      <b className="sp-f1-strong">
        {name(t.leader)} {kind === 'drivers' ? 'leads' : 'lead'} {t.second ? `${name(t.second)} by ${plural(t.gap, 'point')}` : ''}
      </b>{' '}
      with {left} left: up to {most} more points {kind === 'drivers' ? 'for a driver' : 'for a team'}.{' '}
      {t.contenders > 2 ? `${t.contenders} ${kind === 'drivers' ? 'drivers' : 'teams'} can still win it.` : t.contenders === 2 ? `Only ${name(t.leader)} and ${name(t.second)} can still win it.` : ''}
    </p>
  );
}

function Championship({ st, cal, color, named }) {
  const [kind, setKind] = useState('drivers');
  const { data, error } = st;
  const t = data && cal ? titleRace(data, cal.races, data.winners, data.sprintWinners) : null;
  const rows = data ? (kind === 'drivers' ? data.drivers : data.constructors) : [];
  const lead = rows[0]?.points ?? 0;
  return (
    <section className="sp-section">
      <div className="sp-pad sp-section-head">
        <h2 className="sp-h2">Championship</h2>
        <div className="sp-tabs" role="radiogroup" aria-label="Championship" style={{ border: 0, gap: 14 }}>
          {[['drivers', 'Drivers'], ['constructors', 'Teams']].map(([k, l]) => (
            <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} style={{ height: 30, fontSize: 14 }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {!data && !error && <div className="sp-skel" style={{ height: 420, margin: '0 16px', borderRadius: 6 }} />}
      {!data && error && <p className="sp-note sp-pad">Couldn’t load the standings from Jolpica just now.</p>}
      {data && (
        <>
          <TitleWords all={t} kind={kind} named={named} />
          <table className="sp-table sp-f1-table">
            <thead>
              <tr>
                <th className="l" style={{ paddingLeft: 16 }}>#</th>
                <th className="l">{kind === 'drivers' ? 'Driver' : 'Team'}</th>
                <th>Wins</th>
                <th>Pts</th>
                <th style={{ paddingRight: 16 }}>Behind</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={kind === 'drivers' ? r.driver.id : r.team.id}>
                  <td className="l sp-pos" style={{ paddingLeft: 16 }}>{r.pos ?? '–'}</td>
                  <td className="l">
                    {kind === 'drivers' ? (
                      <Driver d={r.driver} color={color(r.team?.id)} team={named(r.team)} />
                    ) : (
                      <span className="sp-f1-driver">
                        <Mark color={color(r.team.id)} />
                        <b>{named(r.team)}</b>
                      </span>
                    )}
                  </td>
                  <td className="sp-num">{r.wins || ''}</td>
                  <td className="sp-pts">{r.points}</td>
                  <td className="sp-num sp-muted" style={{ paddingRight: 16 }}>{r.points === lead ? '' : `−${lead - r.points}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function Calendar({ cal, st, color, now }) {
  const next = nextRace(cal.races, now);
  return (
    <section className="sp-section">
      <div className="sp-pad sp-section-head">
        <h2 className="sp-h2">Calendar</h2>
        <span className="sp-tiny sp-muted">{cal.season}</span>
      </div>
      <ol className="sp-f1-cal">
        {cal.races.map((r) => {
          const raceAt = r.sessions[r.sessions.length - 1]?.at;
          const w = st.winners[r.round];
          const sw = st.sprintWinners[r.round];
          const isNext = next?.round === r.round;
          return (
            <li key={r.round} className={w ? 'sp-f1-done' : isNext ? 'sp-f1-next' : ''}>
              <Link href={weekendHref(cal.season, r.round)}>
                <span className="sp-num sp-muted">{r.round}</span>
                <span className="sp-f1-cal-name">
                  <b>{shortRace(r.name)}</b>
                  <small className="sp-muted">{raceAt ? shortDate(raceAt) : ''}</small>
                </span>
                <span className="sp-f1-cal-win">
                  {w ? (
                    <>
                      <Mark color={color(w.team?.id)} />
                      <b>{w.driver.code}</b>
                      {sw && <small className="sp-muted"> sprint {sw.driver.code}</small>}
                    </>
                  ) : isNext ? (
                    <b>{next.live ? 'On now' : 'Next'}</b>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
