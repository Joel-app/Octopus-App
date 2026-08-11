import { getTimes } from "suncalc";

// Octopus Labour brand palette — ported from the design prototype
// (Artifacts/app-development-v1-1). Dark is the base/default theme; light
// is an explicit override. Keep these two objects in sync with each other
// key-for-key.
export const colorTokens = {
  dark: {
    textPrimary: "#f2f1ec",
    border: "#2c2c29",
    textSecondary: "#a8a6a0",
    bg: "#121212",
    textMedium: "#cfcdc7",
    borderStrong: "#3a3a36",
    textMuted: "#8f8d86",
    infoText: "#6fb3f2",
    dangerText: "#e57373",
    successBg: "#14210a",
    warningText: "#d9a441",
    successText: "#8bc34a",
    infoBg: "#10202e",
    dangerText2: "#d16a63",
    dangerText3: "#c1554f",
    successText2: "#7cb342",
    textMuted2: "#77766f",
    borderVariant: "#333330",
    warningBg: "#241a0a",
    dangerBg: "#241212",
    hoverBg: "#232320",
    panelBg: "#1b1b19",
    dangerBg2: "#d47d78",
    successText3: "#6fa83d",
    infoText2: "#4a90d9",
    dangerBorder: "#4a2b27",
    dangerBg3: "#251313",
    warningBg2: "#241d0f",
    surface2: "#201f1c",
    surface3: "#1e1d1a",
    surface4: "#1a1a18",
    successBg2: "#171a12",
    infoBg2: "#112232",
    infoBg3: "#0f1e2b",
  },
  light: {
    textPrimary: "#1f1f1d",
    border: "#e2e0d8",
    textSecondary: "#6b6a66",
    bg: "#ffffff",
    textMedium: "#4a4944",
    borderStrong: "#c9c7bd",
    textMuted: "#8a8880",
    infoText: "#185fa5",
    dangerText: "#a32d2d",
    successBg: "#eaf3de",
    warningText: "#854f0b",
    successText: "#3b6d11",
    infoBg: "#f0f6fc",
    dangerText2: "#9a3b3b",
    dangerText3: "#791f1f",
    successText2: "#639922",
    textMuted2: "#a3a199",
    borderVariant: "#d8d6cc",
    warningBg: "#faeeda",
    dangerBg: "#fcebeb",
    hoverBg: "#f5f4ee",
    panelBg: "#f7f6f1",
    dangerBg2: "#f09595",
    successText3: "#27500a",
    infoText2: "#85b7eb",
    dangerBorder: "#e3b3ac",
    dangerBg3: "#fbeded",
    warningBg2: "#fdf0d5",
    surface2: "#eeece5",
    surface3: "#f0efe9",
    surface4: "#fbfaf7",
    successBg2: "#eef1e9",
    infoBg2: "#e6f1fb",
    infoBg3: "#eaf3fc",
  },
} as const;

export type ThemeName = "dark" | "light";
export type ThemeMode = ThemeName | "auto";
export type ColorToken = keyof typeof colorTokens.dark;

// Representative NSW location for sunrise/sunset — Sydney. Sunrise/sunset
// varies slightly across the state, but a single statewide reference point
// is the right amount of precision for a UI theme switch.
export const NSW_LOCATION = { latitude: -33.8688, longitude: 151.2093 };

// suncalc types sunrise/sunset as nullable because they can be at extreme
// (polar) latitudes. NSW is nowhere near that, so a null here would mean
// something is actually wrong (bad coordinates) rather than a real edge
// case — fail loudly instead of silently miscalculating day/night.
function assertSunTime(t: Date | null, label: string): Date {
  if (!t) throw new Error(`Unexpected: no ${label} time for NSW coordinates`);
  return t;
}

export function getSunTimes(date: Date = new Date()) {
  const times = getTimes(date, NSW_LOCATION.latitude, NSW_LOCATION.longitude);
  return {
    sunrise: assertSunTime(times.sunrise, "sunrise"),
    sunset: assertSunTime(times.sunset, "sunset"),
  };
}

// 'auto' resolves to 'light' between sunrise and sunset in NSW, else 'dark'.
export function resolveAutoTheme(date: Date = new Date()): ThemeName {
  const { sunrise, sunset } = getSunTimes(date);
  return date >= sunrise && date < sunset ? "light" : "dark";
}

export function getEffectiveTheme(mode: ThemeMode, date: Date = new Date()): ThemeName {
  return mode === "auto" ? resolveAutoTheme(date) : mode;
}

// When the effective theme should next be re-evaluated — the sooner of the
// next sunrise/sunset transition (for 'auto') or a 1-minute safety tick
// (cheap, and covers edge cases like the device clock changing).
export function msUntilNextThemeCheck(mode: ThemeMode, date: Date = new Date()): number {
  if (mode !== "auto") return 60_000;

  const { sunrise, sunset } = getSunTimes(date);
  const upcoming = [sunrise, sunset]
    .map((t) => t.getTime())
    .filter((t) => t > date.getTime());

  if (upcoming.length > 0) {
    return Math.min(...upcoming) - date.getTime();
  }

  // past both of today's transitions (e.g. it's late night) — the next one
  // is tomorrow's sunrise
  const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return getSunTimes(tomorrow).sunrise.getTime() - date.getTime();
}
