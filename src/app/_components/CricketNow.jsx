'use client';
import { useLive, useAge } from './useLive';
import { ShirtMark } from './glyphs';
import { kickoff, shortDate, zoneLabel } from './time';
import { isLive, started, bigMatch, situation, describe } from '@/lib/sport/cricket.mjs';

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
// ESPN's line repeats what situation() already says in words; then it's left out.
const repeats = (status) => /\b(lead|trail|require|need)s?\b/i.test(status);

/** Under the scores: what's happening (live in red), the day of a long match, and the result or start. */
function Status({ m, said }) {
  const day = m.session ? (m.days ? `${m.session} of ${m.days}` : m.session) : null;
  const extra = m.status && !(said && repeats(m.status)) ? m.status : null;
  if (m.state === 'in' && !started(m)) return <p className="sp-cm-status">{extra && !/scheduled to begin/i.test(extra) ? `${extra} · ` : ''}No score yet</p>;
  if (m.state === 'in' && /match over/i.test(m.status)) return <p className="sp-cm-status"><b>Match over</b></p>;
  if (isLive(m)) return <p className="sp-cm-status"><span className="sp-live-text">Live</span>{day && ` · ${day}`}{extra && ` · ${extra}`}</p>;
  if (m.state === 'in') {
    const pause = /^stumps$/i.test(m.summary) && day ? `Stumps, end of ${day.toLowerCase()}` : [m.summary, day].filter(Boolean).join(' · ');
    return <p className="sp-cm-status"><b>{pause}</b>{extra && ` · ${extra}`}</p>;
  }
  if (m.state === 'pre') {
    const toss = /toss/i.test(m.status) ? `${m.status} · ` : '';
    return <p className="sp-cm-status">{/^scheduled$/i.test(m.summary) || !m.summary ? `${toss}Starts ${when(m.start)}` : m.summary}</p>;
  }
  return <p className="sp-cm-status">{m.status || m.summary}</p>;
}

function Match({ m }) {
  const done = m.state === 'post';
  const sit = situation(m);
  const words = describe(sit);
  // "batting" only while that innings is going on: not once they're all out, declared or their overs are up.
  const inId = sit && !sit.allOut && !sit.declared && sit.kind !== 'set' ? sit.bat : null;
  return (
    <li className="sp-cm">
      <p className="sp-cm-meta">{[series(m.league.name), m.title, town(m.venue)].filter(Boolean).join(' · ')}</p>
      {m.teams.map((t) => {
        const batting = t.id === inId;
        return (
          <div key={t.id} className={`sp-cm-team${batting ? ' sp-cm-bat' : ''}${done && t.winner ? ' sp-won' : ''}${done && !t.winner && m.teams.some((x) => x.winner) ? ' sp-lost' : ''}`}>
            <ShirtMark color={t.color} size={20} />
            <span className="sp-tn">
              {t.name}
              {batting && <small className="sp-cm-batting">batting</small>}
            </span>
            <span className="sp-cm-runs">
              {t.runs}
              {t.overs && <small> ({t.overs})</small>}
            </span>
          </div>
        );
      })}
      {words && (
        <p className="sp-cm-sit">
          <b>{words.bold}</b>
          {words.rest}
        </p>
      )}
      <Status m={m} said={Boolean(words)} />
    </li>
  );
}

const counts = (g) => (
  <span className="sp-num">
    {g.live > 0 && <span className="sp-live-text">{g.live} live</span>}
    {g.live > 0 && g.matches > g.live && ' · '}
    {g.matches > g.live && (g.results === g.matches ? plural(g.results, 'result') : plural(g.matches, 'match'))}
  </span>
);

/** Other cricket today, a line per competition; open one to see its matches, worked out the same way. */
function Elsewhere({ groups }) {
  if (!groups.length) return null;
  return (
    <>
      <h3 className="sp-h3" style={{ margin: '16px 0 4px' }}>Other cricket today</h3>
      <ul className="sp-cl">
        {groups.map((g) =>
          g.list.length ? (
            <li key={g.id}>
              <details>
                <summary>
                  <span>
                    <span className="sp-chev" aria-hidden="true">›</span>
                    {series(g.name)}
                  </span>
                  {counts(g)}
                </summary>
                <ul className="sp-cms sp-cms-in">
                  {g.list.map((m) => (
                    <Match key={m.id} m={m} />
                  ))}
                </ul>
              </details>
            </li>
          ) : (
            <li key={g.id}>
              <div className="sp-cl-line">
                <span>{series(g.name)}</span>
                {counts(g)}
              </div>
            </li>
          ),
        )}
      </ul>
    </>
  );
}

/** Matches grouped by competition, with how many are live and how many finished. */
function grouped(matches) {
  const by = new Map();
  for (const m of matches) {
    const g = by.get(m.league.id) ?? { id: m.league.id, name: m.league.name, list: [], matches: 0, live: 0, results: 0 };
    g.list.push(m);
    g.matches += 1;
    if (isLive(m)) g.live += 1;
    if (m.state === 'post') g.results += 1;
    by.set(m.league.id, g);
  }
  return [...by.values()];
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

/** Cricket's shorthand, for anyone who doesn't read it every day. */
function HowToRead() {
  return (
    <details className="sp-cread">
      <summary>
        <span className="sp-chev" aria-hidden="true">›</span>How to read cricket scores
      </summary>
      <ul>
        <li><b>223/6</b> is 223 runs for 6 wickets. A score on its own, like <b>240</b>, means every batter was out.</li>
        <li>In Tests and other long matches each side bats twice: <b>346 &amp; 223/6</b> is the first innings, then the second.</li>
        <li><b>(72 ov)</b> is the overs bowled. An over is six balls, so 68.2 overs is 68 overs and 2 balls.</li>
        <li>A <b>d</b> after a score, like 500/9d, means the side declared: they stopped batting to give themselves time to win.</li>
        <li><b>Stumps</b> is the end of a day’s play. A long match carries on the next morning.</li>
        <li>The line in bold under each score does the sums for you: who leads or trails and by how much, or what a side needs to win.</li>
      </ul>
    </details>
  );
}

/** What's on in cricket now, from ESPN, until the full section is built. */
export default function CricketNow() {
  const { data, error } = useLive((signal) => getJson('/api/sport/cricket/now', signal), [], {
    every: 30000,
    live: (d) => d?.internationals.some(isLive) || d?.domestic?.some(isLive) || d?.leagues?.some((l) => l.live),
  });
  const age = useAge(data ? Date.parse(data.at) : null);
  const list = data?.internationals ?? [];
  // The Test-playing nations' matches in full; the associates' too while they're on or still to come.
  const rows = list.filter((m) => bigMatch(m) || m.state !== 'post');
  const assoc = grouped(list.filter((m) => !bigMatch(m) && m.state === 'post'));
  // Older cached answers have only a line per league, with no matches to open.
  const domestic = data?.domestic ? grouped(data.domestic) : (data?.leagues ?? []).map((l) => ({ ...l, list: [] }));
  const groups = [...domestic, ...assoc].sort((a, b) => b.live - a.live || b.matches - a.matches);
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
        {data && <Elsewhere groups={groups} />}
        {data && <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>{zoneLabel()} · From ESPN · {age}</p>}
        {data && <HowToRead />}
      </section>
      {data && <Upcoming shown={new Set(list.map((m) => m.id))} />}
    </div>
  );
}
