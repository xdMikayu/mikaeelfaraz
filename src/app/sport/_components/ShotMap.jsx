'use client';
import { useState } from 'react';

const OUTCOME = { goal: 'Goal', saved: 'Saved', off: 'Off target', blocked: 'Blocked', post: 'Hit the woodwork' };

/**
 * Both teams on one pitch: home shoots at the right-hand goal, away at the left.
 * Circle area is the chance's xG; filled means scored, a ring means on target, a faint ring
 * means off target or blocked.
 */
export default function ShotMap({ shots, colors, names }) {
  const [sel, setSel] = useState(null);
  const [only, setOnly] = useState('both');
  const shown = shots.filter((s) => only === 'both' || s.side === only);
  // ESPN gives positions as % of the pitch with the attack towards x = 100; y < 50 is the
  // attacker's right. Home attacks right (their right is down the screen), away is mirrored.
  const pos = (s) => (s.side === 'home' ? { x: (s.x / 100) * 105, y: ((100 - s.y) / 100) * 68 } : { x: ((100 - s.x) / 100) * 105, y: (s.y / 100) * 68 });
  const r = (s) => 0.7 + Math.sqrt(s.xg ?? 0.02) * 3.4;
  const line = { fill: 'none', stroke: 'var(--sp-pitch-line)', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' };
  const cur = sel && shots.find((s) => s.id === sel);
  return (
    <div>
      <div className="sp-tabs" role="tablist" style={{ marginBottom: 12 }}>
        {[['both', 'Both'], ['home', names.home], ['away', names.away]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={only === k} onClick={() => setOnly(k)}>{l}</button>
        ))}
      </div>
      <div className="sp-pitch-wrap" style={{ position: 'relative' }}>
        <svg viewBox="-2 -2 109 72" style={{ display: 'block', width: '100%' }} role="img" aria-label="Shot map">
          <rect x="0" y="0" width="105" height="68" {...line} />
          <line x1="52.5" y1="0" x2="52.5" y2="68" {...line} />
          <circle cx="52.5" cy="34" r="9.15" {...line} />
          {[0, 105].map((gx) => {
            const d = gx ? -1 : 1;
            return (
              <g key={gx}>
                <rect x={gx ? gx - 16.5 : 0} y={34 - 20.16} width="16.5" height="40.32" {...line} />
                <rect x={gx ? gx - 5.5 : 0} y={34 - 9.16} width="5.5" height="18.32" {...line} />
                <circle cx={gx + d * 11} cy="34" r="0.35" fill="var(--sp-pitch-line)" />
                <line x1={gx} y1={34 - 3.66} x2={gx} y2={34 + 3.66} stroke="var(--sp-ink-2)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
          {[...shown].sort((a, b) => (b.xg ?? 0) - (a.xg ?? 0)).map((s) => {
            const p = pos(s);
            const c = colors[s.side];
            const goal = s.outcome === 'goal';
            const onT = s.outcome === 'saved' || s.outcome === 'post';
            return (
              <g key={s.id} onClick={() => setSel(sel === s.id ? null : s.id)} onPointerEnter={(e) => e.pointerType === 'mouse' && setSel(s.id)} style={{ cursor: 'pointer' }}>
                <circle cx={p.x} cy={p.y} r={r(s)} fill={goal ? c : 'var(--sp-pitch)'} fillOpacity={goal ? 1 : 0.6} stroke={goal ? 'var(--sp-pitch)' : c} strokeOpacity={goal || onT ? 1 : 0.45} strokeWidth={goal ? 1.5 : 2} vectorEffect="non-scaling-stroke" />
                {sel === s.id && <circle cx={p.x} cy={p.y} r={r(s) + 1.2} fill="none" stroke="var(--sp-ink)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
                <circle cx={p.x} cy={p.y} r={Math.max(2.6, r(s))} fill="transparent" />
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ minHeight: 44, marginTop: 10 }} aria-live="polite">
        {cur ? (
          <p className="sp-small" style={{ margin: 0 }}>
            <b className="sp-num">{cur.minute}</b> {cur.player}, {OUTCOME[cur.outcome].toLowerCase()}, <span className="sp-num">{cur.xg != null ? `${cur.xg.toFixed(2)} xG` : 'no xG'}</span>
            <span className="sp-muted" style={{ display: 'block' }}>{cur.text}</span>
          </p>
        ) : (
          <p className="sp-tiny sp-muted" style={{ margin: 0 }}>
            Bigger circle, better chance. Filled: scored. Ring: on target. Faint ring: off target or blocked. Tap a shot for details.
          </p>
        )}
      </div>
    </div>
  );
}
