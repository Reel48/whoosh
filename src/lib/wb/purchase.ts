import Stripe from "stripe";
import { headers } from "next/headers";

export type WbPurchaseInput = {
  /** USD cents the user wants to spend (== WB cents granted, 1:1). */
  amountCents: number;
  discordUserId: string;
  discordUsername: string;
};

const MIN_PURCHASE_CENTS = 100; // $1.00
const MAX_PURCHASE_CENTS = 100_000_00; // $100,000 hard cap (sanity, not policy)

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

  const metadata = {
    kind: "wb_purchase" as const,
    discord_user_id: discordUserId,
    discord_username: discordUsername,
    wb_cents: String(amountCents),
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
            description: `${amountCents / 100} WB credited to @${discordUsername}`,
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
