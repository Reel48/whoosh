import { NextResponse } from "next/server";
import { createLeagueGroupCheckoutUrl } from "@/lib/fantasy/checkout";
import { jsonError, jsonOk, readJson, requireBearerSession } from "@/lib/api/json";
import type { CheckoutUrlResponse, FantasyCheckoutRequest } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start a fantasy league-group entry-fee purchase. Returns a hosted Stripe
 * Checkout URL the iOS app opens in the browser; the webhook seats the buyer +
 * credits the WB match on completion. Reuses `createLeagueGroupCheckoutUrl`.
 *
 * Note: real-money fantasy entry draws extra App Review scrutiny regardless of
 * payment method — its availability on iOS is gated separately via the
 * `real_money_fantasy` capability (src/lib/api/client.ts).
 */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const body = await readJson<FantasyCheckoutRequest>(req);
  const groupKey = String(body?.groupKey ?? "").trim();
  if (!groupKey) return jsonError("validation", "groupKey is required.");

  try {
    const url = await createLeagueGroupCheckoutUrl({
      groupKey,
      userId: session.id,
      username: session.username,
    });
    return jsonOk<CheckoutUrlResponse>({ url });
  } catch (e) {
    return jsonError("validation", e instanceof Error ? e.message : "Checkout creation failed.");
  }
}
