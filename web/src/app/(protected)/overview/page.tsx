import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addDays, shortDate, sydneyDate } from "@/lib/dashboard/dates";
import {
  loadAttendance,
  loadCompliance,
  loadMoney,
  loadProductivity,
  loadRoster,
  loadSafety,
  type Range,
} from "@/lib/dashboard/data";
import { ColumnChart } from "@/components/charts/ColumnChart";
import {
  ChartCard,
  DataTable,
  HBarChart,
  HeroFigure,
  SegmentedBar,
  StatTile,
  type TableData,
} from "@/components/charts/Primitives";
import { formatValue } from "@/components/charts/format";

type Tab = "overview" | "money" | "productivity" | "attendance" | "safety" | "compliance" | "roster";

const TABS: { key: Tab; label: string; adminOnly?: boolean; ranged: boolean }[] = [
  { key: "overview", label: "Overview", ranged: true },
  { key: "money", label: "Money", adminOnly: true, ranged: true },
  { key: "productivity", label: "Productivity", ranged: true },
  { key: "attendance", label: "Attendance", ranged: true },
  { key: "safety", label: "Safety", ranged: true },
  { key: "compliance", label: "Compliance", adminOnly: true, ranged: false },
  { key: "roster", label: "Roster & leave", ranged: false },
];

const PRESETS = [7, 30, 90] as const;
const MAX_RANGE_DAYS = 366;
const isDate = (v?: string): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

function hasData(values: number[]) {
  return values.some((v) => v > 0);
}

function Empty() {
  return <p className="text-sm text-text-secondary">Nothing recorded for this range.</p>;
}

