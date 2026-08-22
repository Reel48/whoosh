import Stripe from "stripe";
import { headers } from "next/headers";
import { supabase } from "@/lib/supabase";
import { listActiveLeagues, type FantasyLeagueConfig, type LeagueKind } from "./leagues";

/**
 * Anonymous Pick 'Em / Survivor buy-ins for the standalone `/join` landing page.
 *
 * Deliberately separate from the signed-in league flow in `checkout.ts`:
 *  - no Whoosh account, no session — Stripe collects an email and that's it;
 *  - no seat assignment — these pools hold ~unlimited entries, so there is
 *    nothing to balance; the buyer just needs the Sleeper invite link;
 *  - no Whoosh Bucks match — there's no wallet to credit without an account.
 *
 * Checkout metadata is tagged `kind: "pool_entry"` so the Stripe webhook and
 * the WB reconciler can tell these apart from `league_entry` sessions.
 */

/** Price of the "both pools" bundle, in cents. Change this to discount it —
 *  set to `null` to fall back to the sum of the individual entry fees. */
const BUNDLE_PRICE_CENTS: number | null = 2000;

/** Offer id for the bundle. Single-pool offers use their `group_key`. */
export const BUNDLE_OFFER = "both";

export type PoolOffer = {
  /** "pickem" | "survivor" | "both" */
  id: string;
  name: string;
  /** One-line rules blurb for the card. */
  blurb: string;
  priceCents: number;
  /** Undiscounted total, when the bundle saves money. null otherwise. */
  strikeCents: number | null;
  season: string;
  /** fantasy_league.group_key values this offer buys into. */
  groupKeys: string[];
};

const POOL_KINDS: LeagueKind[] = ["pickem", "survivor"];

const BLURB: Record<string, string> = {
  pickem: "Pick every game, every week. Most correct picks on the season takes it.",
  survivor: "One team a week to win. Use a team once. Last entry standing takes it.",
};

/** Purchasable pool leagues: active, pick'em/survivor, with a real entry fee. */
async function listPoolLeagues(): Promise<FantasyLeagueConfig[]> {
  const leagues = await listActiveLeagues();
  return leagues.filter((l) => POOL_KINDS.includes(l.kind) && (l.entryFeeCents ?? 0) > 0);
}

/** Collapse pool leagues into one entry per `group_key`, in display order. */
function byGroup(leagues: FantasyLeagueConfig[]): Map<string, FantasyLeagueConfig[]> {
  const groups = new Map<string, FantasyLeagueConfig[]>();
  for (const l of leagues) {
    const existing = groups.get(l.groupKey);
    if (existing) existing.push(l);
    else groups.set(l.groupKey, [l]);
  }
  return groups;
}

function offerName(leagues: FantasyLeagueConfig[]): string {
  const first = leagues[0];
  return first.productName?.trim() || first.name?.trim() || "Whoosh Pool";
}

/**
 * The cards rendered on `/join`: one per pool, plus a bundle when there's more
 * than one. Everything (name, price, season) comes from `fantasy_league`, so
 * pricing changes are a DB edit — the only hardcoded number is the bundle.
 */
export async function listPoolOffers(): Promise<PoolOffer[]> {
  const groups = byGroup(await listPoolLeagues());
  const offers: PoolOffer[] = [...groups.entries()].map(([groupKey, leagues]) => ({
    id: groupKey,
    name: offerName(leagues),
    blurb: BLURB[leagues[0].kind] ?? "Season-long pool played on Sleeper.",
    priceCents: leagues[0].entryFeeCents!,
    strikeCents: null,
    season: leagues[0].season,
    groupKeys: [groupKey],
  }));

  if (offers.length < 2) return offers;

  const sum = offers.reduce((t, o) => t + o.priceCents, 0);
  const bundlePrice = BUNDLE_PRICE_CENTS ?? sum;
  offers.push({
    id: BUNDLE_OFFER,
    name: "Both pools",
    blurb: offers.map((o) => o.name).join(" + ") + " — one payment, both invites.",
    priceCents: bundlePrice,
    strikeCents: bundlePrice < sum ? sum : null,
    season: offers[0].season,
    groupKeys: offers.map((o) => o.id),
  });
  return offers;
}

