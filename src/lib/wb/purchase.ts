import Stripe from "stripe";
import { headers } from "next/headers";

export type WbPurchaseInput = {
  /** USD cents the user wants to spend. Each $1 paid yields 10 WB. */
  amountCents: number;
  discordUserId: string;
  discordUsername: string;
};

const MIN_PURCHASE_CENTS = 100; // $1.00
const MAX_PURCHASE_CENTS = 100_000_00; // $100,000 hard cap (sanity, not policy)

/** Whoosh Bucks per US dollar. Defined here so the webhook + purchase flow
 *  agree without drift; updates to the rate change a single constant. */
export const WB_PER_USD = 10;

/**
 * Build a one-time Stripe Checkout Session for buying Whoosh Bucks 1:1 with USD.
 * Uses inline `price_data` so the amount is dynamic per checkout (no Stripe
 * Product/Price needed up front).
 */
export async function createWbPurchaseCheckoutUrl({
  amountCents,
  discordUserId,
  discordUsername,
}: WbPurchaseInput): Promise<string> {
  if (!Number.isInteger(amountCents)) {
    throw new Error("amountCents must be an integer.");
  }
  if (amountCents < MIN_PURCHASE_CENTS) {
    throw new Error(`Minimum purchase is $${MIN_PURCHASE_CENTS / 100}.`);
  }
  if (amountCents > MAX_PURCHASE_CENTS) {
    throw new Error(`Maximum purchase is $${MAX_PURCHASE_CENTS / 100}.`);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set.");
  const stripe = new Stripe(secretKey);

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const rawOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
  const origin = rawOrigin.replace(/\/+$/, "");

  // 1 USD = WB_PER_USD WB. USD cents in → WB cents out at 10x.
  const wbCents = amountCents * WB_PER_USD;
  const wbWhole = Math.round(wbCents / 100);

  const metadata = {
    kind: "wb_purchase" as const,
    discord_user_id: discordUserId,
    discord_username: discordUsername,
    wb_cents: String(wbCents),
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: "Whoosh Bucks",
            description: `${wbWhole.toLocaleString("en-US")} WB credited to @${discordUsername}`,
          },
        },
      },
    ],
    success_url: `${origin}/wallet?purchase=ok`,
    cancel_url: `${origin}/wallet?purchase=cancelled`,
    client_reference_id: discordUserId,
    metadata,
    payment_intent_data: { metadata },
  });

  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  return session.url;
}
