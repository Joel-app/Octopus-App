export const DENSITY_COOKIE_NAME = "density-preference";
export type Density = "comfortable" | "compact";

export function parseDensity(value: string | undefined | null): Density {
  return value === "compact" ? "compact" : "comfortable";
}

export const NOTIFICATIONS_COOKIE_NAME = "notifications-preference";

export function parseNotificationsPref(value: string | undefined | null): boolean {
  return value !== "off";
}
