import { cache } from "react";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { hasPremiumRole } from "@/lib/discord";
import { findSubscriptionForUser } from "@/lib/stripe";
import { getLinkedDiscordId } from "@/lib/auth";
import { getSession, type Session } from "@/lib/session";

/**
 * Tag for the cross-request premium-decision cache. The Stripe webhook calls
 * `revalidateTag(PREMIUM_CACHE_TAG)` after a role grant/revoke so a brand-new
 * subscriber (or a just-canceled one) sees the change on their next request
 * instead of waiting out the TTL.
 */
export const PREMIUM_CACHE_TAG = "membership:premium";

/**
 * Single source of truth for "is this user a Whoosh Premium member?"
 *
 * Premium is now a *perk* tier, not a gate. The argument is the app user id.
 * If the user has linked a Discord account, the fast Discord-role check applies
 * (cached 5 min via fetchGuildMember). Otherwise — or if the role hasn't been
 * granted yet — fall back to a Stripe subscription lookup keyed by `user_id`.
 */
async function _isPremium(userId: string): Promise<boolean> {
  let discordId: string | null = null;
  try {
    discordId = await getLinkedDiscordId(userId);
    if (discordId && (await hasPremiumRole(discordId))) return true;
  } catch {
    // Discord may be down or unlinked — fall through to Stripe.
  }
  try {
    // Pass the linked Discord id so legacy subs (keyed by discord_user_id only)
    // are still recognized.
    const sub = await findSubscriptionForUser(userId, discordId);
    return sub?.status === "active" || sub?.status === "trialing";
  } catch {
    return false;
  }
}

/**
 * The premium decision is read on signed-in surfaces that show perk messaging
 * (and the old hot path). Layer a 60s cross-request cache (keyed per-userId by
 * `unstable_cache`) over the live check, tagged so the webhook can invalidate
 * it on a grant/revoke. React `cache()` on top dedups call sites within a
 * single render.
 */
const _isPremiumCached = unstable_cache(_isPremium, ["membership:premium"], {
  revalidate: 60,
  tags: [PREMIUM_CACHE_TAG],
});

export const isPremium = cache(_isPremiumCached);

/**
 * Sign-in gate for the whole signed-in app. Premium is no longer required to
 * enter any section — only an account. Sends anonymous visitors to the login
 * page and back to where they were headed.
 */
export async function requireSession(next = "/home"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session;
}
