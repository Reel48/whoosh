"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createLeagueGroupCheckoutUrl } from "@/lib/fantasy/checkout";

/**
 * Server action behind every league "Join for $X" button. Builds a one-time
 * Stripe Checkout Session for the chosen league group and redirects to the
 * hosted page. Anonymous visitors are bounced through Discord OAuth first and
 * returned to the Leagues grid to retry.
 */
export async function joinLeagueAction(formData: FormData) {
  const groupKey = String(formData.get("group_key") ?? "");
  if (!groupKey) redirect("/fantasy/leagues");

  const session = await getSession();
  if (!session) {
    redirect(`/api/auth/discord?next=${encodeURIComponent("/fantasy/leagues")}`);
  }

  const url = await createLeagueGroupCheckoutUrl({
    groupKey,
    discordUserId: session.id,
    discordUsername: session.username,
  });
  redirect(url);
}
