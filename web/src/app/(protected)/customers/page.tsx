import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AU_STATES } from "@/lib/constants";
import { addCustomer, addRateCard } from "./actions";
import { RateCardRow } from "./RateCardRow";

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

export default async function CustomersPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: customers }, { data: rateCards }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, address, operating_hours")
      .order("name")
      .returns<CustomerRow[]>(),
    supabase
      .from("rate_cards")
      .select("id, customer_id, work_type, position_or_type, size, charge_rate, pay_rate")
      .returns<RateCardRow[]>(),
  ]);

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <h1 className="text-lg font-semibold">Customers</h1>

      <form
        action={addCustomer}
        className="flex flex-col gap-2 border border-border rounded p-4"
      >
        <h2 className="text-sm font-semibold">Add customer</h2>
        <input
          name="name"
          placeholder="Name"
          required
          className="border border-border rounded px-2 py-1 bg-panel"
        />
        <input
          name="street"
          placeholder="Street"
          className="border border-border rounded px-2 py-1 bg-panel"
        />
        <div className="flex gap-2">
          <input
            name="suburb"
            placeholder="Suburb"
            className="border border-border rounded px-2 py-1 bg-panel flex-1"
          />
          <select name="state" className="border border-border rounded px-2 py-1 bg-panel">
            {AU_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            name="postcode"
            placeholder="Postcode"
            className="border border-border rounded px-2 py-1 bg-panel w-24"
          />
        </div>
        <input
          name="operating_hours"
          placeholder="Operating hours (e.g. 7am-5pm)"
          className="border border-border rounded px-2 py-1 bg-panel"
        />
        <button type="submit" className="bg-foreground text-bg rounded px-3 py-1.5 mt-2 self-start">
          Add customer
        </button>
      </form>

      <div className="flex flex-col gap-6">
        {(customers ?? []).map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            rateCards={(rateCards ?? []).filter((r) => r.customer_id === customer.id)}
          />
        ))}
        {(customers ?? []).length === 0 && (
          <p className="text-sm text-text-secondary">No customers yet.</p>
        )}
      </div>
    </div>
  );
}

function CustomerCard({
  customer,
  rateCards,
}: {
  customer: CustomerRow;
  rateCards: RateCardRow[];
}) {
  const addr = customer.address;
  const addressLine = addr
    ? [addr.street, addr.suburb, addr.state, addr.postcode].filter(Boolean).join(", ")
    : null;

  return (
    <div className="border border-border rounded p-4 flex flex-col gap-4">
      <div>
        <h3 className="font-semibold">{customer.name}</h3>
        {addressLine && <p className="text-sm text-text-secondary">{addressLine}</p>}
        {customer.operating_hours && (
          <p className="text-sm text-text-secondary">{customer.operating_hours}</p>
        )}
      </div>

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
          {rateCards.map((rc) => (
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
          {rateCards.length === 0 && (
            <tr>
              <td colSpan={6} className="py-2 text-text-secondary">
                No rate cards yet — this site can't be rostered on mobile until at least one exists.
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
