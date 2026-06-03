import { getMarketTicker } from "@/lib/wb/marketTicker";
import { jsonOk } from "@/lib/api/json";
import type { TickerResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public market-strip quotes. Mirrors `/api/capital/ticker`. */
export async function GET() {
  try {
    const quotes = await getMarketTicker();
    return jsonOk<TickerResponse>({ quotes });
  } catch {
    return jsonOk<TickerResponse>({ quotes: [] });
  }
}
