"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function addShift(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("shifts").insert({
    customer_id: String(formData.get("customer_id")),
    date: String(formData.get("date")),
    start_time: String(formData.get("start_time") || "07:00"),
    shift_type: String(formData.get("shift_type")),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/roster");
}

export async function removeShift(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/roster");
}

export async function setShiftStatus(id: string, status: "draft" | "confirmed") {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("shifts").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/roster");
}

// Drag a chip from the staff pool onto a role zone — creates a new
// assignment row.
export async function assignStaffToRole(shiftId: string, staffId: string, role: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("shift_assignments")
    .insert({ shift_id: shiftId, staff_id: staffId, role });
  if (error) throw new Error(error.message);
  revalidatePath("/roster");
}

// Drag a chip from one role zone to another (same or different shift) —
// moves the existing assignment row rather than delete+recreate, so its id
// (and anything referencing it later) is stable.
export async function moveAssignment(assignmentId: string, shiftId: string, role: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("shift_assignments")
    .update({ shift_id: shiftId, role })
    .eq("id", assignmentId);
  if (error) throw new Error(error.message);
  revalidatePath("/roster");
}

// Drag a chip back onto the pool, or click the ✕ on a chip — unassigns
// entirely.
export async function unassignStaff(assignmentId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("shift_assignments").delete().eq("id", assignmentId);
  if (error) throw new Error(error.message);
  revalidatePath("/roster");
}
