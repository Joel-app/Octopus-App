"use client";

import { useState } from "react";
import { YES_NO } from "@/lib/constants";

const inputClass = "border border-border rounded px-2 py-1 bg-panel w-full";
const labelClass = "flex flex-col gap-1 text-sm";

export function VisaSection({
  initialResident,
  visaSubclass,
  visaNumber,
  visaExpiry,
  visaNotes,
}: {
  initialResident: string;
  visaSubclass: string;
  visaNumber: string;
  visaExpiry: string;
  visaNotes: string;
}) {
  const [resident, setResident] = useState(initialResident);

  return (
    <section className="flex flex-col gap-3 border border-border rounded p-4">
      <h2 className="text-sm font-semibold">Visa</h2>
      <label className={labelClass}>
        Australian resident?
        <select
          name="visa_status"
          value={resident}
          onChange={(e) => setResident(e.target.value)}
          className={inputClass}
        >
          <option value="">—</option>
          {YES_NO.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>

      {resident === "No" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Subclass
              <input name="visa_subclass" defaultValue={visaSubclass} className={inputClass} />
            </label>
            <label className={labelClass}>
              Visa number
              <input name="visa_number" defaultValue={visaNumber} className={inputClass} />
            </label>
            <label className={labelClass}>
              Expiry
              <input type="date" name="visa_expiry" defaultValue={visaExpiry} className={inputClass} />
            </label>
          </div>
          <label className={labelClass}>
            Notes
            <textarea name="visa_notes" defaultValue={visaNotes} className={inputClass} rows={2} />
          </label>
        </>
      )}
    </section>
  );
}
