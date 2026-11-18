export type ValueFormat = "currency" | "number" | "percent" | "hours" | "minutes";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const currencyCompact = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const number = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 });
const numberCompact = new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 });

/** Full value — tooltips, tables, bar-tip labels. */
export function formatValue(v: number, f: ValueFormat): string {
  switch (f) {
    case "currency":
      return currency.format(v);
    case "percent":
      return `${Math.round(v)}%`;
    case "hours":
      return `${number.format(v)} h`;
    case "minutes":
      return `${Math.round(v)} min`;
    default:
      return number.format(v);
  }
}

/** Compact value — stat tiles and axis ticks (12.9K, $4.2M). Full under 10,000. */
export function formatCompact(v: number, f: ValueFormat): string {
  if (Math.abs(v) < 10000) return formatValue(v, f);
  if (f === "currency") return currencyCompact.format(v);
  const n = numberCompact.format(v);
  return f === "hours" ? `${n} h` : n;
}

/** Clean axis steps: 1, 2, 2.5, 5 × 10^n. */
export function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = raw / 10 ** exp;
  const nice = base <= 1 ? 1 : base <= 2 ? 2 : base <= 2.5 ? 2.5 : base <= 5 ? 5 : 10;
  return nice * 10 ** exp;
}
