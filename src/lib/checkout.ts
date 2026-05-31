import Stripe from "stripe";
import { headers } from "next/headers";

const PRICE_BY_INTERVAL: Record<string, string | undefined> = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  six_months: process.env.STRIPE_PRICE_SEMI_ANNUAL,
  annual: process.env.STRIPE_PRICE_ANNUAL,
};

export type CheckoutInput = {
  interval: string;
  userId: string;
  username: string;
};

/**
 * Create a Stripe Checkout Session for the given billing interval and return its
 * hosted-page URL. Embeds the app user id + username in metadata so the webhook
 * can map the payment back to the account (and find it later via Search).
 */
export async function createCheckoutSessionUrl({
  interval,
  userId,
  username,
}: CheckoutInput): Promise<string> {
  const priceId = PRICE_BY_INTERVAL[interval];
  if (!priceId) {
    throw new Error(
      `No Stripe price ID configured for interval "${interval}". ` +
        `Set STRIPE_PRICE_${interval.toUpperCase()} in your environment.`,
    );
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
    user_id: userId,
    username,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#plans`,
    allow_promotion_codes: true,
    client_reference_id: userId,
    metadata,
    subscription_data: { metadata },
  });

  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  return session.url;
}
