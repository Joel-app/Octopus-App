import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoteAdmin, promoteStaffToAdmin } from "./actions";

interface AdminRow {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
}

interface StaffOption {
  id: string;
  full_name: string;
}

export default async function AdminsPage() {
  const { profile: viewer } = await verifySession();
  if (viewer.role !== "superadmin") {
    redirect("/dashboard");
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: admins }, { data: staff }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["superadmin", "admin", "operations"])
      .order("role")
      .order("full_name")
      .returns<AdminRow[]>(),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "staff")
      .eq("active", true)
      .order("full_name")
      .returns<StaffOption[]>(),
  ]);

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <h1 className="text-lg font-semibold">Admins</h1>

      <form
        action={promoteStaffToAdmin}
        className="flex flex-wrap gap-2 items-end border border-border rounded p-4 text-sm"
      >
        <h2 className="w-full text-sm font-semibold mb-1">Promote staff to admin</h2>
        <label className="flex flex-col gap-1">
          Staff
          <select name="staff_id" required className="border border-border rounded px-2 py-1 bg-panel">
            {(staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Email (for their login invite)
          <input
            type="email"
            name="email"
            placeholder="name@example.com"
            className="border border-border rounded px-2 py-1 bg-panel"
          />
        </label>
        <label className="flex flex-col gap-1">
          Role
          <select name="role" required className="border border-border rounded px-2 py-1 bg-panel">
            <option value="admin">Admin</option>
            <option value="operations">Operations</option>
          </select>
        </label>
        <button type="submit" className="bg-foreground text-bg rounded px-3 py-1.5">
          Send invite
        </button>
        <p className="w-full text-xs text-text-muted">
          Sends a real invite email via Supabase Auth so they can set their own password.
        </p>
      </form>

      <table className="text-sm w-full">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="font-normal pr-4">Name</th>
            <th className="font-normal pr-4">Email</th>
            <th className="font-normal pr-4">Role</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(admins ?? []).map((a) => (
            <tr key={a.id} className="border-t border-border">
              <td className="py-2 pr-4">{a.full_name}</td>
              <td className="py-2 pr-4">{a.email ?? "—"}</td>
              <td className="py-2 pr-4 capitalize">{a.role}</td>
              <td className="py-2">
                <form action={demoteAdmin.bind(null, a.id)}>
                  <button type="submit" className="text-xs text-danger-text">
                    Remove admin access
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {(admins ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="py-2 text-text-secondary">
                No admins yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
