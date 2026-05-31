import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { reconcileStripeCredits } from "@/lib/wb/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron: reconcile Stripe payments → Whoosh Bucks credits. Catches any
 * credit the live webhook missed (premium subscription matches, direct WB
 * purchases, fantasy buy-ins). Idempotent and bounded by a cutoff, so a miss is
 * made up within a day and re-runs never double-credit.
 *
 * Manual trigger: curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/wb-reconcile
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const summary = await reconcileStripeCredits();
    console.log(JSON.stringify({ at: "cron.wb-reconcile", ...summary }));
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("wb-reconcile failed:", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
