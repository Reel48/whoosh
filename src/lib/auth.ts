import "server-only";
import { supabase } from "@/lib/supabase";

/**
 * Server-side profile + account-link helpers, built on the service-role client.
 *
 * The session read (`@/lib/session`) is intentionally pure — these are the
 * mutating counterparts, called from the auth callback and the /account link
 * action: ensure a profile exists, sync a linked Discord identity onto it, and
 * claim any legacy (Discord-keyed) wallet for the new account id.
 */

export type ProfileRow = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  discordUserId: string | null;
  stripeCustomerId: string | null;
  hasPassword: boolean;
  isAdmin: boolean;
};

function shape(r: {
  user_id: string;
  username: string;
  avatar_url: string | null;
  discord_user_id: string | null;
  stripe_customer_id: string | null;
  has_password: boolean;
  is_admin: boolean;
}): ProfileRow {
  return {
    userId: r.user_id,
    username: r.username,
    avatarUrl: r.avatar_url,
    discordUserId: r.discord_user_id,
    stripeCustomerId: r.stripe_customer_id,
    hasPassword: r.has_password,
    isAdmin: r.is_admin,
  };
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase()
    .from("profile")
    .select("user_id, username, avatar_url, discord_user_id, stripe_customer_id, has_password, is_admin")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`getProfile failed: ${error.message}`);
  return data ? shape(data) : null;
}

export type AuthMethods = {
  hasDiscord: boolean;
  hasPassword: boolean;
  email: string | null;
  emailVerified: boolean;
};

/**
 * Which sign-in methods an account has wired up — drives the /account
 * "Sign-in methods" card. Reads the auth user (email + verification) via the
 * admin API and the password flag off the profile.
 */
export async function getAuthMethods(userId: string): Promise<AuthMethods> {
  const [{ data }, profile] = await Promise.all([
    supabase().auth.admin.getUserById(userId),
    getProfile(userId),
  ]);
  const user = data?.user;
  return {
    hasDiscord: Boolean(user?.identities?.some((i) => i.provider === "discord")) || Boolean(profile?.discordUserId),
    hasPassword: profile?.hasPassword ?? false,
    email: user?.email ?? null,
    emailVerified: Boolean(user?.email_confirmed_at),
  };
}

/** Flip the has_password flag after a password is set. */
export async function setHasPassword(userId: string, value: boolean): Promise<void> {
  const { error } = await supabase().from("profile").update({ has_password: value }).eq("user_id", userId);
  if (error) throw new Error(`setHasPassword failed: ${error.message}`);
}

/**
 * Persist a new handle to both profile.username and the wallet row that the
 * leaderboard + transfer-by-handle read. Returns `{ taken: true }` on a
 * case-insensitive collision (the unique index is the source of truth).
 */
export async function persistHandle(
  userId: string,
  handle: string,
): Promise<{ ok: true } | { ok: false; taken: boolean; message: string }> {
  const { error } = await supabase().from("profile").update({ username: handle }).eq("user_id", userId);
  if (error) {
    // 23505 = unique_violation (case-insensitive index on lower(username)).
    if (error.code === "23505") return { ok: false, taken: true, message: "That handle is taken." };
    return { ok: false, taken: false, message: error.message };
  }
  // Keep the wallet display name in sync so leaderboards + findRecipient match.
  // Best-effort: the wallet may not exist yet (created lazily by ensureWallet).
  await supabase().from("wallet").update({ discord_username: handle }).eq("discord_user_id", userId);
  return { ok: true };
}

/** The Discord snowflake linked to this account, or null. */
export async function getLinkedDiscordId(userId: string): Promise<string | null> {
  const { data, error } = await supabase()
    .from("profile")
    .select("discord_user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`getLinkedDiscordId failed: ${error.message}`);
  return data?.discord_user_id ?? null;
}

/** Persist the Stripe customer id onto the profile (idempotent). */
export async function setStripeCustomerId(userId: string, customerId: string): Promise<void> {
  const { error } = await supabase()
    .from("profile")
    .update({ stripe_customer_id: customerId })
    .eq("user_id", userId);
  if (error) throw new Error(`setStripeCustomerId failed: ${error.message}`);
}

type DiscordLink = { discordUserId: string; username: string | null; avatarUrl: string | null };

/** Pull the Discord identity (if any) off the auth user via the admin API. */
async function readDiscordIdentity(userId: string): Promise<DiscordLink | null> {
  const { data, error } = await supabase().auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  const identity = data.user.identities?.find((i) => i.provider === "discord");
  if (!identity) return null;
  const d = (identity.identity_data ?? {}) as Record<string, unknown>;
  const discordUserId =
    (d.provider_id as string | undefined) ??
    (d.sub as string | undefined) ??
    identity.id;
  if (!discordUserId) return null;
  return {
    discordUserId,
    username:
      (d.global_name as string | undefined) ??
      (d.full_name as string | undefined) ??
      (d.name as string | undefined) ??
      (d.user_name as string | undefined) ??
      null,
    avatarUrl: (d.avatar_url as string | undefined) ?? (d.picture as string | undefined) ?? null,
  };
}

/**
 * After a Discord sign-in or an /account link, record the Discord id on the
 * profile and claim any legacy wallet that was keyed by that Discord id.
 *
 * Idempotent and safe to call on every Discord-authenticated callback. Returns
 * the linked Discord id (or null if this account has no Discord identity).
 */
export async function syncDiscordIdentityAndClaim(userId: string): Promise<string | null> {
  const link = await readDiscordIdentity(userId);
  if (!link) return null;

  // Fill display fields only when the profile doesn't already have them, so a
  // user's chosen handle/avatar isn't clobbered on a later re-link.
  const existing = await getProfile(userId);
  const patch: { discord_user_id: string; avatar_url?: string } = {
    discord_user_id: link.discordUserId,
  };
  if (existing && !existing.avatarUrl && link.avatarUrl) {
    patch.avatar_url = link.avatarUrl;
  }
  const { error } = await supabase().from("profile").update(patch).eq("user_id", userId);
  if (error) throw new Error(`syncDiscordIdentity failed: ${error.message}`);

  // Re-key any legacy Discord-keyed wallet to this account. No-op when there's
  // nothing to claim or the account already has a wallet.
  const { error: claimErr } = await supabase().rpc("claim_legacy_wallet", {
    p_discord_user_id: link.discordUserId,
    p_new_user_id: userId,
  });
  if (claimErr) {
    // Non-fatal: the link still succeeded; log for follow-up.
    console.warn(`claim_legacy_wallet failed for ${userId}:`, claimErr.message);
  }

  return link.discordUserId;
}
