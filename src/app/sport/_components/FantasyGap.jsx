'use client';
import { useLive } from './useLive';
import { Move, signed } from './FantasySeason';

// Why the gap to the rivals around you moved (src/lib/sport/fpl-history.mjs rivalGap,
// /api/sport/fpl/rivals): both teams scored each gameweek as FPL did, the change split into players
// one of you fielded and the other didn't, the armband, and hits, with the players and moves behind it.

async function load(id, league, signal) {
  const res = await fetch(`/api/sport/fpl/rivals/${id}/${league}`, { signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `FPL ${res.status}`);
  return json;
}

const ordinal = (n) => `${n}${n % 100 > 10 && n % 100 < 14 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th'}`;
const b = (v) => <b style={{ color: 'var(--sp-ink)' }}>{v}</b>;
const andList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''));
const neg = ({ players, captaincy, hits }) => ({ players: -players, captaincy: -captaincy, hits: -hits });

/**
 * Where the points came from, told from the side that gained (`side`: 'them' or 'you', with the parts
 * already signed for that side): "33 from players they fielded and you didn't and 5 from their
 * captains", with anything that went the other way after it ("less 3 back to you from your captains").
 */
function partsWords({ players, captaincy, hits }, side) {
  const [we, they] = side === 'them' ? ['they', 'you'] : ['you', 'they'];
  const [our, other] = side === 'them' ? ['their', 'your'] : ['your', 'their'];
  const gains = [];
  if (players > 0) gains.push(<>{b(players)} from players {we} fielded and {they} didn’t</>);
  if (captaincy > 0) gains.push(<>{b(captaincy)} from {our} captains</>);
  if (hits > 0) gains.push(<>{b(hits)} from {other} hits</>);
  const back = [];
  if (players < 0) back.push(<>{b(-players)} back to {they} from players {they} fielded and {we} didn’t</>);
  if (captaincy < 0) back.push(<>{b(-captaincy)} back to {they} from {other} captains</>);
  if (hits < 0) back.push(<>{b(-hits)} back to {they} from {our} hits</>);
  return [
    ...gains.map((x, i) => (
      <span key={`g${i}`}>
        {i ? (i === gains.length - 1 ? ' and ' : ', ') : ''}
        {x}
      </span>
    )),
    ...back.map((x, i) => (
      <span key={`b${i}`}>
        {gains.length || i ? ', less ' : 'less '}
        {x}
      </span>
    )),
  ];
}

/** Players grouped by how they went: "Groß 42, B.Fernandes 28 and Raya 23 (they had them, you didn’t)". */
function playersWords(list) {
  const groups = [];
  for (const p of list) {
    let g = groups.find((x) => x.how === p.how);
    if (!g) groups.push((g = { how: p.how, names: [] }));
    g.names.push(`${p.name} ${p.points}`);
  }
  return groups.map((g) => `${andList(g.names)} (${g.names.length > 1 ? g.how.replace('him', 'them') : g.how})`).join('; ');
}

/** The gap's story in a sentence: since when, who gained how much, and from what. */
function Story({ r, through }) {
  const n = through - r.since + 1;
  const span = r.sinceYouLed ? `Since gameweek ${r.since}, when you ${r.gapBefore < 0 ? `led by ${-r.gapBefore}` : 'were level'}` : n === 1 ? `In gameweek ${r.since}` : `Over the last ${n} gameweeks`;
  const live = r.thisGameweekSoFar?.gained ? ` This gameweek so far they’re ${r.thisGameweekSoFar.gained > 0 ? `${r.thisGameweekSoFar.gained} up` : `${-r.thisGameweekSoFar.gained} down`} on you.` : '';
  const { players, captaincy, hits } = r.parts;
  if (r.gained < 0) return <>{span}, you’ve gained {b(-r.gained)} on them: {partsWords(neg(r.parts), 'you')}.{live}</>;
  if (r.gained > 0) return <>{span}, they’ve gained {b(r.gained)} on you: {partsWords(r.parts, 'them')}.{live}</>;
  return <>{span}, you’ve matched them point for point{players || captaincy || hits ? <>: {partsWords(r.parts, 'them')}</> : ''}.{live}</>;
}

