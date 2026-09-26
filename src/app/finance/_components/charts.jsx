'use client';
// Hand-rolled SVG charts following the dataviz mark specs: 2px lines, <=24px
// bars with a 4px rounded data-end, 2px surface gaps between stacked segments,
// hairline grid, crosshair/per-mark tooltips, text in ink tokens only.
import { useEffect, useRef, useState } from 'react';
import { aed, compact } from './format';
import { accountColorVar } from '@/lib/finance/accounts.mjs';

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

/** Path for a column with rounded top (data end) and square base. */
function columnPath(x, y, w, h, r) {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

const PAD = { top: 16, right: 16, bottom: 26, left: 44 };

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="fin-chip">
          {it.line ? (
            <span style={{ width: 14, height: 2, background: it.color, display: 'inline-block', borderRadius: 2 }} />
          ) : (
            <span className="fin-dot" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Spend per day or week in one hue, with the comparison period's average as a dashed
 * reference line. Hover/tap a bar for that day's or week's biggest purchases.
 */
export function PeriodBars({ buckets, unit, average, averageLabel, height = 220, onSelect, color }) {
  // One card in focus: its brand colour. Otherwise plain ink.
  const fill = color || 'var(--fin-bar)';
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const max = Math.max(1, average || 0, ...buckets.map((b) => b.total));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const iw = Math.max(10, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const band = iw / buckets.length;
  const bw = Math.max(2, Math.min(20, band * 0.62)); // slim columns, generous gaps
  const y = (v) => PAD.top + ih - (v / top) * ih;
  // Axis labels come pre-picked (days 1/8/15/22/end, or month starts); drop any that would touch.
  const shown = new Set();
  let lastX = -Infinity;
  buckets.forEach((b, i) => {
    const cx = PAD.left + band * i + band / 2;
    if (b.label && cx - lastX >= b.label.length * 6.5 + 12) { shown.add(i); lastX = cx; }
  });
  const h = hover != null ? buckets[hover] : null;
  const per = unit === 'day' ? 'day' : unit === 'month' ? 'month' : 'week';

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        <span className="fin-chip"><span className="fin-dot" style={{ background: fill }} />Spent per {per}</span>
        {average != null && (
          <span className="fin-chip">
            <span style={{ width: 16, borderTop: '2px dashed var(--fin-compare)', display: 'inline-block' }} />
            {averageLabel} · <span className="fin-num">{`${aed(average, { decimals: 0 })}/${per}`}</span>
          </span>
        )}
      </div>
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={`Spend per ${per}`} onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--fin-axis)' : 'var(--fin-grid)'} strokeWidth="1" />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--fin-muted)" className="fin-num">{compact(t)}</text>
              </g>
            ))}
            {buckets.map((b, i) => {
              const cx = PAD.left + band * i + band / 2;
              const v = Math.max(0, b.total);
              const barH = v > 0 ? Math.max(2, y(0) - y(v)) : 0;
              return (
                <g key={i} onMouseEnter={() => setHover(i)} onClick={onSelect && !b.future ? () => onSelect(b) : undefined} style={onSelect && !b.future ? { cursor: 'pointer' } : undefined}>
                  <rect x={PAD.left + band * i} y={PAD.top} width={band} height={ih} fill="transparent" />
                  {barH > 0 && (
                    <path d={columnPath(cx - bw / 2, y(0) - barH, bw, barH, Math.min(2, bw / 2))} fill={fill}
                      opacity={hover == null || hover === i ? 1 : 0.45} />
                  )}
                  {shown.has(i) && (
                    <text x={cx} y={height - 8} textAnchor="middle" fontSize="11" fill={hover === i ? 'var(--fin-ink)' : 'var(--fin-muted)'}>{b.label}</text>
                  )}
                </g>
              );
            })}
            {average != null && (
              <line x1={PAD.left} x2={width - PAD.right} y1={y(average)} y2={y(average)} stroke="var(--fin-compare)" strokeWidth="1.5" strokeDasharray="4 4" pointerEvents="none" />
            )}
          </svg>
        )}
        {h && width > 0 && (
          <div className="fin-tooltip" style={{ left: Math.max(0, Math.min(PAD.left + band * hover + band / 2 + 12, width - 210)), top: 4, minWidth: 180 }}>
            <div className="flex justify-between gap-4 font-semibold">
              <span>{h.fullLabel}</span>
              <span className="fin-num">{h.future ? '—' : aed(h.total, { decimals: 0 })}</span>
            </div>
            {h.future ? (
              <div className="mt-1 fin-muted">Still to come</div>
            ) : h.count === 0 ? (
              <div className="mt-1 fin-muted">No spending</div>
            ) : (
              <div className="mt-1.5 space-y-0.5">
                {h.top.map((t, k) => (
                  <div key={k} className="flex justify-between gap-3">
                    <span className="truncate fin-ink-2" style={{ maxWidth: 140 }}>{t.merchant}</span>
                    <span className="fin-num whitespace-nowrap">{aed(t.amount, { decimals: 0 })}</span>
                  </div>
                ))}
                {h.count > h.top.length && <div className="fin-muted">+{h.count - h.top.length} more</div>}
              </div>
            )}
            {onSelect && !h.future && <div className="mt-1.5 fin-muted">Tap to open this {per}</div>}
          </div>
        )}
      </div>
    </div>
  );
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

