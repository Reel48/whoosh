import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { syncDiscordIdentityAndClaim, getProfile } from "@/lib/auth";
import { sanitizeNext } from "@/lib/session";
import { ensureWallet } from "@/lib/wb/ledger";
import { recordReferralUse } from "@/lib/wb/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth + magic-link callback. Exchanges the auth code for a session, then:
 *  - links any Discord identity onto the profile and claims a legacy wallet,
 *  - applies pending referral attribution (the `whoosh_ref` cookie), which used
 *    to live in the old Discord callback.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.url));
  }

  const sb = await createServerSupabase();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }

  const userId = data.user.id;

  // Link Discord (if this was a Discord sign-in) + claim any legacy wallet.
  await syncDiscordIdentityAndClaim(userId).catch((e) =>
    console.warn("syncDiscordIdentityAndClaim failed (non-fatal):", e),
  );

  // Referral attribution — best effort, mirrors the old Discord callback.
  try {
    const jar = await cookies();
    const ref = jar.get("whoosh_ref")?.value;
    if (ref) {
      const profile = await getProfile(userId);
      await ensureWallet(userId, profile?.username ?? "member");
      const result = await recordReferralUse(userId, ref);
      if (result.created) jar.delete("whoosh_ref");
    }
  } catch (e) {
    console.warn("referral attribution failed (non-fatal):", e);
  }

  return NextResponse.redirect(new URL(next, req.url));
}
