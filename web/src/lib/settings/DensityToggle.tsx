"use client";

import { useState } from "react";
import { DENSITY_COOKIE_NAME, type Density } from "./shared";

export function DensityToggle({ initialDensity }: { initialDensity: Density }) {
  const [density, setDensity] = useState<Density>(initialDensity);

  function toggle() {
    const next: Density = density === "compact" ? "comfortable" : "compact";
    setDensity(next);
    document.documentElement.setAttribute("data-density", next);
    document.cookie = `${DENSITY_COOKIE_NAME}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="border border-border rounded px-3 py-1.5 text-sm self-start"
    >
      {density === "compact" ? "Switch to comfortable view" : "Switch to compact view"}
    </button>
  );
}
