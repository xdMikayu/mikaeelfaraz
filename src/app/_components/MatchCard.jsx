'use client';
import Link from 'next/link';
import Crest from './Crest';
import { kitPair, inkOn } from './colors';
import { useSpoiler } from './prefs';
import { kickoff, dayMonth } from './time';

/** A match as two solid kit halves, the score on a white plate in the middle. */
export default function MatchCard({ m, league }) {
  const { hidden, reveal } = useSpoiler(m);
  const live = m.status.state === 'in';
  const pre = m.status.state === 'pre';
  const kits = kitPair(m.home, m.away);
  const half = (t, color) => (
    <div className="sp-mcard-half" style={{ background: color, color: inkOn(color) }}>
      <span className="sp-mcard-crest"><Crest src={t.logo} size={32} light /></span>
      <span>{t.short}</span>
    </div>
  );
  return (
    <article className="sp-mcard">
      <Link href={`/sport/match?id=${m.id}`} className="sp-row-link" aria-label={`${m.home.name} v ${m.away.name}`} />
      {half(m.home, kits['--home'])}
      {half(m.away, kits['--away'])}
      <span className="sp-mcard-lg" style={{ color: inkOn(kits['--home']) }}>{league}</span>
      <div className="sp-mcard-plate">
        {pre ? (
          <>
            <b style={{ fontSize: 22 }}>{kickoff(m.date)}</b>
            <span className="sp-quiet">{dayMonth(m.date)}</span>
          </>
        ) : hidden ? (
          <button className="sp-reveal" style={{ position: 'relative', zIndex: 2 }} onClick={reveal}>Show score</button>
        ) : (
          <>
            <b>{m.home.score ?? 0}–{m.away.score ?? 0}</b>
            <span className={live ? '' : 'sp-quiet'}>{live ? m.status.label : m.status.label || 'FT'}</span>
          </>
        )}
      </div>
    </article>
  );
}
