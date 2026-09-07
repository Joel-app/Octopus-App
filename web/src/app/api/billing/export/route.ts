import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aggregateByGroup, type GroupBy } from "@/lib/reports";
import { buildXlsxResponse } from "@/lib/xlsx-export";

type View = "customer" | "staff";
type Level = "summary" | "detail";

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

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const view: View = searchParams.get("view") === "staff" ? "staff" : "customer";
  const level: Level = searchParams.get("level") === "detail" ? "detail" : "summary";
  const today = new Date().toISOString().slice(0, 10);
  const start = searchParams.get("start") || today;
  const end = searchParams.get("end") || start;
  const groupBy: GroupBy = searchParams.get("groupBy") === "week" ? "week" : "day";
  const filterValue = searchParams.get("filter") || null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    view === "customer" ? "admin_get_billing_report" : "admin_get_pay_report",
    { p_start_date: start, p_end_date: end }
  );
  if (error) return new Response(error.message, { status: 500 });

  const allRows = (data ?? []) as (BillingRow | PayRow)[];
  const dimensionLabel = view === "customer" ? "Customer" : "Staff";
  const dimensionOf = (r: BillingRow | PayRow) =>
    view === "customer" ? (r as BillingRow).customer_name : (r as PayRow).staff_name;
  const otherDimensionLabel = view === "customer" ? "Staff" : "Site";
  const otherDimensionOf = (r: BillingRow | PayRow) =>
    (view === "customer" ? (r as BillingRow).staff_name : (r as PayRow).customer_name) ?? "";
  const amountLabel = view === "customer" ? "Total bill" : "Total pay";

  const rows = filterValue ? allRows.filter((r) => dimensionOf(r) === filterValue) : allRows;

  const sheetName = view === "customer" ? "Customer Invoicing" : "Staff Pays";
  const filenameBase = `${view === "customer" ? "customer-invoicing" : "staff-pays"}-${level}-${start}-to-${end}`;

  let sheetRows: Record<string, unknown>[];
  if (level === "summary") {
    const grouped = aggregateByGroup(rows, groupBy, dimensionOf);
    sheetRows = grouped.map((g) => ({
      [groupBy === "day" ? "Date" : "Week starting"]: g.period,
      [dimensionLabel]: g.dimension,
      [amountLabel]: g.total,
    }));
  } else {
    const sorted = [...rows].sort((a, b) => a.item_date.localeCompare(b.item_date));
    sheetRows = sorted.map((r) => ({
      Date: r.item_date,
      [dimensionLabel]: dimensionOf(r),
      Type: r.label,
      [otherDimensionLabel]: otherDimensionOf(r),
      Amount: r.amount,
    }));
  }

  return buildXlsxResponse(`${filenameBase}.xlsx`, sheetName, sheetRows);
}