function Rival({ r, through, you, until }) {
  return (
    <div style={{ padding: '12px 0', borderTop: '1px solid var(--sp-rule)' }}>
      <p style={{ margin: 0, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <b style={{ fontSize: 15, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.team}</b>
        <span className="sp-tiny sp-muted" style={{ flex: 'none' }}>
          {ordinal(r.rank)} · {r.gapNow > 0 ? `${r.gapNow} ahead of you` : r.gapNow < 0 ? `${-r.gapNow} behind you` : 'level'} after gameweek {through}
        </span>
      </p>
      <p className="sp-small sp-ink2" style={{ margin: '6px 0 0' }}>
        <Story r={r} through={through} />
      </p>
      {r.forThem.length > 0 && (
        <p className="sp-small sp-ink2" style={{ margin: '6px 0 0' }}>
          {b('Went their way.')} {playersWords(r.forThem.slice(0, 3))}
        </p>
      )}
      {r.forYou.length > 0 && (
        <p className="sp-small sp-ink2" style={{ margin: '4px 0 0' }}>
          {b('Went yours.')} {playersWords(r.forYou.slice(0, 3))}
        </p>
      )}
      {r.captains.length > 0 && (
        <p className="sp-small sp-ink2" style={{ margin: '4px 0 0' }}>
          {b('Captains.')} {r.captains.slice(0, 2).map((c, i) => `${i ? 'gameweek' : 'Gameweek'} ${c.gw}: their ${c.theirs} against your ${c.yours}, ${signed(c.swing)} for them`).join('; ')}
        </p>
      )}
      {r.chipsLeft && you && (
        <p className="sp-small sp-ink2" style={{ margin: '4px 0 0' }}>
          {b(until && until < 38 ? `Chips to play by gameweek ${until}.` : 'Chips left.')} They have {andList(r.chipsLeft) || 'none'}; you have {andList(you) || 'none'}.
        </p>
      )}
      {r.theirBestMoves.length > 0 && (
        <>
          <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0', fontWeight: 700 }}>What they got right</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 0', display: 'grid', gap: 6 }}>{r.theirBestMoves.slice(0, 2).map((m) => <Move key={`${m.gw}-${m.in ?? m.changes}`} m={m} />)}</ul>
        </>
      )}
      {r.yourCostliestMoves.length > 0 && (
        <>
          <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0', fontWeight: 700 }}>What cost you over the same weeks</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 0', display: 'grid', gap: 6 }}>{r.yourCostliestMoves.slice(0, 2).map((m) => <Move key={`${m.gw}-${m.in ?? m.changes}`} m={m} />)}</ul>
        </>
      )}
    </div>
  );
}

export default function LeagueGaps({ entry, league }) {
  const g = useLive((signal) => load(entry.id, league, signal), [entry.id, league], { every: 600000, live: () => false });
  const d = g.data;
  if (!d) return g.error ? null : <div className="sp-skel" style={{ height: 220, margin: '0 16px' }} aria-label="Loading the gaps" />;
  if (!d.rivals?.length) return d.note ? <p className="sp-note sp-pad">{d.note}</p> : null;
  const leading = d.you?.rank === 1;
  return (
    <section className="sp-panel sp-record">
      <div className="sp-section-head">
        <h2 className="sp-h2">{leading ? 'Who’s catching you' : 'Why the gap moved'}</h2>
        <span className="sp-tiny sp-muted">Through gameweek {d.through}</span>
      </div>
      <p className="sp-small sp-ink2" style={{ margin: 0 }}>
        {leading ? 'The two just behind you in the live table, and how the gap to each has moved.' : 'The managers just above you in the live table, and how each has gained on you.'}
      </p>
      {d.rivals.map((r) => <Rival key={r.entry} r={r} through={d.through} you={d.you?.chipsLeft} until={d.chipsUntil} />)}
      <p className="sp-tiny sp-muted" style={{ margin: '4px 0 0' }}>
        Both teams are scored each gameweek exactly as FPL did, so the parts add up to the change in the gap. Ask Matchday AI how to win it back.
      </p>
    </section>
  );
}
