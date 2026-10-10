'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchDay } from '@/lib/sport/espn.mjs';
import { LEAGUE_BY_SLUG } from '@/lib/sport/leagues.mjs';
import { usePrefs } from './prefs';
import { useLive, Freshness } from './useLive';
import { useAlerts } from './alerts';
import MatchRow from './MatchRow';
import { todayYmd, ymdToDate, zoneLabel, longDate } from './time';

const DAYS = Array.from({ length: 11 }, (_, i) => i - 3);

/** Live, or kicking off within 15 minutes: worth refreshing for. */
const isHot = (m) => m.status.state === 'in' || (m.status.state === 'pre' && !m.status.off && new Date(m.date) - Date.now() < 15 * 60e3);

export default function Today() {
  const { prefs, ready } = usePrefs();
  // The day and every time on the page depend on the viewer's clock, so they wait for the browser.
  const [day, setDay] = useState(null);
  useEffect(() => setDay(todayYmd()), []);
  const [liveOnly, setLiveOnly] = useState(false);
  const enabled = useMemo(() => prefs.order.filter((s) => !prefs.off.includes(s)), [prefs.order, prefs.off]);
  // Followed teams pull in their own competitions, even ones switched off here.
  const slugs = useMemo(() => [...new Set([...enabled, ...prefs.teams.flatMap((t) => t.leagues ?? [])])], [enabled, prefs.teams]);
  const followed = useMemo(() => new Set(prefs.teams.map((t) => t.id)), [prefs.teams]);

  const { data, error, at } = useLive((signal) => (ready && day ? fetchDay(slugs, day, { signal }) : Promise.resolve(null)), [ready, slugs.join(','), day], {
    every: 20000,
    live: (d) => d?.matches.some(isHot),
  });
  const matches = data?.matches ?? [];
  useAlerts(matches);
  const live = matches.filter((m) => m.status.state === 'in');
  const shown = liveOnly ? live : matches;
  const mine = shown.filter((m) => followed.has(m.home.id) || followed.has(m.away.id));
  const byLeague = slugs
    .map((slug) => ({ slug, matches: shown.filter((m) => m.league === slug && !mine.includes(m)) }))
    .filter((g) => g.matches.length);

  if (!day) return <Skeleton />;
  return (
    <div className="sp-read">
      <div className="sp-pad" style={{ paddingTop: 16 }}>
        <div className="sp-section-head" style={{ marginBottom: 4 }}>
          <h1 className="sp-h1">{day === todayYmd() ? 'Today' : day === todayYmd(1) ? 'Tomorrow' : day === todayYmd(-1) ? 'Yesterday' : longDate(ymdToDate(day))}</h1>
          {live.length > 0 && (
            <button className="sp-btn sp-btn-sm" aria-pressed={liveOnly} onClick={() => setLiveOnly((v) => !v)}>
              Live now <span className="sp-num">{live.length}</span>
            </button>
          )}
        </div>
        <p className="sp-tiny sp-muted" style={{ margin: '0 0 12px' }}>
          {longDate(ymdToDate(day))}. Times are {zoneLabel()}.
        </p>
        <div className="sp-days" role="group" aria-label="Day">
          {DAYS.map((o) => {
            const ymd = todayYmd(o);
            const d = ymdToDate(ymd);
            return (
              <button key={o} className="sp-day" aria-pressed={ymd === day} onClick={() => setDay(ymd)}>
                <b>{o === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })}</b>
                <span className="sp-num">{d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
              </button>
            );
          })}
        </div>
        <div style={{ minHeight: 18, marginTop: 8 }}>
          <Freshness at={at} error={error} live={matches.some(isHot)} />
        </div>
      </div>

      {data?.failed?.length > 0 && data.failed.length < slugs.length && (
        <p className="sp-warn" style={{ marginTop: 10 }}>
          Couldn’t reach ESPN for {data.failed.map((s) => LEAGUE_BY_SLUG[s]?.name ?? s).join(', ')}. Trying again in 20 s.
        </p>
      )}

      {!data && !error && <Skeleton />}

      {mine.length > 0 && <Group title="Your teams" matches={mine} showLeague />}
      {byLeague.map((g) => (
        <Group key={g.slug} slug={g.slug} title={LEAGUE_BY_SLUG[g.slug]?.name ?? g.slug} matches={g.matches} />
      ))}

      {data && data.failed.length === slugs.length && slugs.length > 0 && (
        <div className="sp-empty">ESPN isn’t answering at the moment, so there are no scores to show. Trying again in 20 s.</div>
      )}

      {data && shown.length === 0 && data.failed.length < slugs.length && (
        <div className="sp-empty">
          <p style={{ margin: '0 0 6px' }}>{liveOnly ? 'Nothing is being played right now.' : `No matches on ${longDate(ymdToDate(day))} in the competitions you follow.`}</p>
          <Link className="sp-link sp-small" href="/sport/following">Choose competitions</Link>
        </div>
      )}
    </div>
  );
}

function Group({ slug, title, matches, showLeague }) {
  const lg = LEAGUE_BY_SLUG[slug];
  return (
    <section className="sp-group" aria-label={title}>
      <header className="sp-ghead">
        <h2 className="sp-h3">
          {title}
          {lg && lg.country !== 'Europe' && lg.country !== 'International' && <span className="sp-muted" style={{ fontWeight: 400 }}> · {lg.country}</span>}
        </h2>
        {lg?.table && <Link className="sp-tiny sp-ink2 sp-link" href={`/sport/table/${slug}`}>Table</Link>}
      </header>
      {matches.map((m) => (
        <MatchRow key={m.id} m={m} caption={showLeague ? LEAGUE_BY_SLUG[m.league]?.name ?? m.league : null} />
      ))}
    </section>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      {[5, 3].map((n, g) => (
        <div key={g} className="sp-group">
          <div className="sp-ghead"><span className="sp-skel" style={{ width: 140, height: 14 }} /></div>
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className="sp-row">
              <span className="sp-skel" style={{ width: 34, height: 12 }} />
              <div className="sp-row-teams">
                <span className="sp-skel" style={{ width: '55%', height: 14 }} />
                <span className="sp-skel" style={{ width: '45%', height: 14 }} />
              </div>
              <span />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
