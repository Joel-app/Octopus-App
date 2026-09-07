import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";

export async function verifySession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile || !profile.active || profile.role === "staff") {
    // web dashboard is admin/operations only — staff use the mobile app
    redirect("/login");
  }

  return { user, profile };
}

// For Route Handlers (file exports, etc.) where a redirect isn't the right
// response — returns null instead of throwing/redirecting, so the caller
// can respond with a plain 401/403. Admin/superadmin only, not operations,
// since this backs financial exports (pay/billing).
export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile || !profile.active || profile.role === "staff" || profile.role === "operations") {
    return null;
  }

  return { user, profile };
}
