import Stripe from "stripe";
import { headers } from "next/headers";
import { listActiveLeagues, type FantasyLeagueConfig } from "./leagues";

/**
 * One-time Stripe Checkout for a fantasy league buy-in. Mirrors the Whoosh
 * Bucks flow (src/lib/wb/purchase.ts): `mode: "payment"` + inline `price_data`
 * so no Stripe Product/Price needs to exist up front, with a `kind` metadata
 * tag the webhook switches on.
 *
 * Purchases are made per *group*, not per league: interchangeable leagues
 * (e.g. Whoosh Blue + Orange) share one `group_key` and one payment, and the
 * buyer is auto-seated in one of them after payment.
 */

export type LeagueCheckoutInput = {
  groupKey: string;
  discordUserId: string;
  discordUsername: string;
};

export type LeagueGroup = {
  groupKey: string;
  /** Entry fee in USD cents (all leagues in a group share one fee). */
  feeCents: number;
  productName: string;
  season: string;
  leagues: FantasyLeagueConfig[];
};

/** Resolve a purchasable group: active leagues sharing `groupKey` that carry a fee. */
export async function getPurchasableGroup(groupKey: string): Promise<LeagueGroup | null> {
  const leagues = (await listActiveLeagues()).filter(
    (l) => l.groupKey === groupKey && (l.entryFeeCents ?? 0) > 0,
  );
  if (leagues.length === 0) return null;
  const first = leagues[0];
  return {
    groupKey,
    feeCents: first.entryFeeCents!,
    productName: first.productName?.trim() || first.name?.trim() || "Whoosh League",
    season: first.season,
    leagues,
  };
}

export async function createLeagueGroupCheckoutUrl({
  groupKey,
  discordUserId,
  discordUsername,
}: LeagueCheckoutInput): Promise<string> {
  const group = await getPurchasableGroup(groupKey);
  if (!group) throw new Error(`No purchasable league group "${groupKey}".`);

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set.");
  const stripe = new Stripe(secretKey);

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const rawOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
  const origin = rawOrigin.replace(/\/+$/, "");

  const metadata = {
    kind: "league_entry" as const,
    group_key: groupKey,
    season: group.season,
    discord_user_id: discordUserId,
    discord_username: discordUsername,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: group.feeCents,
          product_data: {
            name: `${group.productName} — ${group.season} entry`,
            description: `Season buy-in for @${discordUsername}`,
          },
        },
      },
    ],
    success_url: `${origin}/fantasy/leagues/joined?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/fantasy/leagues`,
    client_reference_id: discordUserId,
    metadata,
    payment_intent_data: { metadata },
  });

  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  return session.url;
}
