'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchTeam } from '@/lib/sport/espn.mjs';
import { LEAGUE_BY_SLUG } from '@/lib/sport/leagues.mjs';
import { useLive, Freshness } from './useLive';
import { useFollow, usePrefs } from './prefs';
import Crest from './Crest';
import MatchRow from './MatchRow';
import MatchCard from './MatchCard';
import { inkOn } from './colors';
import { Star } from './glyphs';

export default function TeamView() {
  const q = useSearchParams();
  const id = q.get('id');
  const slug = q.get('l') || 'eng.1';
  const { data, error, at } = useLive((signal) => (id ? fetchTeam(slug, id, { signal }) : Promise.resolve(null)), [id, slug], {
    every: 30000,
    live: (d) => d?.fixtures.some((m) => m.status.state === 'in'),
  });
  const { isFollowed, toggle } = useFollow();
  const { prefs } = usePrefs();
  const [all, setAll] = useState(false);
  if (!id) return <p className="sp-empty">No team given.</p>;
  if (!data) return error ? <p className="sp-empty">Couldn’t load this team from ESPN.</p> : <div className="sp-skel" style={{ height: 400, margin: 16 }} />;

  const { team, results, fixtures } = data;
  // Every competition the team appears in, so following it pulls in cup and European matches too.
  const leagues = [...new Set([data.league, ...results.map((m) => m.league), ...fixtures.map((m) => m.league)])].filter((s) => LEAGUE_BY_SLUG[s]);
  const following = isFollowed(team.id);
  const kit = /^#[0-9a-f]{6}$/i.test(team.color ?? '') ? team.color : '#333333';
  const next = all ? fixtures : fixtures.slice(0, 5);
  // Only name the competition when it isn't the team's league (cups, Europe, friendlies).
  // Last five results from this team's side: W, D or L.
  const form = results.slice(0, 5).reverse().map((m) => {
    const mine = m.home.id === team.id ? m.home : m.away;
    const opp = m.home.id === team.id ? m.away : m.home;
    const r = mine.score > opp.score ? 'W' : mine.score < opp.score ? 'L' : 'D';
    return { id: m.id, r, t: `${mine.score}–${opp.score} ${m.home.id === team.id ? 'v' : 'at'} ${opp.short}` };
  });
  const other = (m) => (m.league === data.league ? null : LEAGUE_BY_SLUG[m.league]?.name ?? 'Other competition');

  return (
    <div className="sp-read" style={{ paddingTop: 0 }}>
      <header style={{ background: kit, color: inkOn(kit), padding: '18px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="sp-hero-crest"><Crest src={team.logo} size={46} light /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="sp-h1">{team.name}</h1>
            <p className="sp-small" style={{ margin: '3px 0 0', fontWeight: 650 }}>{team.standing ?? ''}</p>
          </div>
          <button className="sp-hero-follow" style={{ fontSize: 13 }} aria-pressed={following} onClick={() => toggle({ id: team.id, name: team.name, logo: team.logo, leagues })}>
            <Star on={following} size={14} /> {following ? 'Following' : 'Follow'}
          </button>
        </div>
        {form.length > 0 && !(prefs.spoilers === 'all' || (prefs.spoilers === 'mine' && following)) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <span className="sp-form" style={{ background: '#fff', padding: 3, borderRadius: 5 }}>{form.map((f) => <i key={f.id} className={f.r} title={f.t}>{f.r}</i>)}</span>
            <span className="sp-small" style={{ fontWeight: 650 }}>Last {form.length}, oldest first</span>
          </div>
        )}
      </header>
      <p className="sp-pad sp-tiny sp-muted" style={{ margin: '8px 0 0' }}><Freshness at={at} error={error} /></p>

      {fixtures[0] && (
        <section style={{ marginTop: 14 }}>
          <h2 className="sp-h2 sp-pad" style={{ marginBottom: 8 }}>Next up</h2>
          <div className="sp-carousel">
            {fixtures.slice(0, 2).map((m) => <MatchCard key={m.id} m={m} league={LEAGUE_BY_SLUG[m.league]?.short ?? ''} />)}
          </div>
        </section>
      )}

      <section className="sp-group">
        <header className="sp-ghead"><h2 className="sp-h3">Fixtures</h2></header>
        {next.length ? next.map((m) => <MatchRow key={m.id} m={m} showDate caption={other(m)} />) : <p className="sp-note" style={{ padding: 16, margin: 0 }}>No fixtures listed yet.</p>}
        {fixtures.length > 5 && (
          <p style={{ margin: 0, padding: '10px 16px', borderTop: '1px solid var(--sp-rule)' }}>
            <button className="sp-small sp-link sp-ink2" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `All ${fixtures.length} fixtures`}</button>
          </p>
        )}
      </section>

      <section className="sp-group">
        <header className="sp-ghead"><h2 className="sp-h3">Results</h2></header>
        {results.length ? results.map((m) => <MatchRow key={m.id} m={m} showDate caption={other(m)} />) : <p className="sp-note" style={{ padding: 16, margin: 0 }}>No results this season yet.</p>}
      </section>
      <p className="sp-note sp-pad" style={{ marginTop: 10 }}>Fixtures list league matches ESPN has scheduled; cup ties appear once they’re drawn.</p>
    </div>
  );
}
