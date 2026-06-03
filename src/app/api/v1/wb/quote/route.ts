import { NextResponse } from "next/server";
import { getQuote } from "@/lib/wb/quotes";
import { jsonError, jsonOk, requireBearerSession } from "@/lib/api/json";
import type { QuoteResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single live quote. Bearer-required to preserve the form route's intent — it's
 * a proxy in front of the upstream quote endpoint, deliberately not exposed
 * unauthenticated.
 */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const symbol = new URL(req.url).searchParams.get("symbol") ?? "";
  if (!symbol.trim()) return jsonError("validation", "symbol required");

  const quote = await getQuote(symbol);
  if (!quote) return jsonError("not_found", "Quote unavailable.");
  return jsonOk<QuoteResponse>(quote);
}
