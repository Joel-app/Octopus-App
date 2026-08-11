import type { ThemeMode } from "@workforce-app/shared";

export const THEME_COOKIE_NAME = "theme-preference";

export function parseThemeMode(value: string | undefined | null): ThemeMode {
  return value === "light" || value === "dark" || value === "auto" ? value : "auto";
}
