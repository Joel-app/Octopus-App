import "server-only";
import type { createSupabaseServerClient } from "./server";
import { addDays, daysBetween } from "@/lib/dashboard/dates";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Supabase/PostgREST caps every response at 1000 rows by default and returns
// the first 1000 without any error — so a big date range silently loses data.
// Everything that can plausibly exceed that goes through these helpers.
const PAGE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Pages through a table query. The query MUST order by a unique column (e.g. id) so pages don't overlap. */
export async function fetchAllRows<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) return all;
  }
}

/**
 * Calls a date-ranged report RPC, splitting the range in half whenever a
 * response hits the row cap. Set-returning functions can't be paged reliably
 * (their row order isn't stable across calls), so narrower date windows it is.
 */
export async function fetchReport<T>(
  supabase: Supabase,
  fn: "admin_get_pay_report" | "admin_get_billing_report",
  start: string,
  end: string
): Promise<T[]> {
  const { data, error } = await supabase.rpc(fn, { p_start_date: start, p_end_date: end });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as T[];
  if (rows.length < PAGE) return rows;
  if (start >= end) {
    throw new Error(`${fn} for ${start} returned ${PAGE}+ rows; results would be incomplete.`);
  }
  const mid = addDays(start, Math.floor(daysBetween(start, end) / 2));
  const [first, second] = await Promise.all([
    fetchReport<T>(supabase, fn, start, mid),
    fetchReport<T>(supabase, fn, addDays(mid, 1), end),
  ]);
  return [...first, ...second];
}
