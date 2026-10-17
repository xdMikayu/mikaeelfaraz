'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { fetchStandings } from '@/lib/sport/espn.mjs';
import { LEAGUES, LEAGUE_BY_SLUG } from '@/lib/sport/leagues.mjs';
import { useLive, Freshness } from './useLive';
import { usePrefs, useFollow } from './prefs';
import Crest from './Crest';
import SeasonForecast from './SeasonForecast';
import { LeagueSetPieces } from './SetPieces';

export default function TableView({ slug }) {
  const { prefs } = usePrefs();
  const { isFollowed } = useFollow();
  const [revealed, setRevealed] = useRevealAll(slug);
  const { data, error, at } = useLive((signal) => fetchStandings(slug, { signal }), [slug], { every: 120000, live: () => true });
  const lg = LEAGUE_BY_SLUG[slug];
  const choices = LEAGUES.filter((l) => l.table);
  const hidden = prefs.spoilers === 'all' && !revealed;

  return (
    <div className="sp-read">
      <div className="sp-pad" style={{ paddingTop: 10 }}>
        <h1 className="sp-sr">{lg?.name} table</h1>
        <LeaguePicker choices={choices} slug={slug} />
        <p className="sp-tiny sp-muted" style={{ margin: '10px 0 6px' }}>
          {data?.season ? `${data.season} · ` : ''}
          <Freshness at={at} error={error} />
        </p>
      </div>
      {hidden ? (
        <div className="sp-empty">
          <p style={{ margin: '0 0 10px' }}>Tables give results away, so spoiler mode hides them.</p>
          <button className="sp-btn" onClick={setRevealed}>Show the table</button>
        </div>
      ) : !data ? (
        error ? <p className="sp-empty">Couldn’t load the table from ESPN.</p> : <div className="sp-skel" style={{ height: 600, margin: 16 }} />
      ) : (
        data.groups.map((g) => <Group key={g.name ?? 'all'} g={g} slug={slug} isFollowed={isFollowed} />)
      )}
      {!hidden && data && slug === 'eng.1' && data.groups[0]?.rows.length > 0 && <SeasonForecast rows={data.groups[0].rows} />}
      {!hidden && data && slug === 'eng.1' && <LeagueSetPieces />}
      {!hidden && data && (
        <p className="sp-note sp-pad" style={{ marginTop: 10 }}>
          The bars mark what each place leads to, from ESPN’s notes; they can shift with cup winners. The table updates when a result is final, not during matches.
        </p>
      )}
    </div>
  );
}

/** The competitions as words, the one shown underlined and scrolled into view. */
function LeaguePicker({ choices, slug }) {
  const here = useRef(null);
  useEffect(() => here.current?.scrollIntoView({ block: 'nearest', inline: 'center' }), [slug]);
  return (
    <nav className="sp-days sp-leagues" aria-label="Competition">
      {choices.map((l) => (
        <Link key={l.slug} href={`/sport/table/${l.slug}`} className="sp-day" ref={l.slug === slug ? here : undefined} aria-current={l.slug === slug ? 'page' : undefined}>
          {l.short}
        </Link>
      ))}
    </nav>
  );
}

function Group({ g, slug, isFollowed }) {
  return (
    <section className="sp-group" style={{ paddingBottom: 4 }}>
      {g.name && <header className="sp-ghead"><h2 className="sp-h3">{g.name}</h2></header>}
      <table className="sp-table">
        <thead>
          <tr>
            <th className="l" style={{ paddingLeft: 16 }}>#</th>
            <th className="l">Team</th>
            <th>P</th>
            <th className="sp-hide-sm">W</th>
            <th className="sp-hide-sm">D</th>
            <th className="sp-hide-sm">L</th>
            <th className="sp-hide-sm">F–A</th>
            <th>GD</th>
            <th style={{ paddingRight: 16 }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {g.rows.map((r, i) => (
            <tr key={r.id} className={[isFollowed(r.id) ? 'sp-mine' : '', i > 0 && r.zone !== g.rows[i - 1].zone ? 'sp-zone-break' : ''].filter(Boolean).join(' ') || undefined} title={r.zone ?? undefined}>
              <td className="l sp-pos" style={{ paddingLeft: 12 }}>
                <span className="sp-zone">
                  <i style={zoneMark(r.zone)} aria-hidden="true" />
                  {r.rank}
                </span>
              </td>
              <td className="l" style={{ maxWidth: 0, width: '100%' }}>
                <Link href={`/sport/team?id=${r.id}&l=${slug}`} className="sp-tteam">
                  <Crest src={r.logo} size={22} /> <span>{r.short}</span>
                </Link>
              </td>
              <td>{r.p}</td>
              <td className="sp-hide-sm">{r.w}</td>
              <td className="sp-hide-sm">{r.d}</td>
              <td className="sp-hide-sm">{r.l}</td>
              <td className="sp-hide-sm">{r.gf}–{r.ga}</td>
              <td>{r.gd > 0 ? `+${r.gd}` : r.gd < 0 ? `−${-r.gd}` : 0}</td>
              <td className="sp-pts" style={{ paddingRight: 16 }}>{r.pts}{r.deduction ? <sup className="sp-muted" title={`${r.deduction} point deduction`}>*</sup> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ZoneKey rows={g.rows} />
    </section>
  );
}

// Where each place leads, as a bar beside it. Rewards in ink, more for a bigger one (the Champions
// League or promotion, then the Europa League, then the Conference League); a play-off is outlined;
// the drop is red, as points lost are everywhere else.
const ink = (t) => `color-mix(in srgb, var(--sp-ink) ${t}%, transparent)`;
const zoneMark = (zone) => {
  const z = (zone ?? '').toLowerCase(); // ESPN sends null for mid-table rows
  if (!z) return { background: 'transparent' };
  if (/relegat/.test(z)) return /play/.test(z) ? { boxShadow: 'inset 0 0 0 1.5px var(--sp-loss)' } : { background: 'var(--sp-loss)' };
  if (/play/.test(z)) return { boxShadow: 'inset 0 0 0 1.5px var(--sp-ink)' };
  if (/champions|promot/.test(z)) return { background: 'var(--sp-ink)' };
  if (/europa/.test(z)) return { background: ink(55) };
  return { background: ink(25) };
};

function ZoneKey({ rows }) {
  // ESPN spells some the same way twice ("Promotion playoffs", "Promotion Playoffs").
  const seen = [];
  for (const r of rows) if (r.zone && !seen.some((z) => z.toLowerCase() === r.zone.toLowerCase())) seen.push(r.zone);
  if (!seen.length) return null;
  return (
    <div className="sp-key-chips">
      {seen.map((z) => (
        <span key={z}><i style={zoneMark(z)} />{z}</span>
      ))}
    </div>
  );
}

function useRevealAll(slug) {
  const key = `md-reveal-table-${slug}`;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    try {
      setShown(sessionStorage.getItem(key) === '1');
    } catch {}
  }, [key]);
  const reveal = () => {
    setShown(true);
    try {
      sessionStorage.setItem(key, '1');
    } catch {}
  };
  return [shown, reveal];
}
