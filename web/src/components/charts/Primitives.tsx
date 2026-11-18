import type { ReactNode } from "react";
import { formatCompact, formatValue, type ValueFormat } from "./format";

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

export function DataTable({ table, empty = "Nothing to show." }: { table: TableData; empty?: string }) {
  return (
    <table className="text-sm w-full">
      <thead>
        <tr className="text-left text-text-muted">
          {table.columns.map((c) => (
            <th key={c} className="font-normal pr-4 pb-1">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
        {table.rows.map((row, i) => (
          <tr key={i} className="border-t border-border">
            {row.map((cell, j) => (
              <td key={j} className="py-1.5 pr-4">
                {cell}
              </td>
            ))}
          </tr>
        ))}
        {table.rows.length === 0 && (
          <tr>
            <td colSpan={table.columns.length} className="py-2 text-text-secondary">
              {empty}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** A chart's frame: title, the chart, and its table-view twin (every chart has one). */
export function ChartCard({
  title,
  subtitle,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  table?: TableData;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border border-border rounded p-4 min-w-0">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
      </div>
      {children}
      {table && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-text-secondary select-none">Show table</summary>
          <div className="mt-2 max-h-72 overflow-y-auto">
            <DataTable table={table} />
          </div>
        </details>
      )}
    </section>
  );
}

export type Status = "good" | "warning" | "critical";
const STATUS_ICON: Record<Status, string> = { good: "✓", warning: "!", critical: "✕" };

/** Stat tile: label · value · optional context line · optional status (always icon + label, never color alone). */
export function StatTile({
  label,
  value,
  format,
  context,
  status,
}: {
  label: string;
  value: number | string;
  format?: ValueFormat;
  context?: string;
  status?: { level: Status; text: string };
}) {
  const shown = typeof value === "number" ? formatCompact(value, format ?? "number") : value;
  return (
    <div className="flex flex-col gap-1 border border-border rounded p-4 min-w-0">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="text-2xl font-semibold">{shown}</div>
      {context && <div className="text-xs text-text-muted">{context}</div>}
      {status && (
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span
            aria-hidden
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
            style={{
              background: `var(--status-${status.level})`,
              color: status.level === "warning" ? "#0b0b0b" : "#ffffff",
            }}
          >
            {STATUS_ICON[status.level]}
          </span>
          {status.text}
        </div>
      )}
    </div>
  );
}

/** The one headline number a view leads with. */
export function HeroFigure({ label, value, context }: { label: string; value: string; context?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm text-text-secondary">{label}</div>
      <div className="text-5xl font-semibold leading-none">{value}</div>
      {context && <div className="text-xs text-text-muted">{context}</div>}
    </div>
  );
}

/**
 * Horizontal ranked bars, single series. Value at each bar's tip. Negative
 * values (e.g. a loss-making customer) grow left from a shared zero line in
 * the diverging red, and keep their minus sign so color isn't the only cue.
 */
export function HBarChart({
  items,
  format,
  color = "var(--series-1)",
}: {
  items: { label: string; value: number }[];
  format: ValueFormat;
  color?: string;
}) {
  if (items.length === 0) return <p className="text-sm text-text-secondary">Nothing recorded for this range.</p>;
  const min = Math.min(0, ...items.map((i) => i.value));
  const max = Math.max(0, ...items.map((i) => i.value));
  const range = max - min || 1;
  const zero = (-min / range) * 100;

  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {items.map((item) => {
        const w = (Math.abs(item.value) / range) * 100;
        const neg = item.value < 0;
        return (
          <li
            key={item.label}
            className="grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-3 rounded hover:bg-hover px-1"
          >
            <span className="truncate text-text-secondary" title={item.label}>
              {item.label}
            </span>
            <span className="relative h-3.5">
              {min < 0 && (
                <span className="absolute top-[-2px] bottom-[-2px] w-px" style={{ left: `${zero}%`, background: "var(--chart-axis)" }} />
              )}
              <span
                className="absolute top-0 bottom-0"
                style={{
                  left: `${neg ? zero - w : zero}%`,
                  width: `${w}%`,
                  background: neg ? "var(--diverge-neg)" : color,
                  borderRadius: neg ? "4px 0 0 4px" : "0 4px 4px 0",
                }}
              />
            </span>
            <span className="text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatValue(item.value, format)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** One whole split into parts (tall segmented bar). Share printed inside a block only when it fits. */
export function SegmentedBar({
  parts,
  format,
}: {
  parts: { label: string; value: number; color: string }[];
  format: ValueFormat;
}) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  if (total <= 0) return <p className="text-sm text-text-secondary">Nothing recorded.</p>;
  const shown = parts.filter((p) => p.value > 0);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex gap-[2px] h-7"
        role="img"
        aria-label={shown.map((p) => `${p.label} ${formatValue(p.value, format)}`).join(", ")}
      >
        {shown.map((p) => {
          const share = (p.value / total) * 100;
          return (
            <div
              key={p.label}
              className="flex items-center px-2 rounded text-xs font-semibold text-white whitespace-nowrap"
              style={{ flexGrow: p.value, flexBasis: 0, background: p.color }}
              title={`${p.label}: ${formatValue(p.value, format)} (${Math.round(share)}%)`}
            >
              {share >= 12 ? `${Math.round(share)}%` : ""}
            </div>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-4 text-xs text-text-secondary">
        {shown.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
            {p.label}
            <span className="text-foreground">{formatValue(p.value, format)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
