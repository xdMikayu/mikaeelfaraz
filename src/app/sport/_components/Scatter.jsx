'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useWidth } from './XgChart';

// A scatter chart drawn at its real width, so its type stays the same size on a phone and a desktop.
// Points are dots (in ink when they matter, grey otherwise) or small images such as club shirts.
// Labels go beside the points that ask for one, wherever they fit without covering another point
// or label; the rest are a hover or tap away, and every chart that uses this has a table too.

const PAD = { top: 30, right: 16, bottom: 38, left: 40 };
const NEAR = 30; // px: how close the pointer has to be to a point to pick it
const NO_LINES = [];
const NO_CORNERS = {};

/** About `n` ticks at a clean step (1, 2, 2.5 or 5 times a power of ten) covering lo to hi. */
export function niceTicks(lo, hi, n = 5) {
  const raw = Math.max(hi - lo, 1e-9) / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw - 1e-12);
  const first = Math.floor(lo / step + 1e-9);
  const last = Math.ceil(hi / step - 1e-9);
  const digits = Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + (String(step / p).includes('.') ? 1 : 0));
  return { ticks: Array.from({ length: last - first + 1 }, (_, i) => Number(((first + i) * step).toFixed(digits))), digits };
}

let measurer = null;
function textWidth(text, size, weight, family) {
  try {
    measurer ??= document.createElement('canvas').getContext('2d');
    measurer.font = `${weight} ${size}px ${family}`;
    return measurer.measureText(text).width;
  } catch {
    return text.length * size * 0.56;
  }
}

const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * points: [{ id, x, y, strong?, image?, label?, priority? }]: `label` asks for a direct label, the
 *   higher `priority` first. lines: [{ id, pts: [[x, y], ...], label?, kind: 'iso' | 'rule' | 'mean' }]
 *   in data units, drawn behind the points. corners: { tl, tr, bl, br } words in the plot's corners.
 *   x, y: { title, min?, max?, zero? } axes; fmt(v) for the ticks. tip(point): the hover card.
 */
