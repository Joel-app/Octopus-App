import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aggregateByGroup, type GroupBy } from "@/lib/reports";
import { buildXlsxResponse } from "@/lib/xlsx-export";

interface BillingRow {
  item_date: string;
  customer_id: string;
  customer_name: string;
  staff_name: string | null;
  label: string;
  amount: number;
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const start = searchParams.get("start") || today;
  const end = searchParams.get("end") || start;
  const groupBy: GroupBy = searchParams.get("groupBy") === "week" ? "week" : "day";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_get_billing_report", {
    p_start_date: start,
    p_end_date: end,
  });
  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []) as BillingRow[];
  const grouped = aggregateByGroup(rows, groupBy, (r) => r.customer_name);

  const sheetRows = grouped.map((g) => ({
    [groupBy === "day" ? "Date" : "Week starting"]: g.period,
    Customer: g.dimension,
    "Total bill": g.total,
  }));

  return buildXlsxResponse(`billing-${start}-to-${end}.xlsx`, "Billing", sheetRows);
}
