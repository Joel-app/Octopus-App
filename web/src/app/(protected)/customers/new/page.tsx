import { AU_STATES } from "@/lib/constants";
import { addCustomer } from "../actions";

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-6 max-w-md">
      <h1 className="text-lg font-semibold">Add customer</h1>

      <form action={addCustomer} className="flex flex-col gap-2 border border-border rounded p-4">
        <input
          name="name"
          placeholder="Name"
          required
          className="border border-border rounded px-2 py-1 bg-panel"
        />
        <input name="street" placeholder="Street" className="border border-border rounded px-2 py-1 bg-panel" />
        <div className="flex gap-2">
          <input
            name="suburb"
            placeholder="Suburb"
            className="border border-border rounded px-2 py-1 bg-panel flex-1"
          />
          <select name="state" className="border border-border rounded px-2 py-1 bg-panel">
            <option value="">—</option>
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
    </div>
  );
}
