export const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;

// Matches the role list used by the mobile app's shift-assignment lookups
// (resolve_hourly_rate_key, is_shift_manager) — keep in sync.
export const ROLES = ["Manager", "Forklift Driver", "LO Driver", "General Hand"] as const;

export const SHIFT_TYPES = ["hourly", "container", "rework"] as const;

export const CONTAINER_SIZES = ["20ft", "40ft"] as const;

export const REPORT_STATUSES = ["open", "in_review", "resolved"] as const;

// Every hourly pay lookup (resolve_hourly_rate_key in the mobile migration)
// resolves to exactly one of these four keys — unlike container/rework
// types, which are open-ended per customer, these are fixed and universal,
// so every customer needs all four or pay silently comes out as $0 for
// whichever's missing.
export const DEFAULT_HOURLY_POSITIONS = [
  "General Labourer <3 Months",
  "General Labourer >3 Months",
  "Forklift Operator",
  "LO driver",
] as const;

// Keep these option lists in sync with the mobile app's
// (mobile/src/lib/staff-api.ts) equivalents — same choices either side.
export const LEAVE_TYPES = ["Annual", "Sick", "Unpaid", "Other"] as const;

export const HAZARD_CATEGORIES = [
  "Slip/trip hazard",
  "Manual handling",
  "Equipment/machinery",
  "Chemical/spill",
  "Electrical",
  "Other",
] as const;

export const SEVERITY_LEVELS = ["Low", "Medium", "High", "Critical"] as const;

export const INCIDENT_TYPES = ["Injury", "Near miss", "Property damage", "Other"] as const;

export const YES_NO = ["Yes", "No"] as const;
