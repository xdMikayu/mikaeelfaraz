'use client';
import { useMemo, useState } from 'react';
import { lapText, gapText } from '@/lib/sport/f1.mjs';
import { Mark } from './f1bits';
import { heat } from './fplbits';

// The F1 session charts, drawn from the session data (scripts/sport/f1_sessions.py): positions lap
// by lap, tyre strategies, race pace, and two qualifying laps traced along the track. Team colours
// only; a team's second driver is dashed where both are drawn.

const FLAG_WORD = { SC: 'safety car', VSC: 'virtual safety car', RED: 'red flag' };

/** Each code's colour and whether it's its team's second driver (dashed), in the given order. */
function styles(order, drivers, colorOf) {
  const seen = {};
  const out = {};
  for (const code of order) {
    const d = drivers.find((x) => x.code === code);
    const team = d?.team ?? code;
    out[code] = { color: colorOf(team) ?? 'var(--sp-muted)', dashed: Boolean(seen[team]) };
    seen[team] = true;
  }
  return out;
}

/** Laps under each kind of caution, merged into runs: [{ flag, from, to }]. */
function cautionRuns(flags) {
  const runs = [];
  flags.forEach((f, i) => {
    if (!FLAG_WORD[f]) return;
    const last = runs[runs.length - 1];
    if (last && last.flag === f && last.to === i) last.to = i + 1;
    else runs.push({ flag: f, from: i + 1, to: i + 1 });
  });
  return runs;
}

/** Positions lap by lap: one line per driver, tap a name to pick him out. */
export function LapChart({ s, colorOf }) {
  const order = s.classification.map((c) => c.code).filter((c) => s.byLap[c]);
  const [pick, setPick] = useState(null);
  const st = useMemo(() => styles(order, s.drivers, colorOf), [order, s.drivers, colorOf]);
  const n = s.laps;
  const cars = Math.max(order.length, ...order.map((c) => Math.max(...s.byLap[c].pos.filter(Boolean))));
  const W = 640;
  const H = 18 * cars + 8;
  const x = (lap) => 30 + (lap / n) * (W - 70);
  const y = (p) => 6 + ((p - 1) / Math.max(1, cars - 1)) * (H - 14);
  const runs = cautionRuns(s.flags);
  return (
    <figure className="sp-f1-fig">
      <div className="sp-f1-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} className="sp-f1-svg" style={{ minWidth: 520 }} role="img" aria-label="Positions lap by lap">
          {runs.map((r) => (
            <rect key={`${r.flag}${r.from}`} x={x(r.from - 1)} y={0} width={x(r.to) - x(r.from - 1)} height={H} fill={r.flag === 'RED' ? 'var(--sp-live)' : 'var(--sp-ink)'} opacity={r.flag === 'RED' ? 0.12 : r.flag === 'SC' ? 0.1 : 0.05} />
          ))}
          {order.map((code) => {
            const pts = s.byLap[code].pos.map((p, lap) => (p ? `${x(lap).toFixed(1)},${y(p).toFixed(1)}` : null)).filter(Boolean);
            const on = !pick || pick === code;
            return (
              <polyline key={code} points={pts.join(' ')} fill="none" stroke={st[code].color} strokeWidth={pick === code ? 3 : 1.8} strokeDasharray={st[code].dashed ? '4 3' : undefined} opacity={on ? 1 : 0.15} strokeLinejoin="round" />
            );
          })}
          {order.map((code) => {
            const pos = s.byLap[code].pos;
            const lastLap = pos.length - 1;
            const p = pos[lastLap];
            return p ? (
              <text key={code} x={x(lastLap) + 4} y={y(p) + 4} fontSize="11" fontWeight="800" fill="var(--sp-ink)" opacity={!pick || pick === code ? 1 : 0.25}>
                {code}
              </text>
            ) : null;
          })}
          {order.map((code) => {
            const g = s.byLap[code].pos[0];
            return g ? (
              <text key={`g${code}`} x={24} y={y(g) + 4} fontSize="10.5" textAnchor="end" fill="var(--sp-muted)" opacity={!pick || pick === code ? 1 : 0.25}>
                {g}
              </text>
            ) : null;
          })}
        </svg>
      </div>
      <figcaption className="sp-tiny sp-muted">
        Grid on the left, lap {n} on the right.{' '}
        {runs.length > 0 && `Shaded: ${[...new Set(runs.map((r) => FLAG_WORD[r.flag]))].join(', ')} (${runs.map((r) => (r.from === r.to ? `lap ${r.from}` : `laps ${r.from}–${r.to}`)).join(', ')}).`} Tap a driver to pick him out.
      </figcaption>
      <div className="sp-f1-picks" role="group" aria-label="Pick out a driver">
        {order.map((code) => (
          <button key={code} aria-pressed={pick === code} onClick={() => setPick((p) => (p === code ? null : code))}>
            <Mark color={st[code].color} />
            {code}
          </button>
        ))}
      </div>
    </figure>
  );
}

