import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** Register (upsert) an APNs device token for a user. */
export async function registerDeviceToken(
  userId: string,
  token: string,
  platform = "ios",
): Promise<void> {
  // Untyped client: `device_token` may not be in the generated types yet.
  const db = supabase() as unknown as SupabaseClient;
  const { error } = await db
    .from("device_token")
    .upsert(
      { token, user_id: userId, platform, updated_at: new Date().toISOString() },
      { onConflict: "token" },
    );
  if (error) throw new Error(`registerDeviceToken failed: ${error.message}`);
}
