import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAllRows, fetchReport } from "@/lib/supabase/paging";
import { SEVERITY_LEVELS } from "@/lib/constants";
import { formatValue } from "@/components/charts/format";
import {
  addDays,
  daysBetween,
  eachDay,
  eachWeek,
  shortDate,
  sydneyDate,
  sydneyMinutes,
  timeToMinutes,
  weekStart,
} from "./dates";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface Range {
  start: string;
  end: string;
  today: string;
}

const LATE_GRACE_MINUTES = 5;
const EXPIRY_WINDOW_DAYS = 60;
const HOURS_FLAG = 38;

// ---------------------------------------------------------------------------
// Raw fetches. Anything that can exceed 1000 rows pages via fetchAllRows,
// ordered by a unique id so pages never overlap.
// ---------------------------------------------------------------------------

interface ShiftRef {
  date: string;
  start_time: string;
  customer_id: string;
}

async function fetchCustomerNames(sb: Supabase) {
  const rows = await fetchAllRows<{ id: string; name: string }>((from, to) =>
    sb.from("customers").select("id, name").order("id").range(from, to)
  );
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function fetchProfileNames(sb: Supabase) {
  const rows = await fetchAllRows<{ id: string; full_name: string }>((from, to) =>
    sb.from("profiles").select("id, full_name").order("id").range(from, to)
  );
  return new Map(rows.map((r) => [r.id, r.full_name]));
}

interface SignOnRow {
  id: string;
  shift_id: string;
  staff_id: string;
  sign_on_time: string;
  sign_off_time: string | null;
  shifts: ShiftRef;
  breaks: { start_time: string; end_time: string | null }[];
}

function fetchSignOns(sb: Supabase, start: string, end: string) {
  return fetchAllRows<SignOnRow>((from, to) =>
    sb
      .from("sign_ons")
      .select("id, shift_id, staff_id, sign_on_time, sign_off_time, shifts!inner(date, start_time, customer_id), breaks(start_time, end_time)")
      .gte("shifts.date", start)
      .lte("shifts.date", end)
      .order("id")
      .range(from, to)
      .returns<SignOnRow[]>()
  );
}

interface AssignmentRow {
  id: string;
  shift_id: string;
  staff_id: string;
  role: string;
  shifts: ShiftRef & { shift_type: string };
}

function fetchAssignments(sb: Supabase, start: string, end: string) {
  return fetchAllRows<AssignmentRow>((from, to) =>
    sb
      .from("shift_assignments")
      .select("id, shift_id, staff_id, role, shifts!inner(date, start_time, customer_id, shift_type)")
      .gte("shifts.date", start)
      .lte("shifts.date", end)
      .order("id")
      .range(from, to)
      .returns<AssignmentRow[]>()
  );
}

interface JobRow {
  id: string;
  job_type: "container" | "rework";
  size: string | null;
  status: string;
  started_at: string | null;
  finalised_at: string | null;
  pauses: { start_time: string; end_time?: string | null }[];
  shifts: { date: string; customer_id: string };
}

function fetchJobs(sb: Supabase, start: string, end: string) {
  return fetchAllRows<JobRow>((from, to) =>
    sb
      .from("jobs")
      .select("id, job_type, size, status, started_at, finalised_at, pauses, shifts!inner(date, customer_id)")
      .gte("shifts.date", start)
      .lte("shifts.date", end)
      .order("id")
      .range(from, to)
      .returns<JobRow[]>()
  );
}

/** Worked hours for one sign-on: sign-off minus sign-on minus breaks. 0 if still signed on. */
function workedHours(s: SignOnRow): number {
  if (!s.sign_off_time) return 0;
  const off = Date.parse(s.sign_off_time);
  const breakMs = s.breaks.reduce((sum, b) => {
    const bEnd = b.end_time ? Date.parse(b.end_time) : off;
    return sum + Math.max(0, bEnd - Date.parse(b.start_time));
  }, 0);
  return Math.max(0, off - Date.parse(s.sign_on_time) - breakMs) / 3_600_000;
}

function sumBy<T>(rows: T[], key: (r: T) => string, value: (r: T) => number) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(key(r), (map.get(key(r)) ?? 0) + value(r));
  return map;
}

