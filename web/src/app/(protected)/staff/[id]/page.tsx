import { notFound, redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AU_STATES } from "@/lib/constants";
import { saveStaffCompliance } from "../actions";
import { VisaSection } from "./VisaSection";
import { TaxSuperSection } from "./TaxSuperSection";

interface StaffProfile {
  id: string;
  full_name: string;
  position: string | null;
  active: boolean;
}

interface StaffSensitiveRow {
  profile_id: string;
  address: { street?: string; suburb?: string; state?: string; postcode?: string } | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_bsb_encrypted: string | null;
  bank_account_number_encrypted: string | null;
  tax_type: string | null;
  tfn_encrypted: string | null;
  abn: string | null;
  abn_lookup_link: string | null;
  gst_registered: string | null;
  super_fund_name: string | null;
  super_fund_abn: string | null;
  super_usi: string | null;
  super_account_name: string | null;
  super_member_number_encrypted: string | null;
  super_fund_address: { street?: string; suburb?: string; state?: string; postcode?: string } | null;
  visa_status: string | null;
  visa_subclass: string | null;
  visa_number: string | null;
  visa_expiry: string | null;
  visa_notes: string | null;
  forklift_licence_expiry: string | null;
  lo_licence_expiry: string | null;
}

export default async function StaffCompliancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile: viewer } = await verifySession();

  // staff_sensitive is RLS-gated to admin/superadmin only — operations
  // would just see an empty row here, which reads as "nothing on file"
  // rather than "you don't have access", so redirect explicitly instead.
  if (viewer.role === "operations") {
    redirect("/staff");
  }

  const supabase = await createSupabaseServerClient();

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, position, active")
    .eq("id", id)
    .single<StaffProfile>();

  if (!staff) notFound();

  const { data: sensitive } = await supabase
    .from("staff_sensitive")
    .select("*")
    .eq("profile_id", id)
    .maybeSingle<StaffSensitiveRow>();

  let bsb = "";
  let accountNumber = "";
  let tfn = "";
  let superMemberNumber = "";

  if (sensitive) {
    const [bsbRes, acctRes, tfnRes, superRes] = await Promise.all([
      sensitive.bank_bsb_encrypted
        ? supabase.rpc("decrypt_sensitive", { cipher: sensitive.bank_bsb_encrypted })
        : Promise.resolve({ data: null }),
      sensitive.bank_account_number_encrypted
        ? supabase.rpc("decrypt_sensitive", { cipher: sensitive.bank_account_number_encrypted })
        : Promise.resolve({ data: null }),
      sensitive.tfn_encrypted
        ? supabase.rpc("decrypt_sensitive", { cipher: sensitive.tfn_encrypted })
        : Promise.resolve({ data: null }),
      sensitive.super_member_number_encrypted
        ? supabase.rpc("decrypt_sensitive", { cipher: sensitive.super_member_number_encrypted })
        : Promise.resolve({ data: null }),
    ]);
    bsb = bsbRes.data ?? "";
    accountNumber = acctRes.data ?? "";
    tfn = tfnRes.data ?? "";
    superMemberNumber = superRes.data ?? "";
  }

  const address = sensitive?.address ?? {};
  const superAddress = sensitive?.super_fund_address ?? {};

  const inputClass = "border border-border rounded px-2 py-1 bg-panel w-full";
  const labelClass = "flex flex-col gap-1 text-sm";

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold">{staff.full_name}</h1>
        <p className="text-sm text-text-secondary">{staff.position ?? "—"}</p>
      </div>

      <form action={saveStaffCompliance.bind(null, id)} className="flex flex-col gap-8">
        <section className="flex flex-col gap-3 border border-border rounded p-4">
          <h2 className="text-sm font-semibold">Address</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Street
              <input name="address_street" defaultValue={address.street ?? ""} className={inputClass} />
            </label>
            <label className={labelClass}>
              Suburb
              <input name="address_suburb" defaultValue={address.suburb ?? ""} className={inputClass} />
            </label>
            <label className={labelClass}>
              State
              <select name="address_state" defaultValue={address.state ?? ""} className={inputClass}>
                <option value="">—</option>
                {AU_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Postcode
              <input name="address_postcode" defaultValue={address.postcode ?? ""} className={inputClass} />
            </label>
          </div>
        </section>

        <section className="flex flex-col gap-3 border border-border rounded p-4">
          <h2 className="text-sm font-semibold">Bank details</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Bank name
              <input name="bank_name" defaultValue={sensitive?.bank_name ?? ""} className={inputClass} />
            </label>
            <label className={labelClass}>
              Account name
              <input
                name="bank_account_name"
                defaultValue={sensitive?.bank_account_name ?? ""}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              BSB
              <input name="bank_bsb" defaultValue={bsb} className={inputClass} />
            </label>
            <label className={labelClass}>
              Account number
              <input name="bank_account_number" defaultValue={accountNumber} className={inputClass} />
            </label>
          </div>
        </section>

        <TaxSuperSection
          initialTaxType={sensitive?.tax_type ?? ""}
          tfn={tfn}
          abn={sensitive?.abn ?? ""}
          abnLookupLink={sensitive?.abn_lookup_link ?? ""}
          gstRegistered={sensitive?.gst_registered ?? ""}
          superFundName={sensitive?.super_fund_name ?? ""}
          superFundAbn={sensitive?.super_fund_abn ?? ""}
          superUsi={sensitive?.super_usi ?? ""}
          superAccountName={sensitive?.super_account_name ?? ""}
          superMemberNumber={superMemberNumber}
          superAddress={superAddress}
        />

        <VisaSection
          initialResident={sensitive?.visa_status ?? ""}
          visaSubclass={sensitive?.visa_subclass ?? ""}
          visaNumber={sensitive?.visa_number ?? ""}
          visaExpiry={sensitive?.visa_expiry ?? ""}
          visaNotes={sensitive?.visa_notes ?? ""}
        />

        <section className="flex flex-col gap-3 border border-border rounded p-4">
          <h2 className="text-sm font-semibold">Licences</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Forklift licence expiry
              <input
                type="date"
                name="forklift_licence_expiry"
                defaultValue={sensitive?.forklift_licence_expiry ?? ""}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              LO licence expiry
              <input
                type="date"
                name="lo_licence_expiry"
                defaultValue={sensitive?.lo_licence_expiry ?? ""}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <button type="submit" className="bg-foreground text-bg rounded px-4 py-2 self-start">
          Save compliance details
        </button>
      </form>
    </div>
  );
}