function rangedTable(items: { label: string; value: number }[], heading: string, valueHeading: string, f: Parameters<typeof formatValue>[1]): TableData {
  return { columns: [heading, valueHeading], rows: items.map((i) => [i.label, formatValue(i.value, f)]) };
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; range?: string; start?: string; end?: string }>;
}) {
  const { profile } = await verifySession();
  const isAdmin = profile.role !== "operations";
  const params = await searchParams;

  const visibleTabs = TABS.filter((t) => isAdmin || !t.adminOnly);
  const tab = visibleTabs.find((t) => t.key === params.tab) ?? visibleTabs[0];

  const today = sydneyDate();
  const custom = params.range === "custom" && isDate(params.start) && isDate(params.end) && params.start <= params.end;
  const preset = PRESETS.find((p) => String(p) === params.range) ?? 30;
  let start = custom ? params.start! : addDays(today, -(preset - 1));
  const end = custom ? params.end! : today;
  if (custom && start < addDays(end, -(MAX_RANGE_DAYS - 1))) start = addDays(end, -(MAX_RANGE_DAYS - 1));
  const range: Range = { start, end, today };
  const rangeLabel = custom ? `${shortDate(start)} – ${shortDate(end)}` : `last ${preset} days`;

  const rangeQuery: Record<string, string> = custom ? { range: "custom", start, end } : { range: String(preset) };
  const href = (overrides: Record<string, string>) =>
    `/overview?${new URLSearchParams({ tab: tab.key, ...rangeQuery, ...overrides }).toString()}`;

  const supabase = await createSupabaseServerClient();

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <h1 className="text-lg font-semibold">Dashboard</h1>

      <nav className="flex flex-wrap gap-1 border-b border-border text-sm" aria-label="Dashboard sections">
        {visibleTabs.map((t) => (
          <Link
            key={t.key}
            href={`/overview?${new URLSearchParams({ tab: t.key, ...rangeQuery }).toString()}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={
              t.key === tab.key
                ? "px-3 py-2 -mb-px border-b-2 border-foreground font-semibold"
                : "px-3 py-2 -mb-px border-b-2 border-transparent text-text-secondary hover:text-foreground"
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab.ranged ? (
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <div className="flex gap-1 border border-border rounded p-1">
            {PRESETS.map((p) => (
              <Link
                key={p}
                href={`/overview?${new URLSearchParams({ tab: tab.key, range: String(p) }).toString()}`}
                className={!custom && preset === p ? "bg-hover px-3 py-1 rounded" : "px-3 py-1"}
              >
                Last {p} days
              </Link>
            ))}
          </div>
          <form method="GET" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="tab" value={tab.key} />
            <input type="hidden" name="range" value="custom" />
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              From
              <input type="date" name="start" defaultValue={start} className="border border-border rounded px-2 py-1 bg-panel text-sm text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              To
              <input type="date" name="end" defaultValue={end} className="border border-border rounded px-2 py-1 bg-panel text-sm text-foreground" />
            </label>
            <button type="submit" className="border border-border rounded px-3 py-1.5">
              Apply
            </button>
          </form>
          <span className="text-xs text-text-muted">Showing {rangeLabel}</span>
        </div>
      ) : (
        <p className="text-xs text-text-muted">
          {tab.key === "roster" ? "Next 7 days from today — not affected by the date range." : "Current records — not affected by the date range."}
        </p>
      )}

      {tab.key === "overview" && <OverviewTab supabase={supabase} range={range} isAdmin={isAdmin} rangeLabel={rangeLabel} href={href} />}
      {tab.key === "money" && <MoneyTab supabase={supabase} range={range} rangeLabel={rangeLabel} />}
      {tab.key === "productivity" && <ProductivityTab supabase={supabase} range={range} rangeLabel={rangeLabel} />}
      {tab.key === "attendance" && <AttendanceTab supabase={supabase} range={range} rangeLabel={rangeLabel} />}
      {tab.key === "safety" && <SafetyTab supabase={supabase} range={range} rangeLabel={rangeLabel} />}
      {tab.key === "compliance" && <ComplianceTab supabase={supabase} range={range} />}
      {tab.key === "roster" && <RosterTab supabase={supabase} range={range} />}
    </div>
  );
}

type Sb = Awaited<ReturnType<typeof createSupabaseServerClient>>;
const tiles = "grid grid-cols-2 lg:grid-cols-4 gap-3";
const charts = "grid grid-cols-1 xl:grid-cols-2 gap-4";

async function OverviewTab({
  supabase,
  range,
  isAdmin,
  rangeLabel,
  href,
}: {
  supabase: Sb;
  range: Range;
  isAdmin: boolean;
  rangeLabel: string;
  href: (o: Record<string, string>) => string;
}) {
  const [money, prod, att, safety, compliance] = await Promise.all([
    isAdmin ? loadMoney(supabase, range) : null,
    loadProductivity(supabase, range),
    loadAttendance(supabase, range),
    loadSafety(supabase, range),
    isAdmin ? loadCompliance(supabase, range) : null,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className={tiles}>
        {money && (
          <StatTile
            label={`Revenue, ${rangeLabel}`}
            value={money.revenue}
            format="currency"
            context={`Margin ${formatValue(money.margin, "currency")}${money.marginPct !== null ? ` · ${Math.round(money.marginPct)}%` : ""}`}
          />
        )}
        <StatTile label="Containers finalised" value={prod.containersDone} context={rangeLabel} />
        <StatTile label="Hours worked" value={prod.totalHours} format="hours" context={rangeLabel} />
        <StatTile
          label="Fill rate"
          value={att.fillRate === null ? "—" : formatValue(att.fillRate, "percent")}
          context={`${att.noShowCount} no-show${att.noShowCount === 1 ? "" : "s"}, ${rangeLabel}`}
        />
        <StatTile
          label="Open safety reports"
          value={safety.openHazards + safety.openIncidents}
          context={`${safety.openHazards} hazard, ${safety.openIncidents} incident`}
        />
        {compliance && (
          <StatTile
            label="Licences & visas"
            value={compliance.expiringCount}
            context={`expired or expiring within 60 days`}
            status={
              compliance.expiredCount > 0
                ? { level: "critical", text: `${compliance.expiredCount} already expired` }
                : compliance.expiringCount > 0
                  ? { level: "warning", text: "Renewals due soon" }
                  : { level: "good", text: "All current" }
            }
          />
        )}
      </div>

      <div className={charts}>
        {money && (
          <ChartCard title="Revenue vs labour cost" subtitle={`By week, ${rangeLabel}`} table={money.weekly.table}>
            {hasData([...money.weekly.revenue, ...money.weekly.cost]) ? (
              <ColumnChart
                categories={money.weekly.categories}
                format="currency"
                series={[
                  { label: "Revenue", color: "var(--series-1)", values: money.weekly.revenue },
                  { label: "Labour cost", color: "var(--series-2)", values: money.weekly.cost },
                ]}
              />
            ) : (
              <Empty />
            )}
          </ChartCard>
        )}
        <ChartCard title="Containers finalised per day" subtitle={rangeLabel} table={prod.containersPerDay.table}>
          {hasData(prod.containersPerDay.values) ? (
            <ColumnChart
              categories={prod.containersPerDay.categories}
              format="number"
              series={[{ label: "Containers", color: "var(--series-1)", values: prod.containersPerDay.values }]}
            />
          ) : (
            <Empty />
          )}
        </ChartCard>
        <ChartCard title="Fill rate per day" subtitle="Hourly shifts: rostered staff who signed on, completed days only" table={att.fillPerDay.table}>
          {att.fillPerDay.values.length ? (
            <ColumnChart
              categories={att.fillPerDay.categories}
              format="percent"
              series={[{ label: "Fill rate", color: "var(--series-1)", values: att.fillPerDay.values }]}
            />
          ) : (
            <Empty />
          )}
        </ChartCard>
        <ChartCard
          title="Safety reports by site"
          subtitle={`Hazards and incidents, ${rangeLabel}`}
          table={rangedTable(safety.bySite, "Site", "Reports", "number")}
        >
          <HBarChart items={safety.bySite} format="number" />
        </ChartCard>
      </div>

      <p className="text-xs text-text-muted">
        More detail in the{" "}
        {[
          ...(isAdmin ? [["money", "Money"]] : []),
          ["productivity", "Productivity"],
          ["attendance", "Attendance"],
          ["safety", "Safety"],
        ].map(([key, label], i, arr) => (
          <span key={key}>
            <Link href={href({ tab: key })} className="text-info-text">
              {label}
            </Link>
            {i < arr.length - 1 ? ", " : ""}
          </span>
        ))}{" "}
        tabs.
      </p>
    </div>
  );
}

async function MoneyTab({ supabase, range, rangeLabel }: { supabase: Sb; range: Range; rangeLabel: string }) {
  const m = await loadMoney(supabase, range);
  return (
    <div className="flex flex-col gap-6">
      <div className={tiles}>
        <StatTile label="Revenue" value={m.revenue} format="currency" context={rangeLabel} />
        <StatTile label="Labour cost" value={m.cost} format="currency" context={rangeLabel} />
        <StatTile
          label="Margin"
          value={m.margin}
          format="currency"
          status={m.margin < 0 ? { level: "critical", text: "Loss for this period" } : undefined}
        />
        <StatTile label="Margin %" value={m.marginPct === null ? "—" : formatValue(m.marginPct, "percent")} />
      </div>

      <div className={charts}>
        <ChartCard title="Revenue vs labour cost" subtitle={`By week, ${rangeLabel}`} table={m.weekly.table}>
          {hasData([...m.weekly.revenue, ...m.weekly.cost]) ? (
            <ColumnChart
              categories={m.weekly.categories}
              format="currency"
              series={[
                { label: "Revenue", color: "var(--series-1)", values: m.weekly.revenue },
                { label: "Labour cost", color: "var(--series-2)", values: m.weekly.cost },
              ]}
            />
          ) : (
            <Empty />
          )}
        </ChartCard>
        <ChartCard
          title="Margin by customer"
          subtitle={`Revenue minus labour cost, ${rangeLabel}`}
          table={rangedTable(m.marginByCustomer, "Customer", "Margin", "currency")}
        >
          <HBarChart items={m.marginByCustomer} format="currency" />
        </ChartCard>
        <ChartCard
          title="Revenue by work type"
          subtitle={rangeLabel}
          table={rangedTable(m.revenueByType, "Work type", "Revenue", "currency")}
        >
          <SegmentedBar
            format="currency"
            parts={m.revenueByType.map((t, i) => ({ ...t, color: `var(--series-${i + 1})` }))}
          />
        </ChartCard>
      </div>

      <p className="text-xs text-text-muted">
        Revenue and cost come from the rate cards: a blank rate counts as $0. Billing excludes the 5% manager pay
        bonus and charges container/rework jobs per job, not per crew member.
      </p>
    </div>
  );
}

async function ProductivityTab({ supabase, range, rangeLabel }: { supabase: Sb; range: Range; rangeLabel: string }) {
  const p = await loadProductivity(supabase, range);
  return (
    <div className="flex flex-col gap-6">
      <div className={tiles}>
        <StatTile label="Containers finalised" value={p.containersDone} context={rangeLabel} />
        <StatTile
          label="Avg time per container"
          value={p.avgMinutes === null ? "—" : formatValue(p.avgMinutes, "minutes")}
          context={`From ${p.timedCount} timed container${p.timedCount === 1 ? "" : "s"}, excluding pauses`}
        />
        <StatTile label="Rework jobs finalised" value={p.reworkDone} context={rangeLabel} />
        <StatTile label="Hours worked" value={p.totalHours} format="hours" context={rangeLabel} />
      </div>

      <div className={charts}>
        <ChartCard title="Containers finalised per day" subtitle={rangeLabel} table={p.containersPerDay.table}>
          {hasData(p.containersPerDay.values) ? (
            <ColumnChart
              categories={p.containersPerDay.categories}
              format="number"
              series={[{ label: "Containers", color: "var(--series-1)", values: p.containersPerDay.values }]}
            />
          ) : (
            <Empty />
          )}
        </ChartCard>
        <ChartCard title="Containers by customer" subtitle={rangeLabel} table={rangedTable(p.containersByCustomer, "Customer", "Containers", "number")}>
          <HBarChart items={p.containersByCustomer} format="number" />
        </ChartCard>
        <ChartCard title="Container size mix" subtitle={rangeLabel} table={rangedTable(p.containersBySize, "Size", "Containers", "number")}>
          <SegmentedBar format="number" parts={p.containersBySize.map((s, i) => ({ ...s, color: `var(--series-${i + 1})` }))} />
        </ChartCard>
        <ChartCard
          title="Average time per container, by customer"
          subtitle="Start to finalise, excluding pauses"
          table={rangedTable(p.avgByCustomer, "Customer", "Average", "minutes")}
        >
          <HBarChart items={p.avgByCustomer} format="minutes" />
        </ChartCard>
        <ChartCard title="Hours worked per day" subtitle={rangeLabel} table={p.hoursPerDay.table}>
          {hasData(p.hoursPerDay.values) ? (
            <ColumnChart
              categories={p.hoursPerDay.categories}
              format="hours"
              series={[{ label: "Hours", color: "var(--series-1)", values: p.hoursPerDay.values }]}
            />
          ) : (
            <Empty />
          )}
        </ChartCard>
        <ChartCard title="Hours worked by site" subtitle={rangeLabel} table={rangedTable(p.hoursBySite, "Site", "Hours", "hours")}>
          <HBarChart items={p.hoursBySite} format="hours" />
        </ChartCard>
      </div>
      <p className="text-xs text-text-muted">
        Container times depend on staff pressing start and finalise in the mobile app.
      </p>
    </div>
  );
}

async function AttendanceTab({ supabase, range, rangeLabel }: { supabase: Sb; range: Range; rangeLabel: string }) {
  const a = await loadAttendance(supabase, range);
  return (
    <div className="flex flex-col gap-6">
      <div className={tiles}>
        <StatTile
          label="Fill rate"
          value={a.fillRate === null ? "—" : formatValue(a.fillRate, "percent")}
          context={`${a.totalRostered} rostered hourly shifts, completed days`}
        />
        <StatTile label="No-shows" value={a.noShowCount} context={rangeLabel} />
        <StatTile label="Late sign-ons" value={a.lateCount} context="More than 5 minutes after shift start" />
        <StatTile label="Weeks over 38 hours" value={a.over38.rows.length} context="Person-weeks, by worked hours" />
      </div>

      <div className={charts}>
        <ChartCard title="Fill rate per day" subtitle="Hourly shifts: rostered staff who signed on, completed days only" table={a.fillPerDay.table}>
          {a.fillPerDay.values.length ? (
            <ColumnChart
              categories={a.fillPerDay.categories}
              format="percent"
              series={[{ label: "Fill rate", color: "var(--series-1)", values: a.fillPerDay.values }]}
            />
          ) : (
            <Empty />
          )}
        </ChartCard>
        <ChartCard title="Hours per person" subtitle={`Top 15, ${rangeLabel}`} table={rangedTable(a.hoursPerPerson, "Staff", "Hours", "hours")}>
          <HBarChart items={a.hoursPerPerson} format="hours" />
        </ChartCard>
      </div>

      <div className={charts}>
        <ChartCard title="No-shows" subtitle="Most recent 50">
          <DataTable table={a.noShows} empty="No no-shows in this range." />
        </ChartCard>
        <ChartCard title="Late sign-ons" subtitle="Most recent 50">
          <DataTable table={a.late} empty="No late sign-ons in this range." />
        </ChartCard>
        <ChartCard title="Over 38 hours in a week">
          <DataTable table={a.over38} empty="Nobody worked more than 38 hours in a week." />
        </ChartCard>
      </div>
    </div>
  );
}

async function SafetyTab({ supabase, range, rangeLabel }: { supabase: Sb; range: Range; rangeLabel: string }) {
  const s = await loadSafety(supabase, range);
  return (
    <div className="flex flex-col gap-6">
      <HeroFigure
        label="Days since last incident"
        value={s.daysSinceIncident === null ? "No incidents recorded" : String(s.daysSinceIncident)}
        context={s.lastIncidentDate ? `Last incident reported ${shortDate(s.lastIncidentDate)}` : undefined}
      />

      <div className={tiles}>
        <StatTile label="Open hazards" value={s.openHazards} context="Open or in review, all time" />
        <StatTile label="Open incidents" value={s.openIncidents} context="Open or in review, all time" />
        <StatTile label="Hazards reported" value={s.hazardsInRange} context={rangeLabel} />
        <StatTile label="Incidents reported" value={s.incidentsInRange} context={rangeLabel} />
      </div>

      <div className={charts}>
        <ChartCard title="Reports per week" subtitle={rangeLabel} table={s.perWeek.table}>
          {hasData([...s.perWeek.hazards, ...s.perWeek.incidents]) ? (
            <ColumnChart
              categories={s.perWeek.categories}
              format="number"
              series={[
                { label: "Hazards", color: "var(--series-1)", values: s.perWeek.hazards },
                { label: "Incidents", color: "var(--series-2)", values: s.perWeek.incidents },
              ]}
            />
          ) : (
            <Empty />
          )}
        </ChartCard>
        <ChartCard title="Reports by site" subtitle={rangeLabel} table={rangedTable(s.bySite, "Site", "Reports", "number")}>
          <HBarChart items={s.bySite} format="number" />
        </ChartCard>
        <ChartCard title="Reports by category" subtitle={rangeLabel} table={rangedTable(s.byCategory, "Category", "Reports", "number")}>
          <HBarChart items={s.byCategory} format="number" />
        </ChartCard>
        <ChartCard
          title="Reports by severity"
          subtitle="Hazard risk rating and incident potential severity"
          table={rangedTable(s.bySeverity, "Severity", "Reports", "number")}
        >
          {hasData(s.bySeverity.map((x) => x.value)) ? <HBarChart items={s.bySeverity} format="number" /> : <Empty />}
        </ChartCard>
      </div>
    </div>
  );
}

async function ComplianceTab({ supabase, range }: { supabase: Sb; range: Range }) {
  const c = await loadCompliance(supabase, range);
  return (
    <div className="flex flex-col gap-6">
      <div className={tiles}>
        <StatTile label="Active staff" value={c.activeStaff} />
        <StatTile
          label="Expired documents"
          value={c.expiredCount}
          status={c.expiredCount > 0 ? { level: "critical", text: "Needs renewal now" } : { level: "good", text: "None expired" }}
        />
        <StatTile label="Expiring within 60 days" value={c.expiringCount - c.expiredCount} context="Licences and visas" />
        <StatTile
          label="Incomplete records"
          value={c.incompleteCount}
          context="Missing address, bank or tax details"
        />
      </div>

      <ChartCard title="Employees vs contractors" subtitle="Active staff by tax type">
        <SegmentedBar
          format="number"
          parts={[
            { label: "Employees (TFN)", value: c.split.tfn, color: "var(--series-1)" },
            { label: "Contractors (ABN)", value: c.split.abn, color: "var(--series-2)" },
            { label: "Not set", value: c.split.unset, color: "var(--series-3)" },
          ]}
        />
      </ChartCard>

      <div className={charts}>
        <ChartCard title="Licences & visas expired or expiring" subtitle="Within the next 60 days">
          <DataTable table={c.expiring} empty="Nothing expiring in the next 60 days." />
        </ChartCard>
        <ChartCard title="Incomplete staff records">
          <DataTable table={c.incomplete} empty="Every active staff record is complete." />
        </ChartCard>
      </div>
    </div>
  );
}

async function RosterTab({ supabase, range }: { supabase: Sb; range: Range }) {
  const r = await loadRoster(supabase, range);
  return (
    <div className="flex flex-col gap-6">
      <div className={tiles}>
        <StatTile label="Shifts, next 7 days" value={r.confirmed + r.draft} context={`${shortDate(range.today)} – ${shortDate(r.windowEnd)}`} />
        <StatTile
          label="Missing a Manager"
          value={r.missingManager.rows.length}
          status={r.missingManager.rows.length > 0 ? { level: "warning", text: "Can't be confirmed yet" } : undefined}
        />
        <StatTile label="Pending leave requests" value={r.pendingLeave} />
        <StatTile label="On leave, next 7 days" value={r.onLeaveCount} />
      </div>

      <ChartCard title="Confirmed vs draft shifts" subtitle="Next 7 days">
        <SegmentedBar
          format="number"
          parts={[
            { label: "Confirmed", value: r.confirmed, color: "var(--series-1)" },
            { label: "Draft", value: r.draft, color: "var(--series-2)" },
          ]}
        />
      </ChartCard>

      <div className={charts}>
        <ChartCard title="Container & rework shifts with no Manager">
          <DataTable table={r.missingManager} empty="Every container and rework shift has a Manager." />
        </ChartCard>
        <ChartCard title="On approved leave">
          <DataTable table={r.onLeave} empty="Nobody is on leave in the next 7 days." />
        </ChartCard>
      </div>
    </div>
  );
}
