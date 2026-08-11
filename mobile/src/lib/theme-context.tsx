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
import { secureStorage } from "./secure-storage";

const STORAGE_KEY = "theme-preference";

interface ThemeModeContextValue {
  mode: ThemeMode;
  effectiveTheme: ThemeName;
  setMode: (mode: ThemeMode) => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function parseMode(value: string | null): ThemeMode {
  return value === "light" || value === "dark" || value === "auto" ? value : "auto";
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("auto");
  const [effectiveTheme, setEffectiveTheme] = useState<ThemeName>(() => getEffectiveTheme("auto"));
  const loadedStoredMode = useRef(false);

  useEffect(() => {
    secureStorage.getItem(STORAGE_KEY).then((raw) => {
      loadedStoredMode.current = true;
      setModeState(parseMode(raw));
    });
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      setEffectiveTheme(getEffectiveTheme(mode));
      timer = setTimeout(tick, msUntilNextThemeCheck(mode) + 1000);
    }
    tick();

    return () => clearTimeout(timer);
  }, [mode]);

  function setMode(next: ThemeMode) {
    setModeState(next);
    secureStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <ThemeModeContext.Provider value={{ mode, effectiveTheme, setMode }}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeModeProvider");
  return ctx;
}
