import { NextResponse } from "next/server";
import { createPortalUrl, findSubscriptionForUser } from "@/lib/stripe";
import { jsonError, jsonOk, requireBearerSession } from "@/lib/api/json";
import type { CheckoutUrlResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originFor(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  return (env ? env : new URL(req.url).origin).replace(/\/+$/, "");
}

/**
 * Return a Stripe Billing Portal URL for managing/cancelling the subscription,
 * for the iOS app to open in the browser. Mirrors `POST /api/portal`.
 */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const sub = await findSubscriptionForUser(session.id, session.discordUserId);
  if (!sub) return jsonError("not_found", "No active subscription to manage.");

  try {
    const url = await createPortalUrl(sub.customerId, `${originFor(req)}/account`);
    return jsonOk<CheckoutUrlResponse>({ url });
  } catch (e) {
    return jsonError("internal", e instanceof Error ? e.message : "Could not open billing portal.");
  }
}
