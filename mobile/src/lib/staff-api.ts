import { supabase } from "./supabase";

// Thin typed wrappers over the staff-facing RPCs in
// supabase/migrations/0002_mobile_work.sql. Every call takes the session
// token minted by verify_staff_pin (see auth-context.tsx) as its first
// argument — staff have no Supabase Auth session, so this token is the
// only credential these RPCs check.

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type ShiftType = "hourly" | "container" | "rework";

export interface ShiftToday {
  shift_id: string;
  customer_name: string;
  role: string;
  start_time: string;
  status: string;
}

export async function getMyShiftToday(token: string, shiftType: ShiftType) {
  const rows = await call<ShiftToday[]>("get_my_shift_today", {
    p_token: token,
    p_shift_type: shiftType,
  });
  return rows?.[0] ?? null;
}

export interface BreakRow {
  id: string;
  start_time: string;
  end_time: string | null;
}

export interface SignOnStatus {
  sign_on_id: string;
  sign_on_time: string;
  sign_off_time: string | null;
  breaks: BreakRow[];
}

export async function getSignOnStatus(token: string, shiftId: string) {
  const rows = await call<SignOnStatus[]>("get_sign_on_status", {
    p_token: token,
    p_shift_id: shiftId,
  });
  return rows?.[0] ?? null;
}

export function signOn(token: string, shiftId: string) {
  return call<string>("sign_on", { p_token: token, p_shift_id: shiftId });
}

export function startBreak(token: string, shiftId: string) {
  return call<string>("start_break", { p_token: token, p_shift_id: shiftId });
}

export function endBreak(token: string, shiftId: string) {
  return call<void>("end_break", { p_token: token, p_shift_id: shiftId });
}

export function signOff(token: string, shiftId: string) {
  return call<void>("sign_off", { p_token: token, p_shift_id: shiftId });
}

export interface JobCrewMember {
  staff_id: string;
  full_name: string;
  participation_pct: number | null;
}

export interface NcrRow {
  id: string;
  issues: string[];
  created_at: string;
}

export const NCR_ISSUES = ["Mixed", "Heavy", "Collapsing", "Broken/damaged products"] as const;

export interface Job {
  job_id: string;
  job_type: "container" | "rework";
  type: string;
  size: string | null;
  quantity: number | null;
  container_number: string | null;
  carton_count: number | null;
  sku_count: number | null;
  notes: string | null;
  status: "pending" | "started" | "paused" | "finalised";
  started_at: string | null;
  finalised_at: string | null;
  pauses: { start_time: string; end_time?: string }[];
  crew: JobCrewMember[];
  ncr: NcrRow[];
}

export function getJobsForShift(token: string, shiftId: string) {
  return call<Job[]>("get_jobs_for_shift", { p_token: token, p_shift_id: shiftId });
}

export interface RateOption {
  position_or_type: string;
  size: string | null;
}

// Valid type/size combos from the customer's actual rate cards — using
// these instead of free text guarantees add_job's selection always matches
// a real rate, so pay never silently comes out as $0.
export function getRateOptions(token: string, shiftId: string, jobType: "container" | "rework") {
  return call<RateOption[]>("get_rate_options", {
    p_token: token,
    p_shift_id: shiftId,
    p_job_type: jobType,
  });
}

export interface CrewCandidate {
  staff_id: string;
  full_name: string;
  role: string;
}

export function getCrewCandidates(token: string, shiftId: string) {
  return call<CrewCandidate[]>("get_crew_candidates", { p_token: token, p_shift_id: shiftId });
}

export function addJob(
  token: string,
  shiftId: string,
  jobType: "container" | "rework",
  type: string,
  opts: {
    size?: string;
    quantity?: number;
    containerNumber?: string;
    cartonCount?: number;
    skuCount?: number;
    notes?: string;
  } = {}
) {
  return call<string>("add_job", {
    p_token: token,
    p_shift_id: shiftId,
    p_job_type: jobType,
    p_type: type,
    p_size: opts.size ?? null,
    p_quantity: opts.quantity ?? null,
    p_container_number: opts.containerNumber ?? null,
    p_carton_count: opts.cartonCount ?? null,
    p_sku_count: opts.skuCount ?? null,
    p_notes: opts.notes ?? null,
  });
}

