import { cache } from "react";
import { redirect } from "next/navigation";
import { hasPremiumRole } from "@/lib/discord";
import { findSubscriptionForDiscordUser } from "@/lib/stripe";
import { getSession, type Session } from "@/lib/session";

/**
 * Single source of truth for "is this user a Whoosh Premium member?"
 *
 * Checks the Discord Premium role first (fast — fetchGuildMember is
 * cached for 5 min via unstable_cache). If the role isn't granted yet
 * (e.g. brand-new subscriber whose webhook hasn't fired or whose Discord
 * grant is still propagating), falls back to a Stripe subscription
 * lookup so they're treated as premium immediately on checkout success.
 *
 * Wrapped in `react cache()` so multiple call sites within one render
 * (e.g. Nav + page) share a single result.
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

export const isPremium = cache(_isPremium);

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
