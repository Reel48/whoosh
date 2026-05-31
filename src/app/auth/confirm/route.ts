import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { syncDiscordIdentityAndClaim } from "@/lib/auth";
import { sanitizeNext } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Email confirmation + password-recovery link handler. Supabase emails link
 * here with a `token_hash` + `type`; we verify the OTP (which establishes the
 * session) and bounce to `next`.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNext(url.searchParams.get("next"));

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?error=invalid_confirmation", req.url));
  }

  const sb = await createServerSupabase();
  const { data, error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=confirmation_failed", req.url));
  }

  await syncDiscordIdentityAndClaim(data.user.id).catch(() => {});

  return NextResponse.redirect(new URL(next, req.url));
}
