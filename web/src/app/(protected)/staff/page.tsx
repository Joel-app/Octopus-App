import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setStaffActive } from "./actions";

interface StaffRow {
  id: string;
  full_name: string;
  position: string | null;
  active: boolean;
  created_at: string;
}

interface ComplianceRow {
  profile_id: string;
  address: { street?: string; suburb?: string; state?: string; postcode?: string } | null;
  bank_bsb_encrypted: string | null;
  bank_account_number_encrypted: string | null;
  tax_type: string | null;
}

function isAddressComplete(addr: ComplianceRow["address"] | undefined) {
  return !!(addr && addr.street && addr.suburb && addr.state && addr.postcode);
}

function missingSections(row: ComplianceRow | undefined) {
  const missing: string[] = [];
  if (!isAddressComplete(row?.address)) missing.push("Address");
  if (!(row?.bank_bsb_encrypted && row?.bank_account_number_encrypted)) missing.push("Bank details");
  if (!row?.tax_type) missing.push("Tax details");
  return missing;
}

export default async function StaffPage() {
  const { profile: viewer } = await verifySession();
  const supabase = await createSupabaseServerClient();
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, position, active, created_at")
    .eq("role", "staff")
    .order("full_name")
    .returns<StaffRow[]>();

  // staff_sensitive is RLS-gated to admin/superadmin only — operations
  // can't see it, so skip the compliance column entirely for them rather
  // than showing a misleading "everything missing" badge.
  let complianceByStaffId = new Map<string, ComplianceRow>();
  if (viewer.role !== "operations" && staff && staff.length > 0) {
    const { data: compliance } = await supabase
      .from("staff_sensitive")
      .select("profile_id, address, bank_bsb_encrypted, bank_account_number_encrypted, tax_type")
      .in(
        "profile_id",
        staff.map((s) => s.id)
      )
      .returns<ComplianceRow[]>();
    complianceByStaffId = new Map((compliance ?? []).map((c) => [c.profile_id, c]));
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <h1 className="text-lg font-semibold">Staff</h1>

      <Link
        href="/staff/new"
        className="bg-foreground text-bg rounded px-3 py-1.5 self-start text-sm"
      >
        + Add staff
      </Link>

      <table className="text-sm w-full">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="font-normal pr-4">Name</th>
            <th className="font-normal pr-4">Position</th>
            <th className="font-normal pr-4">Status</th>
            {viewer.role !== "operations" && <th className="font-normal pr-4">Compliance</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {(staff ?? []).map((s) => (
            <tr key={s.id} className="border-t border-border">
              <td className="py-2 pr-4">{s.full_name}</td>
              <td className="py-2 pr-4">{s.position ?? "—"}</td>
              <td className="py-2 pr-4">{s.active ? "Active" : "Inactive"}</td>
              {viewer.role !== "operations" && (
                <td className="py-2 pr-4">
                  <Link href={`/staff/${s.id}`} className="text-xs">
                    {(() => {
                      const missing = missingSections(complianceByStaffId.get(s.id));
                      return missing.length === 0 ? (
                        <span className="text-success-text">Complete</span>
                      ) : (
                        <span className="text-danger-text">Missing: {missing.join(", ")}</span>
                      );
                    })()}
                  </Link>
                </td>
              )}
              <td className="py-2">
                <form action={setStaffActive.bind(null, s.id, !s.active)}>
                  <button type="submit" className="text-xs text-text-secondary">
                    {s.active ? "Deactivate" : "Reactivate"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {(staff ?? []).length === 0 && (
            <tr>
              <td colSpan={viewer.role !== "operations" ? 5 : 4} className="py-2 text-text-secondary">
                No staff yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
