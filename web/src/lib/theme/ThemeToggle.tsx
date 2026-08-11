"use client";

import type { ThemeMode } from "@workforce-app/shared";
import { useThemeMode } from "./ThemeProvider";

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto" },
];

export function ThemeToggle() {
  const { mode, setMode } = useThemeMode();

  return (
    <div className="flex gap-1 rounded-md border border-border p-0.5 text-xs">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setMode(option.value)}
          className={`rounded px-2 py-1 transition-colors ${
            mode === option.value
              ? "bg-hover text-foreground"
              : "text-text-secondary hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
