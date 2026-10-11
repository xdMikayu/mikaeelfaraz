'use client';
import { useLive, useAge } from './useLive';
import { ShirtMark } from './glyphs';
import { kickoff, shortDate, zoneLabel } from './time';
import { isLive, bigMatch } from '@/lib/sport/cricket.mjs';

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${res.status}`);
  return body;
}

// "Australia tour of South Africa 2026/27" → "Australia tour of South Africa".
const series = (name) => name.replace(/\s+\d{4}(\/\d{2,4})?$/, '');
// "Kingsmead, Durban" → "Durban".
const town = (venue) => venue?.split(',').pop().trim() ?? null;
const sameDay = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const when = (iso) => (sameDay(iso) ? kickoff(iso) : `${shortDate(iso)}, ${kickoff(iso)}`);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : word.endsWith('h') ? 'es' : 's'}`;

/** The line under the scores: live in red, a break in play or a result in grey, or when it starts. */
function Status({ m }) {
  const day = m.session ? `${m.session} · ` : '';
  if (isLive(m)) return <p className="sp-cm-status"><span className="sp-live-text">Live</span> · {day}{m.status}</p>;
  if (m.state === 'in') return <p className="sp-cm-status"><b>{m.summary}</b> · {day}{m.status}</p>;
  if (m.state === 'pre') {
    const toss = /toss/i.test(m.status) ? `${m.status} · ` : '';
    return <p className="sp-cm-status">{/^scheduled$/i.test(m.summary) || !m.summary ? `${toss}Starts ${when(m.start)}` : m.summary}</p>;
  }
  return <p className="sp-cm-status">{m.status || m.summary}</p>;
}

function Match({ m }) {
  const done = m.state === 'post';
  return (
    <li className="sp-cm">
      <p className="sp-cm-meta">{[series(m.league.name), m.title, town(m.venue)].filter(Boolean).join(' · ')}</p>
      {m.teams.map((t) => (
        <div key={t.id} className={`sp-cm-team${t.batting && m.state === 'in' ? ' sp-cm-bat' : ''}${done && t.winner ? ' sp-won' : ''}${done && !t.winner && m.teams.some((x) => x.winner) ? ' sp-lost' : ''}`}>
          <ShirtMark color={t.color} size={20} />
          <span className="sp-tn">{t.name}</span>
          <span className="sp-cm-runs">
            {t.runs}
            {t.overs && <small> ({t.overs})</small>}
          </span>
        </div>
      ))}
      <Status m={m} />
    </li>
  );
}

/** Other cricket today, a line per competition: the domestic leagues and the associates' results. */
function Elsewhere({ leagues }) {
  if (!leagues.length) return null;
  return (
    <>
      <h3 className="sp-h3" style={{ margin: '16px 0 4px' }}>Other cricket today</h3>
      <ul className="sp-cl">
        {leagues.map((l) => (
          <li key={l.id}>
            <span>{series(l.name)}</span>
            <span className="sp-num">
              {l.live > 0 && <span className="sp-live-text">{l.live} live</span>}
              {l.live > 0 && l.matches > l.live && ' · '}
              {l.matches > l.live && (l.results === l.matches ? plural(l.results, 'result') : plural(l.matches, 'match'))}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Upcoming({ shown }) {
  const { data, error } = useLive((signal) => getJson('/api/sport/cricket/week', signal), []);
  const list = (data?.matches ?? []).filter((m) => Date.parse(m.start) > Date.now() && !shown.has(m.id));
  const big = list.filter(bigMatch);
  const rows = (big.length ? big : list).slice(0, 8);
  const others = list.length - rows.length;
  return (
    <section className="sp-section">
      <h2 className="sp-h2">Coming up</h2>
      {!data && !error && <div className="sp-skel" style={{ height: 160, marginTop: 10, borderRadius: 6 }} />}
      {!data && error && <p className="sp-note">Couldn’t load the fixtures just now.</p>}
      {data && !list.length && <p className="sp-note">No internationals in the next week.</p>}
      {rows.length > 0 && (
        <ul className="sp-cu">
          {rows.map((m) => (
            <li key={m.id}>
              <span className="sp-cu-when sp-num">
                {shortDate(m.start)}
                <b>{kickoff(m.start)}</b>
              </span>
              <span className="sp-cu-what">
                <b>{m.teams.map((t) => t.name).join(' v ')}</b>
                <small>{[m.title, town(m.venue)].filter(Boolean).join(' · ')}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
      {others > 0 && <p className="sp-small sp-ink2" style={{ margin: '8px 0 0' }}>And {plural(others, 'more international')} in the next week, between associate nations.</p>}
    </section>
  );
}

/** What's on in cricket now, from ESPN, until the full section is built. */
export default function CricketNow() {
  const { data, error } = useLive((signal) => getJson('/api/sport/cricket/now', signal), [], {
    every: 30000,
    live: (d) => d?.internationals.some(isLive) || d?.leagues.some((l) => l.live),
  });
  const age = useAge(data ? Date.parse(data.at) : null);
  const list = data?.internationals ?? [];
  // The Test-playing nations' matches in full; the associates' too while they're on or still to come.
  const rows = list.filter((m) => bigMatch(m) || m.state !== 'post');
  const finished = list.filter((m) => !bigMatch(m) && m.state === 'post');
  const assoc = [...finished.reduce((by, m) => by.set(m.league.id, { id: m.league.id, name: m.league.name, matches: (by.get(m.league.id)?.matches ?? 0) + 1, live: 0, results: (by.get(m.league.id)?.results ?? 0) + 1 }), new Map()).values()];
  return (
    <div className="sp-pad">
      <section className="sp-section">
        <h2 className="sp-h2">On now</h2>
        {!data && !error && <div className="sp-skel" style={{ height: 320, marginTop: 10, borderRadius: 6 }} />}
        {!data && error && <p className="sp-note">Couldn’t reach ESPN just now. Try again in a minute.</p>}
        {data && !rows.length && <p className="sp-note">No international cricket today.</p>}
        {rows.length > 0 && (
          <ul className="sp-cms">
            {rows.map((m) => (
              <Match key={m.id} m={m} />
            ))}
          </ul>
        )}
        {data && <Elsewhere leagues={[...(data.leagues ?? []), ...assoc].sort((a, b) => b.live - a.live || b.matches - a.matches)} />}
        {data && <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>{zoneLabel()} · From ESPN · {age}</p>}
      </section>
      {data && <Upcoming shown={new Set(list.map((m) => m.id))} />}
    </div>
  );
}
