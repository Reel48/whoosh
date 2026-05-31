import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Browser-side Supabase client (anon/publishable key, RLS-enforced).
 *
 * `createBrowserClient` is a singleton under the hood, so calling this multiple
 * times in client components is cheap. Used only for auth flows that must run in
 * the browser (e.g. `linkIdentity`, OAuth sign-in); all privileged data access
 * stays on the server via the service-role client in `@/lib/supabase`.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.",
    );
  }
  return createBrowserClient<Database>(url, key);
}
