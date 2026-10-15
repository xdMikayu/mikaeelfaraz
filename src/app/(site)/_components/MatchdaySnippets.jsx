'use client';

import { useState } from 'react';
import { standingsNow, withScores, moveWords } from '@/lib/sport/as-it-stands.mjs';

// The moving parts of MatchdayMini's three snippets. The table maths runs here, on every goal; what a
// tap can't change (the kits, the circuits, the countdowns) comes in as props, worked out when the
// page is built.

/* ------------------------------------------------------------ football: as it stands */

const live = (id, h, hs, a, as) => ({ id, status: { state: 'in' }, home: { id: h, score: hs }, away: { id: a, score: as } });

function Move({ name, move }) {
  const words = moveWords(move);
  const [, lead, place] = words.match(/^(.*?)(\d+\w\w|top)$/) ?? [null, words, ''];
  return (
    <span className="md-move">
      <strong>{name}</strong> {lead}
      <b>{place}</b>
    </span>
  );
}

/** Everton v Liverpool and Man City v Brighton, live, on `standings`. */
export function AsItStands({ teams, standings, kits }) {
  const [score, setScore] = useState({ eve: 0, liv: 0, mci: 0, bha: 0 });
  const goal = (id) => setScore((s) => ({ ...s, [id]: s[id] + 1 }));
  const match = live('m1', 'eve', score.eve, 'liv', score.liv);
  const other = live('m2', 'mci', score.mci, 'bha', score.bha);
  const r = standingsNow(standings, match, [other]);
  const table = withScores(standings.groups[0].rows, [match, other].map((m) => ({ homeId: m.home.id, awayId: m.away.id, hs: m.home.score, as: m.away.score })));
  const half = (id, kit) => (
    <div className="md-half" style={{ background: kit.fill, color: kit.ink }}>
      <span>{teams[id].name}</span>
      <button type="button" onClick={() => goal(id)} style={{ color: kit.ink, borderColor: kit.ink }}>
        Goal
      </button>
    </div>
  );
  const changed = Object.values(score).some(Boolean);
  return (
    <div className="md-fb">
      <div>
        <div className="md-hero">
          {half('eve', kits.home)}
          {half('liv', kits.away)}
          <b className="md-plate">
            {score.eve}–{score.liv}
          </b>
        </div>
        <div className="md-band" aria-live="polite">
          <span className="md-band-label">As it stands</span>
          <span className="md-band-main">
            <Move name="Everton" move={r.home} />
            <Move name="Liverpool" move={r.away} />
          </span>
        </div>
        <p className="md-also">
          <span>Also live:</span> <b>Man City {score.mci}–{score.bha} Brighton</b>
          <span className="seg">
            <button type="button" onClick={() => goal('mci')}>
              City goal
            </button>
            <button type="button" onClick={() => goal('bha')}>
              Brighton goal
            </button>
            <button type="button" disabled={!changed} onClick={() => setScore({ eve: 0, liv: 0, mci: 0, bha: 0 })}>
              Kick off again
            </button>
          </span>
        </p>
      </div>
      <ol className="md-table" aria-label="The table as it stands">
        {table.map((t) => {
          const moved = t.was - t.at;
          const playing = ['eve', 'liv', 'mci', 'bha'].includes(t.id);
          return (
            <li key={t.id} className={['eve', 'liv'].includes(t.id) ? 'md-mine' : undefined}>
              <span className="md-pos">{t.at}</span>
              <span className="md-team">
                <i style={{ background: `#${teams[t.id].color}` }} />
                {teams[t.id].name}
                {playing && <small> live</small>}
              </span>
              <span className="md-mv" aria-label={moved ? `${moved > 0 ? 'up' : 'down'} ${Math.abs(moved)}` : 'no change'}>
                {moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : ''}
              </span>
              <b className="md-pts">{t.pts}</b>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------ cricket: the last over */

const TARGET = 168;
const START = { runs: 154, wickets: 5, balls: 114 };
const OUTCOMES = [
  ['•', 0, 'a dot ball'],
  ['1', 1, 'one run'],
  ['2', 2, 'two runs'],
  ['4', 4, 'a four'],
  ['6', 6, 'a six'],
  ['W', 0, 'a wicket'],
];
const INDIA = '#1f5fbf';

export function LastOver() {
  const [balls, setBalls] = useState([]);
  const runs = START.runs + balls.reduce((t, b) => t + (b === 'W' ? 0 : Number(b === '•' ? 0 : b)), 0);
  const wickets = START.wickets + balls.filter((b) => b === 'W').length;
  const bowled = START.balls + balls.length;
  const left = 120 - bowled;
  const need = TARGET - runs;
  let main;
  if (need <= 0) main = <><strong>India</strong> win by <b>{10 - wickets}</b> wickets{left ? `, ${left} ${left === 1 ? 'ball' : 'balls'} to spare` : ''}</>;
  else if (wickets >= 10 || left === 0) {
    main = need === 1 ? <>Scores level: a <strong>Super Over</strong> decides it</> : <><strong>West Indies</strong> win by <b>{need - 1}</b> runs</>;
  } else main = <><strong>India</strong> need <b>{need}</b> off <b>{left}</b> {left === 1 ? 'ball' : 'balls'}</>;
  const over = need <= 0 || wickets >= 10 || left === 0;
  return (
    <div className="md-ck">
      <p className="md-ck-score">
        <span className="md-ck-team" style={{ background: INDIA }}>
          India <b>{runs}/{wickets}</b>
        </span>
        <span className="mono faint">
          {Math.floor(bowled / 6)}.{bowled % 6} of 20 overs · chasing {TARGET}
        </span>
      </p>
      <div className="md-band" aria-live="polite">
        <span className="md-band-main md-one">{main}</span>
      </div>
      <ol className="md-over" aria-label="This over">
        {Array.from({ length: 6 }, (_, i) => {
          const b = balls[i];
          if (b == null) return <li key={i} className="md-ball md-yet" aria-label="still to come" />;
          const kind = b === 'W' ? 'md-w' : b === '6' ? 'md-six' : b === '4' ? 'md-four' : b === '•' ? 'md-dot' : 'md-run';
          return (
            <li key={i} className={`md-ball ${kind}`} style={b === '4' || b === '6' ? { background: INDIA } : undefined}>
              {b}
            </li>
          );
        })}
      </ol>
      <div className="seg md-ck-btns" aria-label="Bowl the next ball">
        {OUTCOMES.map(([mark, , words]) => (
          <button key={mark} type="button" disabled={over} aria-label={`Bowl ${words}`} onClick={() => setBalls((x) => [...x, mark])}>
            {mark}
          </button>
        ))}
        <button type="button" disabled={!balls.length} onClick={() => setBalls([])}>
          Again
        </button>
      </div>
      <p className="md-legend">
        A four takes the batting side’s colour and a six gets a ring as well, so it still reads for the one man in twelve who
        is colour-blind. A wicket is red.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ F1: the race weekend */

/** A race weekend's title card: `races` with their circuits, `moments` with their countdowns. */
export function RaceWeek({ races, moments }) {
  const [race, setRace] = useState('monaco');
  const [moment, setMoment] = useState('week');
  const r = races.find((x) => x.id === race);
  const m = moments.find((x) => x.key === moment);
  return (
    <div className="md-f1">
      <div className="md-card-ink">
        <svg className="md-track" viewBox={`-3 -3 ${r.w + 6} ${r.h + 6}`} role="img" aria-label={`The ${r.circuit}`}>
          <path d={r.path} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <p className="md-kick">Round {r.round} of 23</p>
        <p className="md-name">{r.name}</p>
        <div className="md-now" aria-live="polite">
          {m.count ? (
            <>
              <span className="md-label">{m.label}</span>
              <span className="md-count">
                {m.count.map(([n, unit]) => (
                  <span key={unit}>
                    <b>{n}</b> {unit}
                  </span>
                ))}
              </span>
            </>
          ) : (
            <>
              <span className="md-label md-on">
                <i aria-hidden="true" /> On now
              </span>
              <span className="md-count">
                <b>Qualifying</b>
              </span>
            </>
          )}
        </div>
        <p className="md-facts">
          {(r.length / 1000).toFixed(1)} km a lap · first Grand Prix here {r.firstGp}
        </p>
      </div>
      <div className="md-pick">
        <span className="seg" aria-label="Circuit">
          {races.map((x) => (
            <button key={x.id} type="button" aria-pressed={race === x.id} onClick={() => setRace(x.id)}>
              {x.short}
            </button>
          ))}
        </span>
        <span className="seg" aria-label="When">
          {moments.map((x) => (
            <button key={x.key} type="button" aria-pressed={moment === x.key} onClick={() => setMoment(x.key)}>
              {x.button}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}
