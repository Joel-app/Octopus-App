import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { secureStorage } from "./secure-storage";
import { supabase } from "./supabase";

const STORAGE_KEY = "staff_profile";

export interface StaffProfile {
  id: string;
  fullName: string;
  role: string;
  sessionToken: string;
}

interface AuthContextValue {
  staff: StaffProfile | null;
  loading: boolean;
  signInWithPin: (pin: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    secureStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setStaff(JSON.parse(raw));
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      staff,
      loading,
      async signInWithPin(pin: string) {
        const { data, error } = await supabase.rpc("verify_staff_pin", { pin });
        const row = data?.[0];

        if (error || !row) {
          return { error: "Invalid PIN." };
        }

        const profile: StaffProfile = {
          id: row.id,
          fullName: row.full_name,
          role: row.role,
          sessionToken: row.session_token,
        };
        await secureStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        setStaff(profile);
        return { error: null };
      },
      async signOut() {
        await secureStorage.deleteItem(STORAGE_KEY);
        setStaff(null);
      },
    }),
    [staff, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
