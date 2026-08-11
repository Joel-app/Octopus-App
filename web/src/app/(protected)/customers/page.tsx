import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddCustomerForm } from "./AddCustomerForm";

interface CustomerRow {
  id: string;
  name: string;
  address: { street?: string; suburb?: string; state?: string; postcode?: string } | null;
  operating_hours: string | null;
}

export default async function CustomersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, address, operating_hours")
    .order("name")
    .returns<CustomerRow[]>();

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-lg font-semibold">Customers</h1>

      <AddCustomerForm />

      <table className="text-sm w-full">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="font-normal pr-4">Name</th>
            <th className="font-normal pr-4">Address</th>
            <th className="font-normal pr-4">Operating hours</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(customers ?? []).map((c) => {
            const addr = c.address;
            const addressLine = addr
              ? [addr.street, addr.suburb, addr.state, addr.postcode].filter(Boolean).join(", ")
              : "";
            return (
              <tr key={c.id} className="border-t border-border">
                <td className="py-2 pr-4">{c.name}</td>
                <td className="py-2 pr-4 text-text-secondary">{addressLine || "—"}</td>
                <td className="py-2 pr-4 text-text-secondary">{c.operating_hours ?? "—"}</td>
                <td className="py-2">
                  <Link href={`/customers/${c.id}`} className="text-xs text-text-secondary">
                    Edit
                  </Link>
                </td>
              </tr>
            );
          })}
          {(customers ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="py-2 text-text-secondary">
                No customers yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
