'use client';
// An F1 race weekend as a title card: the circuit drawn large, the race in the scoreboard's type, and
// how long until lights out (or until the next session, or what's on now). And the title fight: the
// leading drivers as bars in their team colours, the stakes in one sentence.

import Link from 'next/link';
import CIRCUITS from '@/lib/sport/f1-circuits.json';
import { sessionEnd } from '@/lib/sport/othersports.mjs';
import { SESSION_KEY, titleRace, countdown } from '@/lib/sport/f1.mjs';
import { inkOn } from './colors';
import { kickoff, shortDate } from './time';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The circuit's outline, in the card's ink. */
export function Circuit({ id, className }) {
  const c = CIRCUITS[id];
  if (!c) return null;
  return (
    <svg className={className} viewBox={`-3 -3 ${c.w + 6} ${c.h + 6}`} role="img" aria-label={`The ${c.name}`}>
      <path d={c.path} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * The weekend's title card. `compact` for the weekend's own page, where the sessions follow. The
 * line under the name says the one thing that matters now: what's on, what's next and when, or who
 * won (`winner`, left out while spoilers are hidden).
 */
export function RaceHero({ race, total, season, now, compact = false, kicker = null, winner = null }) {
  const c = CIRCUITS[race.circuitId];
  const sessions = race.sessions;
  const raceS = sessions[sessions.length - 1];
  const live = sessions.find((s) => Date.parse(s.at) <= now && now < sessionEnd(s));
  const next = sessions.find((s) => Date.parse(s.at) > now);
  const started = sessions[0] && Date.parse(sessions[0].at) <= now;
  const over = raceS && sessionEnd(raceS) <= now;
  const href = (s) => `/sport/f1/race?season=${season}&round=${race.round}&s=${SESSION_KEY[s.label]}`;
  // Before the weekend it counts down to the race; during it, to the next session.
  const target = !started ? raceS : next;
  const where = [race.circuit, race.place].filter((x, i, a) => x && !a.slice(0, i).some((y) => y?.includes(x))).join(', ');
  return (
    <section className={`sp-f1h${compact ? ' sp-f1h-compact' : ''}`} aria-label={race.name}>
      <Circuit id={race.circuitId} className="sp-f1h-track" />
      <div className="sp-f1h-body">
        <p className="sp-f1h-kicker">
          {kicker ?? `Round ${race.round} of ${total}`}
          {race.country ? ` · ${race.country}` : ''}
        </p>
        <h1 className="sp-f1h-name">{race.name}</h1>
        <p className="sp-f1h-where">{where}</p>
        <div className="sp-f1h-now" aria-live="polite">
          {live ? (
            <Link className="sp-f1h-live" href={href(live)}>
              <span className="sp-f1h-label">
                <i className="sp-dot" aria-hidden="true" /> On now
              </span>
              <b className="sp-f1h-big">{live.label}</b>
              <span className="sp-f1h-go">Follow the timing →</span>
            </Link>
          ) : target ? (
            <>
              <span className="sp-f1h-label">{target === raceS ? 'Lights out in' : `${target.label} in`}</span>
              <span className="sp-f1h-count">
                {countdown(Date.parse(target.at) - now).map(([n, unit]) => (
                  <span key={unit}>
                    <b className="sp-f1h-big">{n}</b> {unit}
                  </span>
                ))}
              </span>
              <span className="sp-f1h-when">
                {shortDate(target.at)}, {kickoff(target.at)}
                {target !== raceS && raceS ? ` · race ${shortDate(raceS.at)}, ${kickoff(raceS.at)}` : ''}
              </span>
            </>
          ) : over && winner ? (
            <>
              <span className="sp-f1h-label">Winner</span>
              <b className="sp-f1h-big">{winner}</b>
              <span className="sp-f1h-when">Raced {shortDate(raceS.at)}</span>
            </>
          ) : (
            over && <span className="sp-f1h-when">Raced {shortDate(raceS.at)}</span>
          )}
        </div>
        {c && (
          <p className="sp-f1h-facts">
            {c.length ? `${(c.length / 1000).toFixed(1)} km a lap` : ''}
            {c.length && c.firstGp ? ' · ' : ''}
            {c.firstGp ? `first Grand Prix here ${c.firstGp}` : ''}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * The drivers' title as it stands: the leaders as bars in their team colours, as long as their points,
 * and under them, in ink, what's at stake in one sentence.
 */
export function TitleFight({ standings, races, color, named }) {
  const t = titleRace(standings, races, standings.winners, standings.sprintWinners);
  const d = t.drivers;
  if (!d?.leader) return null;
  const left = [t.racesLeft && plural(t.racesLeft, 'race'), t.sprintsLeft && plural(t.sprintsLeft, 'sprint')].filter(Boolean).join(' and ');
  // Everyone who can still win it, at least the top three, at most five.
  const shown = standings.drivers.slice(0, Math.min(5, Math.max(3, d.contenders)));
  const top = d.leader.points || 1;
  const over = !t.racesLeft && !t.sprintsLeft;
  return (
    <section className="sp-section sp-f1t" aria-label="The drivers' title">
      <div className="sp-pad sp-section-head">
        <h2 className="sp-h2">The title</h2>
        <span className="sp-tiny sp-muted">{over ? `${standings.season ?? ''} final standings` : `${left} left`}</span>
      </div>
      <ol className="sp-f1t-bars sp-pad">
        {shown.map((r) => {
          const c = color(r.team?.id) ?? '#3a3a3a';
          const behind = top - r.points;
          return (
            <li key={r.driver.id}>
              <span className="sp-f1t-bar" style={{ width: `${Math.max(34, (r.points / top) * 100)}%`, background: c, color: inkOn(c) }}>
                <b>{r.driver.last}</b>
                {/* "Red Bull", not "Red Bull Racing": the bars are short. */}
                <small>{(named(r.team) ?? '').replace(/ (Racing|F1 Team)$/, '')}</small>
              </span>
              <b className="sp-f1t-pts">{r.points}</b>
              <span className="sp-f1t-gap">{behind ? `−${behind}` : ''}</span>
            </li>
          );
        })}
      </ol>
      <div className="sp-band sp-band-title">
        <span className="sp-band-main">
          {over ? (
            <span>
              <strong>{d.leader.driver.last}</strong> won the title{d.second ? <> by <b>{d.gap}</b> {d.gap === 1 ? 'point' : 'points'}</> : ''}
            </span>
          ) : d.decided ? (
            <span>
              <strong>{d.leader.driver.last}</strong> is champion: {d.second ? `${d.second.driver.last} can’t make up ${d.gap} points with ${t.most.driver} left to win` : `no one can catch ${d.leader.driver.last}`}
            </span>
          ) : (
            <span>
              <strong>{d.leader.driver.last}</strong> leads{d.second ? <> {d.second.driver.last} by <b>{d.gap}</b> {d.gap === 1 ? 'point' : 'points'}</> : ''}, with up to <b>{t.most.driver}</b> still to win.{' '}
              {d.contenders > 2 ? `${d.contenders} drivers can still take it.` : d.contenders === 2 ? 'It’s between the two of them.' : ''}
            </span>
          )}
        </span>
      </div>
    </section>
  );
}
