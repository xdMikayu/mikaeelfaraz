'use client';
import { useEffect, useState } from 'react';
import { useLive, useAge } from './useLive';
import { nextRace, sessionEnd } from '@/lib/sport/othersports.mjs';
import { kickoff, shortDate, until, zoneLabel } from './time';
import CricketNow from './CricketNow';

const DAY = 864e5;

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${res.status}`);
  return body;
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

// ESPN marks a tournament's days with US Eastern midnights; read in that zone they're its calendar dates.
const ET = { timeZone: 'America/New_York', day: 'numeric', month: 'short' };
function tourDates(t) {
  const a = new Date(t.start);
  const b = new Date(t.end);
  try {
    return new Intl.DateTimeFormat(undefined, ET).formatRange(a, b);
  } catch {
    return `${a.toLocaleDateString(undefined, ET)} – ${b.toLocaleDateString(undefined, ET)}`;
  }
}

/** "Women's Singles" → "women's", to tell the draws apart at a joint event. */
const drawWord = (draw) => draw.replace(/\s*singles\s*/i, '').toLowerCase();
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function Tournament({ t }) {
  const joint = t.tours.length > 1;
  const top = t.top?.players.length === 2 ? t.top : null;
  const round = top?.round ? `${joint ? `${drawWord(top.draw)} ` : ''}${top.round.toLowerCase()}` : null;
  return (
    <li className="sp-event">
      <div className="sp-event-top">
        <b>{t.name}</b>
        <span className="sp-tiny sp-muted">{t.tours.join(' · ')}</span>
      </div>
      <p className="sp-muted">{[t.venue, tourDates(t), t.major && 'Grand Slam'].filter(Boolean).join(' · ')}</p>
      {t.live > 0 && (
        <p>
          <span className="sp-live-text">On now:</span>{' '}
          {top
            ? `${top.players.join(' v ')}${round ? `, ${round}` : ''}${t.live > 1 ? `, and ${t.live - 1} more` : ''}`
            : `${t.live} singles ${t.live === 1 ? 'match' : 'matches'}`}
        </p>
      )}
      {!t.live && t.stage && <p className="sp-ink2">Next: {t.stage}</p>}
      {t.champions.map((c) => (
        <p key={c.draw} className="sp-ink2">
          {joint ? `${capital(drawWord(c.draw))} singles won by ` : 'Won by '}
          <b>{c.name}</b>
        </p>
      ))}
    </li>
  );
}

function TennisNow() {
  const { data, error } = useLive((signal) => getJson('/api/sport/tennis/now', signal), [], { every: 60000, live: (d) => d?.tournaments.some((t) => t.live) });
  const age = useAge(data ? Date.parse(data.at) : null);
  const list = data?.tournaments ?? [];
  const rest = list.slice(6);
  return (
    <section className="sp-pad sp-section">
      <h2 className="sp-h2">On the tours this week</h2>
      {!data && !error && <div className="sp-skel" style={{ height: 300, marginTop: 10, borderRadius: 6 }} />}
      {!data && error && <p className="sp-note">Couldn’t reach ESPN just now. Try again in a minute.</p>}
      {data && !list.length && <p className="sp-note">No ATP or WTA tournaments this week.</p>}
      {list.length > 0 && (
        <ul className="sp-events">
          {list.slice(0, 6).map((t) => (
            <Tournament key={t.id} t={t} />
          ))}
        </ul>
      )}
      {rest.length > 0 && <p className="sp-small sp-ink2" style={{ margin: '8px 0 0' }}>Also this week: {rest.map((t) => t.name).join(', ')}.</p>}
      {data && <p className="sp-tiny sp-muted" style={{ margin: '6px 0 0' }}>From ESPN · {age}</p>}
    </section>
  );
}

function F1Next() {
  const { data, error } = useLive((signal) => getJson('/api/sport/f1/season', signal), []);
  const now = useNow(30000);
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
          <p className="sp-small" style={{ margin: '6px 0 0' }}>
            {race.live && <span className="sp-live-text">On now: {race.live.label}</span>}
            {race.live && Date.parse(raceAt) > now && ' · '}
            {Date.parse(raceAt) > now && <span className="sp-ink2">Race {until(raceAt, now)}</span>}
          </p>
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
          {race.after && (
            <p className="sp-small sp-ink2" style={{ margin: '10px 0 0' }}>
              After this: {race.after.name}, race {shortDate(race.after.at)} at {kickoff(race.after.at)}.
            </p>
          )}
          <p className="sp-tiny sp-muted" style={{ margin: '4px 0 0' }}>
            {zoneLabel()} · From Jolpica
          </p>
        </>
      )}
    </section>
  );
}

const PAGES = {
  cricket: {
    title: 'Cricket',
    status: 'Being built',
    intro: 'Live scores, with the sums done for you, and Matchday’s read on each match: par at the ground, where an innings is heading and each side’s chance of winning, learned from over 23,000 past matches. Scorecards and ball by ball are next.',
    Now: CricketNow,
    plan: [
      'Live scores ball by ball: Tests, ODIs and T20 internationals, the IPL, the Big Bash, The Hundred and the rest.',
      'Full scorecards: every batter and bowler, the fall of wickets and the partnerships.',
      'Win chances for Tests, which need the time left in the match as well as the score.',
      'Teams and players to follow, with an alert when their match starts.',
      'Matchday AI for fantasy cricket: your XI, captain and vice-captain. There’s no fantasy API like FPL’s, so you’d enter your team.',
    ],
    data: 'Scores come from ESPN, the same free source as the football. It also carries full scorecards, ball by ball and tables, which the full section will use. Par, projected totals, win chances and each ground’s record come from Cricsheet’s free ball-by-ball record of over 23,000 matches. There’s no open feed from the ICC or the national boards.',
  },
  tennis: {
    title: 'Tennis',
    intro: 'Scores, draws and rankings for the ATP and WTA tours are being built. Meanwhile, here’s what’s on this week.',
    Now: TennisNow,
    plan: [
      'Live scores, point by point, for the ATP and WTA tours and the Grand Slams.',
      'Draws you can follow round by round, and the rankings.',
      'Each match’s chances from both players’ serve and return numbers, updated as it’s played.',
      'Players to follow the way you follow teams, with an alert when their match starts.',
      'Matchday AI previews of the big matches: form, surface and head-to-head, with an honest pick.',
    ],
    data: 'Scores come from ESPN, the same source as the football.',
  },
  f1: {
    title: 'Formula 1',
    intro: 'Sessions, results and both championships are being built. Meanwhile, here’s the next race weekend in your time zone.',
    Now: F1Next,
    plan: [
      'Every session in your time zone, with results and both championships.',
      'Live positions and gaps during sessions, if a free source allows it.',
      'Race predictions from long-run pace in practice and from qualifying.',
      'Matchday AI for F1 Fantasy: picks, swaps and chips, like the FPL advice.',
    ],
    data: 'The calendar comes from Jolpica, which carries on the old Ergast F1 database; results and standings will come from there too. Live timing is the open question: OpenF1, the free source, now charges for data during sessions.',
  },
  wrestling: {
    title: 'Wrestling',
    intro: 'Match cards, results and a pick’em for your group are planned. This one needs a data source first.',
    plan: [
      'Match cards for WWE and AEW shows, in your time zone.',
      'Results as they come in, and who holds each title.',
      'A pick’em for your group: call the winners before each show, with a table for the year.',
      'Matchday AI makes its own picks, so there’s something to beat.',
    ],
    data: 'WWE and AEW don’t publish a free results feed, so this section needs a source first: a licensed feed, or cards entered by hand. That puts it further off than tennis and F1.',
  },
};

/** A sport that isn't built yet: what it will do, where its data will come from, and what's on now where we can show it. */
export default function ComingSoon({ sport }) {
  const p = PAGES[sport];
  const Now = p.Now;
  return (
    <div className="sp-read">
      <div className="sp-pad" style={{ paddingTop: 14 }}>
        <div className="sp-section-head" style={{ marginBottom: 4 }}>
          <h1 className="sp-h1">{p.title}</h1>
          <span className="sp-small sp-muted">{p.status ?? 'Coming soon'}</span>
        </div>
        <p className="sp-prose sp-small" style={{ margin: 0 }}>{p.intro}</p>
      </div>
      {Now && <Now />}
      <section className="sp-pad sp-section">
        <h2 className="sp-h2" style={{ marginBottom: 8 }}>What it will do</h2>
        <ul className="sp-plan">
          {p.plan.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
      <section className="sp-pad sp-section">
        <h2 className="sp-h2" style={{ marginBottom: 6 }}>The data</h2>
        <p className="sp-prose sp-small" style={{ margin: 0 }}>{p.data}</p>
      </section>
    </div>
  );
}
