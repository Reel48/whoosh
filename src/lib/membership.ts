import { cache } from "react";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { hasPremiumRole } from "@/lib/discord";
import { findSubscriptionForDiscordUser } from "@/lib/stripe";
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
 * Checks the Discord Premium role first (fast — fetchGuildMember is
 * cached for 5 min via unstable_cache). If the role isn't granted yet
 * (e.g. brand-new subscriber whose webhook hasn't fired or whose Discord
 * grant is still propagating), falls back to a Stripe subscription
 * lookup so they're treated as premium immediately on checkout success.
 */
async function _isPremium(userId: string): Promise<boolean> {
  try {
    if (await hasPremiumRole(userId)) return true;
  } catch {
    // Discord may be down — fall through to Stripe.
  }
  try {
    const sub = await findSubscriptionForDiscordUser(userId);
    return sub?.status === "active" || sub?.status === "trialing";
  } catch {
    return false;
  }
}

/**
 * The premium decision is read on every signed-in app navigation (each section
 * `layout.tsx`). Without a cache, users whose Premium role isn't granted yet
 * hit the uncached Stripe Search API on every page load. Layer a 60s
 * cross-request cache (keyed per-userId by `unstable_cache`) over the live
 * check, tagged so the webhook can invalidate it on a grant/revoke. The
 * staleness window (≤60s) is tighter than the existing 5-min guild-member
 * cache, so this never widens the access window. React `cache()` on top dedups
 * the multiple call sites within a single render.
 */
const _isPremiumCached = unstable_cache(_isPremium, ["membership:premium"], {
  revalidate: 60,
  tags: [PREMIUM_CACHE_TAG],
});

export const isPremium = cache(_isPremiumCached);

/**
 * Gate for signed-in app sections. Returns the session for a premium member,
 * or redirects to the marketing landing (which itself bounces premium users
 * back to /home, so anon + non-premium land on the page that sells a sub).
 *
 * Used once per section `layout.tsx` so the page bodies don't each repeat the
 * getSession + isPremium + redirect dance.
 */
export async function requirePremiumSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/");
  if (!(await isPremium(session.id))) redirect("/");
  return session;
}

/**
 * Sign-in-only gate for sections that don't require Premium (e.g. Fantasy,
 * where access is sold per-league). Sends anonymous visitors through Discord
 * OAuth and back to where they were headed.
 */
export async function requireSession(next = "/home"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/api/auth/discord?next=${encodeURIComponent(next)}`);
  return session;
}
