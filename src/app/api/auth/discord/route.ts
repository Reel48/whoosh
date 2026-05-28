import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/discord";
import { setOAuthState } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originFor(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  return new URL(req.url).origin;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const intent = url.searchParams.get("intent") ?? "";
  const state = await setOAuthState(intent);
  const redirectUri = `${originFor(req)}/api/auth/discord/callback`;
  return NextResponse.redirect(authorizeUrl(redirectUri, state));
}
