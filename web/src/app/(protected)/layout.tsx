import Link from "next/link";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/lib/theme/BrandLogo";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";
import { CollapsibleSidebar } from "@/lib/settings/CollapsibleSidebar";
import { NOTIFICATIONS_COOKIE_NAME, parseNotificationsPref } from "@/lib/settings/shared";
import { NAV } from "@/lib/nav";
import { logout } from "./actions";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await verifySession();
  const cookieStore = await cookies();
  const notificationsOn = parseNotificationsPref(cookieStore.get(NOTIFICATIONS_COOKIE_NAME)?.value);

  let hazardOpenCount = 0;
  let incidentOpenCount = 0;
  if (notificationsOn) {
    const supabase = await createSupabaseServerClient();
    const [{ count: hazardCount }, { count: incidentCount }] = await Promise.all([
      supabase.from("hazard_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("incident_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);
    hazardOpenCount = hazardCount ?? 0;
    incidentOpenCount = incidentCount ?? 0;
  }

  return (
    <div className="flex flex-1 min-h-full">
      <CollapsibleSidebar>
        <div className="flex items-center gap-2">
          <BrandLogo size={28} />
          <span className="text-sm font-semibold">Octopus Labour</span>
        </div>
        <div className="text-sm text-text-secondary">{profile.full_name}</div>
        <nav className="flex flex-col gap-2">
          {NAV.map((item) =>
            item.href === "/safety" ? (
              <div key={item.href} className="flex items-center gap-1.5">
                <Link href={item.href} className="text-sm">
                  {item.label}
                </Link>
                {hazardOpenCount > 0 && (
                  <Link
                    href="/safety?type=hazard&status=open"
                    title={`${hazardOpenCount} open hazard report${hazardOpenCount === 1 ? "" : "s"}`}
                    className="bg-danger-text text-bg text-xs rounded-full px-1.5 leading-5"
                  >
                    H {hazardOpenCount}
                  </Link>
                )}
                {incidentOpenCount > 0 && (
                  <Link
                    href="/safety?type=incident&status=open"
                    title={`${incidentOpenCount} open incident report${incidentOpenCount === 1 ? "" : "s"}`}
                    className="bg-danger-text text-bg text-xs rounded-full px-1.5 leading-5"
                  >
                    I {incidentOpenCount}
                  </Link>
                )}
              </div>
            ) : (
              <Link key={item.href} href={item.href} className="text-sm">
                {item.label}
              </Link>
            )
          )}
          {profile.role === "superadmin" && (
            <Link href="/admins" className="text-sm">
              Admins
            </Link>
          )}
          <Link href="/settings" className="text-sm">
            Settings
          </Link>
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <ThemeToggle />
          <form action={logout}>
            <button type="submit" className="text-sm text-text-secondary">
              Log out
            </button>
          </form>
        </div>
      </CollapsibleSidebar>
      <div className="flex-1 p-8">{children}</div>
    </div>
  );
}
