"use client";

import { useState } from "react";
import { AU_STATES } from "@/lib/constants";
import { addCustomer } from "./actions";

const inputClass = "border border-border rounded px-2 py-1 bg-panel";

export function AddCustomerForm() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [hours, setHours] = useState("");

  function reset() {
    setName("");
    setStreet("");
    setSuburb("");
    setState("");
    setPostcode("");
    setHours("");
  }

  async function handleSave() {
    if (!name) return;
    setSaving(true);
    await addCustomer(name, { street, suburb, state, postcode }, hours || null);
    setSaving(false);
    reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-foreground text-bg rounded px-3 py-1.5 self-start text-sm"
      >
        + Add customer
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border border-border rounded p-4 max-w-md">
      <h2 className="text-sm font-semibold">Add customer</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inputClass} />
      <input
        value={street}
        onChange={(e) => setStreet(e.target.value)}
        placeholder="Street"
        className={inputClass}
      />
      <div className="flex gap-2">
        <input
          value={suburb}
          onChange={(e) => setSuburb(e.target.value)}
          placeholder="Suburb"
          className={`${inputClass} flex-1`}
        />
        <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
          <option value="">—</option>
          {AU_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          placeholder="Postcode"
          className={`${inputClass} w-24`}
        />
      </div>
      <input
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        placeholder="Operating hours (e.g. 7am-5pm)"
        className={inputClass}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name}
          className="bg-foreground text-bg rounded px-3 py-1.5 self-start"
        >
          {saving ? "Saving…" : "Add customer"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-xs text-text-secondary self-start"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
