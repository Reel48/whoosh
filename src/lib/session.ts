import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase";

/**
 * The signed-in user, backed by Supabase Auth.
 *
 * `id` is the stable app user id (Supabase `auth.users.id`) — the key for the
 * wallet, Whoosh Bucks ledger, and fantasy data. Discord is now an *optional*
 * linked account (`discordUserId`), no longer the identity itself.
 */
export type Session = {
  /** App user id (auth.users.id). The key everything economic hangs off. */
  id: string;
  /** Display handle, from the profile. */
  username: string;
  /** Full avatar URL, or null to render an initials fallback. */
  avatarUrl: string | null;
  /** Linked Discord snowflake, or null when no Discord account is connected. */
  discordUserId: string | null;
  /** Login email (from the verified JWT claim), or null. */
  email: string | null;
  /** Whether the account has a password set (can log in with email + password). */
  hasPassword: boolean;
  /** Admin flag, from the profile (replaces the old Discord-role check). */
  isAdmin: boolean;
};

async function _getSession(): Promise<Session | null> {
  const sb = await createServerSupabase();
  // getClaims() verifies the JWT locally (trustworthy + cheap), unlike
  // getSession() which must not be trusted server-side.
  const { data, error } = await sb.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  const userId = claims.sub as string;

  // Read display + link info from the profile (service role — always works
  // server-side and sidesteps RLS). The profile is created by the
  // on_auth_user_created trigger at signup.
  const { data: profile } = await supabase()
    .from("profile")
    .select("username, avatar_url, discord_user_id, has_password, is_admin")
    .eq("user_id", userId)
    .maybeSingle();

  const email = typeof claims.email === "string" ? claims.email : null;
  const emailLocal = email ? email.split("@")[0] : undefined;

  return {
    id: userId,
    username: profile?.username ?? emailLocal ?? "member",
    avatarUrl: profile?.avatar_url ?? null,
    discordUserId: profile?.discord_user_id ?? null,
    email,
    hasPassword: profile?.has_password ?? false,
    isAdmin: profile?.is_admin ?? false,
  };
}

/** Current session, deduped per-render via React `cache()`. */
export const getSession = cache(_getSession);

/**
 * Validate a `next` redirect target. Only internal paths starting with a single
 * leading slash are allowed, to prevent open-redirect abuse via auth callbacks.
 */
export function sanitizeNext(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
