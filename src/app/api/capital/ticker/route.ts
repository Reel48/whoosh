import { NextResponse } from "next/server";
import { getMarketTicker } from "@/lib/wb/marketTicker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Market quotes for the Capital ticker strip. Public market data (the Capital
 * section is premium-gated upstream anyway). The MarketTicker polls this every
 * ~60s; the underlying Finnhub fetches are revalidate-cached for 60s.
 */
export async function GET() {
  try {
    const quotes = await getMarketTicker();
    return NextResponse.json({ quotes });
  } catch {
    return NextResponse.json({ quotes: [] }, { status: 200 });
  }
}
