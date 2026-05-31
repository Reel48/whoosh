import Stripe from "stripe";
import { creditLedger } from "@/lib/wb/ledger";

/**
 * Single source of truth for turning a paid Stripe object into a Whoosh Bucks
 * credit. Used by BOTH the live webhook (instant) and the reconciler (safety
 * net), so crediting is independent of any single webhook delivery succeeding.
 *
 * Idempotency is keyed on the Stripe OBJECT id (invoice id / checkout session
 * id) — not the event id — so the webhook and the reconciler converge on the
 * same ledger row and never double-credit. `fn_credit_ledger` no-ops on a
 * duplicate (ref_kind, ref_id).
 *
 * Rates (1 WB = 100 ledger "cents", i.e. usd_cents * multiplier = wb_cents):
 *   - Premium subscriptions + direct purchases: 10 WB per $1
 *   - Fantasy buy-ins:                          2.5 WB per $1
 */
export const WB_PER_USD = 10;
export const WB_PER_USD_FANTASY = 2.5;

export type CreditResult = { credited: boolean; ledgerId: number | null; reason?: string };

/**
 * Resolve the Discord user behind a subscription invoice. Newer Stripe API
 * versions (basil/dahlia) carry it under invoice.parent.subscription_details;
 * older ones use the top-level invoice.subscription. Falls back to fetching the
 * subscription when the metadata snapshot is absent.
 */
async function resolveInvoiceUser(
  stripe: Stripe,
  invoice: Stripe.Invoice,
): Promise<{ userId?: string; username: string; subscriptionId?: string }> {
  let subscriptionId: string | undefined;
  let subMeta: Record<string, string> = {};

  const parent = (invoice as { parent?: Stripe.Invoice.Parent | null }).parent ?? null;
  if (parent?.type === "subscription_details" && parent.subscription_details) {
    const sd = parent.subscription_details;
    subscriptionId = typeof sd.subscription === "string" ? sd.subscription : sd.subscription?.id;
    subMeta = (sd.metadata ?? {}) as Record<string, string>;
  } else {
    const legacy = (invoice as { subscription?: string | { id: string } }).subscription;
    subscriptionId = typeof legacy === "string" ? legacy : legacy?.id;
  }

  if (subscriptionId && !subMeta.user_id && !subMeta.discord_user_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      subMeta = (sub.metadata ?? {}) as Record<string, string>;
    } catch (e) {
      console.warn("resolveInvoiceUser: failed to fetch subscription", subscriptionId, e);
    }
  }

  // `user_id` is the app user id (current scheme). `discord_user_id` is the
  // legacy key from pre-auth-migration subscriptions — credited as-is to the
  // matching legacy wallet (no-op once that account migrates).
  const userId =
    (invoice.metadata?.user_id as string | undefined) ??
    subMeta.user_id ??
    (invoice.metadata?.discord_user_id as string | undefined) ??
    subMeta.discord_user_id;
  const username =
    (invoice.metadata?.username as string | undefined) ??
    subMeta.username ??
    (invoice.metadata?.discord_username as string | undefined) ??
    subMeta.discord_username ??
    "";
  return { userId, username, subscriptionId };
}

/**
 * Credit the Premium WB match for a paid subscription invoice (first payment
 * AND every renewal — Stripe fires invoice.paid for both). 10 WB per $1.
 */
export async function creditInvoicePremiumMatch(
  stripe: Stripe,
  invoice: Stripe.Invoice,
): Promise<CreditResult> {
  const usdCents = invoice.amount_paid ?? 0;
  if (usdCents <= 0) return { credited: false, ledgerId: null, reason: "zero_amount" };

  const { userId, username, subscriptionId } = await resolveInvoiceUser(stripe, invoice);
  if (!userId) return { credited: false, ledgerId: null, reason: "no_user" };

  const ledgerId = await creditLedger({
    discordUserId: userId,
    discordUsername: username,
    amountCents: usdCents * WB_PER_USD,
    kind: "premium_match",
    refKind: "stripe_invoice",
    refId: invoice.id,
    memo: `Premium match for invoice ${invoice.id}`,
    metadata: { invoice_id: invoice.id, subscription_id: subscriptionId ?? null, usd_cents: usdCents },
  });
  return { credited: ledgerId !== null, ledgerId };
}

/**
 * Credit WB for a paid one-time Checkout Session:
 *   - kind "wb_purchase"  → "purchase",      10 WB per $1
 *   - kind "league_entry" → "fantasy_match", 2.5 WB per $1
 * Recomputes the amount from amount_total (never trusts client-supplied
 * metadata amounts). No-op for other / unpaid sessions.
 */
export async function creditCheckoutSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<CreditResult> {
  if (session.payment_status !== "paid") {
    return { credited: false, ledgerId: null, reason: "unpaid" };
  }
  const kind = session.metadata?.kind;
  const userId = session.metadata?.user_id ?? session.metadata?.discord_user_id;
  const username = session.metadata?.username ?? session.metadata?.discord_username ?? "";
  if (!userId) return { credited: false, ledgerId: null, reason: "no_user" };

  const usdCents = session.amount_total ?? 0;
  if (usdCents <= 0) return { credited: false, ledgerId: null, reason: "zero_amount" };

  let ledgerKind: "purchase" | "fantasy_match";
  let wbCents: number;
  let memo: string;
  if (kind === "wb_purchase") {
    ledgerKind = "purchase";
    wbCents = usdCents * WB_PER_USD;
    memo = `Bought $${Math.round(wbCents / 100).toLocaleString("en-US")} of Whoosh Bucks`;
  } else if (kind === "league_entry") {
    ledgerKind = "fantasy_match";
    wbCents = Math.round(usdCents * WB_PER_USD_FANTASY);
    memo = `Fantasy match for league entry (${session.metadata?.group_key ?? "league"})`;
  } else {
    return { credited: false, ledgerId: null, reason: "unhandled_kind" };
  }

  const ledgerId = await creditLedger({
    discordUserId: userId,
    discordUsername: username,
    amountCents: wbCents,
    kind: ledgerKind,
    refKind: "stripe_checkout",
    refId: session.id,
    memo,
    metadata: {
      session_id: session.id,
      kind,
      usd_cents: usdCents,
      group_key: session.metadata?.group_key ?? null,
    },
  });
  return { credited: ledgerId !== null, ledgerId };
}

// Stripe params accept `void`/string mixed in a couple of call sites; keep a
// single Stripe constructor helper so secret resolution lives in one place.
export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  return new Stripe(key);
}
