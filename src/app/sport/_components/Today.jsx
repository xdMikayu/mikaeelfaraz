'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchDay } from '@/lib/sport/espn.mjs';
import { LEAGUE_BY_SLUG } from '@/lib/sport/leagues.mjs';
import { usePrefs } from './prefs';
import { useLive, Freshness } from './useLive';
import { useAlerts } from './alerts';
import MatchRow from './MatchRow';
import MatchCard from './MatchCard';
import Crest from './Crest';
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

  // The strip at the top: what's live (your teams first); with nothing live, what's next.
  const ranked = (list) => [...list].sort((a, b) => Number(followed.has(b.home.id) || followed.has(b.away.id)) - Number(followed.has(a.home.id) || followed.has(a.away.id)));
  const upcoming = matches.filter((m) => m.status.state === 'pre' && !m.status.off && new Date(m.date) > Date.now());
  const featured = live.length ? ranked(live) : ranked(upcoming).slice(0, 8);
  const lgName = (slug) => data?.leagues?.[slug]?.abbr ?? LEAGUE_BY_SLUG[slug]?.short ?? slug;

  if (!day) return <Skeleton />;
  const isToday = day === todayYmd();
  return (
    <div className="sp-read">
      <div className="sp-pad" style={{ paddingTop: 14 }}>
        <div className="sp-section-head" style={{ marginBottom: 2 }}>
          <h1 className="sp-h1">{isToday ? 'Today' : day === todayYmd(1) ? 'Tomorrow' : day === todayYmd(-1) ? 'Yesterday' : ymdToDate(day).toLocaleDateString(undefined, { weekday: 'long' })}</h1>
          {live.length > 0 && (
            <button className={`sp-pill ${liveOnly ? 'sp-pill-live' : 'sp-pill-ft'}`} style={{ height: 32, padding: '0 12px', fontSize: 13 }} aria-pressed={liveOnly} onClick={() => setLiveOnly((v) => !v)}>
              <i className="sp-dot sp-dot-live" style={{ color: 'var(--sp-live)' }} /> {live.length} live
            </button>
          )}
        </div>
        <p className="sp-small sp-muted" style={{ margin: '0 0 14px' }}>
          {longDate(ymdToDate(day))} · {zoneLabel()}
        </p>
        <div className="sp-days" role="group" aria-label="Day">
          {DAYS.map((o) => {
            const ymd = todayYmd(o);
            const d = ymdToDate(ymd);
            return (
              <button key={o} className="sp-day" aria-pressed={ymd === day} onClick={() => setDay(ymd)} aria-label={longDate(d)}>
                <b>{o === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })}</b>
                <span className="sp-num">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
        <div style={{ minHeight: 18, marginTop: 10 }}>
          <Freshness at={at} error={error} live={matches.some(isHot)} />
        </div>
      </div>

      {data?.failed?.length > 0 && data.failed.length < slugs.length && (
        <p className="sp-warn">Couldn’t reach ESPN for {data.failed.map((s) => LEAGUE_BY_SLUG[s]?.name ?? s).join(', ')}. Trying again in 20 s.</p>
      )}

      {!data && !error && <Skeleton />}

      {featured.length > 0 && !liveOnly && (
        <section aria-label={live.length ? 'Live now' : 'Coming up'} style={{ marginTop: 14 }}>
          <h2 className="sp-h2 sp-pad" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {live.length ? <><i className="sp-dot sp-dot-live" style={{ color: 'var(--sp-live)' }} /> Live now</> : 'Coming up'}
          </h2>
          <div className="sp-carousel">
            {featured.map((m) => <MatchCard key={m.id} m={m} league={lgName(m.league)} />)}
          </div>
        </section>
      )}

      {mine.length > 0 && <Group title="Your teams" matches={mine} showLeague leagues={data?.leagues} />}
      {byLeague.map((g) => (
        <Group key={g.slug} slug={g.slug} title={LEAGUE_BY_SLUG[g.slug]?.name ?? g.slug} matches={g.matches} leagues={data?.leagues} />
      ))}

      {data && data.failed.length === slugs.length && slugs.length > 0 && (
        <div className="sp-empty">ESPN isn’t answering at the moment, so there are no scores to show. Trying again in 20 s.</div>
      )}

      {data && shown.length === 0 && data.failed.length < slugs.length && (
        <div className="sp-empty">
          <p style={{ margin: '0 0 10px' }}>{liveOnly ? 'Nothing is being played right now.' : `No matches on ${longDate(ymdToDate(day))} in the competitions you follow.`}</p>
          <Link className="sp-btn sp-btn-sm" href="/sport/following">Choose competitions</Link>
        </div>
      )}
    </div>
  );
}

function Group({ slug, title, matches, showLeague, leagues }) {
  const lg = LEAGUE_BY_SLUG[slug];
  const logo = leagues?.[slug]?.logo;
  const liveN = matches.filter((m) => m.status.state === 'in').length;
  return (
    <section className="sp-group" aria-label={title}>
      <header className="sp-ghead">
        {slug ? (
          <span className="sp-lgmark">{logo ? <Crest src={logo} size={20} light /> : null}</span>
        ) : (
          <span className="sp-lgmark" style={{ background: 'var(--sp-gold-soft)', color: 'var(--sp-gold)' }}>★</span>
        )}
        <h2 className="sp-h3">
          {title}
          {lg && lg.country !== 'Europe' && lg.country !== 'International' && <span className="sp-muted" style={{ fontWeight: 500 }}> · {lg.country}</span>}
        </h2>
        {liveN > 0 && <span className="sp-pill sp-pill-live">{liveN} live</span>}
        {lg?.table && <Link className="sp-pill sp-pill-ft" href={`/sport/table/${slug}`}>Table</Link>}
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
