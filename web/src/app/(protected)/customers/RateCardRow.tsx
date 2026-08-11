"use client";

import { useState } from "react";
import { deleteRateCard, updateRateCard } from "./actions";

export function RateCardRow({
  id,
  workType,
  positionOrType,
  size,
  chargeRate,
  payRate,
}: {
  id: string;
  workType: string;
  positionOrType: string;
  size: string | null;
  chargeRate: number | null;
  payRate: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [charge, setCharge] = useState(chargeRate?.toString() ?? "");
  const [pay, setPay] = useState(payRate?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await updateRateCard(id, Number(charge) || null, Number(pay) || null);
    setSaving(false);
    setEditing(false);
  }

  function handleCancel() {
    setCharge(chargeRate?.toString() ?? "");
    setPay(payRate?.toString() ?? "");
    setEditing(false);
  }

  if (!editing) {
    return (
      <tr className="border-t border-border">
        <td className="py-1 pr-4">{workType}</td>
        <td className="py-1 pr-4">{positionOrType}</td>
        <td className="py-1 pr-4">{size ?? "—"}</td>
        <td className="py-1 pr-4">{chargeRate ?? "—"}</td>
        <td className="py-1 pr-4">{payRate ?? "—"}</td>
        <td className="py-1">
          <button onClick={() => setEditing(true)} className="text-xs text-text-secondary">
            Edit
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="py-1 pr-4">{workType}</td>
      <td className="py-1 pr-4">{positionOrType}</td>
      <td className="py-1 pr-4">{size ?? "—"}</td>
      <td className="py-1" colSpan={3}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="Charge"
            value={charge}
            onChange={(e) => setCharge(e.target.value)}
            className="border border-border rounded px-2 py-0.5 bg-panel w-20"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Pay"
            value={pay}
            onChange={(e) => setPay(e.target.value)}
            className="border border-border rounded px-2 py-0.5 bg-panel w-20"
          />
          <button onClick={handleSave} disabled={saving} className="text-xs">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={handleCancel} className="text-xs text-text-secondary">
            Cancel
          </button>
          <button onClick={() => deleteRateCard(id)} className="text-danger-text text-xs">
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}