export default function Scatter({ points, lines = NO_LINES, corners = NO_CORNERS, x: xa, y: ya, tip, label: aria }) {
  const [ref, width] = useWidth();
  const svg = useRef(null);
  const [family, setFamily] = useState('sans-serif');
  const [hover, setHover] = useState(null);
  const clip = `plot${useId().replace(/[^a-z0-9]/gi, '')}`;
  useEffect(() => {
    if (svg.current) setFamily(getComputedStyle(svg.current).fontFamily || 'sans-serif');
  }, [width]);

  const H = Math.round(Math.min(460, Math.max(340, width * 0.62)));
  const layout = useMemo(() => {
    if (!width || !points.length) return null;
    const domain = (axis, key) => {
      const vals = points.map((p) => p[key]);
      let lo = axis.min ?? Math.min(...vals);
      let hi = axis.max ?? Math.max(...vals);
      if (axis.zero) lo = Math.min(0, lo);
      const pad = (hi - lo || 1) * 0.06;
      if (axis.min == null && !axis.zero) lo -= pad;
      if (axis.max == null) hi += pad;
      const t = niceTicks(lo, hi, width < 480 ? 4 : 6);
      // Out to the next tick when it's close; otherwise the axis ends with the data, not with empty space.
      const span = hi - lo || 1;
      if (lo - t.ticks[0] <= 0.08 * span) lo = Math.min(lo, t.ticks[0]);
      if (t.ticks[t.ticks.length - 1] - hi <= 0.08 * span) hi = Math.max(hi, t.ticks[t.ticks.length - 1]);
      return { lo, hi, digits: t.digits, ticks: t.ticks.filter((v) => v >= lo - 1e-9 && v <= hi + 1e-9) };
    };
    const dx = domain(xa, 'x');
    const dy = domain(ya, 'y');
    const iw = width - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const sx = (v) => PAD.left + ((v - dx.lo) / (dx.hi - dx.lo)) * iw;
    const sy = (v) => PAD.top + ih - ((v - dy.lo) / (dy.hi - dy.lo)) * ih;
    const half = width < 480 ? 9 : 11; // an image's half-size: smaller on a phone, so more labels fit
    const marks = points.map((p) => ({ ...p, px: sx(p.x), py: sy(p.y), s: p.image ? half : 4.5 }));
    // What words keep off: the images and the points that matter. Grey dots aren't in the way; a label
    // crossing one rides on its halo, and the dot is still a hover away.
    const solid = marks.filter((m) => m.image || m.strong).map((m) => ({ id: m.id, px: m.px, py: m.py, x0: m.px - m.s - 1, x1: m.px + m.s + 1, y0: m.py - m.s - 1, y1: m.py + m.s + 1 }));
    const bounds = { x0: PAD.left, x1: PAD.left + iw, y0: PAD.top, y1: PAD.top + ih };
    const inPlot = ([a, b]) => a >= dx.lo && a <= dx.hi && b >= dy.lo && b <= dy.hi;
    const placed = [];
    const free = (b, own) => b.x0 >= bounds.x0 && b.x1 <= bounds.x1 && b.y0 >= bounds.y0 && b.y1 <= bounds.y1 && !placed.some((o) => overlaps(o, b)) && !solid.some((o) => o.id !== own && overlaps(o, b));
    // The lines' labels first. A vertical line's goes at its top, beside it. Any other's is written along
    // it, as on a contour map, its halo breaking the line: from where it leaves the plot back along it,
    // the first stretch that's clear of the points and not too steep to read.
    const every = marks.map((m) => ({ x0: m.px - m.s - 1, x1: m.px + m.s + 1, y0: m.py - m.s - 1, y1: m.py + m.s + 1 }));
    const clearOf = (b) => b.x0 >= bounds.x0 && b.x1 <= bounds.x1 && b.y0 >= bounds.y0 && b.y1 <= bounds.y1 && !placed.some((o) => overlaps(o, b)) && !every.some((o) => overlaps(o, b));
    const lineLabels = [];
    for (const l of lines.filter((x) => x.label)) {
      const w = textWidth(l.label, 10.5, 600, family);
      if (l.pts.length === 2 && l.pts[0][0] === l.pts[1][0]) {
        if (l.pts[0][0] < dx.lo || l.pts[0][0] > dx.hi) continue;
        const at = sx(l.pts[0][0]);
        const sides = [
          { x: at + 5, y: PAD.top + 11, anchor: 'start', box: { x0: at + 5, x1: at + 5 + w, y0: PAD.top + 2, y1: PAD.top + 13 } },
          { x: at - 5, y: PAD.top + 11, anchor: 'end', box: { x0: at - 5 - w, x1: at - 5, y0: PAD.top + 2, y1: PAD.top + 13 } },
        ];
        const t = sides.find((o) => clearOf(o.box)) ?? sides[0];
        placed.push(t.box);
        lineLabels.push({ id: l.id, text: l.label, x: t.x, y: t.y, anchor: t.anchor, angle: 0 });
        continue;
      }
      const px = l.pts.map(([a, b]) => [sx(a), sy(b)]);
      const spots = [];
      for (let i = px.length - 2; i >= 1; i--) {
        const [x, y] = px[i];
        const angle = (Math.atan2(px[i + 1][1] - px[i - 1][1], px[i + 1][0] - px[i - 1][0]) * 180) / Math.PI;
        const r = (angle * Math.PI) / 180;
        const ex = Math.abs((w / 2) * Math.cos(r)) + Math.abs(6 * Math.sin(r));
        const ey = Math.abs((w / 2) * Math.sin(r)) + Math.abs(6 * Math.cos(r));
        spots.push({ x, y, angle, box: { x0: x - ex, x1: x + ex, y0: y - ey, y1: y + ey } });
      }
      const t = spots.find((p) => Math.abs(p.angle) <= 40 && clearOf(p.box)) ?? spots.find((p) => clearOf(p.box));
      if (!t) continue;
      placed.push(t.box);
      lineLabels.push({ id: l.id, text: l.label, x: t.x, y: t.y + 3.5, anchor: 'middle', angle: t.angle });
    }
    // Then the corners' words: in the corner if it's clear, else nudged along either edge, but no further
    // than a quarter of the way, so it still names the corner.
    const cornerLabels = [];
    for (const [k, text] of Object.entries(corners)) {
      const w = textWidth(text.toUpperCase(), 11, 800, family) + text.length * 0.5;
      const tries = [[0, 0]];
      for (let step = 12; step <= Math.max(iw, ih) * 0.25; step += 12) {
        if (step <= iw * 0.25) tries.push([step, 0]);
        if (step <= ih * 0.25) tries.push([0, step]);
      }
      for (const [along, down] of tries) {
        const x0 = k[1] === 'l' ? PAD.left + 6 + along : PAD.left + iw - 6 - w - along;
        const y = k[0] === 't' ? PAD.top + 14 + down : PAD.top + ih - 7 - down;
        const b = { x0, x1: x0 + w, y0: y - 10, y1: y + 2 };
        if (!free(b, null)) continue;
        placed.push(b);
        cornerLabels.push({ k, text: text.toUpperCase(), x: k[1] === 'l' ? x0 : x0 + w, y, anchor: k[1] === 'l' ? 'start' : 'end' });
        break;
      }
    }
    // Then the points', most important first, each in the first spot that's free and nearer its own
    // point than any other that matters (or it reads as theirs).
    const labels = [];
    for (const m of marks.filter((x) => x.label).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))) {
      const size = m.strong ? 12 : 11;
      const w = textWidth(m.label, size, m.strong ? 750 : 600, family);
      const d = m.s * 0.7 + 3;
      const spots = [
        [m.px + m.s + 4, m.py + size / 2 - 1.5, 'start'],
        [m.px - m.s - 4, m.py + size / 2 - 1.5, 'end'],
        [m.px, m.py - m.s - 5, 'middle'],
        [m.px, m.py + m.s + size + 2, 'middle'],
        [m.px + d, m.py - d - 1, 'start'],
        [m.px + d, m.py + d + size - 1, 'start'],
        [m.px - d, m.py - d - 1, 'end'],
        [m.px - d, m.py + d + size - 1, 'end'],
      ];
      for (const [lx, ly, anchor] of spots) {
        const x0 = anchor === 'start' ? lx : anchor === 'end' ? lx - w : lx - w / 2;
        const b = { x0, x1: x0 + w, y0: ly - size + 2, y1: ly + 2 };
        if (!free(b, m.id)) continue;
        const cx = (b.x0 + b.x1) / 2;
        const cy = (b.y0 + b.y1) / 2;
        const own = (m.px - cx) ** 2 + (m.py - cy) ** 2;
        if (solid.some((o) => o.id !== m.id && (o.px - cx) ** 2 + (o.py - cy) ** 2 < own)) continue;
        placed.push(b);
        labels.push({ id: m.id, text: m.label, x: lx, y: ly, anchor, size, strong: m.strong });
        break;
      }
    }
    const path = (pts) => pts.map(([a, b], i) => `${i ? 'L' : 'M'}${sx(a).toFixed(1)},${sy(b).toFixed(1)}`).join('');
    return { dx, dy, iw, ih, sx, sy, marks, labels, path, lineLabels, cornerLabels };
  }, [width, H, points, lines, corners, xa, ya, family]);

  const pick = (e) => {
    if (!layout || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let best = null;
    let bd = NEAR * NEAR;
    for (const m of layout.marks) {
      const d = (m.px - mx) ** 2 + (m.py - my) ** 2;
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    setHover(best);
  };

  const L = layout;
  const fmt = (axis, v, digits) => (axis.fmt ? axis.fmt(v) : v.toFixed(digits));
  const order = L ? [...L.marks].sort((a, b) => (a.strong ? 1 : 0) - (b.strong ? 1 : 0)) : [];
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && L && (
        <svg ref={svg} width={width} height={H} role="img" aria-label={aria} onPointerMove={pick} onPointerDown={pick} onPointerLeave={(e) => e.pointerType !== 'touch' && setHover(null)} style={{ display: 'block', touchAction: 'pan-y' }}>
          <defs>
            <clipPath id={clip}>
              <rect x={PAD.left} y={PAD.top} width={L.iw} height={L.ih} />
            </clipPath>
          </defs>
          {L.dy.ticks.map((t) => (
            <g key={`y${t}`}>
              <line x1={PAD.left} x2={PAD.left + L.iw} y1={L.sy(t)} y2={L.sy(t)} stroke="var(--sp-rule)" />
              <text x={PAD.left - 7} y={L.sy(t) + 4} textAnchor="end" fontSize="11" fill="var(--sp-muted)" className="sp-num">{fmt(ya, t, L.dy.digits)}</text>
            </g>
          ))}
          {L.dx.ticks.map((t) => (
            <g key={`x${t}`}>
              <line x1={L.sx(t)} x2={L.sx(t)} y1={PAD.top} y2={PAD.top + L.ih} stroke="var(--sp-rule)" />
              <text x={L.sx(t)} y={PAD.top + L.ih + 15} textAnchor="middle" fontSize="11" fill="var(--sp-muted)" className="sp-num">{fmt(xa, t, L.dx.digits)}</text>
            </g>
          ))}
          <text x={PAD.left + L.iw} y={H - 4} textAnchor="end" fontSize="11.5" fontWeight="700" fill="var(--sp-ink-2)">{xa.title} →</text>
          <text x={PAD.left - 32} y={PAD.top - 12} fontSize="11.5" fontWeight="700" fill="var(--sp-ink-2)">↑ {ya.title}</text>
          <g clipPath={`url(#${clip})`}>
            {lines.map((l) => (
              <path
                key={l.id}
                d={L.path(l.pts)}
                fill="none"
                stroke={l.kind === 'iso' ? 'var(--sp-ink)' : l.kind === 'rule' ? 'var(--sp-ink-2)' : 'var(--sp-rule-2)'}
                strokeOpacity={l.kind === 'iso' ? 0.3 : 1}
                strokeWidth={l.kind === 'iso' ? 1.5 : 1}
                strokeLinejoin="round"
              />
            ))}
          </g>
          {L.lineLabels.map((t) => (
            <text key={t.id} x={t.x} y={t.y} textAnchor={t.anchor} transform={t.angle ? `rotate(${t.angle.toFixed(1)} ${t.x.toFixed(1)} ${(t.y - 3.5).toFixed(1)})` : undefined} fontSize="10.5" fontWeight="600" fill="var(--sp-muted)" stroke="var(--sp-surface)" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round" className="sp-num">{t.text}</text>
          ))}
          {L.cornerLabels.map((t) => (
            <text key={t.k} x={t.x} y={t.y} textAnchor={t.anchor} fontSize="11" fontWeight="800" fill="var(--sp-muted)" letterSpacing="0.04em">{t.text}</text>
          ))}
          {order.map((m) =>
            m.image ? (
              <image key={m.id} href={m.image} x={m.px - m.s} y={m.py - m.s} width={m.s * 2} height={m.s * 2} opacity={hover && hover.id !== m.id ? 0.55 : 1} />
            ) : (
              <circle key={m.id} cx={m.px} cy={m.py} r={hover?.id === m.id ? 6 : 4.5} fill={m.strong || hover?.id === m.id ? 'var(--sp-ink)' : 'var(--sp-muted)'} stroke="var(--sp-surface)" strokeWidth="2" />
            )
          )}
          {hover?.image && <circle cx={hover.px} cy={hover.py} r={hover.s + 4} fill="none" stroke="var(--sp-ink)" strokeWidth="1.5" />}
          {L.labels.map((t) => (
            <text key={t.id} x={t.x} y={t.y} textAnchor={t.anchor} fontSize={t.size} fontWeight={t.strong ? 750 : 600} fill={t.strong ? 'var(--sp-ink)' : 'var(--sp-ink-2)'} stroke="var(--sp-surface)" strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">{t.text}</text>
          ))}
        </svg>
      )}
      {hover && L && (
        <div className="sp-tip" style={{ top: Math.max(0, Math.min(hover.py - 12, H - 150)), ...(hover.px > width / 2 ? { right: width - hover.px + 14 } : { left: hover.px + 14 }) }}>
          {tip(hover)}
        </div>
      )}
    </div>
  );
}
