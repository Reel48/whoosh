import {
  stripeClient,
  creditInvoicePremiumMatch,
  creditCheckoutSession,
} from "@/lib/wb/stripeCredits";

/**
 * Self-healing safety net for Stripe → Whoosh Bucks crediting. Scans recent
 * Stripe activity and credits anything the live webhook missed. Every credit is
 * idempotent (keyed by the Stripe object id, shared with the webhook), so this
 * can run as often as we like and re-runs are no-ops.
 *
 * Bounded by a cutoff so it only ever credits payments from when reliable
 * crediting went live — "fix going forward", not a retroactive backfill.
 */

/** Hard floor: never credit Stripe objects created before this instant. */
const CUTOFF_MS = Date.parse(process.env.WB_RECONCILE_SINCE ?? "2026-05-31T00:00:00Z");
/** Rolling window so a daily run still catches a missed monthly renewal. */
const WINDOW_MS = 40 * 24 * 60 * 60 * 1000;

export type ReconcileSummary = {
  sinceUnix: number;
  invoicesScanned: number;
  invoicesCredited: number;
  sessionsScanned: number;
  sessionsCredited: number;
  truncated: boolean;
  /** reason → count, for skipped objects (no_user, unpaid, duplicate, …). */
  skipped: Record<string, number>;
};

export async function reconcileStripeCredits(opts: { sinceUnix?: number } = {}): Promise<ReconcileSummary> {
  const stripe = stripeClient();
  const floorSec = Math.floor(CUTOFF_MS / 1000);
  const windowSec = Math.floor((Date.now() - WINDOW_MS) / 1000);
  const sinceUnix = opts.sinceUnix ?? Math.max(floorSec, windowSec);

  const skipped: Record<string, number> = {};
  const bump = (reason?: string) => {
    if (reason) skipped[reason] = (skipped[reason] ?? 0) + 1;
  };

  // --- Subscription invoices → premium_match (10 WB/$1) ---
  const invoices = await stripe.invoices.list({
    status: "paid",
    created: { gte: sinceUnix },
    limit: 100,
  });
  let invoicesCredited = 0;
  for (const inv of invoices.data) {
    const r = await creditInvoicePremiumMatch(stripe, inv);
    if (r.credited) invoicesCredited++;
    else bump(r.reason);
  }

  // --- One-time Checkout Sessions → purchase (10) / fantasy_match (2.5) ---
  const sessions = await stripe.checkout.sessions.list({
    created: { gte: sinceUnix },
    limit: 100,
  });
  const relevant = sessions.data.filter(
    (s) => s.metadata?.kind === "wb_purchase" || s.metadata?.kind === "league_entry",
  );
  let sessionsCredited = 0;
  for (const s of relevant) {
    const r = await creditCheckoutSession(stripe, s);
    if (r.credited) sessionsCredited++;
    else bump(r.reason);
  }

  return {
    sinceUnix,
    invoicesScanned: invoices.data.length,
    invoicesCredited,
    sessionsScanned: relevant.length,
    sessionsCredited,
    // A full page means there may be more than the window held — surface it.
    truncated: invoices.has_more || sessions.has_more,
    skipped,
  };
}
