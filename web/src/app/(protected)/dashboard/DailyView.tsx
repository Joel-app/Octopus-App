"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/format";

interface BreakRow {
  id: string;
  start_time: string;
  end_time: string | null;
}

interface SignOnRow {
  id: string;
  sign_on_time: string;
  sign_off_time: string | null;
  profiles: { full_name: string } | null;
  shifts: { date: string; customers: { name: string } | null } | null;
  breaks: BreakRow[];
}

interface JobCrewRow {
  staff_id: string;
  participation_pct: number | null;
  profiles: { full_name: string } | null;
}

interface JobRow {
  id: string;
  job_type: "container" | "rework";
  type: string;
  size: string | null;
  quantity: number | null;
  container_number: string | null;
  status: string;
  shifts: { date: string; customers: { name: string } | null } | null;
  job_crew: JobCrewRow[];
  ncr_reports: { id: string }[];
}

const POLL_MS = 15_000;

export function DailyView() {
  const [signOns, setSignOns] = useState<SignOnRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const today = new Date().toISOString().slice(0, 10);

    async function load() {
      const [{ data: signOnData }, { data: jobData }] = await Promise.all([
        supabase
          .from("sign_ons")
          .select(
            "id, sign_on_time, sign_off_time, profiles(full_name), shifts!inner(date, customers(name)), breaks(id, start_time, end_time)"
          )
          .eq("shifts.date", today)
          .order("sign_on_time")
          .returns<SignOnRow[]>(),
        supabase
          .from("jobs")
          .select(
            "id, job_type, type, size, quantity, container_number, status, shifts!inner(date, customers(name)), job_crew(staff_id, participation_pct, profiles(full_name)), ncr_reports(id)"
          )
          .eq("shifts.date", today)
          .neq("status", "finalised")
          .returns<JobRow[]>(),
      ]);
      setSignOns(signOnData ?? []);
      setJobs(jobData ?? []);
      setLoading(false);
    }

    load();
    const dataTimer = setInterval(load, POLL_MS);
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(dataTimer);
      clearInterval(clockTimer);
    };
  }, []);

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-semibold mb-2">Signed on today</h2>
        {signOns.length === 0 && <p className="text-sm text-text-secondary">No one signed on yet.</p>}
        <table className="text-sm w-full">
          <tbody>
            {signOns.map((s) => {
              const openBreak = s.breaks.find((b) => !b.end_time);
              const signedOff = !!s.sign_off_time;
              const start = new Date(s.sign_on_time).getTime();
              const end = s.sign_off_time ? new Date(s.sign_off_time).getTime() : now.getTime();
              const breakMs = s.breaks.reduce((sum, b) => {
                const bStart = new Date(b.start_time).getTime();
                const bEnd = b.end_time ? new Date(b.end_time).getTime() : now.getTime();
                return sum + (bEnd - bStart);
              }, 0);
              const elapsed = end - start - breakMs;
              const status = signedOff ? "Signed off" : openBreak ? "On break" : "Working";
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2 pr-4">{s.profiles?.full_name}</td>
                  <td className="py-2 pr-4 text-text-secondary">{s.shifts?.customers?.name}</td>
                  <td className="py-2 pr-4">{status}</td>
                  <td className="py-2 font-mono">{formatDuration(elapsed)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Container / rework jobs in progress</h2>
        {jobs.length === 0 && <p className="text-sm text-text-secondary">Nothing in progress.</p>}
        <table className="text-sm w-full">
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-border">
                <td className="py-2 pr-4">{j.shifts?.customers?.name}</td>
                <td className="py-2 pr-4">
                  {j.job_type === "container"
                    ? `${j.container_number ?? j.type} (${j.size ?? "—"})`
                    : `${j.type} × ${j.quantity ?? 0}`}
                </td>
                <td className="py-2 pr-4">{j.status}</td>
                <td className="py-2 pr-4 text-text-secondary">
                  {j.job_crew.map((c) => c.profiles?.full_name).filter(Boolean).join(", ") || "no crew"}
                </td>
                <td className="py-2 text-danger-text">
                  {j.ncr_reports.length > 0 ? `${j.ncr_reports.length} NCR` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
