'use client';
// A copy of the four Mifolio charts the homepage demo uses (MifolioMini). Mifolio itself now lives
// in its own repo at mifolio.mikaeelfaraz.com; this copy only draws made-up numbers and is styled
// by the --fin-* tokens in site.css.
import { useEffect, useMemo, useRef, useState } from 'react';

const aed = (n, { decimals = 2 } = {}) => {
  const v = Number(n) || 0;
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${v < 0 ? '−' : ''}AED ${s}`;
};

/** Compact axis figures: 950, 1.2K, 12.9K, 1.1M */
function compact(n) {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K`;
  return `${Math.round(v)}`;
}

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

/**
 * Hover or drag across a line chart to read a day. Pointer events for mouse, pen and touch;
 * the chart's touch-action: pan-y leaves vertical swipes to the page (the browser cancels the
 * pointer when it scrolls). The rect is measured once per gesture and updates are batched to
 * one per frame, so a drag re-renders the crosshair, not the whole chart, at most 60 times a second.
 */
function useScrub(toIndex) {
  const [hover, setHover] = useState(null);
  const st = useRef({ rect: null, x: 0, raf: 0 });
  const toIndexRef = useRef(toIndex);
  toIndexRef.current = toIndex;
  useEffect(() => {
    const s = st.current;
    const forget = () => { s.rect = null; };
    window.addEventListener('scroll', forget, { passive: true });
    return () => { window.removeEventListener('scroll', forget); cancelAnimationFrame(s.raf); };
  }, []);
  const queue = (e) => {
    const s = st.current;
    if (!s.rect) s.rect = e.currentTarget.getBoundingClientRect();
    s.x = e.clientX - s.rect.left;
    if (!s.raf) s.raf = requestAnimationFrame(() => {
      s.raf = 0;
      const i = toIndexRef.current(s.x);
      setHover((h) => (h === i ? h : i));
    });
  };
  const end = () => {
    cancelAnimationFrame(st.current.raf);
    st.current.raf = 0;
    st.current.rect = null;
    setHover(null);
  };
  const handlers = {
    onPointerDown: queue,
    onPointerMove: queue,
    onPointerLeave: end,
    onPointerCancel: end,
    onPointerUp: (e) => e.pointerType !== 'mouse' && end(),
  };
  return [hover, handlers];
}

/** Clean axis ticks: 0, 500, 1,000 … */
function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw);
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function Row({ color, label, value, sub }) {
  return (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <span className="fin-chip"><span className="fin-dot" style={{ background: color }} />{label}</span>
      <span className="text-right">
        <span className="fin-num whitespace-nowrap font-medium">{value}</span>
        {sub && <span className="block fin-muted">{sub}</span>}
      </span>
    </div>
  );
}

// Category ring colours by rank (validated as a set, see mifolio.css in the Mifolio repo); the rest share a neutral.
const RING = ['var(--fin-k1)', 'var(--fin-k2)', 'var(--fin-k3)', 'var(--fin-k4)', 'var(--fin-k5)', 'var(--fin-k6)'];
const RING_OTHER = 'var(--fin-k-other)';

/** Top six categories plus "Everything else", each with its ring colour. */
export function ringSlices(categories) {
  const live = categories.filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  const top = live.slice(0, 6).map((c, i) => ({ key: c.category, label: c.category, total: c.total, count: c.count, color: RING[i] }));
  const rest = live.slice(6);
  if (rest.length) top.push({ key: '__rest', label: 'Everything else', total: rest.reduce((t, c) => t + c.total, 0), count: rest.reduce((t, c) => t + c.count, 0), color: RING_OTHER, members: rest.map((c) => c.category) });
  return top;
}

/**
 * Where the money went as a ring of rounded segments with gaps between them; tap a segment
 * (or its chip) to see that category in the middle. `center(slice|null)` renders the middle.
 */
