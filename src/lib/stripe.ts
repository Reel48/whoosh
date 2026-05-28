import Stripe from "stripe";

let _stripe: Stripe | null = null;
function stripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  _stripe = new Stripe(key);
  return _stripe;
}

const INTERVAL_LABEL: Record<string, string> = {
  monthly: "Monthly",
  six_months: "6 Months",
  annual: "Annual",
};

/** Map a Stripe Price ID back to our internal interval label. */
function intervalLabelForPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return INTERVAL_LABEL.monthly;
  if (priceId === process.env.STRIPE_PRICE_SEMI_ANNUAL) return INTERVAL_LABEL.six_months;
  if (priceId === process.env.STRIPE_PRICE_ANNUAL) return INTERVAL_LABEL.annual;
  return "Premium";
}

export type SubscriptionSummary = {
  id: string;
  customerId: string;
  status: Stripe.Subscription.Status;
  planLabel: string;
  amount: number; // in cents
  currency: string;
  currentPeriodEnd: number; // unix seconds
  cancelAtPeriodEnd: boolean;
};

/**
 * Find the most relevant subscription for a Discord user, preferring active
 * ones. Uses Stripe's Search API to query the metadata index we set at
 * checkout time. Returns null if none exists.
 *
 * Note: Stripe Search has eventual consistency (a few seconds). Brand-new
 * subscriptions may not appear for a moment after payment.
 */
export async function findSubscriptionForDiscordUser(
  discordUserId: string,
): Promise<SubscriptionSummary | null> {
  const safe = discordUserId.replace(/"/g, ""); // metadata values shouldn't contain quotes anyway
  const res = await stripe().subscriptions.search({
    query: `metadata["discord_user_id"]:"${safe}"`,
    limit: 10,
  });
  if (res.data.length === 0) return null;

  // Prefer active/trialing subscriptions over canceled/past_due.
  const ranked = [...res.data].sort((a, b) => statusRank(a.status) - statusRank(b.status));
  const sub = ranked[0];
  const item = sub.items.data[0];
  const price = item?.price;
  return {
    id: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    status: sub.status,
    planLabel: price ? intervalLabelForPriceId(price.id) : "Premium",
    amount: price?.unit_amount ?? 0,
    currency: price?.currency ?? "usd",
    // current_period_end lives on the subscription item in newer Stripe API versions
    currentPeriodEnd:
      (item as Stripe.SubscriptionItem & { current_period_end?: number })?.current_period_end ??
      (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end ??
      0,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

function statusRank(s: Stripe.Subscription.Status): number {
  switch (s) {
    case "active":
    case "trialing":
      return 0;
    case "past_due":
    case "unpaid":
      return 1;
    case "incomplete":
    case "incomplete_expired":
      return 2;
    case "paused":
      return 3;
    case "canceled":
      return 4;
    default:
      return 5;
  }
}

/** Create a Stripe Customer Portal session and return its URL. */
export async function createPortalUrl(customerId: string, returnUrl: string): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}
