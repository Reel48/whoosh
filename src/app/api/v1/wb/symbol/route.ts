import { NextResponse } from "next/server";
import { getStockSnapshot, RANGE_OPTIONS, type RangeKey, type StockSnapshot } from "@/lib/wb/history";
import { getCompanyProfile, type CompanyProfile } from "@/lib/wb/profile";
import { getQuote, type Quote } from "@/lib/wb/quotes";
import { jsonError, jsonOk, requireBearerSession } from "@/lib/api/json";
import type { SymbolDetailResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRange(s: string): s is RangeKey {
  return RANGE_OPTIONS.some((r) => r.key === s);
}

/**
 * Price-only fallback snapshot built from the (Finnhub) quote when the
 * (TwelveData) chart history is unavailable — e.g. TwelveData rate-limited the
 * free tier. Lets the detail page show price + Buy with an empty chart instead
 * of going blank. Finnhub's quote limit is far higher, so it's usually present.
 */
function snapshotFromQuote(
  symbol: string,
  quote: Quote,
  profile: CompanyProfile | null,
): StockSnapshot {
  return {
    symbol,
    longName: profile?.name ?? null,
    exchange: profile?.exchange ?? null,
    currency: profile?.currency ?? "USD",
    regularMarketPriceCents: quote.priceCents,
    regularMarketDayHighCents: null,
    regularMarketDayLowCents: null,
    fiftyTwoWeekHighCents: null,
    fiftyTwoWeekLowCents: null,
    regularMarketVolume: null,
    candles: [],
  };
}

/**
 * Full stock detail for the invest view: price snapshot + candle history (range)
 * + company profile + quote (for day change). Mirrors what `/capital/invest`
 * loads. `range` ∈ 1m|3m|6m|1y|5y (default 1y).
 */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim();
  if (!symbol) return jsonError("validation", "symbol required");
  const rangeRaw = url.searchParams.get("range") ?? "1y";
  const range: RangeKey = isRange(rangeRaw) ? rangeRaw : "1y";

  const [snapshot, profile, quote] = await Promise.all([
    getStockSnapshot(symbol, range),
    getCompanyProfile(symbol).catch(() => null),
    getQuote(symbol).catch(() => null),
  ]);

  // Chart history unavailable (TwelveData rate-limited?) but we still have a
  // live quote → serve a price-only snapshot so the page shows price + Buy
  // with an empty chart, rather than going blank. Only 404 when we truly have
  // nothing — an unknown/unsupported symbol.
  const resolved = snapshot ?? (quote ? snapshotFromQuote(symbol, quote, profile) : null);
  if (!resolved) return jsonError("not_found", `No data for ${symbol}.`);

  return jsonOk<SymbolDetailResponse>({ snapshot: resolved, profile, quote });
}
