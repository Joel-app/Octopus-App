"use client";

import { useState } from "react";
import { AU_STATES } from "@/lib/constants";
import { updateCustomer } from "./actions";

interface Address {
  street?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
}

export function CustomerHeader({
  id,
  name,
  address,
  operatingHours,
}: {
  id: string;
  name: string;
  address: Address | null;
  operatingHours: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [street, setStreet] = useState(address?.street ?? "");
  const [suburb, setSuburb] = useState(address?.suburb ?? "");
  const [state, setState] = useState(address?.state ?? "");
  const [postcode, setPostcode] = useState(address?.postcode ?? "");
  const [hours, setHours] = useState(operatingHours ?? "");

  async function handleSave() {
    setSaving(true);
    await updateCustomer(id, nameValue, { street, suburb, state, postcode }, hours || null);
    setSaving(false);
    setEditing(false);
  }

  function handleCancel() {
    setNameValue(name);
    setStreet(address?.street ?? "");
    setSuburb(address?.suburb ?? "");
    setState(address?.state ?? "");
    setPostcode(address?.postcode ?? "");
    setHours(operatingHours ?? "");
    setEditing(false);
  }

  if (!editing) {
    const addressLine = address
      ? [address.street, address.suburb, address.state, address.postcode].filter(Boolean).join(", ")
      : null;

    return (
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{name}</h3>
          {addressLine && <p className="text-sm text-text-secondary">{addressLine}</p>}
          {operatingHours && <p className="text-sm text-text-secondary">{operatingHours}</p>}
        </div>
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-text-secondary">
          Edit
        </button>
      </div>
    );
  }

  const inputClass = "border border-border rounded px-2 py-1 bg-panel";

  return (
    <div className="flex flex-col gap-2 text-sm">
      <input
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
        placeholder="Name"
        className={inputClass}
      />
      <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Street" className={inputClass} />
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
          disabled={saving || !nameValue}
          className="bg-foreground text-bg rounded px-3 py-1.5 self-start"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={handleCancel} className="text-xs text-text-secondary self-start">
          Cancel
        </button>
      </div>
    </div>
  );
}
