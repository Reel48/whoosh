import "server-only";
import { supabase } from "@/lib/supabase";

/**
 * Profile mutations for the iOS first-run flow (set a unique @handle, upload an
 * avatar, mark onboarded). All writes go through the service-role client — the
 * `profile` table has no user-facing write RLS (see the profiles migration).
 *
 * Read counterparts live in `@/lib/auth` (`getProfile`, `getAuthMethods`).
 */

/** Mirrors the DB `profile_username_format` check (case-insensitive unique index). */
export const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;

export type SetUsernameResult =
  | { ok: true }
  | { ok: false; error: string; code: "validation" | "conflict" };

/**
 * Normalize a raw handle the way the DB `normalize_handle` function does:
 * lowercase, collapse whitespace/dots/dashes to `_`, strip anything outside
 * [a-z0-9_], cap at 20. Used to suggest a valid handle in the onboarding UI.
 */
export function normalizeHandle(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s.\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
}

/** Case-insensitive availability check, optionally excluding the caller's own row. */
export async function isHandleAvailable(
  handle: string,
  exceptUserId?: string,
): Promise<boolean> {
  let q = supabase().from("profile").select("user_id").ilike("username", handle).limit(1);
  if (exceptUserId) q = q.neq("user_id", exceptUserId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`isHandleAvailable failed: ${error.message}`);
  return data === null;
}

/**
 * Set the user's @handle. Validates format and availability, then relies on the
 * `profile_username_lower_idx` unique index as the final guard against a race
 * (catches the 23505 unique-violation → "taken").
 */
export async function setUsername(
  userId: string,
  handleRaw: string,
): Promise<SetUsernameResult> {
  const handle = handleRaw.trim();
  if (!HANDLE_RE.test(handle)) {
    return {
      ok: false,
      code: "validation",
      error: "Handle must be 3–20 characters: letters, numbers, or underscores.",
    };
  }
  if (!(await isHandleAvailable(handle, userId))) {
    return { ok: false, code: "conflict", error: "That handle is taken." };
  }

  const { error } = await supabase()
    .from("profile")
    .update({ username: handle })
    .eq("user_id", userId);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, code: "conflict", error: "That handle is taken." };
    }
    throw new Error(`setUsername failed: ${error.message}`);
  }
  return { ok: true };
}

/** Whether the user has completed first-run onboarding (`onboarded_at` is set). */
export async function isOnboarded(userId: string): Promise<boolean> {
  const { data, error } = await supabase()
    .from("profile")
    .select("onboarded_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`isOnboarded failed: ${error.message}`);
  return Boolean(data?.onboarded_at);
}

/** Mark the profile onboarded (idempotent — only sets the timestamp once). */
export async function markOnboarded(userId: string): Promise<void> {
  const { error } = await supabase()
    .from("profile")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("onboarded_at", null);
  if (error) throw new Error(`markOnboarded failed: ${error.message}`);
}

/**
 * Upload an avatar image to the public `avatars` bucket and save its URL on the
 * profile. Mirrors the league-logo upload (`uploadLeagueLogoAction`). Returns
 * the public URL. The timestamped path busts the CDN cache on replace.
 */
export async function setAvatar(
  userId: string,
  bytes: Uint8Array,
  contentType: string,
  ext: string,
): Promise<string> {
  const safeExt = (ext || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${userId}-${Date.now()}.${safeExt}`;
  const store = supabase().storage.from("avatars");
  const { error: upErr } = await store.upload(path, bytes, {
    contentType: contentType || "image/png",
    upsert: true,
  });
  if (upErr) throw new Error(`Avatar upload failed: ${upErr.message}`);
  const { data } = store.getPublicUrl(path);

  const { error } = await supabase()
    .from("profile")
    .update({ avatar_url: data.publicUrl })
    .eq("user_id", userId);
  if (error) throw new Error(`Saving avatar failed: ${error.message}`);
  return data.publicUrl;
}
