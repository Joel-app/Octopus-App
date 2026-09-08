import { addStaff } from "../actions";

export default function NewStaffPage() {
  return (
    <div className="flex flex-col gap-6 max-w-md">
      <h1 className="text-lg font-semibold">Add staff</h1>

      <form action={addStaff} className="flex flex-col gap-2 border border-border rounded p-4">
        <input
          name="full_name"
          placeholder="Full name"
          required
          className="border border-border rounded px-2 py-1 bg-panel"
        />
        <input
          name="position"
          placeholder="Position (e.g. General Labourer)"
          className="border border-border rounded px-2 py-1 bg-panel"
        />
        <input
          name="pin"
          placeholder="PIN"
          inputMode="numeric"
          pattern="[0-9]{4,8}"
          required
          className="border border-border rounded px-2 py-1 bg-panel"
        />
        <p className="text-xs text-text-muted">
          This PIN is what they&apos;ll use to sign in on the mobile app — address/bank/tax/super/visa
          details are added afterwards from their compliance page.
        </p>
        <button type="submit" className="bg-foreground text-bg rounded px-3 py-1.5 mt-2 self-start">
          Add staff
        </button>
      </form>
    </div>
  );
}
