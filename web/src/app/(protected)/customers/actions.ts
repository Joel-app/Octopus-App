"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_HOURLY_POSITIONS } from "@/lib/constants";

export async function addCustomer(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      name: String(formData.get("name") || ""),
      address: {
        street: String(formData.get("street") || ""),
        suburb: String(formData.get("suburb") || ""),
        state: String(formData.get("state") || ""),
        postcode: String(formData.get("postcode") || ""),
      },
      operating_hours: String(formData.get("operating_hours") || "") || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Every hourly pay lookup resolves to exactly one of these four keys, so
  // every customer needs all four from the start (rates start blank —
  // editable below — but the rows exist so none get missed).
  const { error: rateError } = await supabase.from("rate_cards").insert(
    DEFAULT_HOURLY_POSITIONS.map((position) => ({
      customer_id: customer.id,
      work_type: "hourly",
      position_or_type: position,
      size: null,
      charge_rate: null,
      pay_rate: null,
    }))
  );

  if (rateError) throw new Error(rateError.message);
  revalidatePath("/customers");
}

export async function updateCustomer(
  id: string,
  name: string,
  address: { street: string; suburb: string; state: string; postcode: string },
  operatingHours: string | null
) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("customers")
    .update({ name, address, operating_hours: operatingHours })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/customers");
}

export async function addRateCard(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const workType = String(formData.get("work_type"));
  const size = String(formData.get("size") || "");

  const { error } = await supabase.from("rate_cards").insert({
    customer_id: String(formData.get("customer_id")),
    work_type: workType,
    position_or_type: String(formData.get("position_or_type") || ""),
    size: workType === "container" ? size || null : null,
    charge_rate: Number(formData.get("charge_rate")) || null,
    pay_rate: Number(formData.get("pay_rate")) || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/customers");
}

export async function updateRateCard(id: string, chargeRate: number | null, payRate: number | null) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("rate_cards")
    .update({ charge_rate: chargeRate, pay_rate: payRate })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/customers");
}

export async function deleteRateCard(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("rate_cards").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/customers");
}
