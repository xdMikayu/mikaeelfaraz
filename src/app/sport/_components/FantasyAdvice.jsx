'use client';
import { useState } from 'react';
import { POS } from '@/lib/sport/fpl.mjs';
import { estimateFree } from '@/lib/sport/optimise.mjs';
import { Face, one } from './fplbits';

const CHIP = { none: 'No chip', wildcard: 'Wildcard', freehit: 'Free Hit', bboost: 'Bench Boost', '3xc': 'Triple Captain' };
const NEWS = { out: 'out', doubtful: 'doubtful', back_in_training: 'back in training', fit: 'fit', unknown: 'no clear update' };
const fmt = (t, o = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) => new Date(t).toLocaleString(undefined, o);
const dayOf = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
};
const until = (t) => {
  const h = (t - Date.now()) / 36e5;
  return h > 36 ? `in ${Math.round(h / 24)} days` : h > 1 ? `in ${Math.round(h)} hours` : 'within the hour';
};

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { code: body.code });
  return body;
}
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7).toString(36);
const ordinal = (n) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** The numbers behind the verdict, as we computed them (not Claude): one line. */
function factLine(f) {
  if (!f) return [];
  return [
    f.shareOfBest != null && `${f.shareOfBest}% of the best squad your budget buys over five gameweeks`,
    f.league && `${ordinal(f.league.projectedRank)} of ${f.league.managers} in ${f.league.name} by projection this week (${ordinal(f.league.tableRank)} in the table)`,
    f.benchCost - f.cheapestBench >= 2 && `£${f.benchCost.toFixed(1)}m on the bench`,
    f.bank >= 1.5 && `£${f.bank.toFixed(1)}m unspent`,
    f.season?.hitPoints > 0 && `−${f.season.hitPoints} in hits this season`,
    f.season && `${f.season.benchPoints} points left on the bench`,
    f.season && `above the average in ${f.season.beatAverage} of ${f.season.gameweeks} gameweeks`,
  ].filter(Boolean);
}

