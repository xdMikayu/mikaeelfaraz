'use client';
// Hand-rolled SVG charts following the dataviz mark specs: 2px lines, <=24px
// bars with a 4px rounded data-end, 2px surface gaps between stacked segments,
// hairline grid, crosshair/per-mark tooltips, text in ink tokens only.
import { useEffect, useId, useRef, useState } from 'react';
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
export function PeriodBars({ buckets, unit, average, averageLabel, height = 220 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const max = Math.max(1, average || 0, ...buckets.map((b) => b.total));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const iw = Math.max(10, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const band = iw / buckets.length;
  const bw = Math.max(2, Math.min(24, band - 2)); // 2px surface gap between neighbours
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
  const gid = `fin-bar-${useId().replace(/:/g, '')}`;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        <span className="fin-chip"><span className="fin-dot" style={{ background: 'linear-gradient(180deg, var(--fin-accent-2), var(--fin-accent))', borderRadius: 3 }} />Spent per {per}</span>
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
            <defs>
              <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--fin-accent-2)" />
                <stop offset="100%" stopColor="var(--fin-accent)" />
              </linearGradient>
            </defs>
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
                <g key={i} onMouseEnter={() => setHover(i)}>
                  <rect x={PAD.left + band * i} y={PAD.top} width={band} height={ih} fill="transparent" />
                  {barH > 0 && (
                    <path d={columnPath(cx - bw / 2, y(0) - barH, bw, barH, Math.min(4, bw / 2))} fill={`url(#${gid})`}
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
export function SpendBars({ buckets, accounts, highlight = [], height = 220, label = 'Spend by card' }) {
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
                <g key={mo.fullLabel} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
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
                      <path key={s.a.id} d={columnPath(x0, y1, bw, h, 4)} fill={color} opacity={opacity} />
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
      <div className="absolute inset-y-0 left-0" style={{ width: `${w * 100}%`, background: 'linear-gradient(90deg, var(--fin-accent), var(--fin-accent-2))', borderRadius: 999, minWidth: value > 0 ? 4 : 0 }} />
      {budget > 0 && max > 0 && (
        <div className="absolute" title={`Budget ${aed(budget, { decimals: 0 })}`}
          style={{ left: `${Math.min(1, budget / max) * 100}%`, top: -3, bottom: -3, width: 2, background: over ? 'var(--fin-bad)' : 'var(--fin-ink-2)', borderRadius: 1 }} />
      )}
    </div>
  );
}
