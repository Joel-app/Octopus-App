"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateHazardReport(id: string, formData: FormData) {
  const { profile } = await verifySession();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("hazard_reports")
    .update({
      status: String(formData.get("status")),
      review_notes: String(formData.get("review_notes") || "") || null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/safety");
}

export async function updateIncidentReport(id: string, formData: FormData) {
  const { profile } = await verifySession();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("incident_reports")
    .update({
      status: String(formData.get("status")),
      review_notes: String(formData.get("review_notes") || "") || null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/safety");
}

export async function submitHazardReport(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("hazard_reports").insert({
    staff_id: String(formData.get("staff_id")),
    customer_id: String(formData.get("customer_id") || "") || null,
    category: String(formData.get("category") || ""),
    description: String(formData.get("description") || ""),
    severity: String(formData.get("severity") || ""),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/safety");
}

export async function submitIncidentReport(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const { data: reportNo, error: reportNoError } = await supabase.rpc("generate_incident_report_no");
  if (reportNoError) throw new Error(reportNoError.message);

  const details = {
    injuredPersonName: String(formData.get("injured_person_name") || ""),
    injuredPersonContact: String(formData.get("injured_person_contact") || ""),
    injuredPersonPosition: String(formData.get("injured_person_position") || ""),
    incidentType: String(formData.get("incident_type") || ""),
    dateTime: new Date().toISOString(),
    taskActivity: String(formData.get("task_activity") || ""),
    firstAidGiven: String(formData.get("first_aid_given") || ""),
    firstAiderName: String(formData.get("first_aider_name") || ""),
    treatment: String(formData.get("treatment") || ""),
    stoppedWork: String(formData.get("stopped_work") || ""),
    potentialSeverity: String(formData.get("potential_severity") || ""),
    investigationNotes: String(formData.get("investigation_notes") || ""),
    signatoryName: String(formData.get("signatory_name") || ""),
  };

  const { error } = await supabase.from("incident_reports").insert({
    report_no: reportNo,
    staff_id: String(formData.get("staff_id")),
    customer_id: String(formData.get("customer_id") || "") || null,
    description: String(formData.get("description") || ""),
    details,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/safety");
}
