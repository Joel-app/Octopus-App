"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function addStaff(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("admin_create_staff", {
    p_full_name: String(formData.get("full_name") || ""),
    p_position: String(formData.get("position") || "") || null,
    p_pin: String(formData.get("pin") || ""),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/staff");
}

export async function setStaffActive(id: string, active: boolean) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/staff");
}

async function encryptIfPresent(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, value: string) {
  if (!value) return null;
  const { data, error } = await supabase.rpc("encrypt_sensitive", { plain: value });
  if (error) throw new Error(error.message);
  return data;
}

// Uploads a document to the staff-documents bucket under a fixed filename
// per document type (so re-uploading just overwrites the old one) and
// returns the storage path to save. Returns undefined — not null — when no
// file was chosen this submission, so callers can tell "leave unchanged"
// apart from "clear it": an empty <input type="file"> still submits a
// zero-byte File, which would otherwise look like a real upload.
async function uploadDocumentIfProvided(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileId: string,
  formData: FormData,
  fieldName: string,
  storageFileName: string
): Promise<string | undefined> {
  const file = formData.get(fieldName);
  if (!(file instanceof File) || file.size === 0) return undefined;

  const ext = file.name.split(".").pop() || "bin";
  const path = `${profileId}/${storageFileName}.${ext}`;
  const { error } = await supabase.storage.from("staff-documents").upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

export async function saveStaffCompliance(profileId: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const str = (key: string) => String(formData.get(key) || "") || null;

  const [
    bsbEncrypted,
    accountNumberEncrypted,
    tfnEncrypted,
    superMemberNumberEncrypted,
    idPhotoPath,
    forkliftLicencePhotoPath,
    loLicencePhotoPath,
    taxFileDeclarationPath,
  ] = await Promise.all([
    encryptIfPresent(supabase, String(formData.get("bank_bsb") || "")),
    encryptIfPresent(supabase, String(formData.get("bank_account_number") || "")),
    encryptIfPresent(supabase, String(formData.get("tfn") || "")),
    encryptIfPresent(supabase, String(formData.get("super_member_number") || "")),
    uploadDocumentIfProvided(supabase, profileId, formData, "id_photo", "id-photo"),
    uploadDocumentIfProvided(supabase, profileId, formData, "forklift_licence_photo", "forklift-licence"),
    uploadDocumentIfProvided(supabase, profileId, formData, "lo_licence_photo", "lo-licence"),
    uploadDocumentIfProvided(supabase, profileId, formData, "tax_file_declaration", "tax-file-declaration"),
  ]);

  const payload: Record<string, unknown> = {
    profile_id: profileId,
    address: {
      street: str("address_street"),
      suburb: str("address_suburb"),
      state: str("address_state"),
      postcode: str("address_postcode"),
    },
    bank_name: str("bank_name"),
    bank_account_name: str("bank_account_name"),
    bank_bsb_encrypted: bsbEncrypted,
    bank_account_number_encrypted: accountNumberEncrypted,
    tax_type: str("tax_type"),
    tfn_encrypted: tfnEncrypted,
    abn: str("abn"),
    abn_lookup_link: str("abn_lookup_link"),
    gst_registered: str("gst_registered"),
    super_fund_name: str("super_fund_name"),
    super_fund_abn: str("super_fund_abn"),
    super_usi: str("super_usi"),
    super_account_name: str("super_account_name"),
    super_member_number_encrypted: superMemberNumberEncrypted,
    super_fund_address: {
      street: str("super_address_street"),
      suburb: str("super_address_suburb"),
      state: str("super_address_state"),
      postcode: str("super_address_postcode"),
    },
    visa_status: str("visa_status"),
    visa_subclass: str("visa_subclass"),
    visa_number: str("visa_number"),
    visa_expiry: str("visa_expiry"),
    visa_notes: str("visa_notes"),
    forklift_licence_expiry: str("forklift_licence_expiry"),
    lo_licence_expiry: str("lo_licence_expiry"),
    updated_at: new Date().toISOString(),
  };

  if (idPhotoPath !== undefined) payload.id_photo_path = idPhotoPath;
  if (forkliftLicencePhotoPath !== undefined) payload.forklift_licence_photo_path = forkliftLicencePhotoPath;
  if (loLicencePhotoPath !== undefined) payload.lo_licence_photo_path = loLicencePhotoPath;
  if (taxFileDeclarationPath !== undefined) payload.tax_file_declaration_path = taxFileDeclarationPath;

  const { error } = await supabase.from("staff_sensitive").upsert(payload);

  if (error) throw new Error(error.message);
  revalidatePath(`/staff/${profileId}`);
  revalidatePath("/staff");
}
