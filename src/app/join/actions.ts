"use server";

import { redirect } from "next/navigation";
import { createPoolEntryCheckoutUrl } from "@/lib/fantasy/poolEntry";

/**
 * Server action behind every "Join for $X" button on `/join`. No session is
 * required — the buyer is anonymous until Stripe collects their email on the
 * hosted Checkout page.
 */
export async function startPoolCheckoutAction(formData: FormData) {
  const offerId = String(formData.get("offer") ?? "").trim();
  if (!offerId) redirect("/join?error=1");

  let url: string;
  try {
    url = await createPoolEntryCheckoutUrl(offerId);
  } catch (e) {
    // redirect() throws, so this catch only ever sees real checkout failures.
    console.error("Pool checkout failed:", e);
    redirect("/join?error=1");
  }
  redirect(url);
}
