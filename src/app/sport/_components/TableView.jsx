'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchStandings } from '@/lib/sport/espn.mjs';
import { LEAGUES, LEAGUE_BY_SLUG } from '@/lib/sport/leagues.mjs';
import { useLive, Freshness } from './useLive';
import { usePrefs, useFollow } from './prefs';
import Crest from './Crest';

export default function TableView({ slug }) {
  const router = useRouter();
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
        <div className="sp-section-head" style={{ flexWrap: 'wrap' }}>
          <h1 className="sp-h1">{lg?.name ?? slug}</h1>
          <label className="sp-sr" htmlFor="lg">Competition</label>
          <select id="lg" className="sp-select" value={slug} onChange={(e) => router.push(`/sport/table/${e.target.value}`)}>
            {choices.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
          </select>
        </div>
        <p className="sp-tiny sp-muted" style={{ margin: '0 0 6px' }}>
          {data?.season ?? ''}{data?.season ? '. ' : ''}<Freshness at={at} error={error} />
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
      {!hidden && data && (
        <p className="sp-note sp-pad" style={{ marginTop: 10 }}>
          Lines mark where places change: European spots, play-offs, relegation. They follow ESPN’s notes and can shift with cup winners. The table updates when a result is final, not during matches.
        </p>
      )}
    </div>
  );
}

function Group({ g, slug, isFollowed }) {
  const zones = [];
  g.rows.forEach((r, i) => {
    if (i && r.zone !== g.rows[i - 1].zone) zones.push(i);
  });
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
            <tr key={r.id} className={`${zones.includes(i) ? 'sp-zone-break' : ''} ${isFollowed(r.id) ? 'sp-mine' : ''}`} title={r.zone ?? undefined}>
              <td className="l sp-pos" style={{ paddingLeft: 16 }}>{r.rank}</td>
              <td className="l" style={{ maxWidth: 0, width: '100%' }}>
                <Link href={`/sport/team?id=${r.id}&l=${slug}`} className="sp-tteam">
                  <Crest src={r.logo} size={18} /> <span>{r.short}</span>
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

function ZoneKey({ rows }) {
  const seen = [];
  for (const r of rows) if (r.zone && !seen.some((z) => z.zone === r.zone)) seen.push({ zone: r.zone, from: r.rank, to: r.rank });
  for (const r of rows) {
    const z = seen.find((x) => x.zone === r.zone);
    if (z) z.to = r.rank;
  }
  if (!seen.length) return null;
  return (
    <p className="sp-tiny sp-muted" style={{ margin: 0, padding: '10px 16px 8px' }}>
      {seen.map((z) => `${z.from === z.to ? z.from : `${z.from}–${z.to}`} ${z.zone}`).join(' · ')}
    </p>
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
