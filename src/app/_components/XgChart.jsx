'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Minute on the chart's axis: first-half stoppage sits on 45, second-half stoppage runs past 90. */
export function axisMinute(display = '') {
  const m = String(display).match(/(\d+)'?(?:\+(\d+))?/);
  if (!m) return 0;
  const base = Number(m[1]);
  const extra = Number(m[2] ?? 0);
  if (base === 45 && extra) return 45;
  return base + extra;
}

const PAD = { top: 14, right: 44, bottom: 24, left: 34 };

/** Cumulative xG for both teams as step lines, goals marked on the steps. */
export default function XgChart({ shots, colors, names, endMinute }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const H = 190;
  const series = useMemo(() => {
    const out = {};
    for (const side of ['home', 'away']) {
      let cum = 0;
      const pts = [{ m: 0, v: 0 }];
      for (const s of shots.filter((x) => x.side === side && x.xg != null)) {
        const m = axisMinute(s.minute);
        pts.push({ m, v: cum, shot: s, step: false });
        cum += s.xg;
        pts.push({ m, v: cum, shot: s, step: true });
      }
      out[side] = { pts, total: cum };
    }
    return out;
  }, [shots]);
  const maxM = Math.max(90, endMinute ?? 0, ...shots.map((s) => axisMinute(s.minute)));
  const maxV = Math.max(1, series.home.total, series.away.total);
  const step = maxV > 3 ? 1 : 0.5;
  const top = Math.ceil(maxV / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(1));
  const iw = Math.max(0, width - PAD.left - PAD.right);
  const ih = H - PAD.top - PAD.bottom;
  const x = (m) => PAD.left + (m / maxM) * iw;
  const y = (v) => PAD.top + ih - (v / top) * ih;
  const path = (pts) => {
    const end = Math.min(maxM, endMinute ?? maxM);
    const all = [...pts, { m: Math.max(end, pts[pts.length - 1].m), v: pts[pts.length - 1].v }];
    return all.map((p, i) => `${i ? 'L' : 'M'}${x(p.m).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  };
  const at = (side, m) => {
    let v = 0;
    for (const p of series[side].pts) if (p.m <= m && p.step) v = p.v;
    return v;
  };
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const m = Math.round(((e.clientX - r.left - PAD.left) / iw) * maxM);
    if (m < 0 || m > maxM) return setHover(null);
    setHover({ m, px: x(m) });
  };
  // End labels only when they won't collide; the legend always carries identity.
  const endY = { home: y(series.home.total), away: y(series.away.total) };
  const labelsFit = Math.abs(endY.home - endY.away) >= 14;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="sp-tiny sp-ink2" style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
        {['home', 'away'].map((s) => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i style={{ width: 14, height: 2, background: colors[s], display: 'inline-block', borderRadius: 2 }} />
            {names[s]} <b className="sp-num" style={{ color: 'var(--sp-ink)' }}>{series[s].total.toFixed(2)}</b>
          </span>
        ))}
      </div>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={`Expected goals over time: ${names.home} ${series.home.total.toFixed(2)}, ${names.away} ${series.away.total.toFixed(2)}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ display: 'block', touchAction: 'pan-y' }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={PAD.left + iw} y1={y(t)} y2={y(t)} stroke="var(--sp-rule)" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--sp-muted)" className="sp-num">{t.toFixed(1)}</text>
            </g>
          ))}
          {[0, 15, 30, 45, 60, 75, 90].map((m) => (
            <text key={m} x={x(m)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--sp-muted)" className="sp-num">{m}′</text>
          ))}
          <line x1={x(45)} x2={x(45)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--sp-rule-2)" />
          {['away', 'home'].map((s) => (
            <path key={s} d={path(series[s].pts)} fill="none" stroke={colors[s]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {['home', 'away'].flatMap((s) =>
            series[s].pts.filter((p) => p.step && p.shot.outcome === 'goal').map((p) => (
              <circle key={p.shot.id} cx={x(p.m)} cy={y(p.v)} r="4.5" fill={colors[s]} stroke="var(--sp-surface)" strokeWidth="2" />
            ))
          )}
          {labelsFit &&
            ['home', 'away'].map((s) => (
              <text key={s} x={PAD.left + iw + 6} y={endY[s] + 4} fontSize="11.5" fontWeight="600" fill="var(--sp-ink)" className="sp-num">{series[s].total.toFixed(2)}</text>
            ))}
          {hover && (
            <line x1={hover.px} x2={hover.px} y1={PAD.top} y2={PAD.top + ih} stroke="var(--sp-ink-2)" strokeWidth="1" />
          )}
        </svg>
      )}
      {hover && (
        <div className="sp-tip" style={{ left: Math.min(hover.px + 10, width - 170), top: 26 }}>
          <b className="sp-num">{hover.m}′</b>
          {['home', 'away'].map((s) => (
            <div key={s} className="sp-num" style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: colors[s], display: 'inline-block' }} />{names[s]}</span>
              <b>{at(s, hover.m).toFixed(2)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