/** A 30-minute calendar entry for a press conference, with a reminder ten minutes before. */
function addToCalendar(w, club, who) {
  const z = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s) => s.replace(/([,;\\])/g, '\\$1');
  const title = esc(`${club} press conference (FPL: ${who})`);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Matchday//FPL//EN', 'BEGIN:VEVENT', `UID:${w.at}-${w.team}@matchday`, `DTSTAMP:${z(Date.now())}`, `DTSTART:${z(w.at)}`, `DTEND:${z(w.at + 30 * 6e4)}`, `SUMMARY:${title}`];
  if (w.source) lines.push(`URL:${w.source}`);
  lines.push('BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  a.download = `${club.toLowerCase().replace(/\W+/g, '-')}-press-conference.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/**
 * One button: Claude reads your squad, free transfers, bank and chips next to our projections, the
 * transfer planner's options and this week's club news (press conferences included), then says what
 * to do before the deadline, when, and why. Three steps, so each server call stays short:
 * which clubs matter, their news, then Claude. Checked against the rules on the server.
 */
export default function Advice({ entry, gw, els, teams, league }) {
  const estimate = estimateFree(entry.history ?? [], entry.chips ?? [], gw - 1);
  const [free, setFree] = useState(estimate);
  const [run, setRun] = useState({ stage: 'idle' });
  const name = (id) => els[id]?.name ?? String(id);
  const club = (team) => teams[team]?.name ?? '';

  const ask = async () => {
    const base = `/api/sport/advice?id=${entry.id}&ft=${free}`;
    try {
      setRun({ stage: 'prep' });
      const prep = await getJson(`${base}&stage=prep`);
      let clubs = prep.clubs.map((c) => ({ ...c, state: 'loading' }));
      setRun({ stage: 'news', clubs });
      const mark = (team, patch) => {
        clubs = clubs.map((c) => (c.team === team ? { ...c, ...patch } : c));
        setRun((r) => ({ ...r, clubs }));
      };
      const reports = await Promise.all(
        prep.clubs.map((c) =>
          getJson(`/api/sport/news/${c.team}?gw=${prep.gw}`)
            .then((r) => (mark(c.team, { state: 'ok', report: r }), r))
            .catch((e) => (mark(c.team, { state: 'failed', error: e.message, code: e.code }), null)),
        ),
      );
      const ok = reports.filter(Boolean);
      setRun((r) => ({ ...r, stage: 'advice' }));
      const data = await getJson(`${base}&news=${ok.map((r) => r.team).join(',')}&v=${hash(ok.map((r) => r.at).join('|'))}${league ? `&league=${league}` : ''}`);
      const failed = clubs.filter((c) => c.state === 'failed');
      const problem = failed.find((c) => c.code === 'web_search_off')?.error ?? (failed.length ? `Couldn’t check ${failed.map((c) => c.short).join(', ')} in time.` : null);
      setRun({ stage: 'done', data, clubs, problem });
    } catch (e) {
      setRun({ stage: 'error', error: e.message });
    }
  };

  const busy = ['prep', 'news', 'advice'].includes(run.stage);
  const d = run.data;
  const a = d?.advice;
  const whenLabel = (m) => {
    if (m.when === 'after_press_conference') {
      const w = a.watch.find((x) => x.players.includes(m.out) || x.players.includes(m.in));
      return w ? `After ${club(w.team)}’s press conference${w.at ? `, ${fmt(w.at, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}` : 'After the press conference';
    }
    if (m.when === 'before_price_change') {
      const night = (n) => (n === 0 ? 'tonight' : n === 1 ? 'tomorrow night' : `in ${n + 1} nights`);
      const p = m.price?.in?.dir === 'rise' ? `${name(m.in)} likely to rise ${night(m.price.in.night)}` : m.price?.out?.dir === 'fall' ? `${name(m.out)} likely to fall ${night(m.price.out.night)}` : null;
      return p ? `Before the price change: ${p}` : 'Before the price change';
    }
    return { now: 'Now', closer_to_deadline: 'Closer to the deadline, after the team news', next_gameweek: 'Next gameweek' }[m.when];
  };
  const Move = ({ m }) => (
    <div className="sp-ai-move">
      <span className="sp-opt-move">
        <span className="sp-opt-p"><Face el={els[m.out]} teams={teams} size={26} /><b className="sp-dif-name">{name(m.out)}</b></span>
        <span className="sp-xfer-arrow" aria-hidden>→</span>
        <span className="sp-opt-p"><Face el={els[m.in]} teams={teams} size={26} /><b className="sp-dif-name">{name(m.in)}</b></span>
      </span>
      <span className="sp-ai-when">{whenLabel(m)}</span>
      {m.reason && <span className="sp-small sp-ink2">{m.reason}</span>}
      {m.note && <span className="sp-small" style={{ color: 'var(--sp-ink)' }}>{m.note}</span>}
      {m.starts === false && <span className="sp-tiny sp-muted">Starts on your bench this week.</span>}
    </div>
  );

  return (
    <section className="sp-panel sp-ai">
      <div className="sp-section-head">
        <h2 className="sp-h2">AI advice for gameweek {gw}</h2>
        <span className="sp-tiny sp-muted">Claude, on our numbers and this week’s news</span>
      </div>

      {!a && (
        <>
          <p className="sp-small sp-ink2" style={{ margin: '0 0 10px' }}>
            Claude reads your squad, bank and chips next to our projections, the transfer planner’s options and this week’s club news, including when managers face the press. It tells you which transfers to make and when, who to start and captain, and whether to play a chip, with the numbers behind each call.
            It doesn’t sugar-coat: you also get an honest verdict on your squad and your recent transfers, measured against your league.
          </p>
          <div className="sp-opt-ctl">
            <span className="sp-small">
              Free transfers
              <span className="sp-step" role="group" aria-label="free transfers">
                <button onClick={() => setFree((v) => Math.max(0, v - 1))} disabled={free <= 0 || busy} aria-label="Fewer free transfers">−</button>
                <b className="sp-num">{free}</b>
                <button onClick={() => setFree((v) => Math.min(5, v + 1))} disabled={free >= 5 || busy} aria-label="More free transfers">+</button>
              </span>
              <span className="sp-tiny sp-muted"> {free === estimate ? 'our estimate' : `we estimated ${estimate}`}</span>
            </span>
            <button className="sp-btn sp-btn-primary" onClick={ask} disabled={busy}>
              {busy ? 'Working…' : 'Get advice'}
            </button>
          </div>
          {busy && (
            <ol className="sp-ai-steps">
              <li data-state={run.stage === 'prep' ? 'now' : 'done'}>Your squad and the planner’s options</li>
              <li data-state={run.stage === 'prep' ? 'todo' : run.stage === 'news' ? 'now' : 'done'}>
                Club news and press conferences
                {run.clubs?.length > 0 && (
                  <span className="sp-tiny sp-muted">
                    {' '}
                    {run.clubs.map((c) => `${c.short}${c.state === 'ok' ? ' ✓' : c.state === 'failed' ? ' ✕' : ' …'}`).join(' · ')}
                  </span>
                )}
                {run.stage === 'prep' || run.clubs?.length ? null : <span className="sp-tiny sp-muted"> nothing to check</span>}
              </li>
              <li data-state={run.stage === 'advice' ? 'now' : 'todo'}>Claude weighs it up, usually 20–40 seconds</li>
            </ol>
          )}
          {run.stage === 'error' && <p className="sp-small" style={{ margin: '8px 0 0', color: 'var(--sp-loss)' }}>{run.error}</p>}
        </>
      )}

      {a && (
        <>
          <p className="sp-ai-head">{a.headline}</p>
          <p className="sp-small sp-ink2" style={{ margin: '4px 0 0' }}>
            <b className="sp-num" style={{ color: 'var(--sp-ink)' }}>{one(a.projected)}</b> projected this gameweek with this week’s moves
            {a.hit ? `, after a −${a.hit} hit` : ''}, against {one(a.holdProjected)} if you change nothing. Confidence: {a.confidence}.
          </p>

          {a.verdict && (
            <div className="sp-ai-verdict">
              <span className="sp-ai-when">The honest verdict</span>
              <p className="sp-ai-verdict-line">{a.verdict.line}</p>
              {a.verdict.problems.length > 0 && <ul className="sp-ai-list">{a.verdict.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
              {a.verdict.working && (
                <p className="sp-small sp-ink2" style={{ margin: '6px 0 0' }}>
                  <b style={{ color: 'var(--sp-ink)' }}>Working:</b> {a.verdict.working}
                </p>
              )}
              {factLine(a.facts).length > 0 && <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>Our numbers: {factLine(a.facts).join(' · ')}.</p>}
              {a.facts?.transfers?.length > 0 && (
                <p className="sp-tiny sp-muted" style={{ margin: '4px 0 0' }}>
                  Your recent transfers, points since (in against out):{' '}
                  {a.facts.transfers
                    .slice(0, 4)
                    .map((t) => `GW${t.gw} ${t.changes ? `${t.wildcard ? 'Wildcard' : 'transfers'} (${t.changes} changes)` : `${name(t.out)} → ${name(t.in)}`} ${t.net > 0 ? '+' : t.net < 0 ? '−' : '±'}${Math.abs(t.net)}`)
                    .join(' · ')}.
                </p>
              )}
            </div>
          )}

          {(a.watch.length > 0 || a.pending?.length > 0) && (
            <div className="sp-ai-box">
              <h3 className="sp-mu-h">Before you move</h3>
              <p className="sp-small" style={{ margin: '0 0 6px' }}>
                The deadline is {fmt(a.deadline)}, {until(a.deadline)}. These can change the answer before then:
              </p>
              {a.watch.map((w) => (
                <div key={w.team} className="sp-ai-watch">
                  <span className="sp-small">
                    <b>{club(w.team)} press conference: </b>
                    {w.at ? fmt(w.at) : w.date ? `${dayOf(w.date)}, time not given yet` : `not announced yet. Clubs usually speak a day or two before kick-off${w.beforeDeadline ? ', so it should come before the deadline' : ''}.`}
                  </span>
                  <span className="sp-tiny sp-muted">
                    Listen for: {w.players.map(name).join(', ')}
                    {w.at && (
                      <>
                        {' · '}
                        <button className="sp-link sp-tiny" onClick={() => addToCalendar(w, club(w.team), w.players.map(name).join(', '))}>Add to calendar</button>
                      </>
                    )}
                    {w.source && (
                      <>
                        {' · '}
                        <a className="sp-link" href={w.source} target="_blank" rel="noreferrer">{host(w.source)}</a>
                      </>
                    )}
                  </span>
                </div>
              ))}
              {a.pending?.length > 0 && (
                <div className="sp-ai-watch">
                  <span className="sp-small">
                    <b>Still to play first: </b>
                    {a.pending.map((f) => `${teams[f.home]?.short} v ${teams[f.away]?.short} ${fmt(f.kickoff, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`).join(', ')}
                  </span>
                  <span className="sp-tiny sp-muted">Your players in them: {[...new Set(a.pending.flatMap((f) => f.players))].map(name).join(', ')}. An injury there changes the answer, so ask again after.</span>
                </div>
              )}
            </div>
          )}

          <h3 className="sp-mu-h" style={{ marginTop: 14 }}>This week’s transfers</h3>
          {a.transfers.length === 0 ? (
            <p className="sp-small" style={{ margin: 0 }}>{a.draft ? `None one by one: the ${CHIP[a.chip.play]} rebuilds the squad.` : `None: roll the transfer${d.freeTransfers > 1 ? 's' : ''}.`}</p>
          ) : (
            a.transfers.map((m) => <Move key={`${m.out}-${m.in}`} m={m} />)
          )}
          {a.transfers.length > 0 && a.bankAfter != null && <p className="sp-tiny sp-muted" style={{ margin: '4px 0 0' }}>£{a.bankAfter.toFixed(1)}m left in the bank at your selling prices.</p>}

          {a.nextWeek.length > 0 && (
            <>
              <h3 className="sp-mu-h" style={{ marginTop: 14 }}>Planned for next week</h3>
              {a.nextWeek.map((m) => <Move key={`${m.out}-${m.in}`} m={m} />)}
            </>
          )}

          {a.conditions.length > 0 && (
            <>
              <h3 className="sp-mu-h" style={{ marginTop: 14 }}>If the news changes</h3>
              <ul className="sp-ai-list">
                {a.conditions.map((c, i) => (
                  <li key={i}>
                    <b>If {c.if.replace(/^if\s+/i, '')}:</b> {c.then}
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3 className="sp-mu-h" style={{ marginTop: 14 }}>Chip: {CHIP[a.chip.play]}</h3>
          <p className="sp-small sp-ink2" style={{ margin: 0 }}>{a.chip.reason}</p>

          <h3 className="sp-mu-h" style={{ marginTop: 14 }}>{a.transfers.length || a.draft ? 'Your eleven after these moves' : 'Your eleven'}</h3>
          <div className="sp-ai-xi">
            {[1, 2, 3, 4].map((t) => (
              <div key={t}>
                <span className="sp-tiny sp-muted">{POS[t]}</span>
                {a.xi.filter((id) => els[id]?.type === t).map((id) => (
                  <span key={id} className="sp-small">
                    <b>{name(id)}</b>
                    {id === a.captain ? <i className="sp-badge" style={{ marginLeft: 4 }}>{a.chip.play === '3xc' ? 'TC' : 'C'}</i> : id === a.vice_captain ? <i className="sp-badge sp-badge-quiet" style={{ marginLeft: 4 }}>V</i> : null}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <p className="sp-tiny sp-muted" style={{ margin: '6px 0 0' }}>
            Bench, in order: {a.bench.map(name).join(', ')}. Picked by our optimiser on projected points for these moves.
          </p>

          <h3 className="sp-mu-h" style={{ marginTop: 14 }}>Why</h3>
          <ul className="sp-ai-list">{a.reasoning.map((r, i) => <li key={i}>{r}</li>)}</ul>
          <h3 className="sp-mu-h" style={{ marginTop: 10 }}>What could go wrong</h3>
          <ul className="sp-ai-list">{a.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>

          {(d.news?.length > 0 || run.problem || d.newsError) && (
            <>
              <h3 className="sp-mu-h" style={{ marginTop: 14 }}>News checked</h3>
              {d.news.map((r) => (
                <div key={r.team} className="sp-ai-news">
                  <span className="sp-small">
                    <b>{club(r.team)}</b>
                    <span className="sp-muted">
                      {' · press conference '}
                      {r.presser.status === 'held' ? `held${r.presser.at ? ` ${fmt(r.presser.at)}` : ''}` : r.presser.at ? fmt(r.presser.at) : r.presser.date ? dayOf(r.presser.date) : 'not announced yet'}
                    </span>
                  </span>
                  {r.summary && <span className="sp-small sp-ink2">{r.summary}</span>}
                  {r.presser.said?.length > 0 && <span className="sp-tiny sp-ink2">Said: {r.presser.said.join(' ')}</span>}
                  {r.players.map((p) => (
                    <span key={p.id} className="sp-tiny sp-ink2">
                      <b>{name(p.id)}</b>, {NEWS[p.status]}
                      {p.back ? ` (back ${dayOf(p.back)})` : ''}: {p.detail}{' '}
                      <a className="sp-link" href={p.source} target="_blank" rel="noreferrer">{host(p.source)}, {dayOf(p.published)}</a>
                    </span>
                  ))}
                  {r.players.length === 0 && !r.summary && <span className="sp-tiny sp-muted">No new fitness news found.</span>}
                </div>
              ))}
              {(run.problem || d.newsError) && <p className="sp-tiny sp-muted" style={{ margin: '6px 0 0' }}>{run.problem || d.newsError} The advice uses FPL’s own injury flags where news is missing.</p>}
            </>
          )}

          {a.notes.length > 0 && <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>Checked against the rules before showing: {a.notes.join(' ')}</p>}
          <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>
            Written by Claude ({d.model}) from our projections and the news above, {fmt(d.at)}. {d.freeEstimated ? 'Free transfers estimated. ' : ''}
            {d.revertedFreeHit ? 'Your Free Hit squad has been undone, so this starts from the squad before it. ' : ''}
            {d.sellingPricesEstimated ? 'Some selling prices are estimated. ' : ''}
            FPL’s public data shows your team as of the last deadline, so transfers you’ve made since aren’t included. Advice, not a guarantee.
          </p>
          <button className="sp-small sp-link" style={{ marginTop: 8 }} onClick={() => setRun({ stage: 'idle' })}>
            Ask again
          </button>
        </>
      )}
    </section>
  );
}
