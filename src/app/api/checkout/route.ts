import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createCheckoutSessionUrl } from "@/lib/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resumption endpoint hit after the OAuth callback. Reads the saved Discord
 * session, builds the Stripe Checkout Session for the chosen interval, and
 * redirects to Stripe's hosted page. If somehow the session is missing,
 * bounces back through OAuth.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const interval = url.searchParams.get("interval") ?? "";

  const session = await getSession();
  if (!session) {
    const next = `/api/checkout?interval=${encodeURIComponent(interval)}`;
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(next)}`, req.url),
    );
  }

  try {
    const checkoutUrl = await createCheckoutSessionUrl({
      interval,
      userId: session.id,
      username: session.username,
    });
    return NextResponse.redirect(checkoutUrl);
  } catch (e) {
    console.error("Checkout creation failed:", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(msg)}`, req.url));
  }
}
