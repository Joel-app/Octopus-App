import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aggregateByGroup, periodBounds, type GroupBy, type GroupedRow } from "@/lib/reports";

type View = "customer" | "staff";

interface BillingRow {
  item_date: string;
  customer_id: string;
  customer_name: string;
  staff_name: string | null;
  label: string;
  amount: number;
}

interface PayRow {
  item_date: string;
  staff_id: string;
  staff_name: string;
  customer_name: string;
  label: string;
  amount: number;
}

function defaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; start?: string; end?: string; groupBy?: string; filter?: string }>;
}) {
  const { profile: viewer } = await verifySession();
  if (viewer.role === "operations") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const view: View = params.view === "staff" ? "staff" : "customer";
  const defaults = defaultDates();
  const start = params.start || defaults.start;
  const end = params.end || defaults.end;
  const groupBy: GroupBy = params.groupBy === "week" ? "week" : "day";
  const filterValue = params.filter || null;
  const level: "summary" | "detail" = filterValue ? "detail" : "summary";

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc(
    view === "customer" ? "admin_get_billing_report" : "admin_get_pay_report",
    { p_start_date: start, p_end_date: end }
  );
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as (BillingRow | PayRow)[];
  const dimensionLabel = view === "customer" ? "Customer" : "Staff";
  const dimensionOf = (r: BillingRow | PayRow) =>
    view === "customer" ? (r as BillingRow).customer_name : (r as PayRow).staff_name;
  const otherDimensionLabel = view === "customer" ? "Staff" : "Site";
  const otherDimensionOf = (r: BillingRow | PayRow) =>
    (view === "customer" ? (r as BillingRow).staff_name : (r as PayRow).customer_name) ?? "—";

  const scopedRows = filterValue ? rows.filter((r) => dimensionOf(r) === filterValue) : rows;

  const grouped = level === "summary" ? aggregateByGroup(scopedRows, groupBy, dimensionOf) : [];
  const detailRows =
    level === "detail" ? [...scopedRows].sort((a, b) => a.item_date.localeCompare(b.item_date)) : [];
  const total = scopedRows.reduce((sum, r) => sum + r.amount, 0);

  function viewTabHref(newView: View) {
    const merged = new URLSearchParams({ view: newView, start, end, groupBy });
    return `/billing?${merged.toString()}`;
  }

  function viewHref(g: GroupedRow) {
    const bounds = periodBounds(g.period, groupBy);
    const merged = new URLSearchParams({
      view,
      start: bounds.start,
      end: bounds.end,
      groupBy,
      filter: g.dimension,
    });
    return `/billing?${merged.toString()}`;
  }

  const backToSummaryHref = `/billing?${new URLSearchParams({ view, start, end, groupBy }).toString()}`;

  const exportHref = `/api/billing/export?${new URLSearchParams({
    view,
    start,
    end,
    groupBy,
    ...(filterValue ? { filter: filterValue } : {}),
  }).toString()}`;

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <h1 className="text-lg font-semibold">Billing</h1>

      <div className="flex gap-2 border border-border rounded p-1 text-sm self-start">
        <Link
          href={viewTabHref("customer")}
          className={view === "customer" ? "bg-hover px-3 py-1 rounded" : "px-3 py-1"}
        >
          Customer Invoicing
        </Link>
        <Link
          href={viewTabHref("staff")}
          className={view === "staff" ? "bg-hover px-3 py-1 rounded" : "px-3 py-1"}
        >
          Staff Pays
        </Link>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <form method="GET" className="flex flex-wrap gap-2 items-end text-sm">
          <input type="hidden" name="view" value={view} />
          {filterValue && <input type="hidden" name="filter" value={filterValue} />}
          <label className="flex flex-col gap-1">
            Start
            <input
              type="date"
              name="start"
              defaultValue={start}
              className="border border-border rounded px-2 py-1 bg-panel"
            />
          </label>
          <label className="flex flex-col gap-1">
            End
            <input
              type="date"
              name="end"
              defaultValue={end}
              className="border border-border rounded px-2 py-1 bg-panel"
            />
          </label>
          {level === "summary" && (
            <label className="flex flex-col gap-1">
              Group by
              <select
                name="groupBy"
                defaultValue={groupBy}
                className="border border-border rounded px-2 py-1 bg-panel"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
              </select>
            </label>
          )}
          <button type="submit" className="border border-border rounded px-3 py-1.5">
            Update
          </button>
        </form>

        <a href={exportHref} className="bg-foreground text-bg rounded px-3 py-1.5 text-sm">
          Export to Excel
        </a>
      </div>

      {filterValue && (
        <div className="text-sm text-text-secondary">
          Showing: <span className="text-foreground font-semibold">{filterValue}</span>{" "}
          <Link href={backToSummaryHref} className="text-info-text">
            ← Back to summary
          </Link>
        </div>
      )}

      {level === "summary" ? (
        <table className="text-sm w-full">
          <thead>
            <tr className="text-left text-text-muted">
              <th className="font-normal pr-4">{groupBy === "day" ? "Date" : "Week starting"}</th>
              <th className="font-normal pr-4">{dimensionLabel}</th>
              <th className="font-normal pr-4">Total {view === "customer" ? "bill" : "pay"}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => (
              <tr key={`${g.period}::${g.dimension}`} className="border-t border-border">
                <td className="py-2 pr-4">{g.period}</td>
                <td className="py-2 pr-4">{g.dimension}</td>
                <td className="py-2 pr-4">${g.total.toFixed(2)}</td>
                <td className="py-2">
                  <Link href={viewHref(g)} className="text-xs text-info-text">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {grouped.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-text-secondary">
                  Nothing recorded for this range.
                </td>
              </tr>
            )}
          </tbody>
          {grouped.length > 0 && (
            <tfoot>
              <tr className="border-t border-border-strong font-semibold">
                <td className="py-2 pr-4" colSpan={2}>
                  Total
                </td>
                <td className="py-2 pr-4">${total.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      ) : (
        <table className="text-sm w-full">
          <thead>
            <tr className="text-left text-text-muted">
              <th className="font-normal pr-4">Date</th>
              <th className="font-normal pr-4">{dimensionLabel}</th>
              <th className="font-normal pr-4">Type</th>
              <th className="font-normal pr-4">{otherDimensionLabel}</th>
              <th className="font-normal pr-4">Amount</th>
            </tr>
          </thead>
          <tbody>
            {detailRows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="py-2 pr-4">{r.item_date}</td>
                <td className="py-2 pr-4">{dimensionOf(r)}</td>
                <td className="py-2 pr-4">{r.label}</td>
                <td className="py-2 pr-4">{otherDimensionOf(r)}</td>
                <td className="py-2 pr-4">${r.amount.toFixed(2)}</td>
              </tr>
            ))}
            {detailRows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-text-secondary">
                  Nothing recorded for this range.
                </td>
              </tr>
            )}
          </tbody>
          {detailRows.length > 0 && (
            <tfoot>
              <tr className="border-t border-border-strong font-semibold">
                <td className="py-2 pr-4" colSpan={4}>
                  Total
                </td>
                <td className="py-2 pr-4">${total.toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  );
}
