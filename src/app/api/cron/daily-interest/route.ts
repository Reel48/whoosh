import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { accrueInterest, fetchFredRateBps, setRate, getCurrentRate } from "@/lib/wb/interest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron: refresh rate from FRED (if FRED_API_KEY set), then accrue
 * interest for yesterday's balances.
 *
 * Why yesterday: when this runs at 00:05 UTC on date D, "yesterday" (D-1) is
 * the day whose balances we want to credit — D itself hasn't happened yet.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const log: Record<string, unknown> = { at: "cron.daily_interest" };

  // 1. Refresh rate from FRED. Non-fatal if it fails.
  try {
    const fred = await fetchFredRateBps();
    if (fred) {
      const today = new Date().toISOString().slice(0, 10);
      await setRate(today, fred.apyBps, `fred_dtb3@${fred.observationDate}`);
      log.fred_apy_bps = fred.apyBps;
      log.fred_observation_date = fred.observationDate;
    } else {
      log.fred = "skipped_or_unavailable";
    }
  } catch (e) {
    console.error("FRED refresh failed (continuing with last known rate):", e);
    log.fred_error = e instanceof Error ? e.message : "unknown";
  }

  // 2. Accrue interest for yesterday.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  try {
    const rate = await getCurrentRate();
    log.rate_used = rate;
    const inserted = await accrueInterest(yesterday);
    log.accrual_date = yesterday;
    log.rows_inserted = inserted;
    console.log(JSON.stringify(log));
    return NextResponse.json({ ok: true, ...log });
  } catch (e) {
    log.error = e instanceof Error ? e.message : "unknown";
    console.error(JSON.stringify(log));
    return NextResponse.json({ ok: false, ...log }, { status: 500 });
  }
}
