import { NextResponse } from "next/server";
import { createWbPurchaseCheckoutUrl } from "@/lib/wb/purchase";
import { jsonError, jsonOk, readJson, requireBearerSession } from "@/lib/api/json";
import type { BuyWbRequest, CheckoutUrlResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start a Whoosh Bucks purchase. Returns a hosted Stripe Checkout URL the iOS
 * app opens in the browser (Apple External Purchase Link); the existing Stripe
 * webhook credits the WB on completion. JSON re-shell of `POST /api/wb/buy`.
 */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const body = await readJson<BuyWbRequest>(req);
  if (!body) return jsonError("validation", "Request body must be valid JSON.");

  const amountCents =
    body.amountCents ??
    (typeof body.amount === "number" ? Math.round(body.amount * 100) : null);
  if (!amountCents || !Number.isFinite(amountCents) || amountCents <= 0) {
    return jsonError("validation", "Enter a positive USD amount.");
  }

  try {
    const url = await createWbPurchaseCheckoutUrl({
      amountCents,
      userId: session.id,
      username: session.username,
    });
    return jsonOk<CheckoutUrlResponse>({ url });
  } catch (e) {
    return jsonError("validation", e instanceof Error ? e.message : "Checkout creation failed.");
  }
}
