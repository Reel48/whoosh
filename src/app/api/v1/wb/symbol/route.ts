import { NextResponse } from "next/server";
import { getStockSnapshot, RANGE_OPTIONS, type RangeKey } from "@/lib/wb/history";
import { getCompanyProfile } from "@/lib/wb/profile";
import { getQuote } from "@/lib/wb/quotes";
import { jsonError, jsonOk, requireBearerSession } from "@/lib/api/json";
import type { SymbolDetailResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRange(s: string): s is RangeKey {
  return RANGE_OPTIONS.some((r) => r.key === s);
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
  if (!snapshot) return jsonError("not_found", `No data for ${symbol}.`);

  return jsonOk<SymbolDetailResponse>({ snapshot, profile, quote });
}
