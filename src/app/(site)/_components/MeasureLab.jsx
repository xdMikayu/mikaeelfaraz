'use client';

import { useState } from 'react';

// Did the programme work, or did the whole market move? A fictional before-and-after for venues
// in a programme against a comparison group. All numbers are made up; the method is the point.
const BASE = 100; // weekly sales index before, both groups
const EFFECT = 6; // what the programme really added, in points (fictional)

export default function MeasureLab() {
  const [market, setMarket] = useState(12);
  const [adjust, setAdjust] = useState(true);

  const controlAfter = BASE + market;
  const programmeAfter = BASE + market + EFFECT;
  const raw = programmeAfter - BASE;
  const adjusted = programmeAfter - controlAfter;
  const shown = adjust ? adjusted : raw;

  const lo = 70;
  const hi = 140;
  const x = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
  const sign = (v) => (v > 0 ? `+${v}` : `${v}`);

  return (
    <div className="lab measure" aria-label="Example: measuring a programme against a comparison group">
      <div className="lab-controls">
        <label className="lab-range">
          <span>Meanwhile, the whole market moved <b className="mono">{sign(market)}%</b></span>
          <input type="range" min="-20" max="25" value={market} onChange={(e) => setMarket(Number(e.target.value))} />
        </label>
        <div className="seg" role="group" aria-label="How to measure">
          <button type="button" aria-pressed={!adjust} onClick={() => setAdjust(false)}>Before vs after</button>
          <button type="button" aria-pressed={adjust} onClick={() => setAdjust(true)}>Against a comparison group</button>
        </div>
      </div>

      <div className="dumb" role="img" aria-label={`Programme venues went from ${BASE} to ${programmeAfter}; comparison venues from ${BASE} to ${controlAfter}.`}>
        {[['Venues in the programme', programmeAfter, 'prog'], ['Comparison venues', controlAfter, 'ctrl']].map(([label, after, cls]) => (
          <div key={cls} className={`dumb-row ${cls}${!adjust && cls === 'ctrl' ? ' quiet' : ''}`}>
            <span className="dumb-label">{label}</span>
            <span className="dumb-track">
              <span className="dumb-line" style={{ left: x(Math.min(BASE, after)), width: `calc(${x(Math.max(BASE, after))} - ${x(Math.min(BASE, after))})` }} />
              <span className="dumb-a" style={{ left: x(BASE) }} title={`Before: ${BASE}`} />
              <span className="dumb-b" style={{ left: x(after) }} title={`After: ${after}`} />
            </span>
            <span className="dumb-val mono">{sign(after - BASE)}</span>
          </div>
        ))}
        <div className="dumb-axis mono faint"><span>before = 100</span><span>sales index</span></div>
      </div>

      <p className="lab-result">
        <b>Measured effect: {sign(shown)} points.</b>{' '}
        {adjust
          ? `The comparison group moved ${sign(market)} too, so that part is taken out. This is the number worth acting on.`
          : market > 0
            ? `Looks good, but ${market} of those points were the market rising, not the programme.`
            : market < 0
              ? `Looks weak, but the market fell ${-market} points over the same weeks and hid the programme’s real effect.`
              : 'With a flat market, both methods agree.'}
      </p>
      <p className="lab-note mono faint">Fictional numbers. The method is the one I use: difference-in-differences against a comparison group</p>
    </div>
  );
}
