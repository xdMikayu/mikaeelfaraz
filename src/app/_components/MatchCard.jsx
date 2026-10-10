'use client';
import Link from 'next/link';
import Crest from './Crest';
import { kitPair } from './colors';
import { useSpoiler } from './prefs';
import { axisMinute } from './XgChart';
import { kickoff, dayMonth } from './time';

/** A big card for a live or featured match, tinted from the home kit into the away kit. */
export default function MatchCard({ m, league }) {
  const { hidden, reveal } = useSpoiler(m);
  const live = m.status.state === 'in';
  const pre = m.status.state === 'pre';
  const minute = live ? (m.status.label === 'HT' ? 45 : axisMinute(m.status.label)) : 0;
  return (
    <article className="sp-mcard" style={kitPair(m.home, m.away)}>
      <Link href={`/sport/match?id=${m.id}`} className="sp-row-link" aria-label={`${m.home.name} v ${m.away.name}`} />
      <div className="sp-mcard-top">
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{league}</span>
        {live ? (
          <span className="sp-pill sp-pill-live"><i className="sp-dot sp-dot-live" />{hidden ? 'Live' : m.status.label}</span>
        ) : pre ? (
          <span className="sp-pill" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}>{dayMonth(m.date)}</span>
        ) : (
          <span className="sp-pill" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}>{m.status.label}</span>
        )}
      </div>
      <div className="sp-mcard-body">
        <Team t={m.home} />
        {pre ? (
          <span className="sp-mcard-score" style={{ fontSize: 22, opacity: 0.9 }}>{kickoff(m.date)}</span>
        ) : hidden ? (
          <button className="sp-reveal" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }} onClick={reveal}>Show</button>
        ) : (
          <span className="sp-mcard-score">{m.home.score ?? 0}<i>–</i>{m.away.score ?? 0}</span>
        )}
        <Team t={m.away} />
      </div>
      {live && (
        <div className="sp-progress" aria-hidden>
          <i style={{ width: `${Math.min(100, (minute / 90) * 100)}%` }} />
        </div>
      )}
    </article>
  );
}

function Team({ t }) {
  return (
    <div className="sp-mcard-team">
      <span className="sp-mcard-crest"><Crest src={t.logo} size={32} light /></span>
      <span>{t.short}</span>
    </div>
  );
}
