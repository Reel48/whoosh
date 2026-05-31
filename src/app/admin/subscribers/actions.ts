"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { hasAdminRole } from "@/lib/discord";
import { reconcileStripeCredits } from "@/lib/wb/reconcile";

async function requireAdmin(): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  if (!(await hasAdminRole(session.id))) throw new Error("Not an admin.");
}

/**
 * Manually run the Stripe → Whoosh Bucks reconciler (same job as the cron).
 * Credits any missed premium/purchase/fantasy WB within the window; idempotent.
 */
export async function reconcileWbAction(): Promise<void> {
  await requireAdmin();
  let q = "reconciled=err";
  try {
    const s = await reconcileStripeCredits();
    q = `reconciled=${s.invoicesCredited + s.sessionsCredited}&scanned=${s.invoicesScanned + s.sessionsScanned}`;
  } catch (e) {
    console.error("manual wb reconcile failed:", e);
  }
  revalidatePath("/admin/subscribers");
  redirect(`/admin/subscribers?${q}`);
}
