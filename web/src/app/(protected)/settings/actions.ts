"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NOTIFICATIONS_COOKIE_NAME } from "@/lib/settings/shared";

export async function setNotificationsPref(formData: FormData) {
  const pref = String(formData.get("pref") || "on");
  const cookieStore = await cookies();
  cookieStore.set(NOTIFICATIONS_COOKIE_NAME, pref, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
  });
  // notifications badge lives in the (protected) layout, which wraps every page
  revalidatePath("/", "layout");
}

export async function setDefaultTab(formData: FormData) {
  const { profile } = await verifySession();
  const supabase = await createSupabaseServerClient();
  const tab = String(formData.get("default_tab") || "") || null;

  const { error } = await supabase.from("profiles").update({ default_tab: tab }).eq("id", profile.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function changePassword(formData: FormData) {
  const { user } = await verifySession();
  const currentPassword = String(formData.get("current_password") || "");
  const newPassword = String(formData.get("new_password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");

  if (!currentPassword || !newPassword) {
    throw new Error("Current and new password are required.");
  }
  if (newPassword !== confirmPassword) {
    throw new Error("New passwords do not match.");
  }
  if (!user.email) {
    throw new Error("Account has no email on file.");
  }

  const supabase = await createSupabaseServerClient();

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) throw new Error("Current password is incorrect.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}
