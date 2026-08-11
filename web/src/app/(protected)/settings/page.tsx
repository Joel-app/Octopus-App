import { cookies } from "next/headers";
import { verifySession } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NAV } from "@/lib/nav";
import { DENSITY_COOKIE_NAME, NOTIFICATIONS_COOKIE_NAME, parseDensity, parseNotificationsPref } from "@/lib/settings/shared";
import { DensityToggle } from "@/lib/settings/DensityToggle";
import { changePassword, setDefaultTab, setNotificationsPref } from "./actions";

export default async function SettingsPage() {
  const { profile } = await verifySession();
  const supabase = await createSupabaseServerClient();
  const cookieStore = await cookies();

  const density = parseDensity(cookieStore.get(DENSITY_COOKIE_NAME)?.value);
  const notificationsOn = parseNotificationsPref(cookieStore.get(NOTIFICATIONS_COOKIE_NAME)?.value);

  const { data: fullProfile } = await supabase
    .from("profiles")
    .select("default_tab")
    .eq("id", profile.id)
    .single<{ default_tab: string | null }>();

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <h1 className="text-lg font-semibold">Settings</h1>

      <section className="flex flex-col gap-3 border border-border rounded p-4">
        <h2 className="text-sm font-semibold">Change password</h2>
        <form action={changePassword} className="flex flex-col gap-2 text-sm">
          <label className="flex flex-col gap-1">
            Current password
            <input
              type="password"
              name="current_password"
              required
              className="border border-border rounded px-2 py-1 bg-panel"
            />
          </label>
          <label className="flex flex-col gap-1">
            New password
            <input
              type="password"
              name="new_password"
              required
              minLength={8}
              className="border border-border rounded px-2 py-1 bg-panel"
            />
          </label>
          <label className="flex flex-col gap-1">
            Confirm new password
            <input
              type="password"
              name="confirm_password"
              required
              minLength={8}
              className="border border-border rounded px-2 py-1 bg-panel"
            />
          </label>
          <button type="submit" className="bg-foreground text-bg rounded px-3 py-1.5 mt-2 self-start">
            Update password
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 border border-border rounded p-4">
        <h2 className="text-sm font-semibold">Display density</h2>
        <DensityToggle initialDensity={density} />
      </section>

      <section className="flex flex-col gap-3 border border-border rounded p-4">
        <h2 className="text-sm font-semibold">Report alerts</h2>
        <p className="text-xs text-text-muted">
          Shows a badge next to Safety with the number of open hazard/incident reports.
        </p>
        <form action={setNotificationsPref}>
          <input type="hidden" name="pref" value={notificationsOn ? "off" : "on"} />
          <button type="submit" className="border border-border rounded px-3 py-1.5 text-sm">
            {notificationsOn ? "Turn off report alerts" : "Turn on report alerts"}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 border border-border rounded p-4">
        <h2 className="text-sm font-semibold">Default landing page</h2>
        <form action={setDefaultTab} className="flex items-end gap-2 text-sm">
          <select
            name="default_tab"
            defaultValue={fullProfile?.default_tab ?? ""}
            className="border border-border rounded px-2 py-1 bg-panel"
          >
            <option value="">Daily View (default)</option>
            {NAV.map((item) => (
              <option key={item.href} value={item.href}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="submit" className="border border-border rounded px-3 py-1.5">
            Save
          </button>
        </form>
      </section>
    </div>
  );
}
