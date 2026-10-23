'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { sessionEnd } from '@/lib/othersports.mjs';
import { SESSION_KEY, lapText, gapText } from '@/lib/f1.mjs';
import { kickoff, shortDate, zoneLabel } from './time';
import { useJson, useF1Index, teamColor, teamName, Driver, Mark, useF1Reveal, Reveal } from './f1bits';
import { LapChart, TyreStrip, PaceList, LapTrace } from './F1Charts';
import { RaceHero } from './F1Hero';
import F1Live from './F1Live';
import { heat } from './fplbits';

const TAB = { 'Practice 1': 'FP1', 'Practice 2': 'FP2', 'Practice 3': 'FP3', 'Sprint qualifying': 'Sprint quali', Sprint: 'Sprint', Qualifying: 'Qualifying', Race: 'Race' };
const TYRE = { SOFT: 'soft', MEDIUM: 'medium', HARD: 'hard', INTERMEDIATE: 'intermediate', WET: 'wet' };

/** Re-renders every so often, so a session's state moves on while the page is open. */
function useNow(every) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

/** "9–11 Oct", or "30 Oct – 1 Nov" across a month's end. */
const dayRange = (a, b) => {
  const [x, y] = [new Date(a), new Date(b)];
  const dm = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return x.getMonth() === y.getMonth() ? `${x.getDate()}–${dm(y)}` : `${dm(x)} – ${dm(y)}`;
};

/** "30" or "30–33": a temperature range, as one number when it held steady. */
const range = ([a, b]) => (Math.round(a) === Math.round(b) ? `${Math.round(a)}` : `${Math.round(a)}–${Math.round(b)}`);

/** A driver from the session data's roster, in the shape <Driver> takes. */
const fromRoster = (r) => ({ id: r.id ?? r.code, code: r.code, first: r.first ?? '', last: r.last ?? r.name ?? r.code });

/**
 * One race weekend: a tab per session, each with its classification (Jolpica for the race, the
 * sprint and qualifying; F1's timing data otherwise) and the analysis the session data allows.
 */
export default function F1Weekend() {
  const q = useSearchParams();
  const cal = useJson('/api/f1/season');
  // Jolpica sends the season as a string.
  const season = Number(q.get('season')) || Number(cal.data?.season) || null;
  const round = Number(q.get('round')) || null;
  const race = cal.data?.races.find((r) => r.round === round) ?? null;
  const rd = useJson(season && round ? `/api/f1/round/${season}/${round}` : null);
  const ix = useF1Index(season);
  const colorOf = useCallback((team) => teamColor(ix.data, team), [ix.data]);
  const nameOf = useCallback((team) => teamName(ix.data, team), [ix.data]);
  const now = useNow(30000);
  const { hidden, reveal } = useF1Reveal(`${season}-${round}`);
  const [pick, setPick] = useState(null);

  if (!round) return <p className="sp-empty">No race weekend given.</p>;
  if (cal.error && !cal.data) return <p className="sp-empty">Couldn’t load the F1 calendar just now. Try again in a minute.</p>;
  if (!cal.data) return <div className="sp-read"><div className="sp-skel" style={{ height: 520, margin: 16, borderRadius: 6 }} /></div>;
  if (season !== Number(cal.data.season)) return <p className="sp-empty">Only the {cal.data.season} season is here so far.</p>;
  if (!race) return <p className="sp-empty">There’s no round {round} in the {cal.data.season} calendar.</p>;

  const sessions = race.sessions;
  const done = sessions.filter((s) => sessionEnd(s) <= now);
  // Open on the session that's on (or about to be), else the last one done.
  const onNow = sessions.find((x) => Date.parse(x.at) - 3600e3 <= now && now < sessionEnd(x) + 30 * 60e3);
  const fallback = onNow ?? (done.length ? done[done.length - 1] : sessions[0]);
  const key = pick ?? q.get('s') ?? SESSION_KEY[fallback.label];
  const s = sessions.find((x) => SESSION_KEY[x.label] === key) ?? fallback;
  const sKey = SESSION_KEY[s.label];
  const onFile = ix.data?.rounds?.[round]?.sessions ?? {};
  const first = sessions[0]?.at;
  const last = sessions[sessions.length - 1]?.at;
  const won = rd.data?.race?.[0];

  return (
    <div className="sp-read">
      <RaceHero
        race={race}
        total={cal.data.races.length}
        season={season}
        now={now}
        compact
        kicker={`Round ${race.round} of ${cal.data.races.length}${first && last ? ` · ${dayRange(first, last)}` : ''}`}
        winner={!hidden && won?.pos === 1 ? won.driver.last : null}
      />
      <div className="sp-pad">
        <div className="sp-tabs" role="tablist" aria-label="Sessions" style={{ marginTop: 12, gap: 16 }}>
          {sessions.map((x) => {
            const k = SESSION_KEY[x.label];
            return (
              <button key={k} role="tab" aria-selected={k === sKey} onClick={() => setPick(k)} style={{ height: 38, fontSize: 14.5 }}>
                {Date.parse(x.at) <= now && now < sessionEnd(x) && <i className="sp-dot sp-live-text" style={{ marginRight: 6, verticalAlign: 2 }} aria-label="On now" />}
                {TAB[x.label] ?? x.label}
              </button>
            );
          })}
        </div>
      </div>
      <Session
        key={sKey}
        s={s}
        sKey={sKey}
        season={season}
        round={round}
        rd={rd}
        onFile={onFile[sKey]}
        settled={Boolean((ix.data || ix.error) && (rd.data || rd.error))}
        predicted={Boolean(ix.data?.rounds?.[round]?.predict)}
        colorOf={colorOf}
        nameOf={nameOf}
        now={now}
        hidden={hidden}
        reveal={reveal}
      />
      <p className="sp-note sp-pad" style={{ margin: '18px 0 0' }}>
        Classifications for the race, the sprint and qualifying from Jolpica; everything else from F1’s timing data through FastF1, an hour or two after each session.
        Circuit maps from Tomislav Bacinger’s f1-circuits (MIT licence). Unofficial: Matchday has no link with Formula 1. Times in {zoneLabel()}.
      </p>
    </div>
  );
}

