// Draft domain types — expect these to change as each feature is built for real.

export type Role = "superadmin" | "admin" | "operations" | "staff";

export interface Profile {
  id: string;
  fullName: string;
  email: string | null;
  role: Role;
  position: string | null;
  startDate: string | null;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  address: string | null;
  operatingHours: string | null;
}

export type WorkType = "hourly" | "container" | "rework";

export interface RateCard {
  id: string;
  customerId: string;
  workType: WorkType;
  positionOrType: string;
  size: string | null;
  chargeRate: number;
  payRate: number;
}

export type ShiftStatus = "draft" | "confirmed";

export interface Shift {
  id: string;
  customerId: string;
  date: string;
  startTime: string;
  shiftType: WorkType;
  status: ShiftStatus;
}

export interface ShiftAssignment {
  id: string;
  shiftId: string;
  staffId: string;
  role: string;
}

export interface SignOn {
  id: string;
  shiftId: string;
  staffId: string;
  signOnTime: string;
  signOffTime: string | null;
}

export type JobStatus = "pending" | "started" | "paused" | "finalised";

export interface Job {
  id: string;
  shiftId: string;
  jobType: Extract<WorkType, "container" | "rework">;
  type: string;
  size: string | null;
  quantity: number | null;
  containerNumber: string | null;
  cartonCount: number | null;
  skuCount: number | null;
  notes: string | null;
  status: JobStatus;
  startedAt: string | null;
  finalisedAt: string | null;
}

export type LeaveStatus = "pending" | "approved" | "declined";

export interface LeaveRequest {
  id: string;
  staffId: string;
  type: string;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
}

export type ReportStatus = "open" | "in_review" | "resolved";

export interface HazardReport {
  id: string;
  staffId: string;
  siteId: string;
  category: string;
  description: string;
  severity: string;
  status: ReportStatus;
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface IncidentReport {
  id: string;
  staffId: string;
  siteId: string;
  reportNo: string;
  description: string;
  status: ReportStatus;
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}
