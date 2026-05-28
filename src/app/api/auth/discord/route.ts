import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/discord";
import { sanitizeNext, setOAuthState } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originFor(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  return new URL(req.url).origin;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  // `next` is the page to return to after auth. Also accept legacy `intent` for
  // any in-flight Subscribe-triggered redirects from old deploys.
  const raw =
    url.searchParams.get("next") ??
    (url.searchParams.get("intent") &&
      `/api/checkout?interval=${encodeURIComponent(url.searchParams.get("intent")!)}`) ??
    "/account";
  const next = sanitizeNext(raw);
  const state = await setOAuthState(next);
  const redirectUri = `${originFor(req)}/api/auth/discord/callback`;
  return NextResponse.redirect(authorizeUrl(redirectUri, state));
}
