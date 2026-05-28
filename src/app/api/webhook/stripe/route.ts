import Stripe from "stripe";
import { NextResponse } from "next/server";
import { addPremiumRole, removePremiumRole } from "@/lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !stripeKey) {
    return new NextResponse("Server not configured for Stripe webhooks.", { status: 500 });
  }

  const stripe = new Stripe(stripeKey);
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid";
    console.error("Stripe signature verification failed:", msg);
    return new NextResponse(`Bad signature: ${msg}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.discord_user_id;
        if (!userId) {
          console.warn("checkout.session.completed without discord_user_id metadata", session.id);
          break;
        }
        const res = await addPremiumRole(userId);
        if (!res.ok) {
          console.error(
            `Failed to grant Premium role to ${userId} (session=${session.id}): ${res.status} ${res.body ?? ""}`,
          );
          // 4xx (e.g. user not in guild) → don't ask Stripe to retry.
          // 5xx → return 500 so Stripe retries.
          if (res.status >= 500) {
            return new NextResponse("Discord transient error", { status: 500 });
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.discord_user_id;
        if (!userId) {
          console.warn("subscription.deleted without discord_user_id metadata", sub.id);
          break;
        }
        const res = await removePremiumRole(userId);
        if (!res.ok && res.status >= 500) {
          console.error(`Failed to revoke role from ${userId}: ${res.status} ${res.body ?? ""}`);
          return new NextResponse("Discord transient error", { status: 500 });
        }
        break;
      }
      default:
        // Ignore other event types.
        break;
    }
  } catch (e) {
    console.error("Webhook handler error:", e);
    return new NextResponse("Handler error", { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
