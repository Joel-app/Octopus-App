// All dashboard dates are Sydney-local. Shift dates are plain `date`s entered
// in local time, so "today" and day buckets must be computed in the same zone
// or late-evening work lands on the wrong day.
const TZ = "Australia/Sydney";

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** YYYY-MM-DD in Sydney for an instant (defaults to now). */
export function sydneyDate(instant: Date | string = new Date()): string {
  return dateFmt.format(typeof instant === "string" ? new Date(instant) : instant);
}

/** Minutes since local midnight in Sydney for an ISO timestamp. */
export function sydneyMinutes(iso: string): number {
  const [h, m] = timeFmt.format(new Date(iso)).split(":").map(Number);
  return (h % 24) * 60 + m;
}

/** Minutes since midnight for a Postgres `time` string like "07:00:00". */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const diffToMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d.toISOString().slice(0, 10);
}

export function eachWeek(start: string, end: string): string[] {
  const weeks: string[] = [];
  for (let w = weekStart(start); w <= end; w = addDays(w, 7)) weeks.push(w);
  return weeks;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** "12 Nov" — compact axis/table label. */
export function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
}
