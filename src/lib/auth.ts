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
  isAdmin: boolean;
};

function shape(r: {
  user_id: string;
  username: string;
  avatar_url: string | null;
  discord_user_id: string | null;
  stripe_customer_id: string | null;
  is_admin: boolean;
}): ProfileRow {
  return {
    userId: r.user_id,
    username: r.username,
    avatarUrl: r.avatar_url,
    discordUserId: r.discord_user_id,
    stripeCustomerId: r.stripe_customer_id,
    isAdmin: r.is_admin,
  };
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase()
    .from("profile")
    .select("user_id, username, avatar_url, discord_user_id, stripe_customer_id, is_admin")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`getProfile failed: ${error.message}`);
  return data ? shape(data) : null;
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
