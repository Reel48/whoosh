import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createPortalUrl, findSubscriptionForUser } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originFor(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  return new URL(req.url).origin;
}

async function handle(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      new URL("/login?next=/account", req.url),
    );
  }

  const sub = await findSubscriptionForUser(session.id);
  if (!sub) {
    return NextResponse.redirect(new URL("/account?error=no_subscription", req.url));
  }

  try {
    const url = await createPortalUrl(sub.customerId, `${originFor(req)}/account`);
    return NextResponse.redirect(url, { status: 303 });
  } catch (e) {
    console.error("Stripe portal session failed:", e);
    return NextResponse.redirect(new URL("/account?error=portal_failed", req.url));
  }
}

export const POST = handle;
export const GET = handle;
