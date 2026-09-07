import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aggregateByGroup, type GroupBy } from "@/lib/reports";
import { buildXlsxResponse } from "@/lib/xlsx-export";

interface PayRow {
  item_date: string;
  staff_id: string;
  staff_name: string;
  customer_name: string;
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
  const { data, error } = await supabase.rpc("admin_get_pay_report", {
    p_start_date: start,
    p_end_date: end,
  });
  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []) as PayRow[];
  const grouped = aggregateByGroup(rows, groupBy, (r) => r.staff_name);

  const sheetRows = grouped.map((g) => ({
    [groupBy === "day" ? "Date" : "Week starting"]: g.period,
    Staff: g.dimension,
    "Total pay": g.total,
  }));

  return buildXlsxResponse(`pays-${start}-to-${end}.xlsx`, "Pays", sheetRows);
}
