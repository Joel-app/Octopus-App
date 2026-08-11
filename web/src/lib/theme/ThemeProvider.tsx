"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getEffectiveTheme,
  msUntilNextThemeCheck,
  type ThemeMode,
  type ThemeName,
} from "@workforce-app/shared";
import { THEME_COOKIE_NAME } from "./shared";

interface ThemeContextValue {
  mode: ThemeMode;
  effectiveTheme: ThemeName;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  initialMode,
  initialTheme,
  children,
}: {
  initialMode: ThemeMode;
  initialTheme: ThemeName;
  children: ReactNode;
}) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [effectiveTheme, setEffectiveTheme] = useState<ThemeName>(initialTheme);
  // avoids re-applying the theme the server already rendered on first mount
  const isFirstRun = useRef(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const theme = getEffectiveTheme(mode);
      setEffectiveTheme(theme);
      if (!isFirstRun.current) {
        document.documentElement.setAttribute("data-theme", theme);
      }
      isFirstRun.current = false;
      timer = setTimeout(tick, msUntilNextThemeCheck(mode) + 1000);
    }
    tick();

    return () => clearTimeout(timer);
  }, [mode]);

  function setMode(next: ThemeMode) {
    setModeState(next);
    document.cookie = `${THEME_COOKIE_NAME}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <ThemeContext.Provider value={{ mode, effectiveTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeProvider");
  return ctx;
}