function Session({ s, sKey, season, round, rd, onFile, settled, predicted, colorOf, nameOf, now, hidden, reveal }) {
  const file = useJson(onFile ? `/api/f1/data/${season}/${round}-${sKey}` : null);
  const pred = useJson(sKey === 'race' && predicted ? `/api/f1/data/${season}/${round}-predict` : null);
  const start = Date.parse(s.at);
  const end = sessionEnd(s);
  const f = file.data;
  const official = sKey === 'race' ? rd.data?.race : sKey === 'sprint' ? rd.data?.sprint : sKey === 'q' ? rd.data?.qualifying : null;
  const before = (
    <>
      <section className="sp-pad sp-section">
        <p className="sp-small sp-ink2" style={{ margin: 0 }}>
          {s.label} starts <b className="sp-f1-strong">{shortDate(s.at)} at {kickoff(s.at)}</b>. Live timing starts here when F1’s does, shortly before.
        </p>
      </section>
      {pred.data && <Prediction p={pred.data} colorOf={colorOf} />}
    </>
  );
  // Live timing from three hours before the start (sessions get moved earlier) until the
  // classification or the analysis is in, at most six hours after the end.
  if (now >= start - 3 * 3600e3 && now < end + 6 * 3600e3 && (now < end || (settled && !onFile && !official))) return <F1Live s={s} hidden={hidden} reveal={reveal} before={before} />;
  if (now < start) return before;
  if (!settled) return <div className="sp-skel" style={{ height: 360, margin: 16, borderRadius: 6 }} />;
  if (hidden) return <Reveal onReveal={reveal} what={`${s.label.toLowerCase()} results`} />;

  const waiting = !onFile && now - end < 6 * 3600e3;
  return (
    <>
      {(sKey === 'race' || sKey === 'sprint') && (
        <>
          {pred.data && (official?.[0] || f?.classification?.[0]) && <Beforehand p={pred.data} winner={official?.[0]?.driver.code ?? f.classification[0].code} />}
          {official ? <RaceTable rows={official} colorOf={colorOf} nameOf={nameOf} /> : f ? <RaceTableFromData f={f} colorOf={colorOf} nameOf={nameOf} /> : null}
          {f && <RaceAnalysis f={f} colorOf={colorOf} />}
        </>
      )}
      {(sKey === 'q' || sKey === 'sq') && (
        <>
          {official ? <QualiTable rows={official} colorOf={colorOf} nameOf={nameOf} sprint={false} /> : f ? <QualiTable rows={qualiRowsFromData(f)} colorOf={colorOf} nameOf={nameOf} sprint={sKey === 'sq'} /> : null}
          {f && <QualiAnalysis f={f} colorOf={colorOf} />}
        </>
      )}
      {sKey.startsWith('fp') && f && <PracticeAnalysis f={f} colorOf={colorOf} />}
      {!f && !file.error && onFile && <div className="sp-skel" style={{ height: 360, margin: 16, borderRadius: 6 }} />}
      {!f && !onFile && (
        <p className="sp-note sp-pad" style={{ marginTop: 14 }}>
          {waiting ? 'Laps, tyres and pace appear an hour or two after the session.' : 'No timing data for this session.'}
        </p>
      )}
      {f?.weather && (
        <p className="sp-tiny sp-muted sp-pad" style={{ margin: '12px 0 0' }}>
          Air {range(f.weather.air)} °C, track {range(f.weather.track)} °C, {f.weather.rain ? 'rain at some point' : 'dry'}.
        </p>
      )}
    </>
  );
}