export function CategoryRing({ slices, selected, onSelect, size = 232, center }) {
  const total = slices.reduce((t, s) => t + s.total, 0);
  const sw = 16;
  const r = size / 2 - sw / 2 - 2;
  const c = size / 2;
  const capGap = sw / r; // round caps reach this far past each end (in radians, both caps)
  const gap = capGap + 0.045;
  let a = -Math.PI / 2;
  const arcs = slices.map((s) => {
    const span = total > 0 ? (s.total / total) * Math.PI * 2 : 0;
    const a0 = a + gap / 2;
    const a1 = a + span - gap / 2;
    a += span;
    return { ...s, a0, a1, dot: a1 <= a0 };
  });
  const pt = (ang) => [c + r * Math.cos(ang), c + r * Math.sin(ang)];
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label="Spend by category">
        {total === 0 && <circle cx={c} cy={c} r={r} fill="none" stroke="var(--fin-surface-3)" strokeWidth={sw} />}
        {arcs.map((s) => {
          const dim = selected && selected !== s.key;
          const common = { stroke: s.color, strokeWidth: sw, strokeLinecap: 'round', fill: 'none', opacity: dim ? 0.22 : 1, style: { cursor: 'pointer', transition: 'opacity 0.15s' }, onClick: () => onSelect(selected === s.key ? null : s.key) };
          if (s.dot) {
            const [x, y] = pt((s.a0 + s.a1) / 2);
            return <line key={s.key} x1={x} y1={y} x2={x + 0.01} y2={y} {...common}><title>{s.label}</title></line>;
          }
          const [x0, y0] = pt(s.a0);
          const [x1, y1] = pt(s.a1);
          const large = s.a1 - s.a0 > Math.PI ? 1 : 0;
          return <path key={s.key} d={`M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`} {...common}><title>{s.label}</title></path>;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        {center(slices.find((s) => s.key === selected) || null)}
      </div>
    </div>
  );
}

/**
 * Net worth over time: a 2px line with a faint flat fill under it, and a crosshair that
 * reads out the day. points: [{ day: 'YYYY-MM-DD', total }], oldest first.
 */
export function NetWorthLine({ points, height = 200, format = (v) => aed(v, { decimals: 0 }) }) {
  const [ref, width] = useWidth();
  const pad = { top: 12, right: 12, bottom: 24, left: 52 };
  const iw = Math.max(10, width - pad.left - pad.right);
  const [hover, scrub] = useScrub((px) => Math.max(0, Math.min(points.length - 1, Math.round(((px - pad.left) / iw) * (points.length - 1)))));
  const geo = useMemo(() => {
    if (!points.length) return null;
    const vals = points.map((p) => p.total);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (hi - lo < Math.max(1, hi * 0.02)) { lo -= Math.max(1, hi * 0.02); hi += Math.max(1, hi * 0.02); }
    const span = hi - lo;
    lo -= span * 0.12;
    hi += span * 0.08;
    const ih = height - pad.top - pad.bottom;
    const x = (i) => pad.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
    const y = (v) => pad.top + ih - ((v - lo) / (hi - lo)) * ih;
    return { x, y, ih, lo, hi };
  }, [points, height, iw]); // eslint-disable-line react-hooks/exhaustive-deps
  const fmtDay = (d) => { const [yy, mm, dd] = d.split('-').map(Number); return `${dd} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mm - 1]}${points.length > 200 ? ` ${yy}` : ''}`; };
  // Everything that doesn't move with the pointer, drawn once per data/size change.
  const staticLayer = useMemo(() => {
    if (!geo || !width) return null;
    const { x, y, ih, lo, hi } = geo;
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join('');
    const area = `${line}L${x(points.length - 1)},${pad.top + ih}L${x(0)},${pad.top + ih}Z`;
    const ticks = [lo + (hi - lo) * 0.15, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.85];
    const labelAt = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((v, i, a) => a.indexOf(v) === i);
    return (
      <>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--fin-grid)" />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--fin-muted)" className="fin-num">{compact(t)}</text>
          </g>
        ))}
        <path d={area} fill="var(--fin-ink)" opacity="0.05" />
        <path d={line} fill="none" stroke="var(--fin-ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {labelAt.map((i) => (
          <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--fin-muted)">{fmtDay(points[i].day)}</text>
        ))}
      </>
    );
  }, [geo, width, points, height]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!geo) return <div ref={ref} style={{ height }} />;
  const { x, y, ih } = geo;
  const h = hover != null ? points[hover] : null;
  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Net worth over time" {...scrub} style={{ touchAction: 'pan-y' }}>
          {staticLayer}
          {h && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + ih} stroke="var(--fin-axis)" />
              <circle cx={x(hover)} cy={y(h.total)} r="4" fill="var(--fin-surface)" stroke="var(--fin-ink)" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {h && (
        <div className="fin-tooltip" style={{ left: 0, top: -8, transform: `translateX(${Math.min(Math.max(0, x(hover) - 75), Math.max(0, width - 160))}px)` }}>
          <p className="text-xs fin-muted">{fmtDay(h.day)}</p>
          <p className="fin-num text-sm font-semibold">{format(h.total)}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Running total through the month (or week): this period as a solid line up to today, a
 * dotted run-on to where today's pace lands, last period as a quiet line, and an even pace
 * to a typical period as a dashed diagonal. Hover or drag to read any day.
 */
export function PaceChart({ pace, height = 230, color = 'var(--fin-ink)' }) {
  const [ref, width] = useWidth();
  const pad = { top: 14, right: 16, bottom: 26, left: 48 };
  const pts = pace.points;
  const n = pts.length;
  const iw = Math.max(10, width - pad.left - pad.right);
  const ih = height - pad.top - pad.bottom;
  const [hover, scrub] = useScrub((px) => Math.max(0, Math.min(n - 1, Math.round(((px - pad.left) / iw) * (n - 1)))));
  const max = Math.max(1, pace.projected || 0, ...pts.map((p) => Math.max(p.cur || 0, p.prev || 0, p.even || 0)));
  const ticks = niceTicks(max, 3);
  const top = ticks[ticks.length - 1];
  const x = (i) => pad.left + (n === 1 ? 0 : (i / (n - 1)) * iw);
  const y = (v) => pad.top + ih - (v / top) * ih;
  // Everything that doesn't move with the pointer, drawn once per data/size change.
  const staticLayer = useMemo(() => {
    if (!width) return null;
    const path = (key) => pts.filter((p) => p[key] != null).map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p[key]).toFixed(1)}`).join('');
    const last = pts.filter((p) => p.cur != null).at(-1);
    const curPath = path('cur');
    const area = last ? `${curPath}L${x(last.i)},${y(0)}L${x(0)},${y(0)}Z` : '';
    const labelIdx = pace.unit === 'week' ? pts.map((p) => p.i) : pts.filter((p) => [1, 8, 15, 22].includes(p.day) || p.i === n - 1).map((p) => p.i);
    return (
      <>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--fin-axis)' : 'var(--fin-grid)'} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--fin-muted)" className="fin-num">{compact(t)}</text>
          </g>
        ))}
        {pts[0].even != null && <path d={path('even')} fill="none" stroke="var(--fin-compare)" strokeWidth="1.5" strokeDasharray="4 4" />}
        <path d={path('prev')} fill="none" stroke="var(--fin-compare)" strokeWidth="1.75" strokeLinejoin="round" />
        {area && <path d={area} fill={color} opacity="0.06" />}
        {curPath && <path d={curPath} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />}
        {last && pace.projected != null && !pace.complete && (
          <path d={`M${x(last.i)},${y(last.cur)}L${x(n - 1)},${y(pace.projected)}`} fill="none" stroke={color} strokeWidth="1.75" strokeDasharray="2 4" strokeLinecap="round" opacity="0.55" />
        )}
        {last && <circle cx={x(last.i)} cy={y(last.cur)} r="4" fill={color} stroke="var(--fin-surface)" strokeWidth="2" />}
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={height - 7} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="11" fill={last && i === last.i ? 'var(--fin-ink)' : 'var(--fin-muted)'}>{pts[i].label}</text>
        ))}
      </>
    );
  }, [pace, width, height, color]); // eslint-disable-line react-hooks/exhaustive-deps
  const h = hover != null ? pts[hover] : null;
  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Running total this period against last period" {...scrub} style={{ touchAction: 'pan-y' }}>
          {staticLayer}
          {h && <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + ih} stroke="var(--fin-axis)" />}
        </svg>
      )}
      {h && (
        <div className="fin-tooltip" style={{ left: 0, top: 0, transform: `translateX(${Math.min(Math.max(0, x(hover) - 80), Math.max(0, width - 180))}px)` }}>
          <p className="mb-1.5 font-semibold">{pace.unit === 'week' ? h.label : `Day ${h.day}`}</p>
          <Row color={color} label="This period" value={h.cur == null ? '—' : aed(h.cur, { decimals: 0 })} />
          <Row color="var(--fin-compare)" label="Last period" value={aed(h.prev, { decimals: 0 })} />
          {h.even != null && <Row color="var(--fin-compare)" label="Typical pace" value={aed(h.even, { decimals: 0 })} />}
        </div>
      )}
    </div>
  );
}
