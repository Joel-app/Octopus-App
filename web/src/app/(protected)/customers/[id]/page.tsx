import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addRateCard } from "../actions";
import { RateCardRow } from "../RateCardRow";
import { CustomerHeader } from "../CustomerHeader";

interface CustomerRow {
  id: string;
  name: string;
  address: { street?: string; suburb?: string; state?: string; postcode?: string } | null;
  operating_hours: string | null;
}

interface RateCardRow {
  id: string;
  customer_id: string;
  work_type: "hourly" | "container" | "rework";
  position_or_type: string;
  size: string | null;
  charge_rate: number | null;
  pay_rate: number | null;
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: customer }, { data: rateCards }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, address, operating_hours")
      .eq("id", id)
      .single<CustomerRow>(),
    supabase
      .from("rate_cards")
      .select("id, customer_id, work_type, position_or_type, size, charge_rate, pay_rate")
      .eq("customer_id", id)
      .returns<RateCardRow[]>(),
  ]);

  if (!customer) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <CustomerHeader
        id={customer.id}
        name={customer.name}
        address={customer.address}
        operatingHours={customer.operating_hours}
      />

      <table className="text-sm w-full">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="font-normal pr-4">Work type</th>
            <th className="font-normal pr-4">Type</th>
            <th className="font-normal pr-4">Size</th>
            <th className="font-normal pr-4">Charge</th>
            <th className="font-normal pr-4">Pay</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(rateCards ?? []).map((rc) => (
            <RateCardRow
              key={rc.id}
              id={rc.id}
              workType={rc.work_type}
              positionOrType={rc.position_or_type}
              size={rc.size}
              chargeRate={rc.charge_rate}
              payRate={rc.pay_rate}
            />
          ))}
          {(rateCards ?? []).length === 0 && (
            <tr>
              <td colSpan={6} className="py-2 text-text-secondary">
                No rate cards yet — this site can&apos;t be rostered on mobile until at least one exists.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form action={addRateCard} className="flex flex-wrap gap-2 items-end text-sm">
        <input type="hidden" name="customer_id" value={customer.id} />
        <label className="flex flex-col gap-1">
          Work type
          <select name="work_type" className="border border-border rounded px-2 py-1 bg-panel">
            <option value="hourly">hourly</option>
            <option value="container">container</option>
            <option value="rework">rework</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Type / position
          <input
            name="position_or_type"
            required
            className="border border-border rounded px-2 py-1 bg-panel w-40"
          />
        </label>
        <label className="flex flex-col gap-1">
          Size (container only)
          <input name="size" className="border border-border rounded px-2 py-1 bg-panel w-24" />
        </label>
        <label className="flex flex-col gap-1">
          Charge rate
          <input
            name="charge_rate"
            type="number"
            step="0.01"
            className="border border-border rounded px-2 py-1 bg-panel w-24"
          />
        </label>
        <label className="flex flex-col gap-1">
          Pay rate
          <input
            name="pay_rate"
            type="number"
            step="0.01"
            className="border border-border rounded px-2 py-1 bg-panel w-24"
          />
        </label>
        <button type="submit" className="bg-foreground text-bg rounded px-3 py-1.5">
          Add rate
        </button>
      </form>
    </div>
  );
}
