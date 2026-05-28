import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { postInterest } from "@/lib/wb/interest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Monthly cron: posts all unposted accruals from the previous month as a
 * single 'interest' ledger row per user.
 *
 * Runs on day 1 of each month at 00:30 UTC. The "through date" is the last
 * day of the previous month — accruals on day 1 of the current month (if
 * any leaked through from the daily cron) stay open for next month.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Last day of previous month.
  const now = new Date();
  const lastDayPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const throughDate = lastDayPrev.toISOString().slice(0, 10);

  try {
    const usersCredited = await postInterest(throughDate);
    const out = { at: "cron.monthly_post_interest", through_date: throughDate, users_credited: usersCredited };
    console.log(JSON.stringify(out));
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("monthly post failed:", msg);
    return NextResponse.json({ ok: false, error: msg, through_date: throughDate }, { status: 500 });
  }
}