export function setJobCrew(token: string, jobId: string, staffIds: string[]) {
  return call<void>("set_job_crew", { p_token: token, p_job_id: jobId, p_staff_ids: staffIds });
}

export function startJob(token: string, jobId: string) {
  return call<void>("start_job", { p_token: token, p_job_id: jobId });
}

export function pauseJob(token: string, jobId: string) {
  return call<void>("pause_job", { p_token: token, p_job_id: jobId });
}

export function resumeJob(token: string, jobId: string) {
  return call<void>("resume_job", { p_token: token, p_job_id: jobId });
}

export function finaliseJob(
  token: string,
  jobId: string,
  participation: { staff_id: string; participation_pct: number }[]
) {
  return call<void>("finalise_job", {
    p_token: token,
    p_job_id: jobId,
    p_participation: participation,
  });
}

export function addNcr(token: string, jobId: string, issues: string[]) {
  return call<string>("add_ncr", { p_token: token, p_job_id: jobId, p_issues: issues });
}

export interface PayItem {
  item_date: string;
  customer_name: string;
  label: string;
  amount: number;
}

export function getMyPay(token: string, startDate: string, endDate: string) {
  return call<PayItem[]>("get_my_pay", {
    p_token: token,
    p_start_date: startDate,
    p_end_date: endDate,
  });
}

export const LEAVE_TYPES = ["Annual", "Sick", "Unpaid", "Other"] as const;

export interface LeaveRequestRow {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "declined";
  created_at: string;
}

export function submitLeaveRequest(token: string, type: string, startDate: string, endDate: string) {
  return call<string>("submit_leave_request", {
    p_token: token,
    p_type: type,
    p_start_date: startDate,
    p_end_date: endDate,
  });
}

export function cancelLeaveRequest(token: string, leaveId: string) {
  return call<void>("cancel_leave_request", { p_token: token, p_leave_id: leaveId });
}

export function getMyLeaveRequests(token: string) {
  return call<LeaveRequestRow[]>("get_my_leave_requests", { p_token: token });
}

export interface CustomerOption {
  id: string;
  name: string;
}

export function listCustomers(token: string) {
  return call<CustomerOption[]>("list_customers", { p_token: token });
}

export const HAZARD_CATEGORIES = [
  "Slip/trip hazard",
  "Manual handling",
  "Equipment/machinery",
  "Chemical/spill",
  "Electrical",
  "Other",
] as const;

export const SEVERITY_LEVELS = ["Low", "Medium", "High", "Critical"] as const;

export interface HazardReportRow {
  id: string;
  customer_name: string | null;
  category: string;
  description: string;
  severity: string;
  status: "open" | "in_review" | "resolved";
  created_at: string;
}

export function submitHazardReport(
  token: string,
  customerId: string | null,
  category: string,
  description: string,
  severity: string
) {
  return call<string>("submit_hazard_report", {
    p_token: token,
    p_customer_id: customerId,
    p_category: category,
    p_description: description,
    p_severity: severity,
  });
}

export function getMyHazardReports(token: string) {
  return call<HazardReportRow[]>("get_my_hazard_reports", { p_token: token });
}

export const INCIDENT_TYPES = ["Injury", "Near miss", "Property damage", "Other"] as const;
export const YES_NO = ["Yes", "No"] as const;

export interface IncidentDetails {
  injuredPersonName?: string;
  injuredPersonContact?: string;
  injuredPersonPosition?: string;
  incidentType?: string;
  dateTime?: string;
  taskActivity?: string;
  firstAidGiven?: string;
  firstAiderName?: string;
  treatment?: string;
  stoppedWork?: string;
  potentialSeverity?: string;
  investigationNotes?: string;
  signatoryName?: string;
}

export interface IncidentReportRow {
  id: string;
  report_no: string;
  customer_name: string | null;
  description: string;
  status: "open" | "in_review" | "resolved";
  details: IncidentDetails;
  created_at: string;
}

export function submitIncidentReport(
  token: string,
  customerId: string | null,
  description: string,
  details: IncidentDetails
) {
  return call<string>("submit_incident_report", {
    p_token: token,
    p_customer_id: customerId,
    p_description: description,
    p_details: details,
  });
}

export function getMyIncidentReports(token: string) {
  return call<IncidentReportRow[]>("get_my_incident_reports", { p_token: token });
}
