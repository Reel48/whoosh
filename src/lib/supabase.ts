import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

let _client: SupabaseClient<Database> | null = null;

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS — never expose this to the browser. All tables have
 * RLS enabled with no policies, so the service role is the only way in.
 */
export function supabase(): SupabaseClient<Database> {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
