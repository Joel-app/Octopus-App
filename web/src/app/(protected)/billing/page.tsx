import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aggregateByGroup, type GroupBy } from "@/lib/reports";

interface BillingRow {
  item_date: string;
  customer_id: string;
  customer_name: string;
  staff_name: string | null;
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
  searchParams: Promise<{ start?: string; end?: string; groupBy?: string }>;
}) {
  const { profile: viewer } = await verifySession();
  if (viewer.role === "operations") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const defaults = defaultDates();
  const start = params.start || defaults.start;
  const end = params.end || defaults.end;
  const groupBy: GroupBy = params.groupBy === "week" ? "week" : "day";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_get_billing_report", {
    p_start_date: start,
    p_end_date: end,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as BillingRow[];
  const grouped = aggregateByGroup(rows, groupBy, (r) => r.customer_name);
  const total = grouped.reduce((sum, g) => sum + g.total, 0);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-lg font-semibold">Billing</h1>

      <form method="GET" className="flex flex-wrap gap-2 items-end text-sm">
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
        <label className="flex flex-col gap-1">
          Group by
          <select name="groupBy" defaultValue={groupBy} className="border border-border rounded px-2 py-1 bg-panel">
            <option value="day">Day</option>
            <option value="week">Week</option>
          </select>
        </label>
        <button type="submit" className="border border-border rounded px-3 py-1.5">
          Update
        </button>
        <a
          href={`/api/billing/export?start=${start}&end=${end}&groupBy=${groupBy}`}
          className="bg-foreground text-bg rounded px-3 py-1.5"
        >
          Export to Excel
        </a>
      </form>

      <table className="text-sm w-full">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="font-normal pr-4">{groupBy === "day" ? "Date" : "Week starting"}</th>
            <th className="font-normal pr-4">Customer</th>
            <th className="font-normal pr-4">Total bill</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((g) => (
            <tr key={`${g.period}::${g.dimension}`} className="border-t border-border">
              <td className="py-2 pr-4">{g.period}</td>
              <td className="py-2 pr-4">{g.dimension}</td>
              <td className="py-2 pr-4">${g.total.toFixed(2)}</td>
            </tr>
          ))}
          {grouped.length === 0 && (
            <tr>
              <td colSpan={3} className="py-2 text-text-secondary">
                No billable work recorded for this range.
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
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
