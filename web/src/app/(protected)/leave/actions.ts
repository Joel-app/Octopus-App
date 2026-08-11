"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function setLeaveStatus(id: string, status: "approved" | "declined") {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("leave_requests").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/leave");
}

export async function submitLeaveRequest(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("leave_requests").insert({
    staff_id: String(formData.get("staff_id")),
    type: String(formData.get("type")),
    start_date: String(formData.get("start_date")),
    end_date: String(formData.get("end_date")),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/leave");
}
