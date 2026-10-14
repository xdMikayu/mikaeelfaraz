'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLive, useAge } from './useLive';
import { ShirtMark } from './glyphs';
import { teamColors, useDark } from './colors';
import { zoneLabel } from './time';
import { situation } from '@/lib/sport/cricket.mjs';
import { oversOf } from '@/lib/sport/cricket-form.mjs';
import { Status, Chances, MatchRead, GroundRecord, pct, series, dayOf } from './CricketNow';
import { Scoreboard, ThisOver, Crease, Bowling, SameStage, Wickets, useKits, settle, inningsDone } from './CricketLive';

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${res.status}`);
  return body;
}

const KIND = { t20: 'T20', odi: 'one-day', test: 'Test', fc: 'first-class' };
const kindOf = (d) => KIND[d.formFormat?.split('-')[0]] ?? '';
const sr = (runs, balls) => (balls ? ((runs / balls) * 100).toFixed(1) : '–');
const econ = (runs, balls) => (balls ? ((runs / balls) * 6).toFixed(2) : '–');
const dm = (iso) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');
const nth = (n) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const times = (n) => (n === 0 ? 'never' : n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const nameOf = (d, id) => d.players[id]?.name ?? 'Unknown';
const shortOf = (d, id) => d.players[id]?.short ?? d.players[id]?.name ?? 'Unknown';
const teamOf = (d, id) => d.teams.find((t) => t.id === id);
// ESPN's short codes for how a batter was out, for when the commentary hasn't reached the wicket yet.
const CARD = { c: 'caught', b: 'bowled', lbw: 'lbw', st: 'stumped', ro: 'run out', 'run out': 'run out', hw: 'hit wicket', 'c&b': 'caught and bowled', rtd: 'retired' };
const outWords = (b) => b.how ?? CARD[String(b.card ?? '').toLowerCase()] ?? b.card ?? 'out';
const marks = (d, id) => `${d.players[id]?.captain ? ' (c)' : ''}${d.players[id]?.keeper ? ' †' : ''}`;

/** One cricket match in full: the score, the scorecard, both XIs with their form, and the analysis. */
export default function CricketMatch() {
  const q = useSearchParams();
  const league = q.get('l');
  const id = q.get('id');
  const { data: d, error, at } = useLive((signal) => (league && id ? getJson(`/api/sport/cricket/match/${league}/${id}`, signal) : Promise.resolve(null)), [league, id], {
    every: 30000,
    live: (x) => x?.state === 'in',
  });
  const dark = useDark();
  const age = useAge(at);
  const [tab, setTab] = useState(null);
  if (!league || !id) return <p className="sp-empty">No match given.</p>;
  if (!d && error) return <p className="sp-empty">Couldn’t load this match from ESPN ({error}). It will try again shortly.</p>;
  if (!d) return <div className="sp-pad"><div className="sp-skel" style={{ height: 420, marginTop: 14, borderRadius: 6 }} /></div>;

  const colors = teamColors(d.teams[0] ?? {}, d.teams[1] ?? {}, dark);
  const live = d.innings.find((inn) => inn.current) && d.state === 'in';
  const sit = settle(d, situation(d.card));
  const tabs = [...(live ? [['live', 'Live']] : []), ...(d.innings.length ? [['card', 'Scorecard']] : []), ['players', 'Players'], ['insights', d.state === 'pre' ? 'Preview' : 'Insights']];
  const current = tabs.find(([k]) => k === tab)?.[0] ?? tabs[0][0];
  return (
    <div className="sp-read">
      <Header d={d} sit={sit} />
      <div className="sp-pad" style={{ marginTop: 10 }}>
        <div className="sp-tabs" role="tablist">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={current === k} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {current === 'live' && <LiveTab d={d} colors={colors} />}
      {current === 'card' && <Scorecard d={d} />}
      {current === 'players' && <Players d={d} />}
      {current === 'insights' && <Insights d={d} colors={colors} />}
      <p className="sp-tiny sp-muted sp-pad" style={{ margin: '16px 0 0' }}>
        {zoneLabel()} · Scores from ESPN, {age}
        {d.formThrough ? ` · Player records from Cricsheet, up to ${dayOf(d.formThrough)}` : ''}
      </p>
    </div>
  );
}

/** The match: the scoreboard in the sides' colours, then the series, the ground and the toss. */
function Header({ d, sit }) {
  const kits = useKits(d);
  const toss = d.toss && !/toss/i.test(d.card.status ?? '') ? `Toss: ${d.toss}` : null;
  return (
    <>
      <div className="sp-pad sp-cmh">
        <Link className="sp-cmh-back" href="/sport/cricket">
          <span aria-hidden="true">‹</span> Cricket
        </Link>
      </div>
      <Scoreboard d={d} sit={sit} kits={kits} />
      <div className="sp-pad">
        <p className="sp-cm-meta" style={{ margin: '8px 0 0' }}>{[series(d.series), d.venue].filter(Boolean).join(' · ')}</p>
        {d.state === 'in' && <Status m={d.card} said />}
        {toss && <p className="sp-tiny sp-muted" style={{ margin: '2px 0 0' }}>{toss}</p>}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ live */

/** Why a player has no record: Cricsheet withholds Afghanistan's men's matches; otherwise none yet. */
const noRecord = (d, id, what) =>
  !d.card.women && teamOf(d, d.players[id]?.team)?.name === 'Afghanistan' ? 'Cricsheet doesn’t publish Afghanistan men’s matches, so there’s no record for him here.' : `No record in Cricsheet’s ${what} matches yet.`;

/** A batter's or bowler's form in one or two lines, from Cricsheet. */
function FormLine({ f, kind, what, missing }) {
  if (!f) return <p className="sp-cm-form">{missing ?? `No record in Cricsheet’s ${what} matches yet.`}</p>;
  if (kind === 'bat') {
    const y = f.year;
    return (
      <p className="sp-cm-form">
        Last {f.recent.length} {what} innings: <b className="sp-num">{f.recent.map((r) => `${r.runs}${r.out ? '' : '*'}`).join(', ')}</b>
        {y ? `. Last 12 months: ${y.runs} runs in ${y.inns} innings${y.avg != null ? `, average ${y.avg}` : ''}, strike rate ${y.sr}.` : '. Nothing in the last 12 months.'}
      </p>
    );
  }
  const y = f.year;
  return (
    <p className="sp-cm-form">
      Last {f.recent.length} {what} spells: <b className="sp-num">{f.recent.map((r) => `${r.wickets}/${r.runs}`).join(', ')}</b>
      {y ? `. Last 12 months: ${count(y.wickets, 'wicket')}${y.avg != null ? ` at ${y.avg}` : ''}, economy ${y.econ}.` : '. Nothing in the last 12 months.'}
    </p>
  );
}

function LiveTab({ d, colors }) {
  const inn = d.innings.find((x) => x.current);
  const what = kindOf(d);
  const kits = useKits(d);
  const bowler = inn.bowling.find((b) => b.now === 'bowling');
  const quota = inn.ballLimit ? Math.ceil(inn.ballLimit / 30) * 6 : null;
  const limited = d.innings.filter((x) => x.ballLimit && x.byOver?.length);
  // Form, records and match-ups wait behind a tap on each card, so the live picture stays short.
  const details = (id, kind) => {
    const vs = kind === 'bat' && bowler ? d.matchups.find((x) => x.batter === id && x.bowler === bowler.id) : null;
    const others = kind === 'bat' ? d.matchups.filter((x) => x.batter === id && x.bowler !== bowler?.id).slice(0, 4) : [];
    const style = kind === 'bat' ? d.players[id]?.batStyle : d.players[id]?.bowlStyle;
    return (
      <details className="sp-ccard-more">
        <summary>
          <span className="sp-chev" aria-hidden="true">›</span>Form{kind === 'bat' && (vs || others.length) ? ' and match-ups' : ''}
        </summary>
        {style && <p className="sp-cm-form">{style}</p>}
        <FormLine f={d.form[id]?.[kind]} kind={kind} what={what} missing={noRecord(d, id, what)} />
        {vs && (
          <p className="sp-cm-form">
            Against {shortOf(d, bowler.id)}: <b>{vs.runs} off {vs.balls}</b>, out {times(vs.outs)}, in the last five years.
          </p>
        )}
        {others.length > 0 && (
          <p className="sp-cm-form">
            Against the rest of this attack:{' '}
            {others.map((x, i) => (
              <span key={x.bowler}>
                {i > 0 && '; '}
                {shortOf(d, x.bowler)} <b>{x.runs} off {x.balls}</b>, out {times(x.outs)}
              </span>
            ))}
            .
          </p>
        )}
      </details>
    );
  };
  return (
    <div className="sp-pad">
      <ThisOver d={d} inn={inn} kits={kits} />
      <Crease d={d} inn={inn} kits={kits} details={details} />
      <Bowling d={d} inn={inn} kits={kits} details={details} />
      {d.read && (
        <section className="sp-section">
          <h2 className="sp-h2">Who’s winning</h2>
          <MatchRead m={d.card} read={d.read} said />
          <SameStage d={d} inn={inn} />
        </section>
      )}
      {limited.length > 0 && <RunsChart d={d} innings={limited} colors={colors} />}
      <Wickets d={d} inn={inn} />
      {quota && !inningsDone(inn) && (
        <p className="sp-small sp-ink2" style={{ margin: '14px 0 0' }}>
          <b style={{ color: 'var(--sp-ink)' }}>Overs left</b> (each bowler can bowl {quota / 6}):{' '}
          {inn.bowling
            .map((b) => `${shortOf(d, b.id)} ${oversOf(b.left ?? 0)}`)
            .join(', ')}
          .
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ scorecard */

function Scorecard({ d }) {
  const list = d.innings;
  const kits = useKits(d);
  return (
    <div className="sp-pad">
      {list.map((inn, i) => (
        // Each innings carries its side's colour: a band down the edge of its heading, and its fifties.
        <details key={inn.number} className="sp-sc" open={i === list.length - 1} style={{ '--kit': kits[inn.team]?.line ?? 'var(--sp-ink)' }}>
          <summary>
            <span>
              <span className="sp-chev" aria-hidden="true">›</span>
              {teamOf(d, inn.team)?.name} <small>{nth(list.filter((x, j) => j <= i && x.team === inn.team).length)} innings</small>
            </span>
            <b className="sp-num">
              {inn.runs}
              {inn.wickets < 10 ? `/${inn.wickets}` : ''}
              {inn.declared ? 'd' : ''} <small>({inn.overs} ov)</small>
            </b>
          </summary>
          <Innings d={d} inn={inn} />
        </details>
      ))}
    </div>
  );
}

function Innings({ d, inn }) {
  const x = inn.extras;
  const parts = [x.byes && `b ${x.byes}`, x.legByes && `lb ${x.legByes}`, x.wides && `w ${x.wides}`, x.noBalls && `nb ${x.noBalls}`, x.penalties && `p ${x.penalties}`].filter(Boolean);
  const rate = inn.balls ? ((inn.runs / inn.balls) * 6).toFixed(2) : null;
  return (
    <>
      <table className="sp-sct">
        <thead>
          <tr>
            <th>Batter</th>
            <th>R</th>
            <th>B</th>
            <th>4s</th>
            <th>6s</th>
            <th>SR</th>
          </tr>
        </thead>
        <tbody>
          {inn.batting.map((b) => (
            <tr key={b.id} className={b.out ? '' : 'sp-sct-in'}>
              <th>
                {nameOf(d, b.id)}
                {marks(d, b.id)}
                <small>{b.out ? outWords(b) : b.now === 'striker' ? 'not out, on strike' : 'not out'}</small>
              </th>
              <td>
                <b className={b.runs >= 50 ? 'sp-sct-fifty' : undefined}>
                  {b.runs}
                  {b.out ? '' : '*'}
                </b>
              </td>
              <td>{b.balls}</td>
              <td>{b.fours}</td>
              <td>{b.sixes}</td>
              <td>{sr(b.runs, b.balls)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sp-sc-line">
        Extras <b>{x.total}</b>
        {parts.length ? ` (${parts.join(', ')})` : ''}
        {' · '}Total{' '}
        <b>
          {inn.runs}
          {inn.wickets < 10 ? `/${inn.wickets}` : ' all out'}
        </b>{' '}
        ({inn.overs} overs{rate ? `, ${rate} an over` : ''})
      </p>
      {inn.yetToBat.length > 0 && (
        <p className="sp-sc-line">
          {inn.current ? 'Yet to bat' : 'Did not bat'}: {inn.yetToBat.map((id) => `${nameOf(d, id)}${marks(d, id)}`).join(', ')}
        </p>
      )}
      {inn.fow.length > 0 && (
        <p className="sp-sc-line">
          Fall of wickets: {inn.fow.map((f) => `${f.runs}/${f.n} (${f.id ? shortOf(d, f.id) : '?'}, ${oversOf(f.balls)} ov)`).join(', ')}
        </p>
      )}
      <table className="sp-sct">
        <thead>
          <tr>
            <th>Bowler</th>
            <th>O</th>
            <th>M</th>
            <th>R</th>
            <th>W</th>
            <th>Econ</th>
            {inn.ballLimit && inn.current ? <th>Left</th> : <th>Dots</th>}
          </tr>
        </thead>
        <tbody>
          {inn.bowling.map((b) => (
            <tr key={b.id} className={b.now === 'bowling' ? 'sp-sct-in' : ''}>
              <th>
                {nameOf(d, b.id)}
                {b.now === 'bowling' && <small>bowling</small>}
                {(b.wides > 0 || b.noballs > 0) && <small>{[b.wides && `${b.wides} wd`, b.noballs && `${b.noballs} nb`].filter(Boolean).join(', ')}</small>}
              </th>
              <td>{oversOf(b.balls)}</td>
              <td>{b.maidens}</td>
              <td>{b.runs}</td>
              <td>
                <b>{b.wickets}</b>
              </td>
              <td>{econ(b.runs, b.balls)}</td>
              <td>{inn.ballLimit && inn.current ? oversOf(b.left ?? 0) : (b.dots ?? '–')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {inn.partnerships.length > 0 && (
        <details className="sp-sc-more">
          <summary>
            <span className="sp-chev" aria-hidden="true">›</span>Partnerships
          </summary>
          <ul>
            {inn.partnerships.map((p) => (
              <li key={p.n}>
                {nth(p.n)} wicket: <b className="sp-num">{p.runs}</b> off {p.balls}
                {p.batters?.length > 0 && <small>{p.batters.map((x) => `${shortOf(d, x.id)} ${x.runs} (${x.balls})`).join(', ')}</small>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ players */

function Players({ d }) {
  const what = kindOf(d);
  // Batting order where they've batted, then the rest as ESPN lists them.
  const order = (team) => {
    const ids = Object.keys(d.players).filter((id) => d.players[id].team === team);
    const pos = (id) => Math.min(...d.innings.filter((inn) => inn.team === team).map((inn) => inn.batting.find((b) => b.id === id)?.pos ?? 99), 99);
    return ids.sort((a, b) => pos(a) - pos(b));
  };
  if (!Object.keys(d.players).length) return <p className="sp-note sp-pad">The teams aren’t out yet. They usually come at the toss.</p>;
  return (
    <div className="sp-pad">
      <p className="sp-small sp-ink2" style={{ margin: '12px 0 0' }}>
        Each player’s record in {what} cricket from Cricsheet’s ball-by-ball archive: internationals and leagues together, as form is form. Open a player for his last ten innings and how he goes in each phase.
      </p>
      {d.teams.map((t) => (
        <section key={t.id} className="sp-section">
          <h2 className="sp-h2">
            <ShirtMark color={t.color} size={20} /> {t.name}
          </h2>
          <ul className="sp-xi">
            {order(t.id).map((id) => (
              <PlayerRow key={id} d={d} id={id} what={what} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const PHASE = { T20: ['overs 1–6', 'overs 7–15', 'overs 16–20'], 'one-day': ['overs 1–10', 'overs 11–40', 'overs 41–50'] };
const PHASE_OVERS = { T20: [6, 9, 5], 'one-day': [10, 30, 10] };

function PlayerRow({ d, id, what }) {
  const p = d.players[id];
  const f = d.form[id];
  const bat = f?.bat;
  const bowl = f?.bowl;
  const role = [p.role, p.batStyle, p.bowlStyle].filter(Boolean).join(' · ');
  const brief = [bat?.all && `${bat.all.runs} runs at ${bat.all.avg ?? '–'}`, bowl?.all?.wickets ? `${count(bowl.all.wickets, 'wicket')} at ${bowl.all.avg ?? '–'}` : null].filter(Boolean).join(' · ');
  return (
    <li>
      <details>
        <summary>
          <span className="sp-xi-name">
            <span className="sp-chev" aria-hidden="true">›</span>
            {p.name}
            {marks(d, id)}
            <small>{role}</small>
          </span>
          <span className="sp-xi-brief sp-num">{brief || 'No record yet'}</span>
        </summary>
        <div className="sp-xi-more">
          {bat && (
            <>
              <h3 className="sp-h3">Batting in {what} cricket</h3>
              <dl className="sp-xi-dl">
                <dt>All in the record</dt>
                <dd>
                  {bat.all.runs} runs in {bat.all.inns} innings, average {bat.all.avg ?? '–'}, strike rate {bat.all.sr ?? '–'}, best {bat.all.best}
                  {bat.all.hundreds ? `, ${count(bat.all.hundreds, 'hundred')}` : ''}
                  {bat.all.fifties ? `, ${count(bat.all.fifties, 'fifty', 'fifties')}` : ''}
                </dd>
                <dt>Last 12 months</dt>
                <dd>{bat.year ? `${bat.year.runs} runs in ${bat.year.inns} innings, average ${bat.year.avg ?? '–'}, strike rate ${bat.year.sr ?? '–'}` : 'No innings'}</dd>
                {bat.phases && PHASE[what] && (
                  <>
                    <dt>Strike rate by phase</dt>
                    <dd>
                      {bat.phases
                        .map((ph, i) => (ph ? `${ph.sr} in ${PHASE[what][i]}` : null))
                        .filter(Boolean)
                        .join(', ')}{' '}
                      (last three years)
                    </dd>
                  </>
                )}
              </dl>
              <ul className="sp-xi-recent">
                {bat.recent.map((r, i) => (
                  <li key={i}>
                    <b className="sp-num">
                      {r.runs}
                      {r.out ? '' : '*'}
                    </b>{' '}
                    <small>
                      ({r.balls}) v {r.opp}, {dm(r.date)}
                    </small>
                  </li>
                ))}
              </ul>
            </>
          )}
          {bowl && (
            <>
              <h3 className="sp-h3">Bowling in {what} cricket</h3>
              <dl className="sp-xi-dl">
                <dt>All in the record</dt>
                <dd>
                  {count(bowl.all.wickets, 'wicket')} in {bowl.all.inns} innings, average {bowl.all.avg ?? '–'}, economy {bowl.all.econ ?? '–'}, best {bowl.all.best}
                  {bowl.all.dots != null ? `, ${bowl.all.dots}% dot balls` : ''}
                </dd>
                <dt>Last 12 months</dt>
                <dd>{bowl.year ? `${count(bowl.year.wickets, 'wicket')} in ${bowl.year.inns} innings, average ${bowl.year.avg ?? '–'}, economy ${bowl.year.econ ?? '–'}` : 'No innings'}</dd>
                {bowl.phases && PHASE[what] && (
                  <>
                    <dt>Economy by phase</dt>
                    <dd>
                      {bowl.phases
                        .map((ph, i) => (ph ? `${ph.econ} in ${PHASE[what][i]}` : null))
                        .filter(Boolean)
                        .join(', ')}{' '}
                      (last three years)
                    </dd>
                  </>
                )}
              </dl>
              <ul className="sp-xi-recent">
                {bowl.recent.map((r, i) => (
                  <li key={i}>
                    <b className="sp-num">
                      {r.wickets}/{r.runs}
                    </b>{' '}
                    <small>
                      ({r.overs} ov) v {r.opp}, {dm(r.date)}
                    </small>
                  </li>
                ))}
              </ul>
            </>
          )}
          {!bat && !bowl && <p className="sp-cm-form">{noRecord(d, id, what).replace('yet.', 'in the last three years.')}</p>}
        </div>
      </details>
    </li>
  );
}

/* ------------------------------------------------------------------ insights */

function Insights({ d, colors }) {
  const oneDay = d.innings.slice(0, 2).filter((inn) => inn.byOver?.length && inn.ballLimit);
  return (
    <div className="sp-pad">
      {d.state === 'pre' && d.read && <MatchRead m={d.card} read={d.read} />}
      {d.read?.byOver?.length > 2 && <ChanceChart d={d} colors={colors} />}
      {oneDay.length > 0 && <RunsChart d={d} innings={oneDay} colors={colors} />}
      {oneDay.some((inn) => inn.phases) && <PhaseTable d={d} innings={oneDay} />}
      {d.headToHead?.length > 0 && <HeadToHead d={d} />}
      {d.read?.record && (
        <section className="sp-section">
          <h2 className="sp-h2">The ground</h2>
          <GroundRecord m={d.card} read={d.read} />
        </section>
      )}
      {!d.read && <p className="sp-note">No analysis for this match: the model only covers Tests, one-day and T20 matches in competitions Cricsheet records.</p>}
    </div>
  );
}

/** Each side's chance after every over, as the model gave it at the time. */
function ChanceChart({ d, colors }) {
  const pts = d.read.byOver;
  const [hover, setHover] = useState(null);
  const W = 320;
  const H = 120;
  const x = (i) => (i / (pts.length - 1)) * W;
  const y = (p) => H - p * H;
  const line = (k) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.chances[k]).toFixed(1)}`).join('');
  const brk = pts.findIndex((p) => p.inn === 2);
  const lastP = pts[pts.length - 1];
  const [a, b] = d.teams;
  const h = hover != null ? pts[hover] : null;
  const label = (p) => (p.over === 0 ? (p.inn === 1 ? 'Before a ball' : 'Start of the chase') : `${nth(p.over)} over of the ${p.inn === 1 ? 'first' : 'second'} innings`);
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(pts.length - 1, Math.round(((e.clientX - r.left) / r.width) * (pts.length - 1)))));
  };
  return (
    <section className="sp-section">
      <div className="sp-section-head">
        <h2 className="sp-h2">Chances over the match</h2>
        <span className="sp-tiny sp-muted">Our estimate</span>
      </div>
      <div className="sp-cht" onPointerMove={move} onPointerLeave={() => setHover(null)}>
        <svg className="sp-wp" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${a.name} ${pct(lastP.chances[0])}, ${b.name} ${pct(lastP.chances[1])} ${d.state === 'post' ? 'at the end' : 'now'}`}>
          <path d={`M0 ${y(0.5)}H${W}`} stroke="var(--sp-rule-2)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          {brk > 0 && <path d={`M${x(brk)} 0V${H}`} stroke="var(--sp-rule)" vectorEffect="non-scaling-stroke" />}
          <path d={line(0)} fill="none" stroke={colors.home} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path d={line(1)} fill="none" stroke={colors.away} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {h && <path d={`M${x(hover)} 0V${H}`} stroke="var(--sp-ink-2)" vectorEffect="non-scaling-stroke" />}
        </svg>
        {h && (
          <div className="sp-cht-tip" style={{ left: `${Math.min(80, Math.max(20, (hover / (pts.length - 1)) * 100))}%` }}>
            <b>{label(h)}</b>
            <span>
              {a.short || a.name} {pct(h.chances[0])} · {b.short || b.name} {pct(h.chances[1])}
            </span>
          </div>
        )}
      </div>
      <div className="sp-wp-axis sp-tiny sp-muted">
        <span>Start</span>
        {brk > 0 && <span>Innings break</span>}
        <span>{d.state === 'post' ? 'End' : 'Now'}</span>
      </div>
      <p className="sp-tiny sp-ink2" style={{ margin: '6px 0 0' }}>
        <b style={{ color: colors.home }}>■</b> {a.name} {pct(lastP.chances[0])} · <b style={{ color: colors.away }}>■</b> {b.name} {pct(lastP.chances[1])}
        {d.state === 'post' ? ' at the end' : ' now'}. Each point is the chance after that over, from the score against par here and the team ratings; dashed is 50%.
      </p>
    </section>
  );
}

/** Runs in each over, or the running total, for both innings. */
function RunsChart({ d, innings, colors }) {
  const [view, setView] = useState('each');
  const [hover, setHover] = useState(null);
  const N = Math.max(...innings.map((inn) => inn.ballLimit / 6));
  const W = 320;
  const H = 130;
  const colorOf = (inn) => (inn.team === d.teams[0]?.id ? colors.home : colors.away);
  const each = view === 'each';
  const top = each ? Math.max(12, ...innings.flatMap((inn) => inn.byOver.map((o) => o.runs))) : Math.max(...innings.map((inn) => Math.max(inn.runs, inn.target ?? 0)), 50);
  const y = (v) => H - (v / top) * (H - 6);
  const slot = W / N;
  const bw = Math.max(1.5, (slot - 2) / innings.length - (innings.length > 1 ? 1 : 0));
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(1, Math.min(N, Math.ceil(((e.clientX - r.left) / r.width) * N))));
  };
  const target = innings[1]?.target ?? (innings.length > 1 ? innings[0].runs + 1 : null);
  return (
    <section className="sp-section">
      <div className="sp-section-head">
        <h2 className="sp-h2">Runs</h2>
        <div className="sp-tabs sp-tabs-small" role="tablist">
          <button role="tab" aria-selected={each} onClick={() => setView('each')}>
            Each over
          </button>
          <button role="tab" aria-selected={!each} onClick={() => setView('total')}>
            Running total
          </button>
        </div>
      </div>
      <div className="sp-cht" onPointerMove={move} onPointerLeave={() => setHover(null)}>
        <svg className="sp-runs" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={innings.map((inn) => `${teamOf(d, inn.team)?.name} ${inn.runs}/${inn.wickets}`).join(', ')}>
          <path d={`M0 ${H - 0.5}H${W}`} stroke="var(--sp-rule-2)" vectorEffect="non-scaling-stroke" />
          {each
            ? innings.map((inn, k) =>
                inn.byOver.map((o) => {
                  const x0 = (o.n - 1) * slot + 1 + k * (bw + 1);
                  return (
                    <g key={`${k}-${o.n}`}>
                      <rect x={x0} y={y(o.runs)} width={bw} height={H - y(o.runs)} fill={colorOf(inn)} />
                      {o.wickets > 0 && <circle cx={x0 + bw / 2} cy={y(o.runs) - 4} r="2.5" fill="var(--sp-loss)" stroke="var(--sp-page)" strokeWidth="1" />}
                    </g>
                  );
                }),
              )
            : innings.map((inn, k) => (
                <g key={k}>
                  <path d={`M0 ${H}` + inn.byOver.map((o) => `L${(o.n * slot).toFixed(1)} ${y(o.total).toFixed(1)}`).join('')} fill="none" stroke={colorOf(inn)} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  {inn.byOver
                    .filter((o) => o.wickets > 0)
                    .map((o) => (
                      <circle key={o.n} cx={o.n * slot} cy={y(o.total)} r="2.5" fill="var(--sp-loss)" stroke="var(--sp-page)" strokeWidth="1" />
                    ))}
                </g>
              ))}
          {!each && target && <path d={`M0 ${y(target)}H${W}`} stroke="var(--sp-ink-2)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
          {hover && <path d={`M${(hover - 0.5) * slot} 0V${H}`} stroke="var(--sp-rule)" vectorEffect="non-scaling-stroke" />}
        </svg>
        {hover && (
          <div className="sp-cht-tip" style={{ left: `${Math.min(80, Math.max(20, ((hover - 0.5) / N) * 100))}%` }}>
            <b>{nth(hover)} over</b>
            {innings.map((inn) => {
              const o = inn.byOver.find((x) => x.n === hover);
              return (
                <span key={inn.number}>
                  {teamOf(d, inn.team)?.short || teamOf(d, inn.team)?.name}: {o ? `${o.runs} (${o.total}/${o.down})${o.wickets ? `, ${count(o.wickets, 'wicket')}` : ''}` : '–'}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div className="sp-wp-axis sp-tiny sp-muted">
        <span>Over 1</span>
        <span>{Math.round(N / 2)}</span>
        <span>{N}</span>
      </div>
      <p className="sp-tiny sp-ink2" style={{ margin: '6px 0 0' }}>
        {innings.map((inn, i) => (
          <span key={inn.number}>
            {i > 0 && ' · '}
            <b style={{ color: colorOf(inn) }}>■</b> {teamOf(d, inn.team)?.name} {inn.wickets >= 10 ? `${inn.runs} all out` : `${inn.runs}/${inn.wickets}`}
          </span>
        ))}
        . Red dots mark wickets{!each && target ? `; dashed is the target, ${target}` : ''}. The highest {each ? 'over' : 'total'} reaches the top: {top} runs.
      </p>
    </section>
  );
}

/** The batters and bowlers in this match who have met most before, and how it went. */
function HeadToHead({ d }) {
  return (
    <section className="sp-section">
      <div className="sp-section-head">
        <h2 className="sp-h2">Head to head</h2>
        <span className="sp-tiny sp-muted">Last five years</span>
      </div>
      <table className="sp-sct">
        <thead>
          <tr>
            <th>Batter v bowler</th>
            <th>Runs</th>
            <th>Balls</th>
            <th>Out</th>
            <th>SR</th>
          </tr>
        </thead>
        <tbody>
          {d.headToHead.map((x) => (
            <tr key={`${x.batter}|${x.bowler}`}>
              <th>
                {shortOf(d, x.batter)}
                <small>v {shortOf(d, x.bowler)}</small>
              </th>
              <td>
                <b>{x.runs}</b>
              </td>
              <td>{x.balls}</td>
              <td>{x.outs}</td>
              <td>{x.sr}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sp-tiny sp-muted" style={{ margin: '6px 0 0' }}>
        Every {kindOf(d)} match in Cricsheet’s record up to {dayOf(d.formThrough)}, internationals and leagues together; pairs that have met for at least six balls.
      </p>
    </section>
  );
}

/** Each phase of the innings against how a first innings usually goes at this ground. */
function PhaseTable({ d, innings }) {
  const what = kindOf(d);
  const usual = d.read?.record?.phases;
  const rows = PHASE[what];
  if (!rows) return null;
  return (
    <section className="sp-section">
      <h2 className="sp-h2">Phase by phase</h2>
      <table className="sp-sct sp-phase">
        <thead>
          <tr>
            <th>Overs</th>
            {innings.map((inn) => (
              <th key={inn.number}>{teamOf(d, inn.team)?.short || teamOf(d, inn.team)?.name}</th>
            ))}
            {usual && <th>Usual here</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((label, i) => (
            <tr key={label}>
              <th>{label.replace('overs ', '')}</th>
              {innings.map((inn) => {
                const p = inn.phases?.[i];
                const full = PHASE_OVERS[what]?.[i];
                const going = d.state === 'in' && inn.current && inn.wickets < 10 && p?.overs && p.overs < full;
                return (
                  <td key={inn.number}>
                    {p?.overs ? `${p.runs}/${p.wickets}` : '–'}
                    {going && <small> after {count(p.overs, 'over')}</small>}
                  </td>
                );
              })}
              {usual && <td>{usual[i] ? `${usual[i][0]}/${usual[i][1]}` : '–'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {usual && <p className="sp-tiny sp-muted" style={{ margin: '6px 0 0' }}>Runs/wickets in each phase. “Usual here” is the average first innings at this ground, wickets to one decimal place.</p>}
    </section>
  );
}
