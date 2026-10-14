'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { fetchMatch, fetchStandings, fetchScoreboard } from '@/lib/sport/espn.mjs';
import { asItStands, ifTheyWin, moveWords } from '@/lib/sport/as-it-stands.mjs';
import { optaXg } from '@/lib/sport/fplmap.mjs';
import { LEAGUE_BY_SLUG } from '@/lib/sport/leagues.mjs';
import { useLive, Freshness } from './useLive';
import { useSpoiler, useFollow } from './prefs';
import { teamColors, useDark, kitPair, inkOn } from './colors';
import Crest from './Crest';
import XgChart, { axisMinute } from './XgChart';
import ShotMap from './ShotMap';
import Lineups from './Lineups';
import { Ball, Card, SecondYellow, SubArrows, Missed, Screen, Star } from './glyphs';
import { kickoff, longDate, until } from './time';
import { useMatchRates, ForecastPanel, BookmakersPanel, WinPathChart, Deserved, MatchupsToWatch } from './MatchForecast';
import { useScrolledPast, StickyBar, StickyTeam } from './Sticky';

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
  const rates = useMatchRates(data);
  const table = useTableNow(data?.match);
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
      <Header m={m} data={data} hidden={hidden} reveal={reveal} at={at} error={error} band={!hidden && <TableBand m={m} table={table} names={names} />} />
      {!hidden && data.shootout?.length > 0 && <Shootout m={m} kicks={data.shootout} colors={colors} names={names} />}

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
            {rates && (pre || (live && showStuff)) && <ForecastPanel data={data} rates={rates} colors={colors} names={names} />}
            {pre && data.prices && <BookmakersPanel prices={data.prices} colors={colors} names={names} />}
            {rates && !pre && showStuff && <WinPathChart data={data} rates={rates} colors={colors} names={names} />}
            {m.status.state === 'post' && showStuff && data.shots.length > 0 && <Deserved data={data} rates={rates} colors={colors} names={names} />}
            {rates?.kit && (pre || live) && <MatchupsToWatch data={data} rates={rates} names={names} />}
            {showStuff && data.shots.length > 0 && (
              <section className="sp-panel">
                <div className="sp-section-head">
                  <h2 className="sp-h2">Expected goals</h2>
                  <Link className="sp-tiny sp-muted sp-link" href="/sport/settings#xg">Our estimate</Link>
                </div>
                <XgChart shots={data.shots} colors={colors} names={names} endMinute={live ? axisMinute(m.status.label) : null} />
                {live && <Momentum shots={data.shots} now={axisMinute(m.status.label)} names={names} />}
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
                <Stats stats={data.stats.slice(0, 6)} colors={colors} early={live && axisMinute(m.status.label) < 5} />
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
          <Stats stats={data.stats} colors={colors} early={live && axisMinute(m.status.label) < 5} />
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
        const live = await fetch(`/api/sport/fpl/live/${st.current}`).then((r) => (r.ok ? r.json() : null));
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

/**
 * The league's table and its matches today, for "as it stands": only in leagues with a table, and
 * only before and during the match (after it, ESPN's table takes the result itself).
 */
function useTableNow(m) {
  const slug = m && LEAGUE_BY_SLUG[m.league]?.table && m.status.state !== 'post' && !m.status.off ? m.league : null;
  const { data } = useLive(
    (signal) => (slug ? Promise.all([fetchStandings(slug, { signal }), fetchScoreboard(slug, null, { signal })]).then(([standings, board]) => ({ standings, board })) : Promise.resolve(null)),
    [slug],
    { every: 60000, live: () => m?.status.state === 'in' },
  );
  return data;
}

/** "go up to 6th" with the place in the scoreboard's type. */
function Move({ name, move }) {
  const words = moveWords(move);
  const [, lead, place] = words.match(/^(.*?)(\d+\w\w|top)$/) ?? [null, words, ''];
  return (
    <span className="sp-band-move">
      <strong>{name}</strong> {lead}
      <b>{place}</b>
    </span>
  );
}

/**
 * Under the header, in ink: what the score means. While it's live, the table as it stands, with
 * every match in the league being played counted as if it ended now; before kick-off, where a win
 * would take each side.
 */
function TableBand({ m, table, names }) {
  if (!table?.standings) return null;
  const live = m.status.state === 'in';
  let r = null;
  if (live) {
    // This match from its own feed, which is fresher than the league's scoreboard.
    const others = (table.board?.matches ?? []).filter((x) => x.id !== m.id && x.status.state === 'in');
    r = asItStands(table.standings, m.home.id, m.away.id, [m, ...others]);
  } else if (m.status.state === 'pre') {
    r = ifTheyWin(table.standings, m.home.id, m.away.id);
  }
  if (!r) return null;
  return (
    <div className="sp-band" aria-live="polite">
      <span className="sp-band-label">{live ? 'As it stands' : 'With a win'}</span>
      <span className="sp-band-main">
        <Move name={names.home} move={r.home} />
        <Move name={names.away} move={r.away} />
      </span>
    </div>
  );
}

/**
 * A penalty shoot-out kick by kick: each side's kicks in order, scored in its colour, missed or saved
 * in red with a cross (so it reads without colour), and while it's on, the kicks still to come.
 */
function Shootout({ m, kicks, colors, names }) {
  const live = m.status.state === 'in';
  const by = { home: kicks.filter((k) => k.side === 'home'), away: kicks.filter((k) => k.side === 'away') };
  const most = Math.max(by.home.length, by.away.length);
  // Five each, then a kick each in sudden death; while it's on, room for the next round.
  const slots = Math.max(5, live && by.home.length === by.away.length && most >= 5 ? most + 1 : most);
  const first = kicks[0]?.side;
  const order = first === 'away' ? ['away', 'home'] : ['home', 'away'];
  return (
    <section className="sp-pens" aria-label={`Penalty shoot-out: ${names.home} ${by.home.filter((k) => k.outcome === 'scored').length}, ${names.away} ${by.away.filter((k) => k.outcome === 'scored').length}`}>
      <h2 className="sp-h2">Penalties</h2>
      {order.map((side) => (
        <div key={side} className="sp-pens-row">
          <span className="sp-pens-name">{names[side]}</span>
          <span className="sp-pens-kicks">
            {Array.from({ length: slots }, (_, i) => {
              const k = by[side][i];
              if (!k) return live ? <i key={i} className="sp-pens-kick sp-pens-yet" /> : null;
              return k.outcome === 'scored' ? (
                <i key={i} className="sp-pens-kick" style={{ background: colors[side] }} title={`${k.player ?? names[side]}: scored`} />
              ) : (
                <i key={i} className="sp-pens-kick sp-pens-miss" title={`${k.player ?? names[side]}: ${k.outcome}`}>×</i>
              );
            })}
          </span>
          <b className="sp-pens-total">{by[side].filter((k) => k.outcome === 'scored').length}</b>
        </div>
      ))}
    </section>
  );
}

function Header({ m, data, hidden, reveal, at, error, band }) {
  const { isFollowed, toggle } = useFollow();
  const [heroRef, scrolledPast] = useScrolledPast();
  const live = m.status.state === 'in';
  const pre = m.status.state === 'pre';
  const lg = LEAGUE_BY_SLUG[m.league];
  const kits = kitPair(m.home, m.away);
  const goals = (side) => data.events.filter((e) => ['goal', 'pen', 'og'].includes(e.kind) && e.side === side);
  const reds = (side) => data.events.filter((e) => e.kind === 'red' && e.side === side);
  const half = (t, side, color) => (
    <div className="sp-hero-half" style={{ background: color, color: inkOn(color) }}>
      <span className="sp-hero-crest"><Crest src={t.logo} size={46} light /></span>
      <span className="sp-hero-name">
        <Link href={`/sport/team?id=${t.id}&l=${m.league}`}>{t.name}</Link>
        {/* Beside the name, so both halves line up. */}
        {!hidden && reds(side).length > 0 && (
          <span className="sp-pips" aria-label={`${reds(side).length} red card${reds(side).length > 1 ? 's' : ''}`}>
            {reds(side).map((r) => <Card key={r.id} red size={13} />)}
          </span>
        )}
      </span>
      <button className="sp-hero-follow" onClick={() => toggle({ id: t.id, name: t.short, logo: t.logo, leagues: [m.league] })} aria-pressed={isFollowed(t.id)}>
        <Star on={isFollowed(t.id)} size={12} /> {isFollowed(t.id) ? 'Following' : 'Follow'}
      </button>
    </div>
  );
  return (
    <>
      <header className="sp-hero" ref={heroRef}>
        {half(m.home, 'home', kits['--home'])}
        {half(m.away, 'away', kits['--away'])}
        <p className="sp-hero-meta" style={{ margin: 0 }}>
          <span style={{ background: '#fff', color: '#111', padding: '2px 8px', borderRadius: 4 }}>
            {lg?.table ? <Link href={`/sport/table/${m.league}`}>{m.leagueName ?? lg.name}</Link> : m.leagueName ?? lg?.name}
            {m.round ? ` · ${m.round}` : ''}
          </span>
        </p>
        <div className="sp-hero-plate">
          {pre ? (
            <>
              <b style={{ fontSize: 30 }}>{m.status.off ? m.status.label : kickoff(m.date)}</b>
              <span>{until(m.date) ?? 'Starting'}</span>
            </>
          ) : hidden ? (
            <button className="sp-reveal" style={{ position: 'relative', zIndex: 2 }} onClick={reveal}>Show score</button>
          ) : (
            <>
              <b>{m.home.score ?? '–'}–{m.away.score ?? '–'}</b>
              <span className={live ? 'sp-on' : ''}>{live ? m.status.label : ended(m.status.long)}</span>
              {m.home.shootout != null && <span>Pens {m.home.shootout}–{m.away.shootout}</span>}
            </>
          )}
        </div>
      </header>
      {band}
      {live && !hidden && (
        <StickyBar shown={scrolledPast}>
          <StickyTeam fill={kits['--home']} ink={inkOn(kits['--home'])} name={m.home.abbr ?? m.home.short} score={m.home.score ?? 0} />
          <StickyTeam fill={kits['--away']} ink={inkOn(kits['--away'])} name={m.away.abbr ?? m.away.short} score={m.away.score ?? 0} flip />
          <span className="sp-stick-words sp-on">{m.home.shootout != null ? `Pens ${m.home.shootout}–${m.away.shootout}` : m.status.label}</span>
        </StickyBar>
      )}
      {!hidden && !pre && (goals('home').length > 0 || goals('away').length > 0) && (
        <div className="sp-scorers">
          {['home', 'away'].map((s) => (
            <ul key={s}>
              {goals(s).map((g) => (
                <li key={g.id}>
                  {s === 'away' && <Ball size={12} own={g.kind === 'og'} />}
                  {g.pending ? (
                    <span className="sp-muted">Scorer to follow</span>
                  ) : (
                    <span>{initialled(g.players[0])} <span className="sp-num sp-muted">{g.minute}{g.kind === 'pen' ? ' pen' : g.kind === 'og' ? ' og' : ''}</span></span>
                  )}
                  {s === 'home' && <Ball size={12} own={g.kind === 'og'} />}
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
      <p className="sp-hero-under sp-tiny sp-muted" style={{ margin: 0 }}>
        {longDate(m.date)} · <Freshness at={at} error={error} live={live} />
      </p>
    </>
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

/** ESPN's "Final Score - After Penalties" as "After penalties", so it fits the score plate. */
const ended = (long = '') => {
  const t = String(long).replace(/^final score\s*-\s*/i, '');
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
};

/** "Riccardo Calafiori" -> "R. Calafiori", so names fit the narrow timeline columns on a phone. */
const initialled = (name = '') => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name;
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
        const goal = ['goal', 'pen', 'og'].includes(e.kind);
        // A goal carries the score it made, in the scoreboard's type, on the outer side of the name.
        const score = goal && e.score ? <span className="sp-tl-score">{e.score[0]}–{e.score[1]}</span> : null;
        const how = [e.kind === 'pen' && 'penalty', e.kind === 'og' && 'own goal', goal && e.kind !== 'og' && e.players[1] && `assist ${initialled(e.players[1])}`].filter(Boolean).join(', ');
        const who = (
          <span className="sp-tl-who">
            <span className="sp-tl-line">
              {e.side === 'home' && score}
              <b>{e.pending ? 'Goal' : initialled(e.players[0])}</b>
              {e.side === 'away' && score}
            </span>
            {e.pending && <small>details to follow</small>}
            {e.kind === 'sub' && e.players[1] && <small>for {initialled(e.players[1])}</small>}
            {how && <small>{how}</small>}
            {e.kind === 'var' && <small>{e.text}</small>}
            {e.kind === 'pen-miss' && <small>Penalty {/saved/i.test(e.text) ? 'saved' : 'missed'}</small>}
          </span>
        );
        const icon = <span className="sp-tl-icon" aria-label={e.kind}>{ICON[e.kind](e)}</span>;
        const tone = goal ? 'sp-tl-goal' : e.kind === 'red' ? 'sp-tl-red' : e.kind === 'sub' ? 'sp-tl-sub' : '';
        return (
          <li key={e.id} className={tone} aria-label={`${e.minute} ${e.kind} ${e.side === 'home' ? names.home : names.away} ${e.players.join(', ')}`}>
            <span className="sp-tl-home">{e.side === 'home' && <>{who}{icon}</>}</span>
            <span className="sp-tl-min">{e.minute}</span>
            <span className="sp-tl-away">{e.side === 'away' && <>{icon}{who}</>}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The last ten minutes in words, for who's on top now: "Last 10 minutes: City 4 shots (0.9 xG),
 * Liverpool none." The xG chart shows the whole match; this says what it's doing at the moment.
 */
function Momentum({ shots, now, names }) {
  if (!(now >= 10)) return null;
  const recent = shots.filter((s) => axisMinute(s.minute) > now - 10);
  const of = (side) => {
    const list = recent.filter((s) => s.side === side);
    const xg = list.reduce((t, s) => t + (s.xg ?? 0), 0);
    return { n: list.length, xg };
  };
  const h = of('home');
  const a = of('away');
  const said = (side, x) => (x.n ? <><b>{names[side]}</b> {x.n} {x.n === 1 ? 'shot' : 'shots'} <span className="sp-num">({x.xg.toFixed(1)} xG)</span></> : <><b>{names[side]}</b> none</>);
  // The side with more of the chances first.
  const [first, second] = a.xg > h.xg ? [['away', a], ['home', h]] : [['home', h], ['away', a]];
  return (
    <p className="sp-small" style={{ margin: '10px 0 0' }}>
      <span className="sp-muted">Last 10 minutes: </span>
      {!h.n && !a.n ? 'no shots from either side.' : <>{said(...first)}, {said(...second)}.</>}
    </p>
  );
}

function Stats({ stats: all, colors, early = false }) {
  // Possession in the first few minutes swings on a single spell on the ball (80% at 2′ means nothing).
  const stats = early ? all.filter((x) => x.key !== 'possessionPct') : all;
  const poss = stats.find((x) => x.key === 'possessionPct');
  const rest = stats.filter((x) => x !== poss);
  return (
    <div>
      {poss && (
        <div style={{ marginBottom: 6 }}>
          <p className="sp-tiny sp-muted" style={{ margin: '0 0 6px', textAlign: 'center', fontWeight: 650 }}>Possession</p>
          <div className="sp-poss" role="img" aria-label={`Possession ${poss.home}% to ${poss.away}%`}>
            <span style={{ width: `${poss.home}%`, background: colors.home, color: inkOn(colors.home) }}>{Math.round(poss.home)}%</span>
            <span style={{ width: `${poss.away}%`, background: colors.away, color: inkOn(colors.away) }}>{Math.round(poss.away)}%</span>
          </div>
        </div>
      )}
      {rest.map((s) => {
        const tot = s.home + s.away || 1;
        const lead = s.home === s.away ? null : s.home > s.away ? 'home' : 'away';
        return (
          <div key={s.key} className="sp-stat">
            <div className="sp-stat-top">
              <span style={{ fontWeight: lead === 'home' ? 900 : 600 }}>{s.home}{s.unit}</span>
              <span className="sp-stat-l">{s.label}</span>
              <span style={{ fontWeight: lead === 'away' ? 900 : 600 }}>{s.away}{s.unit}</span>
            </div>
            <div className="sp-stat-bars" aria-hidden>
              <div><i style={{ width: `${(s.home / tot) * 100}%`, background: colors.home, opacity: lead === 'away' ? 0.4 : 1 }} /></div>
              <div><i style={{ width: `${(s.away / tot) * 100}%`, background: colors.away, opacity: lead === 'home' ? 0.4 : 1 }} /></div>
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
          <li key={c.seq} className={c.kind && c.kind !== 'phase' ? `sp-key${['goal', 'pen', 'og'].includes(c.kind) ? ' sp-key-goal' : ['yellow', 'red'].includes(c.kind) ? ' sp-key-card' : ''}` : ''}>
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
