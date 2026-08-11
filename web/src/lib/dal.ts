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
