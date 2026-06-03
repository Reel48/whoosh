import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Service-role Supabase client for the chat tables.
 *
 * The committed `database.types.ts` is regenerated from migrations lazily, so
 * the new `chat_*` tables / RPCs may not be in the typed `Database` yet. Chat
 * queries therefore use an untyped client (rows are cast to the hand-written
 * row types in `./types`). Stays server-side only — never shipped to a client.
 */
export function chatDb(): SupabaseClient {
  return supabase() as unknown as SupabaseClient;
}
