"use server";

import Stripe from "stripe";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

const PRICE_BY_INTERVAL: Record<string, string | undefined> = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  six_months: process.env.STRIPE_PRICE_SEMI_ANNUAL,
  annual: process.env.STRIPE_PRICE_ANNUAL,
};

/**
 * Server action invoked by each Subscribe form on the marketing page.
 * Creates a Stripe Checkout Session for the chosen billing interval and
 * redirects the visitor to Stripe's hosted checkout page.
 */
export async function createCheckoutSession(formData: FormData) {
  const interval = String(formData.get("interval") ?? "");
  const priceId = PRICE_BY_INTERVAL[interval];
  if (!priceId) {
    throw new Error(
      `No Stripe price ID configured for interval "${interval}". ` +
        `Set STRIPE_PRICE_${interval.toUpperCase()} in your environment.`,
    );
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set in the environment.");
  }

  const stripe = new Stripe(secretKey);

  // Derive the public origin so success/cancel URLs are absolute.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#plans`,
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  redirect(session.url);
}
