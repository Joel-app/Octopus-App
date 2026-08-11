"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function requireSuperadmin() {
  const { profile } = await verifySession();
  if (profile.role !== "superadmin") throw new Error("Superadmin role required");
  return profile;
}

export async function promoteStaffToAdmin(formData: FormData) {
  await requireSuperadmin();
  const supabase = await createSupabaseServerClient();

  const staffId = String(formData.get("staff_id") || "");
  const role = String(formData.get("role") || "");
  let email = String(formData.get("email") || "").trim();

  if (!staffId || !role) throw new Error("Staff member and role are required");

  if (!email) {
    const { data: existing } = await supabase.from("profiles").select("email").eq("id", staffId).single();
    email = existing?.email ?? "";
  }
  if (!email) throw new Error("An email address is required to invite this staff member");

  const adminClient = createSupabaseAdminClient();
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);
  if (inviteError) throw new Error(inviteError.message);

  const { error: updateEmailError } = await supabase.from("profiles").update({ email }).eq("id", staffId);
  if (updateEmailError) throw new Error(updateEmailError.message);

  const { error: promoteError } = await supabase.rpc("promote_to_admin", {
    p_staff_id: staffId,
    p_auth_user_id: invited.user.id,
    p_role: role,
  });
  if (promoteError) throw new Error(promoteError.message);

  revalidatePath("/admins");
  revalidatePath("/staff");
}

export async function demoteAdmin(profileId: string) {
  await requireSuperadmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("demote_admin", { p_profile_id: profileId });
  if (error) throw new Error(error.message);
  revalidatePath("/admins");
  revalidatePath("/staff");
}
