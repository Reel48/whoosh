import Stripe from "stripe";
import { NextResponse } from "next/server";
import { addPremiumRole, removePremiumRole } from "@/lib/discord";
import { creditLedger } from "@/lib/wb/ledger";
import { WB_PER_USD } from "@/lib/wb/purchase";

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

        // Whoosh Bucks one-time purchase — credit ledger, do NOT grant Premium.
        if (session.metadata?.kind === "wb_purchase") {
          const wbCents = Number(session.metadata.wb_cents ?? session.amount_total ?? 0);
          const username = session.metadata.discord_username ?? "";
          if (wbCents > 0) {
            await creditLedger({
              discordUserId: userId,
              discordUsername: username,
              amountCents: wbCents,
              kind: "purchase",
              refKind: "stripe_event",
              refId: event.id,
              memo: `Bought ${Math.round(wbCents / 100).toLocaleString("en-US")} WB`,
              metadata: { session_id: session.id },
            });
          } else {
            console.warn("wb_purchase checkout had no wb_cents", session.id);
          }
          break;
        }

        // Subscription checkout → grant Premium role (existing behavior).
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
      case "invoice.paid": {
        // Premium match: credit WB equal to the invoice amount for any
        // subscription invoice that carries discord_user_id in its
        // subscription metadata snapshot. Forward-only — past invoices
        // are not replayed. (Stripe v22+ exposes subscription via
        // `parent.subscription_details`.)
        const invoice = event.data.object as Stripe.Invoice;
        const subDetails =
          invoice.parent?.type === "subscription_details"
            ? invoice.parent.subscription_details
            : null;
        if (!subDetails) break;
        const subMeta = subDetails.metadata ?? {};
        const subscriptionId =
          typeof subDetails.subscription === "string"
            ? subDetails.subscription
            : subDetails.subscription?.id;
        const userId =
          (invoice.metadata?.discord_user_id as string | undefined) ??
          (subMeta.discord_user_id as string | undefined);
        const username =
          (invoice.metadata?.discord_username as string | undefined) ??
          (subMeta.discord_username as string | undefined) ??
          "";
        if (!userId) {
          console.warn("invoice.paid without discord_user_id metadata", invoice.id);
          break;
        }
        const usdCents = invoice.amount_paid ?? 0;
        if (usdCents <= 0) break;
        // 1 USD = WB_PER_USD WB → scale invoice USD cents up to WB cents.
        const wbCents = usdCents * WB_PER_USD;
        await creditLedger({
          discordUserId: userId,
          discordUsername: username,
          amountCents: wbCents,
          kind: "premium_match",
          refKind: "stripe_event",
          refId: event.id,
          memo: `Premium match for invoice ${invoice.id}`,
          metadata: { invoice_id: invoice.id, subscription_id: subscriptionId, usd_cents: usdCents },
        });
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
