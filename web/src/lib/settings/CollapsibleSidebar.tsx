"use client";

import { useEffect, useState } from "react";

const KEY = "sidebar-collapsed";

export function CollapsibleSidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(KEY) === "1");
    setMounted(true);
  }, []);

  function toggle(next: boolean) {
    setCollapsed(next);
    localStorage.setItem(KEY, next ? "1" : "0");
  }

  if (mounted && collapsed) {
    return (
      <button
        type="button"
        onClick={() => toggle(false)}
        title="Expand sidebar"
        className="border-r border-border px-2 text-text-secondary hover:text-foreground"
      >
        ›
      </button>
    );
  }

  return (
    <aside className="w-48 border-r border-border p-4 flex flex-col gap-4 relative">
      <button
        type="button"
        onClick={() => toggle(true)}
        title="Collapse sidebar"
        className="absolute top-2 right-2 text-text-secondary hover:text-foreground text-xs"
      >
        ‹
      </button>
      {children}
    </aside>
  );
}
