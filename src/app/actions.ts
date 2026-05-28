"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createCheckoutSessionUrl } from "@/lib/checkout";

/**
 * Server action invoked by each Subscribe form.
 *
 * - If the visitor has not connected their Discord yet, redirect them through
 *   the Discord OAuth flow (their `intent` interval is preserved through state
 *   so they land back on a checkout session for the right billing option).
 * - Otherwise, create a Stripe Checkout Session with the Discord user ID
 *   embedded in metadata and redirect to Stripe's hosted page.
 */
export async function createCheckoutSession(formData: FormData) {
  const interval = String(formData.get("interval") ?? "");

  const session = await getSession();
  if (!session) {
    const next = `/api/checkout?interval=${encodeURIComponent(interval)}`;
    redirect(`/api/auth/discord?next=${encodeURIComponent(next)}`);
  }

  const url = await createCheckoutSessionUrl({
    interval,
    discordUserId: session.id,
    discordUsername: session.username,
  });
  redirect(url);
}
