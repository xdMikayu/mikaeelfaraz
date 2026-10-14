'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card, ShirtMark } from './glyphs';
import { useSpoiler } from './prefs';
import { kickoff, dayMonth } from './time';

/** Two-line score row: status | teams | score. Fixed widths, so updates never move anything. */
export default function MatchRow({ m, showDate = false, caption = null }) {
  const { hidden, reveal } = useSpoiler(m);
  const live = m.status.state === 'in';
  const done = m.status.state === 'post' && !m.status.off;
  const flash = useScoreFlash(m);
  const hs = m.home.score;
  const as = m.away.score;
  // Level after extra time, a shoot-out decides it: ESPN marks the winner even when it leaves out the shoot-out score.
  const beat = (me, them) => me.score > them.score || (me.score === them.score && me.winner && !them.winner);
  const result = (me, them) => (!done || hidden || me.score == null || them.score == null ? '' : beat(me, them) ? 'sp-won' : beat(them, me) ? 'sp-lost' : '');
  const label = `${m.home.name} v ${m.away.name}`;
  return (
    <div className="sp-row">
      <Link className="sp-row-link" href={`/sport/match?id=${m.id}`} aria-label={hidden ? `${label}, score hidden` : label} />
      <div className="sp-row-status">
        {showDate && <span className="sp-muted" style={{ fontWeight: 600 }}>{dayMonth(m.date)}</span>}
        {m.status.off ? (
          <abbr className="sp-pill sp-pill-off" title={m.status.long} style={{ textDecoration: 'none' }}>{m.status.label}</abbr>
        ) : m.status.state === 'pre' ? (
          <span className="sp-pill sp-pill-time">{kickoff(m.date)}</span>
        ) : live ? (
          <span className="sp-pill sp-pill-live">{hidden ? 'Live' : m.status.label}</span>
        ) : (
          <span className="sp-pill sp-pill-ft">{m.status.label}</span>
        )}
      </div>
      <div className="sp-row-teams">
        {caption && <span className="sp-tiny sp-muted" style={{ lineHeight: 1.2, height: 14.4, fontWeight: 650 }}>{caption}</span>}
        <TeamLine team={m.home} cls={result(m.home, m.away)} hidden={hidden} />
        <TeamLine team={m.away} cls={result(m.away, m.home)} hidden={hidden} />
      </div>
      <div className={`sp-row-score${live ? ' sp-is-live' : ''}`}>
        {caption && <i aria-hidden style={{ display: 'block', height: 14.4 }} />}
        {m.status.state === 'pre' || (m.status.off && hs == null) ? null : hidden ? (
          <button className="sp-reveal" onClick={reveal}>Show</button>
        ) : (
          <>
            <span className={`${result(m.home, m.away) === 'sp-lost' ? 'sp-lost' : ''} ${flash.home ? 'sp-flash' : ''}`}>{hs ?? '–'}{m.home.shootout != null && <small className="sp-muted"> ({m.home.shootout})</small>}</span>
            <span className={`${result(m.away, m.home) === 'sp-lost' ? 'sp-lost' : ''} ${flash.away ? 'sp-flash' : ''}`}>{as ?? '–'}{m.away.shootout != null && <small className="sp-muted"> ({m.away.shootout})</small>}</span>
          </>
        )}
      </div>
    </div>
  );
}

function TeamLine({ team, cls, hidden }) {
  return (
    <div className={`sp-team-line ${cls}`}>
      <ShirtMark color={team.color} alt={team.alt} />
      <span className="sp-tn">{team.short || team.name}</span>
      {!hidden && team.red > 0 && (
        <span className="sp-pips" aria-label={`${team.red} red card${team.red > 1 ? 's' : ''}`}>
          {Array.from({ length: team.red }, (_, i) => <Card key={i} red size={11} />)}
        </span>
      )}
    </div>
  );
}

/** Which side's score just changed, for one flash. Not on first render. */
function useScoreFlash(m) {
  const prev = useRef(null);
  const [flash, setFlash] = useState({ home: false, away: false });
  useEffect(() => {
    const cur = [m.home.score, m.away.score];
    const p = prev.current;
    prev.current = cur;
    if (!p || m.status.state !== 'in') return;
    const f = { home: cur[0] !== p[0], away: cur[1] !== p[1] };
    if (!f.home && !f.away) return;
    setFlash(f);
    const t = setTimeout(() => setFlash({ home: false, away: false }), 2600);
    return () => clearTimeout(t);
  }, [m.home.score, m.away.score, m.status.state]);
  return flash;
}
