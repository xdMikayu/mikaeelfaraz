'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchTeam } from '@/lib/sport/espn.mjs';
import { LEAGUE_BY_SLUG } from '@/lib/sport/leagues.mjs';
import { useLive, Freshness } from './useLive';
import { useFollow } from './prefs';
import Crest from './Crest';
import MatchRow from './MatchRow';
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
  const [all, setAll] = useState(false);
  if (!id) return <p className="sp-empty">No team given.</p>;
  if (!data) return error ? <p className="sp-empty">Couldn’t load this team from ESPN.</p> : <div className="sp-skel" style={{ height: 400, margin: 16 }} />;

  const { team, results, fixtures } = data;
  // Every competition the team appears in, so following it pulls in cup and European matches too.
  const leagues = [...new Set([data.league, ...results.map((m) => m.league), ...fixtures.map((m) => m.league)])].filter((s) => LEAGUE_BY_SLUG[s]);
  const following = isFollowed(team.id);
  const next = all ? fixtures : fixtures.slice(0, 5);
  // Only name the competition when it isn't the team's league (cups, Europe, friendlies).
  const other = (m) => (m.league === data.league ? null : LEAGUE_BY_SLUG[m.league]?.name ?? 'Other competition');

  return (
    <div className="sp-read">
      <header className="sp-pad" style={{ paddingTop: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Crest src={team.logo} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="sp-h1">{team.name}</h1>
          <p className="sp-small sp-ink2" style={{ margin: '2px 0 0' }}>{team.standing ?? ''}</p>
        </div>
        <button className="sp-btn" aria-pressed={following} onClick={() => toggle({ id: team.id, name: team.name, logo: team.logo, leagues })}>
          <Star on={following} size={15} /> {following ? 'Following' : 'Follow'}
        </button>
      </header>
      <p className="sp-pad sp-tiny sp-muted" style={{ margin: '8px 0 0' }}><Freshness at={at} error={error} /></p>

      <section className="sp-group">
        <header className="sp-ghead"><h2 className="sp-h3">Next</h2></header>
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
