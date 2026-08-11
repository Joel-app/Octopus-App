import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Staff sign in via PIN (see verify_staff_pin RPC), not Supabase Auth,
// so there's no session to persist here.
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
