"use client";

import { useState } from "react";
import { AU_STATES, YES_NO } from "@/lib/constants";
import { DocumentField } from "./DocumentField";

const inputClass = "border border-border rounded px-2 py-1 bg-panel w-full";
const labelClass = "flex flex-col gap-1 text-sm";

interface Address {
  street?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
}

export function TaxSuperSection({
  initialTaxType,
  tfn,
  abn,
  abnLookupLink,
  gstRegistered,
  superFundName,
  superFundAbn,
  superUsi,
  superAccountName,
  superMemberNumber,
  superAddress,
  taxFileDeclarationUrl,
}: {
  initialTaxType: string;
  tfn: string;
  abn: string;
  abnLookupLink: string;
  gstRegistered: string;
  superFundName: string;
  superFundAbn: string;
  superUsi: string;
  superAccountName: string;
  superMemberNumber: string;
  superAddress: Address;
  taxFileDeclarationUrl: string | null;
}) {
  const [taxType, setTaxType] = useState(initialTaxType);

  return (
    <>
      <section className="flex flex-col gap-3 border border-border rounded p-4">
        <h2 className="text-sm font-semibold">Tax details</h2>
        <label className={labelClass}>
          Tax type
          <select
            name="tax_type"
            value={taxType}
            onChange={(e) => setTaxType(e.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            <option value="TFN">TFN</option>
            <option value="ABN">ABN</option>
          </select>
        </label>

        {taxType === "TFN" && (
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              TFN
              <input name="tfn" defaultValue={tfn} className={inputClass} />
            </label>
            <DocumentField
              label="Tax file declaration"
              name="tax_file_declaration"
              signedUrl={taxFileDeclarationUrl}
              accept="image/*,application/pdf"
            />
          </div>
        )}

        {taxType === "ABN" && (
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              ABN
              <input name="abn" defaultValue={abn} className={inputClass} />
            </label>
            <label className={labelClass}>
              ABN lookup link
              <input name="abn_lookup_link" defaultValue={abnLookupLink} className={inputClass} />
            </label>
            <label className={labelClass}>
              GST registered
              <select name="gst_registered" defaultValue={gstRegistered} className={inputClass}>
                <option value="">—</option>
                {YES_NO.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </section>

      {taxType === "TFN" && (
        <section className="flex flex-col gap-3 border border-border rounded p-4">
          <h2 className="text-sm font-semibold">Superannuation</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Fund name
              <input name="super_fund_name" defaultValue={superFundName} className={inputClass} />
            </label>
            <label className={labelClass}>
              Fund ABN
              <input name="super_fund_abn" defaultValue={superFundAbn} className={inputClass} />
            </label>
            <label className={labelClass}>
              USI
              <input name="super_usi" defaultValue={superUsi} className={inputClass} />
            </label>
            <label className={labelClass}>
              Account name
              <input name="super_account_name" defaultValue={superAccountName} className={inputClass} />
            </label>
            <label className={labelClass}>
              Member number
              <input name="super_member_number" defaultValue={superMemberNumber} className={inputClass} />
            </label>
          </div>
          <h3 className="text-xs font-semibold text-text-secondary mt-2">Fund address</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Street
              <input name="super_address_street" defaultValue={superAddress.street ?? ""} className={inputClass} />
            </label>
            <label className={labelClass}>
              Suburb
              <input name="super_address_suburb" defaultValue={superAddress.suburb ?? ""} className={inputClass} />
            </label>
            <label className={labelClass}>
              State
              <select name="super_address_state" defaultValue={superAddress.state ?? ""} className={inputClass}>
                <option value="">—</option>
                {AU_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Postcode
              <input
                name="super_address_postcode"
                defaultValue={superAddress.postcode ?? ""}
                className={inputClass}
              />
            </label>
          </div>
        </section>
      )}
    </>
  );
}