export async function getPoolOffer(offerId: string): Promise<PoolOffer | null> {
  return (await listPoolOffers()).find((o) => o.id === offerId) ?? null;
}

/** Sleeper invite for each purchased pool. Only ever called after payment. */
export type PoolInvite = { name: string; kind: LeagueKind; joinUrl: string };

export async function getPoolInvites(
  groupKeys: string[],
  season: string,
): Promise<PoolInvite[]> {
  if (groupKeys.length === 0) return [];
  const leagues = await listPoolLeagues();
  return leagues
    .filter((l) => groupKeys.includes(l.groupKey) && l.season === season && l.joinUrl)
    .map((l) => ({
      name: l.productName?.trim() || l.name?.trim() || "Whoosh Pool",
      kind: l.kind,
      joinUrl: l.joinUrl!,
    }));
}

function siteOrigin(h: Headers): string {
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
  return raw.replace(/\/+$/, "");
}

/**
 * One-time Stripe Checkout for a pool entry. Inline `price_data` (no Stripe
 * Product/Price to keep in sync) and `mode: "payment"`, mirroring the signed-in
 * league flow. Stripe collects the buyer's email on the hosted page — that's
 * the only identity we get, and it's all the receipt needs.
 */
export async function createPoolEntryCheckoutUrl(offerId: string): Promise<string> {
  const offer = await getPoolOffer(offerId);
  if (!offer) throw new Error(`No purchasable pool offer "${offerId}".`);

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set.");
  const stripe = new Stripe(secretKey);
  const origin = siteOrigin(await headers());

  const metadata = {
    kind: "pool_entry" as const,
    offer: offer.id,
    group_keys: offer.groupKeys.join(","),
    season: offer.season,
    source: "join",
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: offer.priceCents,
          product_data: {
            name: `${offer.name} — ${offer.season} entry`,
            description: offer.blurb,
          },
        },
      },
    ],
    success_url: `${origin}/join/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/join`,
    metadata,
    payment_intent_data: { metadata },
  });

  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  return session.url;
}

export type RecordedPurchase = {
  email: string | null;
  offer: string;
  groupKeys: string[];
  season: string;
};

/** Parse a paid `pool_entry` Checkout Session into the fields we persist. */
export function readPoolSession(cs: Stripe.Checkout.Session): RecordedPurchase | null {
  const meta = cs.metadata ?? {};
  if (meta.kind !== "pool_entry") return null;
  const groupKeys = (meta.group_keys ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (groupKeys.length === 0 || !meta.season) return null;
  return {
    email: cs.customer_details?.email ?? cs.customer_email ?? null,
    offer: meta.offer ?? groupKeys.join("+"),
    groupKeys,
    season: meta.season,
  };
}

/**
 * Persist a paid pool entry. Idempotent on `stripe_session_id`, so the webhook
 * and the success page can both call it — whichever lands first wins and the
 * other is a no-op.
 */
export async function recordPoolPurchase(input: {
  purchase: RecordedPurchase;
  amountCents: number;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
}): Promise<void> {
  const { error } = await supabase()
    .from("pool_entry_purchase")
    .upsert(
      {
        email: input.purchase.email,
        offer: input.purchase.offer,
        group_keys: input.purchase.groupKeys,
        season: input.purchase.season,
        amount_cents: input.amountCents,
        stripe_session_id: input.stripeSessionId,
        stripe_payment_intent_id: input.stripePaymentIntentId,
      },
      { onConflict: "stripe_session_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(`recordPoolPurchase failed: ${error.message}`);
}

export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}
