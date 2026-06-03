import { NextResponse } from "next/server";
import { getAuthMethods } from "@/lib/auth";
import { getReferralStats } from "@/lib/wb/referrals";
import { listEarned } from "@/lib/wb/achievements";
import { isOnboarded } from "@/lib/profile";
import { isPremium } from "@/lib/membership";
import { jsonOk, requireBearerSession } from "@/lib/api/json";
import type { AccountResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Account screen data: identity (already on the session), auth methods,
 * referral stats, and earned achievements. Mirrors what `src/app/account/page.tsx`
 * loads server-side.
 */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const [auth, referrals, achievements, onboarded, premium] = await Promise.all([
    getAuthMethods(session.id),
    getReferralStats(session.id),
    listEarned(session.id),
    isOnboarded(session.id),
    isPremium(session.id).catch(() => false),
  ]);

  return jsonOk<AccountResponse>({
    id: session.id,
    username: session.username,
    avatarUrl: session.avatarUrl,
    discordUserId: session.discordUserId,
    isAdmin: session.isAdmin,
    onboarded,
    premium,
    auth,
    referrals,
    achievements,
  });
}
