'use client';
import { useLive, useAge } from './useLive';
import CricketNow from './CricketNow';

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${res.status}`);
  return body;
}

// ESPN marks a tournament's days with US Eastern midnights; read in that zone they're its calendar dates.
const ET = { timeZone: 'America/New_York', day: 'numeric', month: 'short' };
function tourDates(t) {
  const a = new Date(t.start);
  const b = new Date(t.end);
  try {
    return new Intl.DateTimeFormat(undefined, ET).formatRange(a, b);
  } catch {
    return `${a.toLocaleDateString(undefined, ET)} – ${b.toLocaleDateString(undefined, ET)}`;
  }
}

/** "Women's Singles" → "women's", to tell the draws apart at a joint event. */
const drawWord = (draw) => draw.replace(/\s*singles\s*/i, '').toLowerCase();
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function Tournament({ t }) {
  const joint = t.tours.length > 1;
  const top = t.top?.players.length === 2 ? t.top : null;
  const round = top?.round ? `${joint ? `${drawWord(top.draw)} ` : ''}${top.round.toLowerCase()}` : null;
  return (
    <li className="sp-event">
      <div className="sp-event-top">
        <b>{t.name}</b>
        <span className="sp-tiny sp-muted">{t.tours.join(' · ')}</span>
      </div>
      <p className="sp-muted">{[t.venue, tourDates(t), t.major && 'Grand Slam'].filter(Boolean).join(' · ')}</p>
      {t.live > 0 && (
        <p>
          <span className="sp-live-text">On now:</span>{' '}
          {top
            ? `${top.players.join(' v ')}${round ? `, ${round}` : ''}${t.live > 1 ? `, and ${t.live - 1} more` : ''}`
            : `${t.live} singles ${t.live === 1 ? 'match' : 'matches'}`}
        </p>
      )}
      {!t.live && t.stage && <p className="sp-ink2">Next: {t.stage}</p>}
      {t.champions.map((c) => (
        <p key={c.draw} className="sp-ink2">
          {joint ? `${capital(drawWord(c.draw))} singles won by ` : 'Won by '}
          <b>{c.name}</b>
        </p>
      ))}
    </li>
  );
}

function TennisNow() {
  const { data, error } = useLive((signal) => getJson('/api/sport/tennis/now', signal), [], { every: 60000, live: (d) => d?.tournaments.some((t) => t.live) });
  const age = useAge(data ? Date.parse(data.at) : null);
  const list = data?.tournaments ?? [];
  const rest = list.slice(6);
  return (
    <section className="sp-pad sp-section">
      <h2 className="sp-h2">On the tours this week</h2>
      {!data && !error && <div className="sp-skel" style={{ height: 300, marginTop: 10, borderRadius: 6 }} />}
      {!data && error && <p className="sp-note">Couldn’t reach ESPN just now. Try again in a minute.</p>}
      {data && !list.length && <p className="sp-note">No ATP or WTA tournaments this week.</p>}
      {list.length > 0 && (
        <ul className="sp-events">
          {list.slice(0, 6).map((t) => (
            <Tournament key={t.id} t={t} />
          ))}
        </ul>
      )}
      {rest.length > 0 && <p className="sp-small sp-ink2" style={{ margin: '8px 0 0' }}>Also this week: {rest.map((t) => t.name).join(', ')}.</p>}
      {data && <p className="sp-tiny sp-muted" style={{ margin: '6px 0 0' }}>From ESPN · {age}</p>}
    </section>
  );
}

const PAGES = {
  cricket: {
    title: 'Cricket',
    status: 'Being built',
    intro: 'Live scores with the sums done for you: par at the ground, where an innings is heading and each side’s chance, learned from over 23,000 past matches.',
    Now: CricketNow,
    plan: [
      'Live scores ball by ball: Tests, ODIs and T20 internationals, the IPL, the Big Bash, The Hundred and the rest.',
      'Full scorecards: every batter and bowler, the fall of wickets and the partnerships.',
      'Win chances for Tests, which need the time left in the match as well as the score.',
      'Teams and players to follow, with an alert when their match starts.',
      'Matchday AI for fantasy cricket: your XI, captain and vice-captain. There’s no fantasy API like FPL’s, so you’d enter your team.',
    ],
    data: 'Scores come from ESPN, the same free source as the football. It also carries full scorecards, ball by ball and tables, which the full section will use. Par, projected totals, win chances and each ground’s record come from Cricsheet’s free ball-by-ball record of over 23,000 matches. There’s no open feed from the ICC or the national boards.',
  },
  tennis: {
    title: 'Tennis',
    intro: 'Scores, draws and rankings for the ATP and WTA tours are being built. Meanwhile, here’s what’s on this week.',
    Now: TennisNow,
    plan: [
      'Live scores, point by point, for the ATP and WTA tours and the Grand Slams.',
      'Draws you can follow round by round, and the rankings.',
      'Each match’s chances from both players’ serve and return numbers, updated as it’s played.',
      'Players to follow the way you follow teams, with an alert when their match starts.',
      'Matchday AI previews of the big matches: form, surface and head-to-head, with an honest pick.',
    ],
    data: 'Scores come from ESPN, the same source as the football.',
  },
  wrestling: {
    title: 'Wrestling',
    intro: 'Match cards, results and a pick’em for your group are planned. This one needs a data source first.',
    plan: [
      'Match cards for WWE and AEW shows, in your time zone.',
      'Results as they come in, and who holds each title.',
      'A pick’em for your group: call the winners before each show, with a table for the year.',
      'Matchday AI makes its own picks, so there’s something to beat.',
    ],
    data: 'WWE and AEW don’t publish a free results feed, so this section needs a source first: a licensed feed, or cards entered by hand. That puts it further off than tennis and F1.',
  },
};

/** A sport that isn't built yet: what it will do, where its data will come from, and what's on now where we can show it. */
export default function ComingSoon({ sport }) {
  const p = PAGES[sport];
  const Now = p.Now;
  return (
    <div className="sp-read">
      <div className="sp-pad" style={{ paddingTop: 14 }}>
        {/* The header already names the sport; the page opens on where it stands. */}
        <h1 className="sp-sr">{p.title}</h1>
        <p className="sp-prose sp-small" style={{ margin: 0 }}>
          <b style={{ color: 'var(--sp-ink)' }}>{p.status ?? 'Coming soon'}.</b> {p.intro}
        </p>
      </div>
      {Now && <Now />}
      {p.status ? (
        // Where the section already shows plenty, its plans wait behind a tap.
        <details className="sp-pad sp-section sp-about">
          <summary>
            <span className="sp-chev" aria-hidden="true">›</span>What’s still to come, and where the data comes from
          </summary>
          <Plan p={p} />
        </details>
      ) : (
        <Plan p={p} />
      )}
    </div>
  );
}

function Plan({ p }) {
  return (
    <>
      <section className="sp-pad sp-section">
        <h2 className="sp-h2" style={{ marginBottom: 8 }}>What it will do</h2>
        <ul className="sp-plan">
          {p.plan.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
      <section className="sp-pad sp-section">
        <h2 className="sp-h2" style={{ marginBottom: 6 }}>The data</h2>
        <p className="sp-prose sp-small" style={{ margin: 0 }}>{p.data}</p>
      </section>
    </>
  );
}
