import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { getEffectiveTheme } from "@workforce-app/shared";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { THEME_COOKIE_NAME, parseThemeMode } from "@/lib/theme/shared";
import { DENSITY_COOKIE_NAME, parseDensity } from "@/lib/settings/shared";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Octopus Labour",
  description: "Rostering, daily ops, safety, and leave for Octopus Labour",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const mode = parseThemeMode(cookieStore.get(THEME_COOKIE_NAME)?.value);
  const effectiveTheme = getEffectiveTheme(mode);
  const density = parseDensity(cookieStore.get(DENSITY_COOKIE_NAME)?.value);

  return (
    <html
      lang="en"
      data-theme={effectiveTheme}
      data-density={density}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider initialMode={mode} initialTheme={effectiveTheme}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
