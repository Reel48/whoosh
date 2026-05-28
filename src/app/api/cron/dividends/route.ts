import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { listHeldSymbols, postDividend } from "@/lib/wb/dividend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TWELVEDATA_BASE = "https://api.twelvedata.com";

/**
 * Daily cron: for each symbol any user holds, ask Twelve Data which
 * dividends fell in the last week and post any whose ex-date is today
 * (so we never pay dividends ahead of ex-date, and a one-day window
 * is sufficient because we run daily).
 *
 * The week-back lookback exists so a one-off cron miss can be made up
 * the next day — fn_post_dividend is idempotent per (symbol, ex_date)
 * so re-posting the same dividend is a no-op.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "TWELVEDATA_API_KEY not set" }, { status: 500 });
  }

  let symbols: string[];
  try {
    symbols = await listHeldSymbols();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
  if (symbols.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, note: "no held symbols" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const summary: { symbol: string; status: string; usersCredited?: number; amount?: number }[] = [];

  for (const symbol of symbols) {
    try {
      const url = new URL(`${TWELVEDATA_BASE}/dividends`);
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("start_date", sevenDaysAgo);
      url.searchParams.set("end_date", today);
      url.searchParams.set("apikey", apiKey);

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        summary.push({ symbol, status: `td-${res.status}` });
        continue;
      }
      const json = (await res.json()) as {
        status?: string;
        message?: string;
        dividends?: { ex_date: string; amount: number }[];
      };

      const events = json.dividends ?? [];
      let anyPosted = false;
      for (const ev of events) {
        if (ev.ex_date !== today) continue; // only post today's dividends
        if (!Number.isFinite(ev.amount) || ev.amount <= 0) continue;
        const result = await postDividend({
          symbol,
          exDate: ev.ex_date,
          usdPerShare: ev.amount,
          source: "twelve_data",
        });
        summary.push({
          symbol,
          status: result.alreadyPosted ? "skipped" : "posted",
          usersCredited: result.usersCredited,
          amount: ev.amount,
        });
        anyPosted = true;
      }
      if (!anyPosted) summary.push({ symbol, status: "no-ex-today" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      summary.push({ symbol, status: `error:${msg}` });
    }
  }

  console.log(JSON.stringify({ at: "cron.dividends", date: today, summary }));
  return NextResponse.json({ ok: true, date: today, summary });
}
