'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchStandings } from '@/lib/sport/espn.mjs';
import { LEAGUES, LEAGUE_BY_SLUG } from '@/lib/sport/leagues.mjs';
import { useLive, Freshness } from './useLive';
import { usePrefs, useFollow } from './prefs';
import Crest from './Crest';
import SeasonForecast from './SeasonForecast';

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
      <div className="sp-pad" style={{ paddingTop: 16 }}>
        <h1 className="sp-h1">Tables</h1>
        <nav className="sp-days" aria-label="Competition" style={{ margin: '12px 0 10px' }}>
          {choices.map((l) => (
            <Link key={l.slug} href={`/sport/table/${l.slug}`} className="sp-pill" aria-current={l.slug === slug ? 'page' : undefined}
              style={l.slug === slug ? { height: 36, padding: '0 14px', fontSize: 13.5, background: 'var(--sp-brand)', color: '#fff' } : { height: 36, padding: '0 14px', fontSize: 13.5, background: 'var(--sp-surface)', color: 'var(--sp-ink-2)', border: '1px solid var(--sp-rule)' }}>
              {l.short}
            </Link>
          ))}
        </nav>
        <p className="sp-tiny sp-muted" style={{ margin: '0 0 6px' }}>
          <b style={{ color: 'var(--sp-ink-2)' }}>{lg?.name}</b> · {data?.season ?? ''}{data?.season ? '. ' : ''}<Freshness at={at} error={error} />
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
      {!hidden && data && (
        <p className="sp-note sp-pad" style={{ marginTop: 10 }}>
          Colours mark where places change, from ESPN’s notes; they can shift with cup winners. The table updates when a result is final, not during matches.
        </p>
      )}
    </div>
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
          {g.rows.map((r) => (
            <tr key={r.id} className={isFollowed(r.id) ? 'sp-mine' : ''} title={r.zone ?? undefined}>
              <td className="l sp-pos" style={{ paddingLeft: 12 }}>
                <span className="sp-zone" style={zoneStyle(r.zone)}>{r.rank}</span>
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

/** One colour per kind of place, so the table reads at a glance: Europe, promotion, the drop. */
const zoneColor = (zone) => {
  const z = (zone ?? '').toLowerCase(); // ESPN sends null for mid-table rows
  if (!z) return null;
  if (/relegat/.test(z) && /play/.test(z)) return '#f97316';
  if (/relegat/.test(z)) return '#ef4444';
  if (/champions/.test(z)) return '#3b82f6';
  if (/europa/.test(z)) return '#f59e0b';
  if (/conference/.test(z)) return '#10b981';
  if (/promot/.test(z)) return '#22c55e';
  if (/play/.test(z)) return '#14b8a6';
  return '#8b5cf6';
};

const zoneStyle = (zone) => {
  const c = zoneColor(zone);
  return c ? { background: c, color: '#fff' } : { background: 'var(--sp-sunk)', color: 'var(--sp-ink-2)' };
};

function ZoneKey({ rows }) {
  const seen = [];
  for (const r of rows) if (r.zone && !seen.includes(r.zone)) seen.push(r.zone);
  if (!seen.length) return null;
  return (
    <div className="sp-key-chips">
      {seen.map((z) => (
        <span key={z}><i style={{ background: zoneColor(z) }} />{z}</span>
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
