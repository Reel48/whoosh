import { NextResponse } from "next/server";
import { createCheckoutSessionUrl } from "@/lib/checkout";
import { jsonError, jsonOk, readJson, requireBearerSession } from "@/lib/api/json";
import type { CheckoutUrlResponse, SubscribeRequest } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTERVALS = new Set(["monthly", "six_months", "annual"]);

/**
 * Start a premium subscription. Returns a hosted Stripe Checkout URL the iOS app
 * opens in the browser; the existing Stripe webhook grants premium on
 * completion. JSON re-shell of `GET /api/checkout`.
 */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const body = await readJson<SubscribeRequest>(req);
  if (!body || !INTERVALS.has(body.interval)) {
    return jsonError("validation", "interval must be monthly, six_months, or annual.");
  }

  try {
    const url = await createCheckoutSessionUrl({
      interval: body.interval,
      userId: session.id,
      username: session.username,
    });
    return jsonOk<CheckoutUrlResponse>({ url });
  } catch (e) {
    return jsonError("validation", e instanceof Error ? e.message : "Checkout creation failed.");
  }
}
