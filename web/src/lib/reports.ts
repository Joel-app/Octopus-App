export type GroupBy = "day" | "week";

// Monday-start week bucket, keyed by that Monday's date (YYYY-MM-DD).
export function periodKey(dateStr: string, groupBy: GroupBy): string {
  if (groupBy === "day") return dateStr;
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  const diffToMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d.toISOString().slice(0, 10);
}

// Inverse of periodKey: the [start, end] date bounds that bucket covers, so
// a "View" link can re-query scoped to exactly the rows behind one total.
export function periodBounds(period: string, groupBy: GroupBy): { start: string; end: string } {
  if (groupBy === "day") return { start: period, end: period };
  const d = new Date(`${period}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return { start: period, end: d.toISOString().slice(0, 10) };
}

export interface GroupedRow {
  period: string;
  dimension: string;
  total: number;
}

export function aggregateByGroup<T extends { item_date: string; amount: number }>(
  rows: T[],
  groupBy: GroupBy,
  dimensionKey: (row: T) => string
): GroupedRow[] {
  const map = new Map<string, GroupedRow>();
  for (const row of rows) {
    const period = periodKey(row.item_date, groupBy);
    const dimension = dimensionKey(row);
    const key = `${period}::${dimension}`;
    const existing = map.get(key);
    if (existing) {
      existing.total += row.amount;
    } else {
      map.set(key, { period, dimension, total: row.amount });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => a.period.localeCompare(b.period) || a.dimension.localeCompare(b.dimension)
  );
}
