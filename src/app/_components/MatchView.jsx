'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { fetchMatch } from '@/lib/sport/espn.mjs';
import { optaXg } from '@/lib/sport/fplmap.mjs';
import { LEAGUE_BY_SLUG } from '@/lib/sport/leagues.mjs';
import { useLive, Freshness } from './useLive';
import { useSpoiler, useFollow } from './prefs';
import { teamColors, useDark } from './colors';
import Crest from './Crest';
import XgChart, { axisMinute } from './XgChart';
import ShotMap from './ShotMap';
import Lineups from './Lineups';
import { Ball, Card, SecondYellow, SubArrows, Missed, Screen, Star } from './glyphs';
import { kickoff, longDate, until } from './time';

const hot = (d) => {
  if (!d) return false;
  const s = d.match.status;
  if (s.state === 'in') return true;
  // From 90 minutes before kick-off, so the lineups show up when ESPN gets them.
  return s.state === 'pre' && !s.off && new Date(d.match.date) - Date.now() < 90 * 60e3;
};

export default function MatchView() {
  const id = useSearchParams().get('id');
  const { data, error, at } = useLive((signal) => (id ? fetchMatch('all', id, { signal }) : Promise.resolve(null)), [id], { every: 20000, live: hot });
  const opta = useOpta(data);
  const dark = useDark();
  const [tab, setTab] = useState('overview');
  const { hidden, reveal } = useSpoiler(data?.match);
  const lineupsOut = Boolean(data?.lineups.home?.starters.length);
  const firstLineups = useFirstTrue(lineupsOut);

  if (!id) return <p className="sp-empty">No match given.</p>;
  if (!data && error) return <p className="sp-empty">Couldn’t load this match from ESPN ({error}). It will retry in 20 s.</p>;
  if (!data) return <MatchSkeleton />;

  const { match: m } = data;
  const colors = teamColors(m.home, m.away, dark);
  const names = { home: m.home.short, away: m.away.short };
  const pre = m.status.state === 'pre';
  const live = m.status.state === 'in';
  const showStuff = !hidden;
  const tabs = [
    ['overview', 'Overview'],
    ['lineups', 'Lineups'],
    ...(!pre && showStuff && data.stats.length ? [['stats', 'Stats']] : []),
    ...(!pre && showStuff && data.commentary.length ? [['commentary', 'Commentary']] : []),
  ];
  const current = tabs.some(([k]) => k === tab) ? tab : 'overview';

  return (
    <div>
      <Header m={m} data={data} hidden={hidden} reveal={reveal} at={at} error={error} />

      <div className="sp-pad" style={{ marginTop: 12 }}>
        <div className="sp-tabs" role="tablist">
          {tabs.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={current === k} onClick={() => setTab(k)}>
              {l}
              {k === 'lineups' && pre && lineupsOut && <span className={firstLineups ? 'sp-flash' : ''} style={{ marginLeft: 6, fontSize: 12, color: 'var(--sp-win)' }}>out</span>}
            </button>
          ))}
        </div>
      </div>

      {current === 'overview' && (
        <div className="sp-two" style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            {showStuff && data.shots.length > 0 && (
              <section className="sp-panel">
                <div className="sp-section-head">
                  <h2 className="sp-h2">Expected goals</h2>
                  <Link className="sp-tiny sp-muted sp-link" href="/sport/following#xg">Our estimate</Link>
                </div>
                <XgChart shots={data.shots} colors={colors} names={names} endMinute={live ? axisMinute(m.status.label) : null} />
                {opta && (
                  <p className="sp-tiny sp-muted sp-num" style={{ margin: '8px 0 0' }}>
                    Opta’s xG from FPL’s live data: {names.home} {opta.home.toFixed(2)}, {names.away} {opta.away.toFixed(2)}.
                  </p>
                )}
              </section>
            )}
            {showStuff && data.shots.length > 0 && (
              <section className="sp-panel">
                <h2 className="sp-h2" style={{ marginBottom: 10 }}>Shots</h2>
                <ShotMap shots={data.shots} colors={colors} names={names} />
              </section>
            )}
            {!pre && showStuff && !data.shots.length && (
              <p className="sp-note sp-pad">{data.hasShotData ? 'No shots yet.' : 'ESPN has no shot-by-shot data for this match, so there’s no shot map or xG.'}</p>
            )}
            {pre && <PreMatch data={data} />}
          </div>
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            {!pre && showStuff && (
              <section className="sp-panel">
                <h2 className="sp-h2" style={{ marginBottom: 6 }}>Key events</h2>
                <Timeline events={data.events} live={live} names={names} />
              </section>
            )}
            {!pre && showStuff && data.stats.length > 0 && (
              <section className="sp-panel">
                <div className="sp-section-head">
                  <h2 className="sp-h2">Stats</h2>
                  <button className="sp-tiny sp-link sp-ink2" onClick={() => setTab('stats')}>All stats</button>
                </div>
                <Stats stats={data.stats.slice(0, 6)} colors={colors} />
              </section>
            )}
            {(!pre || !showStuff) && <MatchInfo data={data} />}
          </div>
        </div>
      )}

      {current === 'lineups' && (
        <section className="sp-panel" style={{ marginTop: 14 }}>
          {lineupsOut ? (
            showStuff || pre ? <Lineups lineups={data.lineups} colors={colors} names={names} /> : <p className="sp-note">Lineups show goals and cards, so they stay hidden with the score.</p>
          ) : (
            <p className="sp-ink2" style={{ margin: 0 }}>
              Not announced yet. Clubs name their teams about an hour before kick-off, and this page checks for them every 20 seconds from 90 minutes before.
            </p>
          )}
        </section>
      )}

      {current === 'stats' && (
        <section className="sp-panel" style={{ marginTop: 14 }}>
          <div className="sp-stat-top sp-small" style={{ marginBottom: 4 }}>
            <span>{names.home}</span>
            <span />
            <span>{names.away}</span>
          </div>
          <Stats stats={data.stats} colors={colors} />
          <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>From ESPN’s match feed.</p>
        </section>
      )}

      {current === 'commentary' && <Commentary items={data.commentary} />}
    </div>
  );
}

