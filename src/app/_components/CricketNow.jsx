'use client';
import { useLive, useAge } from './useLive';
import { teamColors, useDark } from './colors';
import { CricketCard } from './CricketLive';
import { kickoff, shortDate, zoneLabel } from './time';
import { isLive, started, bigMatch } from '@/lib/cricket.mjs';
import about from '@/lib/cricket/about.json';

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${res.status}`);
  return body;
}

// "Australia tour of South Africa 2026/27" → "Australia tour of South Africa".
export const series = (name) => name.replace(/\s+\d{4}(\/\d{2,4})?$/, '');
// "Kingsmead, Durban" → "Durban".
export const town = (venue) => venue?.split(',').pop().trim() ?? null;
const sameDay = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const when = (iso) => (sameDay(iso) ? kickoff(iso) : `${shortDate(iso)}, ${kickoff(iso)}`);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : word.endsWith('h') ? 'es' : 's'}`;
// ESPN's line repeats what situation() already says in words; then it's left out.
const repeats = (status) => /\b(lead|trail|require|need)s?\b/i.test(status);
// Chances never read 0% or 100% while there's anything left to play.
export const pct = (p) => (p < 0.01 ? 'under 1%' : p > 0.99 ? 'over 99%' : `${Math.round(p * 100)}%`);
export const share = (n, of) => `${Math.round((n / of) * 100)}%`;
const scoreOf = ([, runs, wkts]) => (runs == null ? '' : wkts >= 10 ? `${runs}` : `${runs}/${wkts}`);
export const dayOf = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Under the scores: what's happening (live in red), the day of a long match, and the result or start. */
export function Status({ m, said }) {
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
  return (
    <li className="sp-cm">
      <p className="sp-cm-meta">{[series(m.league.name), m.title, town(m.venue)].filter(Boolean).join(' · ')}</p>
      <CricketCard m={m} />
      {m.state === 'in' && <Status m={m} said />}
      {m.read && <MatchRead m={m} read={m.read} said={m.state === 'in'} />}
    </li>
  );
}

/** Two-way bar in the sides' colours (the same as on the match page), each side's chance under it. */
export function Chances({ m, chances }) {
  const [a, b] = m.teams;
  const dark = useDark();
  const c = teamColors(a ?? {}, b ?? {}, dark);
  return (
    <div className="sp-cm-odds">
      <div className="sp-split" role="img" aria-label={`Chance of winning: ${a.name} ${pct(chances[0])}, ${b.name} ${pct(chances[1])}`}>
        <i style={{ width: `${chances[0] * 100}%`, background: c.home }} />
        <i style={{ width: `${chances[1] * 100}%`, background: c.away }} />
      </div>
      <div className="sp-split-l">
        <span>
          <b className="sp-num">{pct(chances[0])}</b> {a.name}
        </span>
        <span>
          {b.name} <b className="sp-num">{pct(chances[1])}</b>
        </span>
      </div>
    </div>
  );
}

const competitionOf = (m) => (m.international ? (m.women ? 'women’s internationals' : 'internationals') : series(m.league.name));

/**
 * Matchday's read under the score: where the innings is heading or what a chase usually brings,
 * par at the ground, each side's chance, and in a Test's last innings how chases that size went.
 */
export function MatchRead({ m, read, said = false }) {
  const now = read.now;
  const before = m.state === 'pre' || !started(m);
  const chances = now?.chances ?? (before ? read.pre : null);
  const team = (id) => m.teams.find((t) => t.id === id)?.name;
  let line = null;
  if (now?.kind === 'first') {
    // `said`: the scoreboard above already gives the projected total, so this gives its range.
    line = said ? (
      now.projected.lo === now.projected.hi ? null : (
      <>
        <b>
          Most likely between {now.projected.lo} and {now.projected.hi}
        </b>
        , against a par of {read.par} here.
      </>
      )
    ) : (
      <>
        <b>Projected total: about {now.projected.mean}</b>, most likely between {now.projected.lo} and {now.projected.hi}. Par here is {read.par}.
      </>
    );
  } else if (now?.kind === 'chase') {
    const gap = now.usual - now.need;
    line = (
      <>
        <b>From here a side usually adds about {now.usual}</b>, {gap === 0 ? 'exactly' : gap > 0 ? `${gap} more than` : `${-gap} short of`} the {now.need} {team(now.team)} need.
      </>
    );
  } else if (now?.kind === 'reduced') {
    line = <>The match has been shortened, so there’s no projection.</>;
  } else if (before && read.par) {
    line = (
      <>
        <b>Par here is about {read.par}</b>: what a first innings usually makes at {read.ground?.name ?? 'this ground'} in {competitionOf(m)}.
      </>
    );
  }
  const source = before
    ? now?.kind === 'toss'
      ? `Our estimate after the toss, from ${read.pre ? 'team ratings and ' : ''}par here.`
      : `Our estimate before a ball, from team ratings${read.home ? ` and ${read.home} playing at home` : ''}.`
    : `Our estimate, from the score against par here${read.pre ? ' and team ratings' : ''}.`;
  const tc = read.testChase;
  if (!line && !chances && !tc) return null;
  return (
    <div className="sp-cm-read">
      {line && <p>{line}</p>}
      {chances && now?.kind !== 'reduced' && (
        <>
          <Chances m={m} chances={chances} />
          <p className="sp-cm-src">{source}</p>
        </>
      )}
      {tc && (
        <p>
          <b>
            Sides set {tc.from === 0 ? 'under 100' : tc.to == null ? `${tc.from} or more` : `${tc.from} to ${tc.to}`} to win a Test have won {share(tc.won, tc.n)} of the time
          </b>
          : {share(tc.drawn, tc.n)} were drawn and {share(tc.lost, tc.n)} lost, in {tc.n} Tests since {tc.since}. The target here is {tc.target}.
        </p>
      )}
    </div>
  );
}