function ranked(map: Map<string, number>, limit = 15) {
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Money (admin only — the RPCs themselves enforce is_admin()).
// ---------------------------------------------------------------------------

interface ReportRow {
  item_date: string;
  customer_name: string;
  label: string;
  amount: number;
}

export async function loadMoney(sb: Supabase, { start, end }: Range) {
  const [billing, pay] = await Promise.all([
    fetchReport<ReportRow>(sb, "admin_get_billing_report", start, end),
    fetchReport<ReportRow>(sb, "admin_get_pay_report", start, end),
  ]);

  const revenue = billing.reduce((s, r) => s + Number(r.amount), 0);
  const cost = pay.reduce((s, r) => s + Number(r.amount), 0);
  const margin = revenue - cost;

  const weeks = eachWeek(start, end);
  const revByWeek = sumBy(billing, (r) => weekStart(r.item_date), (r) => Number(r.amount));
  const costByWeek = sumBy(pay, (r) => weekStart(r.item_date), (r) => Number(r.amount));

  const revByCustomer = sumBy(billing, (r) => r.customer_name, (r) => Number(r.amount));
  const costByCustomer = sumBy(pay, (r) => r.customer_name, (r) => Number(r.amount));
  const customers = new Set([...revByCustomer.keys(), ...costByCustomer.keys()]);
  const marginByCustomer = [...customers]
    .map((c) => ({ label: c, value: (revByCustomer.get(c) ?? 0) - (costByCustomer.get(c) ?? 0) }))
    .sort((a, b) => b.value - a.value);

  const workType = (label: string) =>
    label.startsWith("Container") ? "Container" : label.startsWith("Rework") ? "Rework" : "Hourly";
  const revByType = sumBy(billing, (r) => workType(r.label), (r) => Number(r.amount));

  return {
    revenue,
    cost,
    margin,
    marginPct: revenue > 0 ? (margin / revenue) * 100 : null,
    weekly: {
      categories: weeks.map(shortDate),
      revenue: weeks.map((w) => revByWeek.get(w) ?? 0),
      cost: weeks.map((w) => costByWeek.get(w) ?? 0),
      table: {
        columns: ["Week starting", "Revenue", "Labour cost", "Margin"],
        rows: weeks.map((w) => {
          const rv = revByWeek.get(w) ?? 0;
          const c = costByWeek.get(w) ?? 0;
          return [shortDate(w), formatValue(rv, "currency"), formatValue(c, "currency"), formatValue(rv - c, "currency")];
        }),
      },
    },
    marginByCustomer,
    revenueByType: ["Hourly", "Container", "Rework"].map((t) => ({ label: t, value: revByType.get(t) ?? 0 })),
  };
}

// ---------------------------------------------------------------------------
// Productivity
// ---------------------------------------------------------------------------

/** Active minutes on a container: start → finalise, minus pauses. null if unusable. */
function containerMinutes(j: JobRow): number | null {
  if (!j.started_at || !j.finalised_at) return null;
  const fin = Date.parse(j.finalised_at);
  const paused = (j.pauses ?? []).reduce((sum, p) => {
    const pEnd = p.end_time ? Date.parse(p.end_time) : fin;
    return sum + Math.max(0, pEnd - Date.parse(p.start_time));
  }, 0);
  const minutes = (fin - Date.parse(j.started_at) - paused) / 60_000;
  return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
}

export async function loadProductivity(sb: Supabase, { start, end }: Range) {
  const [jobs, signOns, customers] = await Promise.all([
    fetchJobs(sb, start, end),
    fetchSignOns(sb, start, end),
    fetchCustomerNames(sb),
  ]);
  const site = (id: string) => customers.get(id) ?? "Unknown site";
  const days = eachDay(start, end);

  const containers = jobs.filter((j) => j.job_type === "container" && j.status === "finalised");
  const reworkDone = jobs.filter((j) => j.job_type === "rework" && j.status === "finalised").length;
  const containersByDay = sumBy(containers, (j) => j.shifts.date, () => 1);

  const timed = containers
    .map((j) => ({ j, minutes: containerMinutes(j) }))
    .filter((x): x is { j: JobRow; minutes: number } => x.minutes !== null);
  const avgMinutes = timed.length ? timed.reduce((s, x) => s + x.minutes, 0) / timed.length : null;
  const minutesByCustomer = new Map<string, number[]>();
  for (const { j, minutes } of timed) {
    const key = site(j.shifts.customer_id);
    minutesByCustomer.set(key, [...(minutesByCustomer.get(key) ?? []), minutes]);
  }
  const avgByCustomer = [...minutesByCustomer.entries()]
    .map(([label, ms]) => ({ label, value: ms.reduce((a, b) => a + b, 0) / ms.length }))
    .sort((a, b) => b.value - a.value);

  const sizes = sumBy(containers, (j) => (j.size === "20ft" || j.size === "40ft" ? j.size : "Other"), () => 1);

  const hoursByDay = sumBy(signOns, (s) => s.shifts.date, workedHours);
  const hoursBySite = sumBy(signOns, (s) => site(s.shifts.customer_id), workedHours);
  const totalHours = [...hoursByDay.values()].reduce((a, b) => a + b, 0);

  return {
    containersDone: containers.length,
    reworkDone,
    avgMinutes,
    timedCount: timed.length,
    totalHours,
    containersPerDay: {
      categories: days.map(shortDate),
      values: days.map((d) => containersByDay.get(d) ?? 0),
      table: { columns: ["Date", "Containers"], rows: days.map((d) => [shortDate(d), containersByDay.get(d) ?? 0]) },
    },
    containersByCustomer: ranked(sumBy(containers, (j) => site(j.shifts.customer_id), () => 1)),
    containersBySize: (["20ft", "40ft", "Other"] as const).map((s) => ({ label: s, value: sizes.get(s) ?? 0 })),
    avgByCustomer,
    hoursPerDay: {
      categories: days.map(shortDate),
      values: days.map((d) => hoursByDay.get(d) ?? 0),
      table: {
        columns: ["Date", "Hours"],
        rows: days.map((d) => [shortDate(d), (hoursByDay.get(d) ?? 0).toFixed(1)]),
      },
    },
    hoursBySite: ranked(hoursBySite),
  };
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export async function loadAttendance(sb: Supabase, { start, end, today }: Range) {
  const [assignments, signOns, customers, people] = await Promise.all([
    fetchAssignments(sb, start, end),
    fetchSignOns(sb, start, end),
    fetchCustomerNames(sb),
    fetchProfileNames(sb),
  ]);
  const site = (id: string) => customers.get(id) ?? "Unknown site";
  const person = (id: string) => people.get(id) ?? "Unknown";
  // Only hourly shifts have a sign-on in the mobile app — container/rework
  // crews log work through jobs — so attendance is measured on hourly shifts.
  const hourly = assignments.filter((a) => a.shifts.shift_type === "hourly");

  // Earliest sign-on per (shift, person).
  const firstSignOn = new Map<string, string>();
  for (const s of signOns) {
    const key = `${s.shift_id}:${s.staff_id}`;
    const prev = firstSignOn.get(key);
    if (!prev || s.sign_on_time < prev) firstSignOn.set(key, s.sign_on_time);
  }

  // Fill rate only counts completed days — today's later shifts haven't started yet.
  const lastCompleteDay = end < today ? end : addDays(today, -1);
  const pastDays = lastCompleteDay >= start ? eachDay(start, lastCompleteDay) : [];
  const past = hourly.filter((a) => a.shifts.date <= lastCompleteDay);
  const rostered = sumBy(past, (a) => a.shifts.date, () => 1);
  const attended = sumBy(
    past.filter((a) => firstSignOn.has(`${a.shift_id}:${a.staff_id}`)),
    (a) => a.shifts.date,
    () => 1
  );
  const totalRostered = past.length;
  const totalAttended = [...attended.values()].reduce((a, b) => a + b, 0);
  const fillPct = (d: string) => {
    const r = rostered.get(d) ?? 0;
    return r ? ((attended.get(d) ?? 0) / r) * 100 : 0;
  };

  const noShows = past
    .filter((a) => !firstSignOn.has(`${a.shift_id}:${a.staff_id}`))
    .sort((a, b) => b.shifts.date.localeCompare(a.shifts.date));

  const late = hourly
    .map((a) => {
      const signOn = firstSignOn.get(`${a.shift_id}:${a.staff_id}`);
      if (!signOn || sydneyDate(signOn) !== a.shifts.date) return null;
      const mins = sydneyMinutes(signOn) - timeToMinutes(a.shifts.start_time);
      return mins > LATE_GRACE_MINUTES ? { a, mins } : null;
    })
    .filter((x): x is { a: AssignmentRow; mins: number } => x !== null)
    .sort((x, y) => y.a.shifts.date.localeCompare(x.a.shifts.date));

  const hoursByPerson = sumBy(signOns, (s) => person(s.staff_id), workedHours);
  const weekly = sumBy(signOns, (s) => `${s.staff_id}|${weekStart(s.shifts.date)}`, workedHours);
  const over38 = [...weekly.entries()]
    .filter(([, h]) => h > HOURS_FLAG)
    .map(([key, h]) => {
      const [staffId, week] = key.split("|");
      return { name: person(staffId), week, hours: h };
    })
    .sort((a, b) => b.week.localeCompare(a.week) || b.hours - a.hours);

  return {
    fillRate: totalRostered ? (totalAttended / totalRostered) * 100 : null,
    totalRostered,
    noShowCount: noShows.length,
    lateCount: late.length,
    fillPerDay: {
      categories: pastDays.map(shortDate),
      values: pastDays.map(fillPct),
      table: {
        columns: ["Date", "Rostered", "Signed on", "Fill rate"],
        rows: pastDays.map((d) => [
          shortDate(d),
          rostered.get(d) ?? 0,
          attended.get(d) ?? 0,
          `${Math.round(fillPct(d))}%`,
        ]),
      },
    },
    noShows: {
      columns: ["Date", "Staff", "Site", "Role"],
      rows: noShows.slice(0, 50).map((a) => [shortDate(a.shifts.date), person(a.staff_id), site(a.shifts.customer_id), a.role]),
    },
    late: {
      columns: ["Date", "Staff", "Site", "Minutes late"],
      rows: late.slice(0, 50).map(({ a, mins }) => [shortDate(a.shifts.date), person(a.staff_id), site(a.shifts.customer_id), mins]),
    },
    hoursPerPerson: ranked(hoursByPerson),
    over38: {
      columns: ["Staff", "Week starting", "Hours"],
      rows: over38.map((r) => [r.name, shortDate(r.week), r.hours.toFixed(1)]),
    },
  };
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

interface HazardRow {
  id: string;
  created_at: string;
  category: string | null;
  severity: string | null;
  customer_id: string | null;
}
interface IncidentRow {
  id: string;
  created_at: string;
  customer_id: string | null;
  details: { incidentType?: string; potentialSeverity?: string } | null;
}

export async function loadSafety(sb: Supabase, { start, end, today }: Range) {
  // created_at is a UTC instant; widen by a day each side, then bucket in Sydney time.
  const from = `${addDays(start, -1)}T00:00:00Z`;
  const to = `${addDays(end, 1)}T23:59:59Z`;
  const inRange = (iso: string) => {
    const d = sydneyDate(iso);
    return d >= start && d <= end;
  };

  const [hazardsAll, incidentsAll, customers, openHazards, openIncidents, last] = await Promise.all([
    fetchAllRows<HazardRow>((f, t) =>
      sb.from("hazard_reports").select("id, created_at, category, severity, customer_id").gte("created_at", from).lte("created_at", to).order("id").range(f, t)
    ),
    fetchAllRows<IncidentRow>((f, t) =>
      sb.from("incident_reports").select("id, created_at, customer_id, details").gte("created_at", from).lte("created_at", to).order("id").range(f, t)
    ),
    fetchCustomerNames(sb),
    sb.from("hazard_reports").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    sb.from("incident_reports").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    sb.from("incident_reports").select("created_at").order("created_at", { ascending: false }).limit(1),
  ]);
  for (const r of [openHazards, openIncidents, last]) if (r.error) throw new Error(r.error.message);

  const hazards = hazardsAll.filter((h) => inRange(h.created_at));
  const incidents = incidentsAll.filter((i) => inRange(i.created_at));
  const site = (id: string | null) => (id ? customers.get(id) ?? "Unknown site" : "Other");

  const weeks = eachWeek(start, end);
  const hazardByWeek = sumBy(hazards, (h) => weekStart(sydneyDate(h.created_at)), () => 1);
  const incidentByWeek = sumBy(incidents, (i) => weekStart(sydneyDate(i.created_at)), () => 1);

  const bySite = sumBy(
    [...hazards.map((h) => h.customer_id), ...incidents.map((i) => i.customer_id)],
    (id) => site(id),
    () => 1
  );
  const byCategory = sumBy(
    [
      ...hazards.map((h) => `Hazard — ${h.category || "Uncategorised"}`),
      ...incidents.map((i) => `Incident — ${i.details?.incidentType || "Other"}`),
    ],
    (k) => k,
    () => 1
  );
  const bySeverity = sumBy(
    [...hazards.map((h) => h.severity), ...incidents.map((i) => i.details?.potentialSeverity)],
    (s) => s || "Not set",
    () => 1
  );

  const lastIncidentAt = last.data?.[0]?.created_at ?? null;

  return {
    openHazards: openHazards.count ?? 0,
    openIncidents: openIncidents.count ?? 0,
    hazardsInRange: hazards.length,
    incidentsInRange: incidents.length,
    daysSinceIncident: lastIncidentAt ? daysBetween(sydneyDate(lastIncidentAt), today) : null,
    lastIncidentDate: lastIncidentAt ? sydneyDate(lastIncidentAt) : null,
    perWeek: {
      categories: weeks.map(shortDate),
      hazards: weeks.map((w) => hazardByWeek.get(w) ?? 0),
      incidents: weeks.map((w) => incidentByWeek.get(w) ?? 0),
      table: {
        columns: ["Week starting", "Hazards", "Incidents"],
        rows: weeks.map((w) => [shortDate(w), hazardByWeek.get(w) ?? 0, incidentByWeek.get(w) ?? 0]),
      },
    },
    bySite: ranked(bySite),
    byCategory: ranked(byCategory),
    // Severity is ordinal — keep Low → Critical order rather than ranking by count.
    bySeverity: [...SEVERITY_LEVELS, "Not set"]
      .map((s) => ({ label: s, value: bySeverity.get(s) ?? 0 }))
      .filter((x) => x.value > 0 || x.label !== "Not set"),
  };
}

// ---------------------------------------------------------------------------
// Compliance (admin only — staff_sensitive is RLS-gated to is_admin()).
// ---------------------------------------------------------------------------

interface SensitiveRow {
  profile_id: string;
  address: { street?: string; suburb?: string; state?: string; postcode?: string } | null;
  bank_bsb_encrypted: string | null;
  bank_account_number_encrypted: string | null;
  tax_type: string | null;
  forklift_licence_expiry: string | null;
  lo_licence_expiry: string | null;
  visa_status: string | null;
  visa_expiry: string | null;
}

export async function loadCompliance(sb: Supabase, { today }: Range) {
  const [staff, sensitive] = await Promise.all([
    fetchAllRows<{ id: string; full_name: string }>((f, t) =>
      sb.from("profiles").select("id, full_name").eq("role", "staff").eq("active", true).order("id").range(f, t)
    ),
    fetchAllRows<SensitiveRow>((f, t) =>
      sb
        .from("staff_sensitive")
        .select(
          "profile_id, address, bank_bsb_encrypted, bank_account_number_encrypted, tax_type, forklift_licence_expiry, lo_licence_expiry, visa_status, visa_expiry"
        )
        .order("profile_id")
        .range(f, t)
    ),
  ]);
  const byId = new Map(sensitive.map((s) => [s.profile_id, s]));
  const horizon = addDays(today, EXPIRY_WINDOW_DAYS);

  const expiring: { name: string; doc: string; expiry: string; days: number }[] = [];
  const incomplete: { name: string; missing: string[] }[] = [];
  let tfn = 0;
  let abn = 0;
  let unset = 0;

  for (const p of staff) {
    const s = byId.get(p.id);
    const docs: [string, string | null | undefined][] = [
      ["Forklift licence", s?.forklift_licence_expiry],
      ["LO licence", s?.lo_licence_expiry],
      // Visa expiry only matters for non-residents ("No" from the resident question; older records say "Visa holder").
      ["Visa", s && (s.visa_status === "No" || s.visa_status === "Visa holder") ? s.visa_expiry : null],
    ];
    for (const [doc, expiry] of docs) {
      if (expiry && expiry <= horizon) {
        expiring.push({ name: p.full_name, doc, expiry, days: daysBetween(today, expiry) });
      }
    }

    const missing: string[] = [];
    const a = s?.address;
    if (!(a?.street && a?.suburb && a?.state && a?.postcode)) missing.push("Address");
    if (!(s?.bank_bsb_encrypted && s?.bank_account_number_encrypted)) missing.push("Bank details");
    if (!s?.tax_type) missing.push("Tax details");
    if (missing.length) incomplete.push({ name: p.full_name, missing });

    if (s?.tax_type === "TFN") tfn++;
    else if (s?.tax_type === "ABN") abn++;
    else unset++;
  }
  expiring.sort((x, y) => x.days - y.days);

  return {
    activeStaff: staff.length,
    expiredCount: expiring.filter((e) => e.days < 0).length,
    expiringCount: expiring.length,
    incompleteCount: incomplete.length,
    expiring: {
      columns: ["Staff", "Document", "Expiry", "Status"],
      rows: expiring.map((e) => [
        e.name,
        e.doc,
        shortDate(e.expiry),
        e.days < 0 ? `Expired ${-e.days}d ago` : e.days === 0 ? "Expires today" : `Expires in ${e.days}d`,
      ]),
    },
    incomplete: {
      columns: ["Staff", "Missing"],
      rows: incomplete.sort((x, y) => x.name.localeCompare(y.name)).map((i) => [i.name, i.missing.join(", ")]),
    },
    split: { tfn, abn, unset },
  };
}

// ---------------------------------------------------------------------------
// Roster & leave — always the next 7 days from today, independent of the range filter.
// ---------------------------------------------------------------------------

export async function loadRoster(sb: Supabase, { today }: Range) {
  const end = addDays(today, 6);
  const [shifts, assignments, customers, leave, pending] = await Promise.all([
    fetchAllRows<{ id: string; date: string; start_time: string; shift_type: string; status: string; customer_id: string }>(
      (f, t) =>
        sb.from("shifts").select("id, date, start_time, shift_type, status, customer_id").gte("date", today).lte("date", end).order("id").range(f, t)
    ),
    fetchAssignments(sb, today, end),
    fetchCustomerNames(sb),
    fetchAllRows<{ id: string; type: string; start_date: string; end_date: string; profiles: { full_name: string } | null }>(
      (f, t) =>
        sb
          .from("leave_requests")
          .select("id, type, start_date, end_date, profiles(full_name)")
          .eq("status", "approved")
          .lte("start_date", end)
          .gte("end_date", today)
          .order("id")
          .range(f, t)
          .returns<{ id: string; type: string; start_date: string; end_date: string; profiles: { full_name: string } | null }[]>()
    ),
    sb.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  if (pending.error) throw new Error(pending.error.message);
  const site = (id: string) => customers.get(id) ?? "Unknown site";

  const hasManager = new Set(assignments.filter((a) => a.role === "Manager").map((a) => a.shift_id));
  // Same rule the Roster page enforces before a shift can be confirmed.
  const missingManager = shifts
    .filter((s) => s.shift_type !== "hourly" && !hasManager.has(s.id))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

  return {
    windowEnd: end,
    confirmed: shifts.filter((s) => s.status === "confirmed").length,
    draft: shifts.filter((s) => s.status !== "confirmed").length,
    pendingLeave: pending.count ?? 0,
    onLeaveCount: new Set(leave.map((l) => l.profiles?.full_name)).size,
    missingManager: {
      columns: ["Date", "Site", "Type", "Start"],
      rows: missingManager.map((s) => [shortDate(s.date), site(s.customer_id), s.shift_type, s.start_time.slice(0, 5)]),
    },
    onLeave: {
      columns: ["Staff", "Type", "From", "To"],
      rows: leave
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .map((l) => [l.profiles?.full_name ?? "Unknown", l.type, shortDate(l.start_date), shortDate(l.end_date)]),
    },
  };
}
