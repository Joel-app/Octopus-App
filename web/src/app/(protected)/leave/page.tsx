import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LEAVE_TYPES } from "@/lib/constants";
import { setLeaveStatus, submitLeaveRequest } from "./actions";

interface LeaveRow {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "declined";
  created_at: string;
  profiles: { full_name: string } | null;
}

interface StaffOption {
  id: string;
  full_name: string;
  role: string;
}

export default async function LeavePage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: requests }, { data: staff }] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("id, type, start_date, end_date, status, created_at, profiles(full_name)")
      // "pending" sorts after "approved"/"declined" alphabetically, so descending
      // puts pending requests first — simple heuristic, revisit if statuses change.
      .order("status", { ascending: false })
      .order("start_date", { ascending: false })
      .returns<LeaveRow[]>(),
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("active", true)
      .order("full_name")
      .returns<StaffOption[]>(),
  ]);

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <h1 className="text-lg font-semibold">Leave requests</h1>

      <form
        action={submitLeaveRequest}
        className="flex flex-wrap gap-2 items-end border border-border rounded p-4 text-sm"
      >
        <h2 className="w-full text-sm font-semibold mb-1">Add leave request</h2>
        <label className="flex flex-col gap-1">
          Staff
          <select name="staff_id" required className="border border-border rounded px-2 py-1 bg-panel">
            {(staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
                {s.role !== "staff" ? ` (${s.role})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Type
          <select name="type" className="border border-border rounded px-2 py-1 bg-panel">
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Start date
          <input type="date" name="start_date" required className="border border-border rounded px-2 py-1 bg-panel" />
        </label>
        <label className="flex flex-col gap-1">
          End date
          <input type="date" name="end_date" required className="border border-border rounded px-2 py-1 bg-panel" />
        </label>
        <button type="submit" className="bg-foreground text-bg rounded px-3 py-1.5">
          Add request
        </button>
      </form>

      <table className="text-sm w-full">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="font-normal pr-4">Staff</th>
            <th className="font-normal pr-4">Type</th>
            <th className="font-normal pr-4">Dates</th>
            <th className="font-normal pr-4">Status</th>
            <th />
        </tr>
        </thead>
        <tbody>
          {(requests ?? []).map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="py-2 pr-4">{r.profiles?.full_name}</td>
              <td className="py-2 pr-4">{r.type}</td>
              <td className="py-2 pr-4">
                {r.start_date} → {r.end_date}
              </td>
              <td className="py-2 pr-4">{r.status}</td>
              <td className="py-2">
                {r.status === "pending" && (
                  <div className="flex gap-3">
                    <form action={setLeaveStatus.bind(null, r.id, "approved")}>
                      <button type="submit" className="text-success-text text-xs">
                        Approve
                      </button>
                    </form>
                    <form action={setLeaveStatus.bind(null, r.id, "declined")}>
                      <button type="submit" className="text-danger-text text-xs">
                        Decline
                      </button>
                    </form>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {(requests ?? []).length === 0 && (
            <tr>
              <td colSpan={5} className="py-2 text-text-secondary">
                No leave requests yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
