"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BillingNavDropdown() {
  const pathname = usePathname();
  const isBillingSection = pathname === "/billing";
  const [open, setOpen] = useState(isBillingSection);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-left flex items-center justify-between w-full"
      >
        Billing
        <span className="text-xs text-text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-1 pl-3">
          <Link href="/billing?view=customer" className="text-sm text-text-secondary hover:text-foreground">
            Customer Invoicing
          </Link>
          <Link href="/billing?view=staff" className="text-sm text-text-secondary hover:text-foreground">
            Staff Pays
          </Link>
        </div>
      )}
    </div>
  );
}
