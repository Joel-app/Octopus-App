import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HAZARD_CATEGORIES, INCIDENT_TYPES, REPORT_STATUSES, SEVERITY_LEVELS, YES_NO } from "@/lib/constants";
import { submitHazardReport, submitIncidentReport, updateHazardReport, updateIncidentReport } from "./actions";

type ReportType = "hazard" | "incident";
type Mode = "create" | "view";

interface HazardRow {
  id: string;
  category: string;
  description: string;
  severity: string;
  status: string;
  review_notes: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
  customers: { name: string } | null;
}

interface IncidentRow {
  id: string;
  report_no: string;
  description: string;
  status: string;
  review_notes: string | null;
  details: Record<string, unknown>;
  created_at: string;
  profiles: { full_name: string } | null;
  customers: { name: string } | null;
}

interface StaffOption {
  id: string;
  full_name: string;
  role: string;
}

interface CustomerOption {
  id: string;
  name: string;
}

export default async function SafetyPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; type?: string; status?: string }>;
}) {
  const params = await searchParams;
  const mode: Mode = params.mode === "create" ? "create" : "view";
  const type: ReportType = params.type === "incident" ? "incident" : "hazard";
  const statusFilter = params.status || "all";

  const supabase = await createSupabaseServerClient();

  let staff: StaffOption[] = [];
  let customers: CustomerOption[] = [];
  let hazardReports: HazardRow[] = [];
  let incidentReports: IncidentRow[] = [];

  if (mode === "create") {
    const [{ data: staffData }, { data: customerData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("active", true)
        .order("full_name")
        .returns<StaffOption[]>(),
      supabase.from("customers").select("id, name").order("name").returns<CustomerOption[]>(),
    ]);
    staff = staffData ?? [];
    customers = customerData ?? [];
  } else if (type === "hazard") {
    let query = supabase
      .from("hazard_reports")
      .select(
        "id, category, description, severity, status, review_notes, created_at, profiles!staff_id(full_name), customers(name)"
      )
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data, error } = await query.returns<HazardRow[]>();
    if (error) throw new Error(error.message);
    hazardReports = data ?? [];
  } else {
    let query = supabase
      .from("incident_reports")
      .select(
        "id, report_no, description, status, review_notes, details, created_at, profiles!staff_id(full_name), customers(name)"
      )
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data, error } = await query.returns<IncidentRow[]>();
    if (error) throw new Error(error.message);
    incidentReports = data ?? [];
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-lg font-semibold">Safety reports</h1>

      <div className="flex gap-2 border border-border rounded p-1 text-sm self-start">
        <Link
          href={`/safety?mode=create&type=${type}`}
          className={mode === "create" ? "bg-hover px-3 py-1 rounded" : "px-3 py-1"}
        >
          Create report
        </Link>
        <Link
          href={`/safety?mode=view&type=${type}&status=${statusFilter}`}
          className={mode === "view" ? "bg-hover px-3 py-1 rounded" : "px-3 py-1"}
        >
          View reports
        </Link>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="flex gap-2 border border-border rounded p-1">
          <Link
            href={`/safety?mode=${mode}&type=hazard&status=${statusFilter}`}
            className={type === "hazard" ? "bg-hover px-2 py-1 rounded" : "px-2 py-1"}
          >
            Hazard
          </Link>
          <Link
            href={`/safety?mode=${mode}&type=incident&status=${statusFilter}`}
            className={type === "incident" ? "bg-hover px-2 py-1 rounded" : "px-2 py-1"}
          >
            Incident
          </Link>
        </div>
        {mode === "view" && (
          <div className="flex gap-2 border border-border rounded p-1">
            {["all", ...REPORT_STATUSES].map((s) => (
              <Link
                key={s}
                href={`/safety?mode=view&type=${type}&status=${s}`}
                className={statusFilter === s ? "bg-hover px-2 py-1 rounded" : "px-2 py-1"}
              >
                {s}
              </Link>
            ))}
          </div>
        )}
      </div>

      {mode === "create" &&
        (type === "hazard" ? (
          <form
            action={submitHazardReport}
            className="flex flex-wrap gap-2 items-end border border-border rounded p-4 text-sm"
          >
            <h2 className="w-full text-sm font-semibold mb-1">Add hazard report</h2>
            <label className="flex flex-col gap-1">
              Staff
              <select name="staff_id" required className="border border-border rounded px-2 py-1 bg-panel">
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                    {s.role !== "staff" ? ` (${s.role})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Site
              <select name="customer_id" className="border border-border rounded px-2 py-1 bg-panel">
                <option value="">Other</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Category
              <select name="category" className="border border-border rounded px-2 py-1 bg-panel">
                {HAZARD_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Risk rating
              <select name="severity" className="border border-border rounded px-2 py-1 bg-panel">
                {SEVERITY_LEVELS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 flex-1 basis-full">
              Description
              <input name="description" required className="border border-border rounded px-2 py-1 bg-panel" />
            </label>
            <button type="submit" className="bg-foreground text-bg rounded px-3 py-1.5">
              Add report
            </button>
          </form>
        ) : (
          <form
            action={submitIncidentReport}
            className="flex flex-col gap-3 border border-border rounded p-4 text-sm"
          >
            <h2 className="text-sm font-semibold">Add incident report</h2>

            <div className="flex flex-wrap gap-2 items-end">
              <label className="flex flex-col gap-1">
                Staff
                <select name="staff_id" required className="border border-border rounded px-2 py-1 bg-panel">
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                      {s.role !== "staff" ? ` (${s.role})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Site
                <select name="customer_id" className="border border-border rounded px-2 py-1 bg-panel">
                  <option value="">Other</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Type
                <select name="incident_type" className="border border-border rounded px-2 py-1 bg-panel">
                  {INCIDENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1">
              Task/activity at the time
              <input name="task_activity" className="border border-border rounded px-2 py-1 bg-panel" />
            </label>
            <label className="flex flex-col gap-1">
              What happened
              <input name="description" required className="border border-border rounded px-2 py-1 bg-panel" />
            </label>

            <fieldset className="border border-border rounded p-3 flex flex-wrap gap-2 items-end">
              <legend className="text-xs text-text-muted px-1">Injured / affected person</legend>
              <label className="flex flex-col gap-1">
                Name
                <input name="injured_person_name" className="border border-border rounded px-2 py-1 bg-panel" />
              </label>
              <label className="flex flex-col gap-1">
                Contact number
                <input name="injured_person_contact" className="border border-border rounded px-2 py-1 bg-panel" />
              </label>
              <label className="flex flex-col gap-1">
                Position
                <input name="injured_person_position" className="border border-border rounded px-2 py-1 bg-panel" />
              </label>
            </fieldset>

            <fieldset className="border border-border rounded p-3 flex flex-wrap gap-2 items-end">
              <legend className="text-xs text-text-muted px-1">Treatment</legend>
              <label className="flex flex-col gap-1">
                First aid given?
                <select name="first_aid_given" className="border border-border rounded px-2 py-1 bg-panel">
                  {YES_NO.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                First aider name
                <input name="first_aider_name" className="border border-border rounded px-2 py-1 bg-panel" />
              </label>
              <label className="flex flex-col gap-1">
                Treatment given
                <input name="treatment" className="border border-border rounded px-2 py-1 bg-panel" />
              </label>
              <label className="flex flex-col gap-1">
                Work stopped?
                <select name="stopped_work" className="border border-border rounded px-2 py-1 bg-panel">
                  {YES_NO.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>

            <fieldset className="border border-border rounded p-3 flex flex-wrap gap-2 items-end">
              <legend className="text-xs text-text-muted px-1">Investigation</legend>
              <label className="flex flex-col gap-1">
                Potential severity
                <select name="potential_severity" className="border border-border rounded px-2 py-1 bg-panel">
                  {SEVERITY_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 flex-1">
                Notes
                <input name="investigation_notes" className="border border-border rounded px-2 py-1 bg-panel" />
              </label>
            </fieldset>

            <label className="flex flex-col gap-1">
              Signed off by (name)
              <input
                name="signatory_name"
                required
                className="border border-border rounded px-2 py-1 bg-panel max-w-xs"
              />
            </label>

            <button type="submit" className="bg-foreground text-bg rounded px-3 py-1.5 self-start">
              Add report
            </button>
          </form>
        ))}

      {mode === "view" && (
        <div className="flex flex-col gap-4">
          {type === "hazard" &&
            hazardReports.map((r) => (
              <div key={r.id} className="border border-border rounded p-4 flex flex-col gap-2">
                <div className="text-sm text-text-secondary">
                  {new Date(r.created_at).toLocaleString()} · {r.profiles?.full_name} ·{" "}
                  {r.customers?.name ?? "Other"}
                </div>
                <div className="font-semibold">
                  {r.category} · {r.severity}
                </div>
                <p className="text-sm">{r.description}</p>
                <ReviewForm
                  action={updateHazardReport.bind(null, r.id)}
                  status={r.status}
                  reviewNotes={r.review_notes}
                />
              </div>
            ))}

          {type === "incident" &&
            incidentReports.map((r) => (
              <div key={r.id} className="border border-border rounded p-4 flex flex-col gap-2">
                <div className="text-sm text-text-secondary">
                  {r.report_no} · {new Date(r.created_at).toLocaleString()} · {r.profiles?.full_name} ·{" "}
                  {r.customers?.name ?? "Other"}
                </div>
                <p className="text-sm">{r.description}</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-secondary">
                  {Object.entries(r.details || {}).map(([key, value]) =>
                    value ? (
                      <div key={key} className="contents">
                        <dt className="text-text-muted">{key}</dt>
                        <dd>{String(value)}</dd>
                      </div>
                    ) : null
                  )}
                </dl>
                <ReviewForm
                  action={updateIncidentReport.bind(null, r.id)}
                  status={r.status}
                  reviewNotes={r.review_notes}
                />
              </div>
            ))}

          {type === "hazard" && hazardReports.length === 0 && (
            <p className="text-sm text-text-secondary">No hazard reports.</p>
          )}
          {type === "incident" && incidentReports.length === 0 && (
            <p className="text-sm text-text-secondary">No incident reports.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewForm({
  action,
  status,
  reviewNotes,
}: {
  action: (formData: FormData) => Promise<void>;
  status: string;
  reviewNotes: string | null;
}) {
  return (
    <form action={action} className="flex flex-wrap gap-2 items-end text-sm mt-2">
      <label className="flex flex-col gap-1">
        Status
        <select name="status" defaultValue={status} className="border border-border rounded px-2 py-1 bg-panel">
          {REPORT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 flex-1">
        Review notes
        <input
          name="review_notes"
          defaultValue={reviewNotes ?? ""}
          className="border border-border rounded px-2 py-1 bg-panel w-full"
        />
      </label>
      <button type="submit" className="bg-foreground text-bg rounded px-3 py-1.5">
        Save
      </button>
    </form>
  );
}
