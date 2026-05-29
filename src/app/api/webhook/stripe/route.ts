import Stripe from "stripe";
import { NextResponse } from "next/server";
import { addPremiumRole, removePremiumRole } from "@/lib/discord";
import { creditLedger } from "@/lib/wb/ledger";
import { WB_PER_USD } from "@/lib/wb/purchase";
import { pendingReferralFor, markReferralRewarded } from "@/lib/wb/referrals";
import { pushNotification } from "@/lib/wb/notifications";

// Both parties get this when a referred user converts to Premium.
const REFERRAL_REWARD_WB_CENTS = 5000; // $50 WB

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Split a comma-separated STRIPE_WEBHOOK_SECRET into individual secrets. */
function parseSecrets(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Non-reversible hint for logs — enough to tell endpoints apart, never the value. */
function maskSecret(s: string): string {
  return `${s.slice(0, 9)}…(len=${s.length},whsec=${s.startsWith("whsec_")})`;
}

/**
 * Verify the payload against each configured signing secret, returning the
 * first that validates. Supporting a comma-separated STRIPE_WEBHOOK_SECRET
 * means a rotated or duplicate (live + test) endpoint keeps working during a
 * transition instead of silently 400-ing every event.
 */
function constructEventFromAnySecret(
  stripe: Stripe,
  raw: string,
  sig: string,
  secrets: string[],
): Stripe.Event {
  let lastErr: unknown;
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(raw, sig, secret);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("No webhook signing secret configured");
}

export async function POST(req: Request) {
  const secrets = parseSecrets(process.env.STRIPE_WEBHOOK_SECRET);
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (secrets.length === 0 || !stripeKey) {
    return new NextResponse("Server not configured for Stripe webhooks.", { status: 500 });
  }

  const stripe = new Stripe(stripeKey);
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = constructEventFromAnySecret(stripe, raw, sig ?? "", secrets);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid";
    console.error(
      "Stripe signature verification failed:",
      JSON.stringify({
        msg,
        secrets_tried: secrets.length,
        secret_hints: secrets.map(maskSecret),
        has_signature_header: Boolean(sig),
        raw_body_len: raw.length,
      }),
    );
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
              memo: `Bought $${Math.round(wbCents / 100).toLocaleString("en-US")} of Whoosh Bucks`,
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

        // Referral reward — fires once per referred user, on first Premium sub.
        try {
          const pending = await pendingReferralFor(userId);
          if (pending) {
            const username = session.metadata?.discord_username ?? "";
            await creditLedger({
              discordUserId: userId,
              discordUsername: username,
              amountCents: REFERRAL_REWARD_WB_CENTS,
              kind: "referral_reward",
              refKind: "referral",
              refId: `referred:${userId}`,
              memo: `Welcome bonus from referral code ${pending.code}`,
            });
            await creditLedger({
              discordUserId: pending.referrerId,
              discordUsername: "",
              amountCents: REFERRAL_REWARD_WB_CENTS,
              kind: "referral_reward",
              refKind: "referral",
              refId: `referrer:${userId}`,
              memo: `Referral bonus — @${username || userId} joined Premium`,
            });
            await markReferralRewarded(userId, REFERRAL_REWARD_WB_CENTS);
            await pushNotification({
              userId: pending.referrerId,
              kind: "referral",
              title: "Referral cashed in",
              body: `@${username || "Someone"} joined Premium with your code — $${(REFERRAL_REWARD_WB_CENTS / 100).toFixed(2)} WB added.`,
              href: "/wallet",
            }).catch(() => {});
            await pushNotification({
              userId,
              kind: "referral",
              title: "Welcome bonus credited",
              body: `Thanks for using a referral code — $${(REFERRAL_REWARD_WB_CENTS / 100).toFixed(2)} WB added to your wallet.`,
              href: "/wallet",
            }).catch(() => {});
          }
        } catch (e) {
          console.warn("Referral reward failed (non-fatal):", e);
        }
        break;
      }
      case "invoice.paid": {
        // Premium match: credit WB equal to the invoice amount for any
        // subscription invoice that maps back to a Discord user. Forward-only —
        // past invoices are not replayed.
        //
        // The invoice's shape depends on the Stripe account/endpoint API
        // version (constructEvent does NOT reshape the payload), so resolve the
        // subscription across both shapes:
        //   - newer (>=2025-03-31.basil): invoice.parent.subscription_details
        //   - older: top-level invoice.subscription (string id)
        // Then read discord_user_id from the metadata snapshot, falling back to
        // fetching the subscription if the snapshot doesn't carry it.
        const invoice = event.data.object as Stripe.Invoice;

        let subscriptionId: string | undefined;
        let subMeta: Record<string, string> = {};

        const parent = (invoice as { parent?: Stripe.Invoice.Parent | null }).parent ?? null;
        if (parent?.type === "subscription_details" && parent.subscription_details) {
          const sd = parent.subscription_details;
          subscriptionId =
            typeof sd.subscription === "string" ? sd.subscription : sd.subscription?.id;
          subMeta = (sd.metadata ?? {}) as Record<string, string>;
        } else {
          const legacy = (invoice as { subscription?: string | { id: string } }).subscription;
          subscriptionId = typeof legacy === "string" ? legacy : legacy?.id;
        }

        // Subscription invoice but no metadata snapshot → fetch the live sub.
        if (subscriptionId && !subMeta.discord_user_id) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            subMeta = (sub.metadata ?? {}) as Record<string, string>;
          } catch (e) {
            console.warn("invoice.paid: failed to fetch subscription", subscriptionId, e);
          }
        }

        const userId =
          (invoice.metadata?.discord_user_id as string | undefined) ?? subMeta.discord_user_id;
        const username =
          (invoice.metadata?.discord_username as string | undefined) ??
          subMeta.discord_username ??
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