const PHASES = { t20: ['1–6', '7–15', '16–20'], odi: ['1–10', '11–40', '41–50'] };

/** "Pakistan 118/4 beat Sri Lanka 114" from a ground's recent match. */
function lastLine(x) {
  if (x.teams) {
    const [a, b] = x.teams;
    return x.result === 'draw' ? `${a} and ${b} drew` : x.result === 'tie' ? `${a} and ${b} tied` : x.result === a || x.result === b ? `${x.result} beat ${x.result === a ? b : a}` : `${a} v ${b}`;
  }
  const a = `${x.a[0]} ${scoreOf(x.a)}`.trim();
  const b = `${x.b[0]} ${scoreOf(x.b)}`.trim();
  const said = x.result === x.a[0] ? `${a} beat ${b}` : x.result === x.b[0] ? `${b} beat ${a}` : x.result === 'tie' ? `${a} and ${b} tied` : `${x.a[0]} v ${x.b[0]}: no result`;
  return x.dl ? `${said} (rain rules)` : said;
}

/** The ground's record for this kind of match, folded away under the card. */
export function GroundRecord({ m, read }) {
  const r = read.record;
  const [kind, gender] = read.format.split('-');
  const women = gender === 'female' ? 'Women’s ' : '';
  const what =
    r.scope === 'intl'
      ? kind === 'test'
        ? `${women}Tests`
        : `${women}${kind === 't20' ? 'T20' : 'one-day'} internationals`
      : r.scope === 'league'
        ? `${series(m.league.name)} matches`
        : r.scope === 'fc'
          ? 'First-class matches'
          : `${women}${kind === 't20' ? 'T20' : 'one-day'} matches of every kind`;
  const name = read.ground?.name ?? 'This ground';
  return (
    <details className="sp-cm-ground">
      <summary>
        <span className="sp-chev" aria-hidden="true">›</span>
        {name}: the record
      </summary>
      <p>
        {what} here since {r.since}: <b>{r.n}</b>.
      </p>
      {r.inns ? (
        <>
          <table className="sp-cm-rec">
            <thead>
              <tr>
                <th>Innings</th>
                <th>1st</th>
                <th>2nd</th>
                <th>3rd</th>
                <th>4th</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Average</th>
                {r.inns.map((x, i) => (
                  <td key={i} className="sp-num">
                    {x ? x[0] : '–'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <dl>
            <dt>Batting first</dt>
            <dd>won {r.batFirst} of {r.n}</dd>
            <dt>Batting second</dt>
            <dd>won {r.batSecond}</dd>
            <dt>Drawn</dt>
            <dd>{r.drawn}{r.tied ? `, and ${r.tied} tied` : ''}</dd>
            {r.bestChase && (
              <>
                <dt>Best last-innings chase</dt>
                <dd>
                  {r.bestChase[0]} by {r.bestChase[1]} in {r.bestChase[2]}
                </dd>
              </>
            )}
          </dl>
        </>
      ) : (
        <>
          <dl>
            <dt>Batting first</dt>
            <dd>
              {r.first ? `averages ${r.first[0]}, ` : ''}won {r.batFirst} of {r.n}
            </dd>
            <dt>Chasing</dt>
            <dd>
              {r.second ? `averages ${r.second[0]}, ` : ''}won {r.chasing} of {r.n}
              {r.tied ? `; ${r.tied} tied` : ''}
            </dd>
            {r.toss && (
              <>
                <dt>The toss</dt>
                <dd>
                  {r.toss.n >= 10
                    ? `winners chose to field ${share(r.toss.field, r.toss.n)} of the time, and won ${share(r.toss.won, r.toss.n)} of their matches`
                    : `winners chose to field ${r.toss.field} times in ${r.toss.n}, and won ${r.toss.won}`}
                </dd>
              </>
            )}
            {r.high && (
              <>
                <dt>Highest total</dt>
                <dd>
                  {r.high[0]} by {r.high[1]} in {r.high[2]}
                </dd>
              </>
            )}
            {r.bestChase && (
              <>
                <dt>Best chase</dt>
                <dd>
                  {r.bestChase[0]} by {r.bestChase[1]} in {r.bestChase[2]}
                </dd>
              </>
            )}
          </dl>
          {r.phases && (
            <table className="sp-cm-rec">
              <caption>A first innings here, on average</caption>
              <thead>
                <tr>
                  <th>Overs</th>
                  <th>Runs</th>
                  <th>Wickets</th>
                </tr>
              </thead>
              <tbody>
                {r.phases.map(([runs, wkts], i) => (
                  <tr key={i}>
                    <th>{PHASES[kind][i]}</th>
                    <td className="sp-num">{runs}</td>
                    <td className="sp-num">{wkts.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      {r.last?.length > 0 && (
        <>
          <p className="sp-cm-rec-h">Last time here</p>
          <ul className="sp-cm-last">
            {r.last.map((x, i) => (
              <li key={i}>
                {lastLine(x)} <span className="sp-muted">· {dayOf(x.date)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
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
  const { data, error } = useLive((signal) => getJson('/api/cricket/week', signal), []);
  const list = (data?.matches ?? []).filter((m) => Date.parse(m.start) > Date.now() && !shown.has(m.id));
  const big = list.filter(bigMatch);
  const rows = (big.length ? big : list).slice(0, 8);
  const others = list.length - rows.length;
  return (
    <section className="sp-section" id="coming-up">
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
                {m.read?.pre && (
                  <small className="sp-cu-odds">
                    Our estimate: {m.teams.map((t, i) => `${t.name} ${pct(m.read.pre[i])}`).join(', ')}
                  </small>
                )}
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

/** How Matchday works out par, projections and chances, and how well it did on matches it hadn't seen. */
function HowItWorks() {
  const t = about.tested['t20-male'];
  const w = about.tested['t20-female'];
  const o = about.tested['odi-male'];
  return (
    <details className="sp-cread">
      <summary>
        <span className="sp-chev" aria-hidden="true">›</span>How Matchday works out par, projections and chances
      </summary>
      <ul>
        <li>
          <b>Par</b> is what a first innings usually makes at that ground in that competition, from Cricsheet’s ball-by-ball records of {about.matches.toLocaleString('en-GB')} matches up to {dayOf(about.through)}. Recent seasons count
          most, and a ground with few matches is pulled towards its competition’s usual score.
        </li>
        <li>
          A <b>projected total</b> is where innings usually end up from the same balls and wickets left, scaled to par. Eight in ten finish inside the range shown.
        </li>
        <li>
          <b>Win chances</b> weigh the score against par, and team ratings built from every result, with home advantage. The ratings count for less as the match goes on.
        </li>
        <li>
          Tested on {about.years[0]} to {about.years[1]} matches it hadn’t seen: after {t.overs} overs of a men’s T20, projected totals were {Math.round(t.projected)} runs out on average, against {Math.round(t.runRate)} for the run
          rate so far ({Math.round(o.projected)} against {Math.round(o.runRate)} after {o.overs} overs of a men’s one-day match). Chasing sides it gave a 70 to 80% chance won {t.chase.won}% of the time. The
          side it favoured before the match won {t.favouriteWon}% of men’s T20s and {w.favouriteWon}% of women’s.
        </li>
        <li>For Tests it gives each ground’s record and how fourth-innings chases of each size have gone. No win chances yet: whether a Test is drawn depends on the time left, which the records don’t hold.</li>
        <li>Cricsheet doesn’t publish Afghanistan men’s matches, so Afghanistan’s men have no rating here, and leagues it doesn’t cover get no projections.</li>
        <li>
          Data from{' '}
          <a className="sp-link" href="https://cricsheet.org" target="_blank" rel="noreferrer">
            Cricsheet
          </a>
          , under the Open Data Commons Attribution License.
        </li>
      </ul>
    </details>
  );
}

/** What's on in cricket now, from ESPN, until the full section is built. */
export default function CricketNow() {
  const { data, error } = useLive((signal) => getJson('/api/cricket/now', signal), [], {
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
        {data && (
          <div id="guide">
            <HowToRead />
            <HowItWorks />
          </div>
        )}
      </section>
      {data && <Upcoming shown={new Set(list.map((m) => m.id))} />}
    </div>
  );
}
