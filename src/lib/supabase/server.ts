import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Cookie-bound server Supabase client (anon/publishable key, RLS-enforced).
 *
 * Reads the auth cookie from the incoming request so server components, server
 * actions, and route handlers can identify the signed-in user. A fresh client
 * is created per call (it closes over this request's cookies) — never cache it
 * in a module global.
 *
 * `setAll` is wrapped in try/catch because cookie writes throw when called from
 * a Server Component render; in that case the session is refreshed by the proxy
 * (`src/proxy.ts`) instead, so swallowing the error is safe.
 *
 * NOTE: this is distinct from `@/lib/supabase`, which is the service-role client
 * used for privileged money-engine writes that must bypass RLS.
 */
export async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.",
    );
  }
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component render — the proxy refreshes instead.
        }
      },
    },
  });
}