/** FPL's live data, for the Opta xG line on Premier League matches. */
function useOpta(data) {
  const isPl = data?.match.league === 'eng.1' && data.match.status.state !== 'pre';
  const [fpl, setFpl] = useState(null);
  const at = data ? Math.floor(Date.now() / 60000) : 0; // at most once a minute
  useEffect(() => {
    if (!isPl) return;
    let off = false;
    (async () => {
      try {
        const st = await fetch('/api/sport/fpl/static').then((r) => (r.ok ? r.json() : null));
        if (!st) return;
        const live = await fetch(`/api/sport/fpl/live?event=${st.current}`).then((r) => (r.ok ? r.json() : null));
        if (!off && live) setFpl({ st, live });
      } catch {}
    })();
    return () => {
      off = true;
    };
  }, [isPl, at]);
  return useMemo(() => (isPl && fpl ? optaXg(data.match, fpl.st, fpl.live) : null), [isPl, fpl, data]);
}

/** True for one render cycle after `v` first becomes true (not if it was true on arrival). */
function useFirstTrue(v) {
  const seen = useRef(null);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (seen.current === false && v) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 2600);
      return () => clearTimeout(t);
    }
    seen.current = v;
  }, [v]);
  return flash;
}

function Header({ m, data, hidden, reveal, at, error }) {
  const { isFollowed, toggle } = useFollow();
  const live = m.status.state === 'in';
  const pre = m.status.state === 'pre';
  const lg = LEAGUE_BY_SLUG[m.league];
  const goals = (side) => data.events.filter((e) => ['goal', 'pen', 'og'].includes(e.kind) && e.side === side);
  const reds = (side) => data.events.filter((e) => e.kind === 'red' && e.side === side);
  const team = (t, side) => (
    <div className="sp-mteam">
      <Crest src={t.logo} size={52} />
      <Link href={`/sport/team?id=${t.id}&l=${m.league}`}>{t.name}</Link>
      <button
        className="sp-tiny sp-ink2"
        onClick={() => toggle({ id: t.id, name: t.short, logo: t.logo, leagues: [m.league] })}
        aria-pressed={isFollowed(t.id)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <Star on={isFollowed(t.id)} size={14} /> {isFollowed(t.id) ? 'Following' : 'Follow'}
      </button>
      {!hidden && reds(side).length > 0 && (
        <span className="sp-pips">{reds(side).map((r) => <Card key={r.id} red />)}</span>
      )}
    </div>
  );
  return (
    <header className="sp-mhead">
      <p className="sp-tiny sp-ink2" style={{ margin: 0, textAlign: 'center' }}>
        {lg?.table ? <Link className="sp-link" href={`/sport/table/${m.league}`}>{m.leagueName ?? lg.name}</Link> : m.leagueName ?? lg?.name}
        {m.round ? ` · ${m.round}` : ''} · {longDate(m.date)}
      </p>
      <div className="sp-mhead-grid">
        {team(m.home, 'home')}
        <div>
          {pre ? (
            <div className="sp-mscore sp-num" style={{ fontSize: 34, paddingTop: 12 }}>{m.status.off ? m.status.long : kickoff(m.date)}</div>
          ) : hidden ? (
            <div style={{ textAlign: 'center', paddingTop: 10 }}>
              <button className="sp-btn" onClick={reveal}>Show score</button>
            </div>
          ) : (
            <div className="sp-mscore">
              {m.home.score ?? '–'}
              <span className="sp-dash">–</span>
              {m.away.score ?? '–'}
            </div>
          )}
          <div className="sp-mstatus">
            {pre ? (
              <span className="sp-ink2">{until(m.date) ?? 'Starting'}</span>
            ) : live ? (
              <span className="sp-live-text">{hidden ? 'Live' : m.status.label}</span>
            ) : (
              <span className="sp-ink2">{m.status.long}</span>
            )}
            {!hidden && m.home.shootout != null && <span className="sp-ink2 sp-num" style={{ display: 'block' }}>Penalties {m.home.shootout}–{m.away.shootout}</span>}
          </div>
        </div>
        {team(m.away, 'away')}
      </div>
      {!hidden && !pre && (goals('home').length > 0 || goals('away').length > 0) && (
        <div className="sp-scorers">
          {['home', 'away'].map((s) => (
            <ul key={s}>
              {goals(s).map((g) => (
                <li key={g.id}>
                  {g.players[0]} <span className="sp-num sp-muted">{g.minute}{g.kind === 'pen' ? ' pen' : g.kind === 'og' ? ' og' : ''}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
      <p style={{ margin: '14px 0 0', textAlign: 'center' }}>
        <Freshness at={at} error={error} live={live} />
      </p>
    </header>
  );
}

const ICON = {
  goal: () => <Ball />,
  pen: () => <Ball />,
  og: () => <Ball own />,
  'pen-miss': () => <Missed />,
  yellow: () => <Card size={13} />,
  red: (e) => (/second/i.test(e.text) ? <SecondYellow size={14} /> : <Card red size={13} />),
  sub: () => <SubArrows />,
  var: () => <Screen />,
};

function Timeline({ events, live, names }) {
  const list = events.filter((e) => ICON[e.kind] || e.kind === 'ht' || e.kind === 'ft');
  const ordered = live ? [...list].reverse() : list;
  if (!list.length) return <p className="sp-note" style={{ margin: 0 }}>Nothing yet.</p>;
  return (
    <ol className="sp-tl">
      {ordered.map((e) => {
        if (e.kind === 'ht' || e.kind === 'ft') {
          const s = [...events].filter((x) => x.score && x.order <= e.order).pop()?.score ?? [0, 0];
          return (
            <li key={e.id}>
              <span className="sp-tl-phase sp-num">{e.kind === 'ht' ? 'Half-time' : 'Full time'} {s[0]}–{s[1]}</span>
            </li>
          );
        }
        const who = (
          <span className="sp-tl-who">
            <b>{e.kind === 'sub' ? e.players[0] : e.players[0] ?? ''}</b>
            {e.kind === 'sub' && e.players[1] && <small>for {e.players[1]}</small>}
            {['goal', 'pen'].includes(e.kind) && (
              <small className="sp-num">
                {e.score ? `${e.score[0]}–${e.score[1]}` : ''}
                {e.kind === 'pen' ? ', penalty' : ''}
                {e.players[1] ? `, assist ${e.players[1]}` : ''}
              </small>
            )}
            {e.kind === 'og' && <small className="sp-num">{e.score ? `${e.score[0]}–${e.score[1]}, ` : ''}own goal</small>}
            {e.kind === 'var' && <small>{e.text}</small>}
            {e.kind === 'pen-miss' && <small>Penalty {/saved/i.test(e.text) ? 'saved' : 'missed'}</small>}
          </span>
        );
        const icon = <span aria-label={e.kind}>{ICON[e.kind](e)}</span>;
        return (
          <li key={e.id} aria-label={`${e.minute} ${e.kind} ${e.side === 'home' ? names.home : names.away} ${e.players.join(', ')}`}>
            <span className="sp-tl-home">{e.side === 'home' && <>{who}{icon}</>}</span>
            <span className="sp-tl-min">{e.minute}</span>
            <span className="sp-tl-away">{e.side === 'away' && <>{icon}{who}</>}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Stats({ stats, colors }) {
  return (
    <div>
      {stats.map((s) => {
        const tot = s.home + s.away || 1;
        const lead = s.home === s.away ? null : s.home > s.away ? 'home' : 'away';
        return (
          <div key={s.key} className="sp-stat">
            <div className="sp-stat-top">
              <span style={{ fontWeight: lead === 'home' ? 700 : 500 }}>{s.home}{s.unit}</span>
              <span className="sp-stat-l">{s.label}</span>
              <span style={{ fontWeight: lead === 'away' ? 700 : 500 }}>{s.away}{s.unit}</span>
            </div>
            <div className="sp-stat-bars" aria-hidden>
              <div><i style={{ width: `${(s.home / tot) * 100}%`, background: colors.home, opacity: lead === 'away' ? 0.45 : 1 }} /></div>
              <div><i style={{ width: `${(s.away / tot) * 100}%`, background: colors.away, opacity: lead === 'home' ? 0.45 : 1 }} /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Commentary({ items }) {
  const [keyOnly, setKeyOnly] = useState(false);
  const shown = keyOnly ? items.filter((c) => c.kind) : items;
  return (
    <section className="sp-panel" style={{ marginTop: 14 }}>
      <div className="sp-section-head">
        <h2 className="sp-h2">Commentary</h2>
        <button className="sp-btn sp-btn-sm" aria-pressed={keyOnly} onClick={() => setKeyOnly((v) => !v)}>Key moments only</button>
      </div>
      <ol className="sp-comm">
        {shown.map((c) => (
          <li key={c.seq} className={c.kind && c.kind !== 'phase' ? 'sp-key' : ''}>
            <span className="sp-comm-min">{c.minute}</span>
            <span>{c.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FormRow({ team, form }) {
  if (!form.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Crest src={team.logo} size={18} /> <span className="sp-cond" style={{ fontWeight: 550 }}>{team.short}</span>
      </span>
      <span className="sp-form">
        {[...form].reverse().map((g) => (
          <i key={g.id} className={g.result} title={`${g.home ? 'v' : 'at'} ${g.opponent} ${g.score} (${g.league})`}>{g.result}</i>
        ))}
      </span>
    </div>
  );
}

function PreMatch({ data }) {
  const { match: m } = data;
  return (
    <>
      <section className="sp-panel">
        <div className="sp-section-head">
          <h2 className="sp-h2">Form</h2>
          <span className="sp-tiny sp-muted">Last five, oldest first</span>
        </div>
        <FormRow team={m.home} form={data.form.home} />
        <FormRow team={m.away} form={data.form.away} />
      </section>
      {data.h2h.length > 0 && (
        <section className="sp-panel">
          <h2 className="sp-h2" style={{ marginBottom: 6 }}>Last meetings</h2>
          <ul className="sp-bench">
            {data.h2h.map((g) => (
              <li key={g.id} style={{ gridTemplateColumns: '92px 1fr' }}>
                <span className="sp-tiny sp-muted sp-num">{new Date(g.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="sp-num">{g.home} {g.hs}–{g.as} {g.away}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <MatchInfo data={data} />
    </>
  );
}

function MatchInfo({ data }) {
  const { match: m, info } = data;
  const rows = [
    ['Kick-off', `${longDate(m.date)}, ${kickoff(m.date)}`],
    info.venue && ['Venue', [info.venue, info.city].filter(Boolean).join(', ')],
    info.referee && ['Referee', info.referee],
    info.attendance && ['Attendance', Number(info.attendance).toLocaleString()],
    m.tv.length > 0 && ['On TV (US)', m.tv.join(', ')],
  ].filter(Boolean);
  return (
    <section className="sp-panel">
      <h2 className="sp-h2" style={{ marginBottom: 10 }}>Match info</h2>
      <dl className="sp-dl">
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function MatchSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading match">
      <div className="sp-mhead" style={{ height: 210 }}>
        <div className="sp-skel" style={{ width: 180, height: 12, margin: '0 auto' }} />
        <div className="sp-mhead-grid">
          <div className="sp-mteam"><span className="sp-skel" style={{ width: 52, height: 52, borderRadius: 26 }} /></div>
          <span className="sp-skel" style={{ width: 90, height: 40, marginTop: 8 }} />
          <div className="sp-mteam"><span className="sp-skel" style={{ width: 52, height: 52, borderRadius: 26 }} /></div>
        </div>
      </div>
    </div>
  );
}
