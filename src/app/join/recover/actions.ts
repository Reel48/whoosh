"use server";

import { getPoolInvitesForEmail, type PoolInvite } from "@/lib/fantasy/poolEntry";

export type RecoverState =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "none" }
  | { status: "error" }
  | { status: "found"; invites: PoolInvite[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Look up every Sleeper invite a buyer has paid for, by the email Stripe
 * collected at checkout. Posted (never a query string) so the address stays
 * out of URLs and logs. A miss and a typo both read the same on the page, so
 * the form can't be used to probe which emails have bought in.
 */
export async function recoverPoolInvitesAction(
  _prev: RecoverState,
  formData: FormData,
): Promise<RecoverState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL_RE.test(email)) return { status: "invalid" };
  try {
    const invites = await getPoolInvitesForEmail(email);
    return invites.length > 0 ? { status: "found", invites } : { status: "none" };
  } catch (e) {
    console.error("recoverPoolInvitesAction failed:", e);
    return { status: "error" };
  }
}
