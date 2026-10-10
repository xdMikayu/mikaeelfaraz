'use client';
import { useEffect, useMemo, useState } from 'react';
import { simulateSeason } from '@/lib/sport/forecast.mjs';
import { useMatchupIndex, useForecastKit } from './matchupData';

const pct = (p) => (p < 0.005 ? '–' : p < 0.01 ? '<1%' : p > 0.99 ? '>99%' : `${Math.round(p * 100)}%`);

/**
 * The Premier League's remaining fixtures played out thousands of times with our team ratings:
 * projected points, title, top-four and relegation chances, and where each club tends to finish.
 */
export default function SeasonForecast({ rows }) {
  const mx = useMatchupIndex();
  const kit = useForecastKit(mx.data);
  const [fixtures, setFixtures] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let on = true;
    fetch('/api/sport/fpl/fixtures')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`FPL ${r.status}`))))
      .then((f) => on && setFixtures(f), (e) => on && setErr(e.message));
    return () => {
      on = false;
    };
  }, []);
  const sim = useMemo(() => {
    if (!kit || !fixtures) return null;
    const left = fixtures
      .filter((f) => !f.finished && !f.finishedProvisional)
      .map((f) => ({ home: kit.fplTeams[f.home], away: kit.fplTeams[f.away] }))
      .filter((f) => f.home && f.away);
    const table = rows.map((r) => ({ id: r.id, pts: r.pts, gd: r.gd, gf: r.gf }));
    return { left: left.length, out: simulateSeason(table, left, kit.ratings, { n: 4000 }) };
  }, [kit, fixtures, rows]);

  if (err) return <p className="sp-note sp-pad">The season forecast needs FPL’s fixture list, which didn’t load ({err}).</p>;
  if (!sim) return <div className="sp-skel" style={{ height: 300, margin: '16px 16px 0' }} />;
  const list = rows.map((r) => ({ r, s: sim.out[r.id] })).filter((x) => x.s).sort((a, b) => b.s.pts - a.s.pts);
  const n = rows.length;
  return (
    <section className="sp-group" style={{ marginTop: 24 }}>
      <header className="sp-ghead" style={{ display: 'block' }}>
        <h2 className="sp-h3">How the season could end</h2>
        <p className="sp-tiny sp-muted" style={{ margin: '2px 0 0' }}>
          The {sim.left} matches left, played 4,000 times with our team ratings. The strip shows where each club finishes across those seasons, first on the left; darker is more often.
        </p>
      </header>
      <div className="sp-heat-wrap">
        <table className="sp-table sp-sim">
          <thead>
            <tr>
              <th className="l" style={{ paddingLeft: 0 }}>Team</th>
              <th>Pts</th>
              <th>Title</th>
              <th>Top 4</th>
              <th>Down</th>
              <th className="l sp-hide-sm">Finishing position</th>
            </tr>
          </thead>
          <tbody>
            {list.map(({ r, s }) => (
              <tr key={r.id}>
                <td className="l" style={{ paddingLeft: 0 }}>
                  <span className="sp-tn" style={{ fontWeight: 700 }}>{r.short}</span>
                </td>
                <td className="sp-num" style={{ fontWeight: 800 }}>{Math.round(s.pts)}</td>
                <td className="sp-num">{pct(s.title)}</td>
                <td className="sp-num">{pct(s.top)}</td>
                <td className="sp-num">{pct(s.bottom)}</td>
                <td className="l sp-hide-sm">
                  <span className="sp-posdist" role="img" aria-label={`Most likely ${s.likely}${s.likely === 1 ? 'st' : s.likely === 2 ? 'nd' : s.likely === 3 ? 'rd' : 'th'}`}>
                    {s.dist.map((p, i) => (
                      <i key={i} style={{ background: `color-mix(in srgb, var(--sp-ink) ${Math.round(Math.min(1, p / 0.35) * 100)}%, var(--sp-sunk))` }} title={`${i + 1}: ${pct(p)}`} />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sp-tiny sp-muted sp-pad" style={{ margin: '8px 0 0' }}>
        Ratings come from every Premier League match since 2023/24, mostly xG, recent matches counting more. Ties are split on goal difference, then goals scored. Injuries, transfers and managers changing aren’t modelled; {n} clubs.
      </p>
    </section>
  );
}
