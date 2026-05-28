import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, fetchDiscordUser } from "@/lib/discord";
import { consumeOAuthState, setSession } from "@/lib/session";
import { ensureWallet } from "@/lib/wb/ledger";
import { recordReferralUse } from "@/lib/wb/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originFor(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  return new URL(req.url).origin;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?error=oauth_missing", req.url));
  }

  const consumed = await consumeOAuthState(state);
  if (!consumed) {
    return NextResponse.redirect(new URL("/?error=oauth_state", req.url));
  }

  const redirectUri = `${originFor(req)}/api/auth/discord/callback`;

  try {
    const tok = await exchangeCode(code, redirectUri);
    const user = await fetchDiscordUser(tok.access_token);
    const username = user.global_name?.trim() || user.username;
    await setSession({
      id: user.id,
      username,
      avatar: user.avatar ?? null,
    });

    // Best-effort: if a referral cookie is set and this user doesn't already
    // have a wallet (i.e. signing in for the first time), record the referral
    // attribution. The reward fires later — on first Stripe sub.
    try {
      const jar = await cookies();
      const ref = jar.get("whoosh_ref")?.value;
      if (ref) {
        await ensureWallet(user.id, username);
        const result = await recordReferralUse(user.id, ref);
        if (result.created) {
          jar.delete("whoosh_ref");
        }
      }
    } catch (e) {
      console.warn("referral attribution failed (non-fatal):", e);
    }
  } catch (e) {
    console.error("Discord OAuth callback failed:", e);
    return NextResponse.redirect(new URL("/?error=oauth_failed", req.url));
  }

  return NextResponse.redirect(new URL(consumed.next || "/account", req.url));
}