// A chance as a whole percentage, never 0% or 100%: there's always something left to happen.
const chance = (p) => (p < 0.005 ? '<1%' : p > 0.995 ? '>99%' : `${Math.round(p * 100)}%`);

/** Before the race: each driver's chances from qualifying, practice and form (scripts/f1_model.py). */
function Prediction({ p, colorOf }) {
  const t = p.model?.test;
  const gridOnly = p.model?.inputs?.length === 1 && p.model.inputs[0] === 'grid';
  const top = p.drivers.slice(0, 10);
  const rest = p.drivers.slice(10);
  return (
    <section className="sp-section">
      <div className="sp-pad sp-section-head">
        <h2 className="sp-h2">Who wins?</h2>
        <span className="sp-tiny sp-muted">Our estimate</span>
      </div>
      <table className="sp-table sp-f1-table">
        <thead>
          <tr>
            <th className="l" style={{ paddingLeft: 16 }}>Driver</th>
            <th>Win</th>
            <th>Podium</th>
            <th style={{ paddingRight: 16 }}>Points</th>
          </tr>
        </thead>
        <tbody>
          {top.map((d) => (
            <tr key={d.code}>
              <td className="l" style={{ paddingLeft: 16 }}>
                <Driver d={{ first: d.first ?? '', last: d.last ?? d.code }} color={colorOf(d.team)} />
              </td>
              <td className="sp-num" style={heat(Math.min(1, d.win * 2))}>{chance(d.win)}</td>
              <td className="sp-num">{chance(d.podium)}</td>
              <td className="sp-num" style={{ paddingRight: 16 }}>{chance(d.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>
        {rest.length > 0 && `The other ${rest.length} have ${chance(rest.reduce((s, d) => s + d.win, 0))} between them to win. `}
        {gridOnly ? 'From the grid alone' : 'From the grid'}
        {p.model?.inputs?.includes('quali') ? ', the qualifying gaps' : ''}
        {p.model?.inputs?.includes('longRun') ? ', long runs in practice' : ''}
        {p.model?.inputs?.includes('form') ? ', each team’s race pace lately' : ''} and a {chance(p.model?.dnf ?? 0)} chance each car retires, played out 20,000 times.
        {gridOnly ? ' Adding the qualifying gaps, long runs in practice and each team’s recent race pace didn’t make it better on races it hadn’t seen, so they’re left out.' : ''} Grid penalties
        after qualifying aren’t in it.
        {t ? ` Tested on ${t.races} races it hadn’t seen: the eventual winner had ${chance(t.winnerChance)} on average, and our favourite won ${t.favouriteWon} of them.` : ''}
      </p>
    </section>
  );
}

/** After the race: what we said beforehand, so the estimate can be judged. */
function Beforehand({ p, winner }) {
  const fav = p.drivers[0];
  const w = p.drivers.find((d) => d.code === winner);
  if (!fav || !w) return null;
  return (
    <p className="sp-small sp-ink2 sp-pad" style={{ margin: '14px 0 4px' }}>
      Before the race we gave <b className="sp-f1-strong">{w.last ?? w.code} a {chance(w.win)} chance</b> of winning
      {fav.code === winner ? ', the best of anyone.' : `; our favourite was ${fav.last ?? fav.code} at ${chance(fav.win)}.`}
    </p>
  );
}

/** Places gained or lost from the grid, in words a glance can read: "▲10", "▼2". */
function Moved({ grid, pos }) {
  if (!grid || !pos || grid === pos) return null;
  const up = grid > pos;
  return (
    <small className="sp-num" style={{ color: up ? 'var(--sp-win)' : 'var(--sp-muted)', fontWeight: 750 }}>
      {up ? '▲' : '▼'}
      {Math.abs(grid - pos)}
    </small>
  );
}

function RaceTable({ rows, colorOf, nameOf }) {
  return (
    <section className="sp-section">
      <table className="sp-table sp-f1-table">
        <thead>
          <tr>
            <th className="l" style={{ paddingLeft: 16 }}>#</th>
            <th className="l">Driver</th>
            <th>Grid</th>
            <th>Time</th>
            <th style={{ paddingRight: 16 }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.driver.id}>
              <td className="l sp-pos" style={{ paddingLeft: 16 }}>{/^\d+$/.test(r.text) ? r.pos : r.text === 'R' ? 'Out' : r.text}</td>
              <td className="l">
                <Driver d={r.driver} color={colorOf(r.team?.id)} team={nameOf(r.team)} />
              </td>
              <td className="sp-num">
                {r.grid || 'Pit'} <Moved grid={r.grid} pos={/^\d+$/.test(r.text) ? r.pos : null} />
              </td>
              <td className="sp-num">{r.time ?? r.status}</td>
              <td className="sp-pts" style={{ paddingRight: 16 }}>{r.points || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>
        Grid: where each started, ▲ places gained by the flag, ▼ lost. Out: retired, with the reason.
      </p>
    </section>
  );
}

/** Before Jolpica has a classification, F1's own from the session data. */
function RaceTableFromData({ f, colorOf, nameOf }) {
  const who = Object.fromEntries(f.drivers.map((d) => [d.code, d]));
  const leader = f.classification[0]?.time;
  const rows = f.classification.map((c) => ({
    driver: fromRoster(who[c.code] ?? { code: c.code }),
    team: { id: who[c.code]?.team, name: who[c.code]?.teamName },
    pos: c.pos,
    text: c.text,
    grid: c.grid,
    points: c.points,
    status: c.status,
    time: c.pos === 1 && leader ? lapText(leader) : c.time != null && leader != null && c.status === 'Finished' ? gapText(c.time) : null,
  }));
  return <RaceTable rows={rows} colorOf={colorOf} nameOf={nameOf} />;
}

function RaceAnalysis({ f, colorOf }) {
  const who = Object.fromEntries(f.drivers.map((d) => [d.code, d]));
  return (
    <>
      <section className="sp-section">
        <div className="sp-pad sp-section-head">
          <h2 className="sp-h2">How it unfolded</h2>
          <span className="sp-tiny sp-muted">Position each lap</span>
        </div>
        <div className="sp-pad">
          <LapChart s={f} colorOf={colorOf} />
        </div>
      </section>
      <section className="sp-section">
        <div className="sp-pad sp-section-head">
          <h2 className="sp-h2">Tyres</h2>
          <span className="sp-tiny sp-muted">Each stint</span>
        </div>
        <div className="sp-pad">
          <TyreStrip s={f} colorOf={colorOf} />
        </div>
      </section>
      <section className="sp-section">
        <div className="sp-pad sp-section-head">
          <h2 className="sp-h2">Race pace</h2>
          <span className="sp-tiny sp-muted">Median clean lap</span>
        </div>
        <PaceList
          pace={f.pace}
          drivers={f.drivers}
          colorOf={colorOf}
          note={`Each driver’s typical lap: the median of his clean laps (no pit laps, no laps under a yellow flag or the safety car, not lap 1), so traffic and tyre age are in it. A shorter bar is quicker.${f.fastest ? ` Fastest lap: ${who[f.fastest.code]?.last ?? f.fastest.code}, ${lapText(f.fastest.time)} on lap ${f.fastest.lap}.` : ''}`}
        />
      </section>
    </>
  );
}

/** Qualifying rows from the session data (sprint qualifying isn't in Jolpica). */
function qualiRowsFromData(f) {
  const who = Object.fromEntries(f.drivers.map((d) => [d.code, d]));
  const fmt = (t) => (t == null ? null : lapText(t));
  const list = f.parts.map(([code, ...times], i) => {
    const last = times.findLastIndex((t) => t != null);
    return { pos: i + 1, driver: fromRoster(who[code] ?? { code }), team: { id: who[code]?.team, name: who[code]?.teamName }, q: times.map(fmt), times, part: last < 0 ? null : last + 1 };
  });
  const fastest = [0, 1, 2].map((i) => Math.min(...list.map((x) => x.times[i] ?? Infinity)));
  return list.map((x) => ({ ...x, gap: x.part && Number.isFinite(fastest[x.part - 1]) ? x.times[x.part - 1] - fastest[x.part - 1] : null }));
}

function QualiTable({ rows, colorOf, nameOf, sprint }) {
  const p = sprint ? 'SQ' : 'Q';
  return (
    <section className="sp-section">
      <table className="sp-table sp-f1-table">
        <thead>
          <tr>
            <th className="l" style={{ paddingLeft: 16 }}>#</th>
            <th className="l">Driver</th>
            <th className="sp-hide-sm">{p}1</th>
            <th className="sp-hide-sm">{p}2</th>
            <th className="sp-hide-sm">{p}3</th>
            <th className="sp-only-sm">Time</th>
            <th style={{ paddingRight: 16 }}>Gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const prev = rows[i - 1];
            const cut = prev && prev.part !== r.part && r.part;
            return [
              cut ? (
                <tr key={`cut${r.part}`} className="sp-f1-cut">
                  <td colSpan={7} style={{ paddingLeft: 16 }}>
                    Out in {p}
                    {r.part}
                  </td>
                </tr>
              ) : null,
              <tr key={r.driver.id}>
                <td className="l sp-pos" style={{ paddingLeft: 16 }}>{r.pos}</td>
                <td className="l">
                  <Driver d={r.driver} color={colorOf(r.team?.id)} team={nameOf(r.team)} />
                </td>
                {r.q.map((t, k) => (
                  <td key={k} className={`sp-num sp-hide-sm${k + 1 === r.part ? '' : ' sp-muted'}`}>
                    {t ?? ''}
                  </td>
                ))}
                <td className="sp-num sp-only-sm">{r.part ? r.q[r.part - 1] : '–'}</td>
                <td className="sp-num sp-muted" style={{ paddingRight: 16 }}>{r.gap ? gapText(r.gap) : ''}</td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
      <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>
        Gap: behind the fastest time in the part each driver went out in, the time that decided his place.
      </p>
    </section>
  );
}

function QualiAnalysis({ f, colorOf }) {
  const who = Object.fromEntries(f.drivers.map((d) => [d.code, d]));
  const best = f.best;
  const cols = [0, 1, 2].map((k) => best.map((b) => b.sectors[k]).filter((x) => x != null));
  const shade = (v, k) => {
    if (v == null) return undefined;
    const lo = Math.min(...cols[k]);
    const hi = Math.min(lo + 0.8, Math.max(...cols[k]));
    return heat(hi > lo ? Math.max(0, 1 - (v - lo) / (hi - lo)) : 1);
  };
  const ideal = best.filter((b) => b.ideal != null).sort((a, b) => a.ideal - b.ideal)[0];
  return (
    <>
      {f.trace && (
        <section className="sp-section">
          <div className="sp-pad sp-section-head">
            <h2 className="sp-h2">
              {who[f.trace.codes[0]]?.last} against {who[f.trace.codes[1]]?.last}
            </h2>
            <span className="sp-tiny sp-muted">The two fastest laps</span>
          </div>
          <div className="sp-pad">
            <SectorWords a={best[0]} b={best[1]} who={who} />
            <LapTrace trace={f.trace} drivers={f.drivers} colorOf={colorOf} />
          </div>
        </section>
      )}
      <section className="sp-section">
        <div className="sp-pad sp-section-head">
          <h2 className="sp-h2">Sectors</h2>
          <span className="sp-tiny sp-muted">Each driver’s best</span>
        </div>
        <table className="sp-table sp-f1-table sp-f1-sectors">
          <thead>
            <tr>
              <th className="l" style={{ paddingLeft: 16 }}>Driver</th>
              <th>S1</th>
              <th>S2</th>
              <th>S3</th>
              <th>Ideal</th>
              <th className="sp-hide-sm" style={{ paddingRight: 16 }}>Top speed</th>
            </tr>
          </thead>
          <tbody>
            {best.map((b) => (
              <tr key={b.code}>
                <td className="l" style={{ paddingLeft: 16 }}>
                  <span className="sp-f1-driver">
                    <Mark color={colorOf(who[b.code]?.team)} />
                    <b>{b.code}</b>
                  </span>
                </td>
                {b.sectors.map((v, k) => (
                  <td key={k} className="sp-num" style={shade(v, k)}>
                    {v == null ? '–' : v.toFixed(3)}
                  </td>
                ))}
                <td className="sp-num">
                  {b.ideal == null ? '–' : lapText(b.ideal)}
                  {b.ideal != null && b.time - b.ideal > 0.0005 && <small className="sp-muted"> {gapText(b.time - b.ideal)}</small>}
                </td>
                <td className="sp-num sp-hide-sm" style={{ paddingRight: 16 }}>{b.speed ? `${Math.round(b.speed)}` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>
          Each driver’s best time in each sector across his laps; more ink is quicker. Ideal: those three put together, with the time he left out there in small type
          {ideal ? `; the best ideal lap was ${who[ideal.code]?.last ?? ideal.code}’s ${lapText(ideal.ideal)}` : ''}. Top speed in km/h at the speed trap.
        </p>
      </section>
    </>
  );
}

/** Where the faster lap was won, sector by sector, in words. */
function SectorWords({ a, b, who }) {
  if (!a?.lap || !b?.lap || a.lap.some((x) => x == null) || b.lap.some((x) => x == null)) return null;
  const diffs = a.lap.map((x, k) => b.lap[k] - x);
  const na = who[a.code]?.last ?? a.code;
  const nb = who[b.code]?.last ?? b.code;
  const part = (d, k) => (Math.abs(d) < 0.0005 ? `level in sector ${k + 1}` : d > 0 ? `${d.toFixed(3)} s quicker in sector ${k + 1}` : `${(-d).toFixed(3)} s slower in sector ${k + 1}`);
  return (
    <p className="sp-small sp-ink2" style={{ margin: '0 0 10px' }}>
      <b className="sp-f1-strong">
        {na} beat {nb} by {(b.time - a.time).toFixed(3)} s
      </b>
      : {diffs.map(part).join(', ')}.
    </p>
  );
}

function PracticeAnalysis({ f, colorOf }) {
  const who = Object.fromEntries(f.drivers.map((d) => [d.code, d]));
  const top = f.best.find((b) => b.time != null)?.time;
  const pace = f.longRun.map((r) => ({ code: r.code, median: r.median, laps: r.laps }));
  return (
    <>
      <section className="sp-section">
        <div className="sp-pad sp-section-head">
          <h2 className="sp-h2">One-lap pace</h2>
          <span className="sp-tiny sp-muted">Best lap</span>
        </div>
        <table className="sp-table sp-f1-table">
          <thead>
            <tr>
              <th className="l" style={{ paddingLeft: 16 }}>#</th>
              <th className="l">Driver</th>
              <th>Best</th>
              <th>Gap</th>
              <th className="sp-hide-sm">Tyre</th>
              <th style={{ paddingRight: 16 }}>Laps</th>
            </tr>
          </thead>
          <tbody>
            {f.best.map((b, i) => (
              <tr key={b.code}>
                <td className="l sp-pos" style={{ paddingLeft: 16 }}>{b.time == null ? '–' : i + 1}</td>
                <td className="l">
                  <Driver d={fromRoster(who[b.code] ?? { code: b.code })} color={colorOf(who[b.code]?.team)} team={who[b.code]?.teamName} />
                </td>
                <td className="sp-num">{lapText(b.time)}</td>
                <td className="sp-num sp-muted">{i && b.time != null ? gapText(b.time - top) : ''}</td>
                <td className="sp-hide-sm sp-muted">{TYRE[b.compound] ?? '–'}</td>
                <td className="sp-num" style={{ paddingRight: 16 }}>{b.laps}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>
          Practice times flatter some: teams run different fuel loads and tyres, and don’t all go for a fast lap.
        </p>
      </section>
      <section className="sp-section">
        <div className="sp-pad sp-section-head">
          <h2 className="sp-h2">Long runs</h2>
          <span className="sp-tiny sp-muted">Race pace</span>
        </div>
        {pace.length ? (
          <PaceList
            pace={pace}
            drivers={f.drivers}
            colorOf={colorOf}
            note={`Each driver’s longest run of at least five laps on one set of tyres, its typical (median) lap with cool-down laps left out: a rough guide to race pace. ${f.longRun
              .slice(0, 3)
              .map((r) => `${who[r.code]?.last ?? r.code} did ${r.laps} laps on the ${TYRE[r.compound] ?? 'unknown'}`)
              .join('; ')}. Fuel loads aren’t published, so read small gaps as level; in our tests long runs didn’t pick race results better than the grid does.`}
          />
        ) : (
          <p className="sp-note sp-pad">No one did a run of five clean laps on one set of tyres in this session.</p>
        )}
      </section>
    </>
  );
}
