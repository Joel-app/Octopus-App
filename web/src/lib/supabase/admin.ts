import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely. Only ever import this from a
// Server Action, and only to call the Auth admin API (inviting new admin
// logins). Never use it for ordinary data access; the regular
// createSupabaseServerClient (which respects RLS under the caller's own
// session) covers everything else.
export function createSupabaseAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
