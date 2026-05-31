import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * Find the most relevant subscription for an app user, preferring active ones.
 * Uses Stripe's Search API. New subscriptions carry `metadata.user_id`; legacy
 * ones (created before the auth migration) carry only `metadata.discord_user_id`,
 * so when the caller passes the user's linked Discord id we match either — that
 * keeps existing subscribers recognized as Premium. Returns null if none exists.
 *
 * Note: Stripe Search has eventual consistency (a few seconds). Brand-new
 * subscriptions may not appear for a moment after payment.
 */
export async function findSubscriptionForUser(
  userId: string,
  discordUserId?: string | null,
): Promise<SubscriptionSummary | null> {
  const safeUser = userId.replace(/"/g, ""); // metadata values shouldn't contain quotes anyway
  const parts = [`metadata["user_id"]:"${safeUser}"`];
  if (discordUserId) {
    parts.push(`metadata["discord_user_id"]:"${discordUserId.replace(/"/g, "")}"`);
  }
  const res = await stripe().subscriptions.search({
    query: parts.join(" OR "),
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

/**
 * Stamp `metadata.user_id` onto a user's legacy subscription(s) (those created
 * with only `discord_user_id`). Makes future renewal crediting + role revoke
 * resolve to the correct app account, and lets direct user_id lookups work.
 * Idempotent: skips subs that already carry `user_id`. Returns the Stripe
 * customer id when found (for persisting onto the profile). Best-effort.
 */
export async function backfillSubscriptionUserId(
  userId: string,
  discordUserId: string,
): Promise<string | null> {
  const safe = discordUserId.replace(/"/g, "");
  const res = await stripe().subscriptions.search({
    query: `metadata["discord_user_id"]:"${safe}"`,
    limit: 10,
  });
  let customerId: string | null = null;
  for (const sub of res.data) {
    customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    if (sub.metadata?.user_id === userId) continue;
    await stripe().subscriptions.update(sub.id, {
      metadata: { ...sub.metadata, user_id: userId },
    });
  }
  return customerId;
}

/** Create a Stripe Customer Portal session and return its URL. */
export async function createPortalUrl(customerId: string, returnUrl: string): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

export type SubscriptionListItem = SubscriptionSummary & {
  /** App user id (uuid) or, for legacy subs, the Discord id — from metadata. */
  userId: string | null;
  /** Resolved real Discord id (from the profile), if linked. */
  discordUserId: string | null;
  /** Display handle — resolved from the profile, else the checkout metadata. */
  username: string | null;
  /** Email the member signed in with (reliable identifier). */
  appEmail: string | null;
  /** Stripe customer email — may be an Apple Pay "Hide My Email" relay. */
  customerEmail: string | null;
  createdAt: number; // unix seconds
};

/**
 * List subscriptions for the admin portal. Returns up to `limit` subscriptions
 * (default 100, max Stripe allows is 100). Pagination not yet implemented —
 * fine for the first ~100 subscribers.
 */
export async function listSubscriptions(
  opts: { statuses?: ReadonlyArray<Stripe.Subscription.Status>; limit?: number } = {},
): Promise<SubscriptionListItem[]> {
  const params: Stripe.SubscriptionListParams = {
    status: "all",
    limit: opts.limit ?? 100,
    expand: ["data.customer"],
  };
  const res = await stripe().subscriptions.list(params);

  const subs = opts.statuses
    ? res.data.filter((s) => opts.statuses!.includes(s.status))
    : res.data;

  const items = subs.map(toListItem);
  await enrichWithProfiles(items);
  return items;
}

/**
 * Overlay each subscription with its app identity (handle + the email the user
 * signed in with + linked Discord), resolved from the profile via a single RPC.
 * This is what makes the admin list identify subscribers even when Apple Pay
 * supplied a Hide My Email relay as the Stripe customer email. Best-effort — a
 * failure here leaves the metadata-derived fallbacks in place.
 */
async function enrichWithProfiles(items: SubscriptionListItem[]): Promise<void> {
  const uuids = new Set<string>();
  const discordIds = new Set<string>();
  for (const it of items) {
    if (it.userId && UUID_RE.test(it.userId)) uuids.add(it.userId);
    else if (it.userId) discordIds.add(it.userId);
    if (it.discordUserId) discordIds.add(it.discordUserId);
  }
  if (uuids.size === 0 && discordIds.size === 0) return;

  try {
    const { data, error } = await supabase().rpc("admin_subscriber_identities", {
      p_user_ids: [...uuids],
      p_discord_ids: [...discordIds],
    });
    if (error || !data) return;

    const byUserId = new Map<string, (typeof data)[number]>();
    const byDiscord = new Map<string, (typeof data)[number]>();
    for (const row of data) {
      byUserId.set(row.user_id, row);
      if (row.discord_user_id) byDiscord.set(row.discord_user_id, row);
    }

    for (const it of items) {
      const row =
        (it.userId && byUserId.get(it.userId)) ||
        (it.discordUserId && byDiscord.get(it.discordUserId)) ||
        (it.userId && byDiscord.get(it.userId)) ||
        null;
      if (row) {
        it.username = row.username ?? it.username;
        it.appEmail = row.email ?? null;
        it.discordUserId = row.discord_user_id ?? it.discordUserId;
      }
    }
  } catch {
    // leave metadata fallbacks
  }
}

function toListItem(sub: Stripe.Subscription): SubscriptionListItem {
  const item = sub.items.data[0];
  const price = item?.price;
  const customer = sub.customer;
  const customerEmail =
    typeof customer === "string" || customer.deleted
      ? null
      : (customer.email ?? null);

  return {
    id: sub.id,
    customerId: typeof customer === "string" ? customer : customer.id,
    status: sub.status,
    planLabel: price ? intervalLabelForPriceId(price.id) : "Premium",
    amount: price?.unit_amount ?? 0,
    currency: price?.currency ?? "usd",
    currentPeriodEnd:
      (item as Stripe.SubscriptionItem & { current_period_end?: number })?.current_period_end ??
      (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end ??
      0,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    // Baseline from checkout metadata; overlaid with profile data in
    // enrichWithProfiles. New subs carry user_id/username; legacy ones carry
    // discord_user_id/discord_username.
    userId: sub.metadata?.user_id ?? sub.metadata?.discord_user_id ?? null,
    discordUserId: sub.metadata?.discord_user_id ?? null,
    username: sub.metadata?.username ?? sub.metadata?.discord_username ?? null,
    appEmail: null,
    customerEmail,
    createdAt: sub.created,
  };
}

/** Roll-up stats for the admin dashboard. */
export type AdminStats = {
  totalActive: number;
  totalCanceled: number;
  totalPastDue: number;
  byPlan: { monthly: number; sixMonths: number; annual: number };
  /** Estimated normalized monthly revenue across active+trialing subs, in USD cents. */
  estimatedMrrCents: number;
  recentSubs: SubscriptionListItem[];
};

export async function getAdminStats(): Promise<AdminStats> {
  const all = await listSubscriptions({ limit: 100 });
  const active = all.filter((s) => s.status === "active" || s.status === "trialing");

  // Normalized monthly value per plan
  const monthlyValue = (label: string): number => {
    if (label === "Monthly") return 400; // $4
    if (label === "6 Months") return Math.round(2000 / 6); // $20 / 6mo
    if (label === "Annual") return Math.round(3600 / 12); // $36 / 12mo
    return 0;
  };

  const estimatedMrrCents = active.reduce((sum, s) => sum + monthlyValue(s.planLabel), 0);

  return {
    totalActive: active.length,
    totalCanceled: all.filter((s) => s.status === "canceled").length,
    totalPastDue: all.filter((s) => s.status === "past_due" || s.status === "unpaid").length,
    byPlan: {
      monthly: active.filter((s) => s.planLabel === "Monthly").length,
      sixMonths: active.filter((s) => s.planLabel === "6 Months").length,
      annual: active.filter((s) => s.planLabel === "Annual").length,
    },
    estimatedMrrCents,
    recentSubs: [...all]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5),
  };
}
