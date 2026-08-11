import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SHIFT_TYPES } from "@/lib/constants";
import { addShift } from "./actions";
import { RosterBoard } from "./RosterBoard";

interface CustomerRow {
  id: string;
  name: string;
  address: { state?: string } | null;
}

interface StaffRow {
  id: string;
  full_name: string;
  position: string | null;
}

interface ShiftRow {
  id: string;
  customer_id: string;
  start_time: string;
  shift_type: "hourly" | "container" | "rework";
  status: "draft" | "confirmed";
}

interface AssignmentRow {
  id: string;
  shift_id: string;
  staff_id: string;
  role: string;
}

interface JobRow {
  id: string;
  shift_id: string;
  type: string;
  size: string | null;
  status: string;
}

interface ContainerRateCardRow {
  id: string;
  customer_id: string;
  position_or_type: string;
  size: string | null;
}

function addDays(date: string, delta: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date || new Date().toISOString().slice(0, 10);

  const supabase = await createSupabaseServerClient();
  const [{ data: customers }, { data: staff }, { data: shifts }] = await Promise.all([
    supabase.from("customers").select("id, name, address").order("name").returns<CustomerRow[]>(),
    supabase
      .from("profiles")
      .select("id, full_name, position")
      .eq("role", "staff")
      .eq("active", true)
      .order("full_name")
      .returns<StaffRow[]>(),
    supabase
      .from("shifts")
      .select("id, customer_id, start_time, shift_type, status")
      .eq("date", date)
      .order("start_time")
      .returns<ShiftRow[]>(),
  ]);

  const shiftIds = (shifts ?? []).map((s) => s.id);
  const [{ data: assignments }, { data: jobs }, { data: containerRateCards }] = await Promise.all([
    shiftIds.length
      ? supabase
          .from("shift_assignments")
          .select("id, shift_id, staff_id, role")
          .in("shift_id", shiftIds)
          .returns<AssignmentRow[]>()
      : Promise.resolve({ data: [] as AssignmentRow[] }),
    shiftIds.length
      ? supabase
          .from("jobs")
          .select("id, shift_id, type, size, status")
          .eq("job_type", "container")
          .in("shift_id", shiftIds)
          .returns<JobRow[]>()
      : Promise.resolve({ data: [] as JobRow[] }),
    supabase
      .from("rate_cards")
      .select("id, customer_id, position_or_type, size")
      .eq("work_type", "container")
      .returns<ContainerRateCardRow[]>(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Roster</h1>
        <Link href={`/roster?date=${addDays(date, -1)}`} className="text-sm">
          {"< Prev"}
        </Link>
        <form method="GET" className="flex gap-2">
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="border border-border rounded px-2 py-1 bg-panel text-sm"
          />
          <button type="submit" className="text-sm border border-border rounded px-2 py-1">
            Go
          </button>
        </form>
        <Link href={`/roster?date=${addDays(date, 1)}`} className="text-sm">
          {"Next >"}
        </Link>
      </div>

      <form
        action={addShift}
        className="flex flex-wrap gap-2 items-end border border-border rounded p-4 text-sm max-w-3xl"
      >
        <input type="hidden" name="date" value={date} />
        <h2 className="w-full text-sm font-semibold mb-1">Add shift for {date}</h2>
        <label className="flex flex-col gap-1">
          Customer
          <select name="customer_id" required className="border border-border rounded px-2 py-1 bg-panel">
            {(customers ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Shift type
          <select name="shift_type" className="border border-border rounded px-2 py-1 bg-panel">
            {SHIFT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Start time
          <input
            type="time"
            name="start_time"
            defaultValue="07:00"
            className="border border-border rounded px-2 py-1 bg-panel"
          />
        </label>
        <button type="submit" className="bg-foreground text-bg rounded px-3 py-1.5">
          Add shift
        </button>
      </form>

      <RosterBoard
        customers={customers ?? []}
        staff={staff ?? []}
        shifts={shifts ?? []}
        assignments={assignments ?? []}
        jobs={jobs ?? []}
        containerRateCards={containerRateCards ?? []}
      />
    </div>
  );
}
