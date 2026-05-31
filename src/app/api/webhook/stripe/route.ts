import Stripe from "stripe";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { addPremiumRole, removePremiumRole, GUILD_MEMBER_CACHE_TAG } from "@/lib/discord";
import { PREMIUM_CACHE_TAG } from "@/lib/membership";
import { creditLedger } from "@/lib/wb/ledger";
import { creditCheckoutSession, creditInvoicePremiumMatch } from "@/lib/wb/stripeCredits";
import { pendingReferralFor, markReferralRewarded } from "@/lib/wb/referrals";
import { pushNotification } from "@/lib/wb/notifications";
import { assignEntitlement } from "@/lib/fantasy/entitlements";

// Both parties get this when a referred user converts to Premium.
const REFERRAL_REWARD_WB_CENTS = 5000; // $50 WB

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Drop the cached premium decision (and the guild-member read it leans on) so a
 * just-granted or just-revoked member sees the change on their next request
 * rather than waiting out the cache TTL.
 */
function invalidatePremiumCaches() {
  // `{ expire: 0 }` = immediate expiration, the documented pattern for a webhook
  // (a third-party caller) that needs the next request to see fresh data rather
  // than stale-while-revalidate.
  revalidateTag(PREMIUM_CACHE_TAG, { expire: 0 });
  revalidateTag(GUILD_MEMBER_CACHE_TAG, { expire: 0 });
}

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
        // Idempotent + amount recomputed from amount_total in the shared helper.
        if (session.metadata?.kind === "wb_purchase") {
          const r = await creditCheckoutSession(stripe, session);
          if (!r.credited && r.reason && r.reason !== "duplicate") {
            console.warn("wb_purchase not credited", session.id, r.reason);
          }
          break;
        }

        // Fantasy league buy-in (one-time) → seat the buyer in a league within
        // the purchased group. Idempotent via the DB function (dedupes on the
        // checkout session id), so the success-page finalizer can race this
        // safely. Does NOT grant the Premium role — league access is standalone.
        if (session.metadata?.kind === "league_entry") {
          const groupKey = session.metadata.group_key;
          const season = session.metadata.season;
          const username = session.metadata.discord_username ?? "";
          if (!groupKey || !season) {
            console.warn("league_entry checkout missing group_key/season", session.id);
            break;
          }
          const paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null;
          const ent = await assignEntitlement({
            discordUserId: userId,
            discordUsername: username,
            groupKey,
            season,
            amountCents: session.amount_total ?? 0,
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
          });
          if (ent?.status === "active" && ent.assignedLeagueId) {
            await pushNotification({
              userId,
              kind: "system",
              title: "You're in!",
              body: "Your league spot is confirmed — open it to grab your Sleeper invite.",
              href: `/fantasy/leagues/${ent.assignedLeagueId}`,
              metadata: { session_id: session.id, group_key: groupKey },
            }).catch(() => {});
          } else {
            // group full → seated as `unassigned`; commissioner resolves manually.
            await pushNotification({
              userId,
              kind: "system",
              title: "Payment received",
              body: "Your buy-in is in. We're finalizing your league spot and will follow up shortly.",
              href: "/fantasy/leagues",
              metadata: { session_id: session.id, group_key: groupKey, status: ent?.status ?? "unknown" },
            }).catch(() => {});
            console.warn(`league_entry could not seat ${userId} in group ${groupKey} (${ent?.status})`);
          }
          // Fantasy WB match (2.5 WB per $1) — credited regardless of seating,
          // since they paid. Idempotent by checkout session id.
          await creditCheckoutSession(stripe, session).catch((e) =>
            console.warn("league_entry WB credit failed (non-fatal)", session.id, e),
          );
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
        // Premium just became active (role granted, or recognizable via the
        // now-active Stripe sub) — refresh the cached decision immediately.
        invalidatePremiumCaches();

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
              href: "/capital/wallet",
            }).catch(() => {});
            await pushNotification({
              userId,
              kind: "referral",
              title: "Welcome bonus credited",
              body: `Thanks for using a referral code — $${(REFERRAL_REWARD_WB_CENTS / 100).toFixed(2)} WB added to your wallet.`,
              href: "/capital/wallet",
            }).catch(() => {});
          }
        } catch (e) {
          console.warn("Referral reward failed (non-fatal):", e);
        }
        break;
      }
      case "invoice.paid": {
        // Premium match: 10 WB per $1 on every paid subscription invoice (first
        // payment AND renewals). Resolution + crediting live in the shared
        // helper, idempotent by invoice id and reused by the reconciler.
        const invoice = event.data.object as Stripe.Invoice;
        const r = await creditInvoicePremiumMatch(stripe, invoice);
        if (!r.credited && r.reason && r.reason !== "duplicate") {
          console.warn("invoice.paid not credited", invoice.id, r.reason);
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
        invalidatePremiumCaches();
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