export const COMPOUND = { SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W' };
// More ink for the softer tyre, as on a heat map; wet-weather tyres are outlined.
export const SHADE = { SOFT: 0.95, MEDIUM: 0.55, HARD: 0.12 };

/** Each driver's stints along the race, in finishing order, with the compound in each. */
export function TyreStrip({ s, colorOf }) {
  const order = s.classification.map((c) => c.code).filter((c) => s.stints[c]);
  const n = s.laps;
  const st = styles(order, s.drivers, colorOf);
  return (
    <figure className="sp-f1-fig">
      <div className="sp-f1-tyres">
        {order.map((code) => {
          const stops = s.pits[code]?.length ?? 0;
          return (
            <div key={code} className="sp-f1-tyre-row">
              <span className="sp-f1-tyre-who">
                <Mark color={st[code].color} />
                <b>{code}</b>
              </span>
              <span className="sp-f1-tyre-bar" title={`${code}: ${s.stints[code].map(([c, a, b]) => `${COMPOUND[c] ?? '?'} laps ${a}–${b}`).join(', ')}`}>
                {s.stints[code].map(([c, a, b, age]) => {
                  const wet = c === 'INTERMEDIATE' || c === 'WET';
                  const t = SHADE[c] ?? 0;
                  return (
                    <i
                      key={a}
                      style={{
                        left: `${((a - 1) / n) * 100}%`,
                        width: `${((b - a + 1) / n) * 100}%`,
                        ...(wet ? { boxShadow: 'inset 0 0 0 1.5px var(--sp-ink)', color: 'var(--sp-ink)' } : heat(t)),
                      }}
                    >
                      {b - a >= 3 ? `${COMPOUND[c] ?? '?'}${age ? '*' : ''}` : ''}
                    </i>
                  );
                })}
              </span>
              <span className="sp-tiny sp-muted sp-num">{stops ? `${stops} ${stops === 1 ? 'stop' : 'stops'}` : 'no stop'}</span>
            </div>
          );
        })}
      </div>
      <figcaption className="sp-tiny sp-muted">S soft, M medium, H hard (more ink is softer), I intermediate, W wet; * a used set. Lap 1 on the left, lap {n} on the right.</figcaption>
    </figure>
  );
}

/** Race pace: each driver's median clean lap against the quickest, as bars. */
export function PaceList({ pace, colorOf, drivers, note }) {
  if (!pace?.length) return <p className="sp-note sp-pad">Not enough clean laps to compare pace.</p>;
  const best = pace[0].median;
  const worst = pace[pace.length - 1].median;
  const st = styles(pace.map((p) => p.code), drivers, colorOf);
  return (
    <div>
      <ol className="sp-f1-pace">
        {pace.map((p, i) => (
          <li key={p.code}>
            <span className="sp-num sp-muted">{i + 1}</span>
            <span className="sp-f1-tyre-who">
              <Mark color={st[p.code].color} />
              <b>{p.code}</b>
            </span>
            <span className="sp-f1-pace-bar">
              <i style={{ width: `${worst > best ? 6 + ((p.median - best) / (worst - best)) * 94 : 6}%`, background: st[p.code].color }} />
            </span>
            <span className="sp-num">{lapText(p.median)}</span>
            <span className="sp-num sp-muted">{i ? gapText(p.median - best) : ''}</span>
          </li>
        ))}
      </ol>
      {note && <p className="sp-tiny sp-muted sp-pad" style={{ margin: '6px 0 0' }}>{note}</p>}
    </div>
  );
}

/** Two qualifying laps along the track: speed for each, and how the gap built up. */
export function LapTrace({ trace, colorOf, drivers }) {
  const [a, b] = trace.codes;
  const st = styles(trace.codes, drivers, colorOf);
  const d = trace.distance;
  const len = d[d.length - 1];
  const W = 640;
  const H = 150;
  const DH = 70;
  const vmax = Math.max(...trace.laps.flatMap((l) => l.speed));
  const vmin = Math.min(...trace.laps.flatMap((l) => l.speed));
  const x = (m) => (m / len) * W;
  const y = (v) => H - 6 - ((v - vmin) / (vmax - vmin || 1)) * (H - 12);
  const line = (vals, yy) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(d[i]).toFixed(1)} ${yy(v).toFixed(1)}`).join('');
  const dmax = Math.max(0.05, ...trace.delta.map(Math.abs));
  const dy = (v) => DH / 2 - (v / dmax) * (DH / 2 - 4);
  const end = trace.delta[trace.delta.length - 1];
  // Each line named at its end, so it reads without telling the colours apart; kept 16% apart.
  const ends = trace.laps.map((l, i) => ({ code: trace.codes[i], at: (y(l.speed[l.speed.length - 1]) / H) * 100 }));
  if (ends.length === 2 && Math.abs(ends[0].at - ends[1].at) < 16) {
    const mid = (ends[0].at + ends[1].at) / 2;
    const [hi, lo] = ends[0].at <= ends[1].at ? [ends[0], ends[1]] : [ends[1], ends[0]];
    hi.at = Math.max(8, mid - 8);
    lo.at = Math.min(92, hi.at + 16);
  }
  return (
    <figure className="sp-f1-fig">
      <div className="sp-f1-ends">
        <svg viewBox={`0 0 ${W} ${H}`} className="sp-f1-svg" preserveAspectRatio="none" role="img" aria-label={`Speed along the lap, ${a} and ${b}`}>
          {trace.laps.map((l, i) => (
            <path key={trace.codes[i]} d={line(l.speed, y)} fill="none" stroke={st[trace.codes[i]].color} strokeWidth="2" strokeDasharray={st[trace.codes[i]].dashed ? '5 3' : undefined} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {ends.map((e) => (
          <span key={e.code} className="sp-f1-end" style={{ top: `${e.at}%`, color: st[e.code].color }} aria-hidden="true">
            {e.code}
          </span>
        ))}
      </div>
      {/* The same width as the speed lines above, so the two line up along the lap. */}
      <div className="sp-f1-axis sp-f1-ends sp-tiny sp-muted">
        <span>Speed, {vmin}–{vmax} km/h</span>
        <span>{(len / 1000).toFixed(2)} km</span>
      </div>
      <div className="sp-f1-ends" style={{ marginTop: 8 }}>
        <svg viewBox={`0 0 ${W} ${DH}`} className="sp-f1-svg" preserveAspectRatio="none" role="img" aria-label={`Gap between ${a} and ${b} along the lap`}>
          <path d={`M0 ${DH / 2}H${W}`} stroke="var(--sp-rule-2)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <path d={line(trace.delta, dy)} fill="none" stroke="var(--sp-ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <figcaption className="sp-tiny sp-muted">
        Above: speed along the lap, <Mark color={st[a].color} /> {a} and <Mark color={st[b].color} /> {b}
        {st[b].dashed ? ' (dashed)' : ''}. Below: how far {b} was behind {a} at each point of the lap, rising where {a} gained; {gapText(end)} s at the line. From F1’s car data, about four readings a second, so small wiggles are noise.
      </figcaption>
    </figure>
  );
}
