"use client";

import { useEffect, useRef, useState } from "react";
import { formatCompact, formatValue, niceStep, type ValueFormat } from "./format";

export interface ColumnSeries {
  label: string;
  /** CSS color, e.g. "var(--series-1)". Assign in fixed slot order. */
  color: string;
  values: number[];
}

const MARGIN = { top: 8, right: 8, bottom: 22, left: 52 };
const BAR_MAX = 24;
const GAP = 2;

function columnPath(x: number, w: number, top: number, base: number) {
  const h = base - top;
  const r = Math.min(4, w / 2, h);
  return `M${x},${base}L${x},${top + r}Q${x},${top} ${x + r},${top}L${x + w - r},${top}Q${x + w},${top} ${x + w},${top + r}L${x + w},${base}Z`;
}

export function ColumnChart({
  categories,
  series,
  format,
  height = 200,
}: {
  categories: string[];
  series: ColumnSeries[];
  format: ValueFormat;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = categories.length;
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const base = MARGIN.top + plotH;

  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const step = niceStep(max / 4);
  // The top tick must reach the tallest bar, or bars overrun the plot.
  const ticks = [0, step];
  while (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  const top = ticks[ticks.length - 1];
  const y = (v: number) => base - (v / top) * plotH;

  const band = n > 0 ? plotW / n : plotW;
  const s = series.length;
  const barW = Math.max(2, Math.min(BAR_MAX, (band * 0.8 - (s - 1) * GAP) / s));
  const groupW = s * barW + (s - 1) * GAP;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 56))));

  const hoverX = hover === null ? 0 : MARGIN.left + hover * band + band / 2;

  return (
    <div className="flex flex-col gap-2">
      {s > 1 && (
        <ul className="flex flex-wrap gap-4 text-xs text-text-secondary">
          {series.map((ser) => (
            <li key={ser.label} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: ser.color }} />
              {ser.label}
            </li>
          ))}
        </ul>
      )}
      <div ref={wrapRef} className="relative w-full" onPointerLeave={() => setHover(null)}>
        <svg width={width} height={height} role="img" aria-label={series.map((x) => x.label).join(", ")}>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? "var(--chart-axis)" : "var(--chart-grid)"}
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 6}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                fontSize={11}
                fill="var(--text-muted)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatCompact(t, format)}
              </text>
            </g>
          ))}

          {hover !== null && (
            <rect x={MARGIN.left + hover * band} y={MARGIN.top} width={band} height={plotH} fill="var(--hover-bg)" />
          )}

          {categories.map((cat, i) => {
            const x0 = MARGIN.left + i * band + (band - groupW) / 2;
            return (
              <g key={`${cat}-${i}`}>
                {series.map((ser, si) => {
                  const v = ser.values[i] ?? 0;
                  if (v <= 0) return null;
                  const x = x0 + si * (barW + GAP);
                  return <path key={ser.label} d={columnPath(x, barW, y(v), base)} fill={ser.color} />;
                })}
                {i % labelEvery === 0 && (
                  <text
                    x={MARGIN.left + i * band + band / 2}
                    y={height - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--text-muted)"
                  >
                    {cat}
                  </text>
                )}
                <rect
                  x={MARGIN.left + i * band}
                  y={MARGIN.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${cat}: ${series.map((ser) => `${ser.label} ${formatValue(ser.values[i] ?? 0, format)}`).join(", ")}`}
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  style={{ outline: "none" }}
                />
              </g>
            );
          })}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded border border-border bg-panel px-2.5 py-1.5 text-xs shadow-sm"
            style={{
              left: hoverX,
              transform: hoverX > width / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
            }}
          >
            <div className="text-text-muted mb-1">{categories[hover]}</div>
            {series.map((ser) => (
              <div key={ser.label} className="flex items-center gap-2 whitespace-nowrap">
                <span className="inline-block w-3 h-0.5" style={{ background: ser.color }} />
                <span className="font-semibold text-foreground">{formatValue(ser.values[hover] ?? 0, format)}</span>
                {s > 1 && <span className="text-text-secondary">{ser.label}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
