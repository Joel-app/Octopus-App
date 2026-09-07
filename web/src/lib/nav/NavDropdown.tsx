"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavDropdownItem {
  href?: string;
  label: string;
  badge?: ReactNode;
  children?: NavDropdownItem[];
}

function itemMatchesPath(item: NavDropdownItem, pathname: string): boolean {
  if (item.href && pathname === item.href.split("?")[0]) return true;
  if (item.children) return item.children.some((child) => itemMatchesPath(child, pathname));
  return false;
}

export function NavDropdown({ label, items }: { label: string; items: NavDropdownItem[] }) {
  const pathname = usePathname();
  const isActiveSection = items.some((item) => itemMatchesPath(item, pathname));
  const [open, setOpen] = useState(isActiveSection);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-left flex items-center justify-between w-full"
      >
        {label}
        <span className="text-xs text-text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-1 pl-3">
          {items.map((item) =>
            item.children ? (
              <NavDropdown key={item.label} label={item.label} items={item.children} />
            ) : (
              <div key={item.href} className="flex items-center gap-1.5">
                <Link href={item.href!} className="text-sm text-text-secondary hover:text-foreground">
                  {item.label}
                </Link>
                {item.badge}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
