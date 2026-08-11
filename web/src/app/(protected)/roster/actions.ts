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

// Pre-adds a container to a container shift at roster time, so the crew
// already sees it queued up when they open the mobile app instead of
// having to create it themselves on the spot. Type/size come from the
// customer's own container rate cards (picked as one paired option) rather
// than free text, for the same reason mobile's job entry does — a typo'd
// type silently computes $0 pay since it won't match any rate card.
export async function addContainerJob(shiftId: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const rateCardId = String(formData.get("rate_card_id") || "");
  if (!rateCardId) throw new Error("Select a container type");

  // type/size come from the rate card row itself, not client-supplied text —
  // the same reasoning as mobile's rate-option dropdown: a mismatched
  // type/size pair would silently compute $0 pay.
  const { data: rateCard, error: rateCardError } = await supabase
    .from("rate_cards")
    .select("position_or_type, size")
    .eq("id", rateCardId)
    .single();
  if (rateCardError || !rateCard) throw new Error("Container rate card not found");

  const { error } = await supabase.from("jobs").insert({
    shift_id: shiftId,
    job_type: "container",
    type: rateCard.position_or_type,
    size: rateCard.size,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/roster");
}

// Only removes containers still in "pending" status — once a job has
// started, staff on mobile are relying on it, so it shouldn't be pulled out
// from under them via the roster page.
export async function removeContainerJob(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("jobs").delete().eq("id", id).eq("status", "pending");
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