/** Monthly spend stacked by card; `highlight` marks the months the selected period covers. */
export function SpendBars({ buckets, accounts, highlight = [], height = 220, label = 'Spend by card', onSelect }) {
  const lit = new Set(highlight);
  const partial = lit.size > 0 && lit.size < buckets.length; // only dim when the period is a subset
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  // Legend lists the cards in view; colour still follows each card's fixed slot.
  const present = accounts.filter((a) => buckets.some((b) => (b.parts[a.id] || 0) > 0));
  const max = Math.max(1, ...buckets.map((m) => m.total));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const iw = Math.max(10, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const band = iw / buckets.length;
  const bw = Math.min(24, band * 0.6);
  const y = (v) => PAD.top + ih - (v / top) * ih;
  const GAP = 2;
  const labelled = partial ? Math.max(...highlight) : buckets.length - 1;
  // Show every k-th axis label so they never touch (~6.5px per character at 11px, plus a gap).
  const longest = Math.max(...buckets.map((b) => b.label.length));
  const step = Math.max(1, Math.ceil((longest * 6.5 + 12) / band));
  const dim = (i) => (hover != null ? hover !== i : partial && !lit.has(i));

  return (
    <div>
      <div className="mb-2"><Legend items={present.map((a) => ({ label: a.name, color: accountColorVar(a.slug, accounts) }))} /></div>
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={label}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--fin-axis)' : 'var(--fin-grid)'} strokeWidth="1" />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--fin-muted)" className="fin-num">{compact(t)}</text>
              </g>
            ))}
            {buckets.map((mo, i) => {
              const cx = PAD.left + band * i + band / 2;
              const x0 = cx - bw / 2;
              let acc = 0;
              const segs = present
                .map((a) => ({ a, v: Math.max(0, mo.parts[a.id] || 0) }))
                .filter((s) => s.v > 0);
              return (
                <g key={mo.fullLabel} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  onClick={onSelect ? () => onSelect(mo, i) : undefined} style={onSelect ? { cursor: 'pointer' } : undefined}>
                  <rect x={PAD.left + band * i} y={PAD.top} width={band} height={ih} fill="transparent" />
                  {segs.map((s, j) => {
                    const y1 = y(acc + s.v);
                    const y0 = y(acc);
                    acc += s.v;
                    const isTop = j === segs.length - 1;
                    const h = Math.max(0, y0 - y1 - (j > 0 ? GAP : 0));
                    const color = accountColorVar(s.a.slug, accounts);
                    const opacity = dim(i) ? 0.4 : 1;
                    return isTop ? (
                      <path key={s.a.id} d={columnPath(x0, y1, bw, h, 2)} fill={color} opacity={opacity} />
                    ) : (
                      <rect key={s.a.id} x={x0} y={y1} width={bw} height={h} fill={color} opacity={opacity} />
                    );
                  })}
                  {((buckets.length - 1 - i) % step === 0 || (lit.size === 1 && lit.has(i))) && (
                    <text x={cx} y={height - 8} textAnchor="middle" fontSize="11" fill={hover === i || (partial && lit.has(i)) ? 'var(--fin-ink)' : 'var(--fin-muted)'} fontWeight={partial && lit.has(i) ? 600 : 400}>{mo.label}</text>
                  )}
                  {i === labelled && mo.total > 0 && (
                    <text x={cx} y={y(mo.total) - 6} textAnchor="middle" fontSize="11" fill="var(--fin-ink-2)" className="fin-num">{compact(mo.total)}</text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {hover != null && width > 0 && (
          <div className="fin-tooltip" style={{ left: Math.min(PAD.left + band * hover + band / 2 + 14, width - 190), top: 8 }}>
            <div className="mb-1 flex justify-between gap-4 font-semibold">
              <span>{buckets[hover].fullLabel}</span>
              <span className="fin-num">{aed(buckets[hover].total, { decimals: 0 })}</span>
            </div>
            {present.map((a) => (
              <Row key={a.id} color={accountColorVar(a.slug, accounts)} label={a.name} value={aed(buckets[hover].parts[a.id] || 0, { decimals: 0 })} />
            ))}
            {onSelect && <div className="mt-1.5 fin-muted">Tap to open this month</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Horizontal magnitude bars (single hue) with a value at the tip. */
export function HBar({ value, max, budget }) {
  const w = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const over = budget && value > budget;
  return (
    <div className="relative h-2 w-full rounded-full" style={{ background: 'var(--fin-surface-2)' }}>
      <div className="absolute inset-y-0 left-0" style={{ width: `${w * 100}%`, background: 'var(--fin-bar)', borderRadius: 2, minWidth: value > 0 ? 3 : 0 }} />
      {budget > 0 && max > 0 && (
        <div className="absolute" title={`Budget ${aed(budget, { decimals: 0 })}`}
          style={{ left: `${Math.min(1, budget / max) * 100}%`, top: -3, bottom: -3, width: 2, background: over ? 'var(--fin-bad)' : 'var(--fin-ink-2)', borderRadius: 1 }} />
      )}
    </div>
  );
}

// Category ring colours by rank (validated as a set, see finance.css); the rest share a neutral.
const RING = ['var(--fin-k1)', 'var(--fin-k2)', 'var(--fin-k3)', 'var(--fin-k4)', 'var(--fin-k5)', 'var(--fin-k6)'];
export const RING_OTHER = 'var(--fin-k-other)';

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
 * This week against last week, day by day: last week as a pale column behind each of this
 * week's. Days still to come are left empty.
 */
export function WeekBars({ days, height = 150 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 8, right: 4, bottom: 24, left: 4 };
  const max = Math.max(1, ...days.flatMap((d) => [d.total, d.prev]));
  const iw = Math.max(10, width - pad.left - pad.right);
  const ih = height - pad.top - pad.bottom;
  const band = iw / days.length;
  const bw = Math.min(26, band * 0.42);
  const y = (v) => pad.top + ih - (v / max) * ih;
  const h = hover != null ? days[hover] : null;
  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Spend per day this week and last week" onMouseLeave={() => setHover(null)}>
          <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke="var(--fin-axis)" />
          {days.map((d, i) => {
            const cx = pad.left + band * i + band / 2;
            const ph = d.prev > 0 ? Math.max(2, y(0) - y(d.prev)) : 0;
            const th = d.total > 0 ? Math.max(2, y(0) - y(d.total)) : 0;
            return (
              <g key={d.label} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                <rect x={pad.left + band * i} y={pad.top} width={band} height={ih} fill="transparent" />
                {ph > 0 && <path d={columnPath(cx - bw * 0.9, y(0) - ph, bw, ph, 2)} fill="var(--fin-bar-soft)" />}
                {th > 0 && <path d={columnPath(cx - bw * 0.1, y(0) - th, bw, th, 2)} fill="var(--fin-bar)" opacity={hover == null || hover === i ? 1 : 0.5} />}
                <text x={cx} y={height - 6} textAnchor="middle" fontSize="11.5" fill={d.today ? 'var(--fin-ink)' : 'var(--fin-muted)'} fontWeight={d.today ? 650 : 400}>{d.label}</text>
              </g>
            );
          })}
        </svg>
      )}
      {h && (
        <div className="fin-tooltip" style={{ left: Math.min(Math.max(0, pad.left + band * hover + band / 2 - 80), Math.max(0, width - 170)), top: 0 }}>
          <p className="mb-1.5 font-semibold">{h.label}</p>
          <Row color="var(--fin-bar)" label="This week" value={h.future ? '—' : aed(h.total, { decimals: 0 })} />
          <Row color="var(--fin-bar-soft)" label="Last week" value={aed(h.prev, { decimals: 0 })} />
        </div>
      )}
    </div>
  );
}

/**
 * Net worth over time: a 2px line with a faint flat fill under it, and a crosshair that
 * reads out the day. points: [{ day: 'YYYY-MM-DD', total }], oldest first.
 */
export function NetWorthLine({ points, height = 200, format = (v) => aed(v, { decimals: 0 }) }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 12, right: 12, bottom: 24, left: 52 };
  if (!points.length) return <div ref={ref} style={{ height }} />;
  const vals = points.map((p) => p.total);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < Math.max(1, hi * 0.02)) { lo -= Math.max(1, hi * 0.02); hi += Math.max(1, hi * 0.02); }
  const span = hi - lo;
  lo -= span * 0.12;
  hi += span * 0.08;
  const iw = Math.max(10, width - pad.left - pad.right);
  const ih = height - pad.top - pad.bottom;
  const x = (i) => pad.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => pad.top + ih - ((v - lo) / (hi - lo)) * ih;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join('');
  const area = `${line}L${x(points.length - 1)},${pad.top + ih}L${x(0)},${pad.top + ih}Z`;
  const ticks = [lo + (hi - lo) * 0.15, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.85];
  const labelAt = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const fmtDay = (d) => { const [yy, mm, dd] = d.split('-').map(Number); return `${dd} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mm - 1]}${points.length > 200 ? ` ${yy}` : ''}`; };
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(((px - pad.left) / iw) * (points.length - 1)))));
  };
  const h = hover != null ? points[hover] : null;
  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Net worth over time" onMouseMove={onMove} onTouchMove={onMove} onTouchStart={onMove} onMouseLeave={() => setHover(null)} onTouchEnd={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
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
          {h && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + ih} stroke="var(--fin-axis)" />
              <circle cx={x(hover)} cy={y(h.total)} r="4" fill="var(--fin-surface)" stroke="var(--fin-ink)" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {h && (
        <div className="fin-tooltip" style={{ left: Math.min(Math.max(0, x(hover) - 75), Math.max(0, width - 160)), top: -8 }}>
          <p className="text-xs fin-muted">{fmtDay(h.day)}</p>
          <p className="fin-num text-sm font-semibold">{format(h.total)}</p>
        </div>
      )}
    </div>
  );
}
