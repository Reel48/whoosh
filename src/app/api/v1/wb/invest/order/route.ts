import { NextResponse } from "next/server";
import { ensureWallet } from "@/lib/wb/ledger";
import { getQuote } from "@/lib/wb/quotes";
import { placeOrder } from "@/lib/wb/invest";
import { evaluateAchievements } from "@/lib/wb/achievements";
import { jsonError, readJson, requireBearerSession, respondResult } from "@/lib/api/json";
import type { InvestOrderRequest, InvestOrderResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * JSON re-shell of `POST /api/wb/invest/order`. Same logic: quote the symbol,
 * convert a USD amount → fractional shares (or use an explicit share count),
 * then `placeOrder`.
 */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  await ensureWallet(session.id, session.username);

  const body = await readJson<InvestOrderRequest>(req);
  if (!body) return jsonError("validation", "Request body must be valid JSON.");

  const symbol = String(body.symbol ?? "").toUpperCase().trim();
  const side: "buy" | "sell" = body.side === "sell" ? "sell" : "buy";
  const amountCents =
    typeof body.amount === "number" && Number.isFinite(body.amount)
      ? Math.round(body.amount * 100)
      : 0;
  const shares =
    typeof body.shares === "number" && Number.isFinite(body.shares) ? body.shares : null;

  if (!symbol) return jsonError("validation", "Symbol is required.");
  if (amountCents <= 0 && (!shares || shares <= 0)) {
    return jsonError("validation", "Enter either a USD amount or a share count.");
  }

  const quote = await getQuote(symbol);
  if (!quote) return jsonError("not_found", `No quote available for ${symbol}.`);

  // Dollar amount → fractional shares (6 dp); prefer an explicit share count
  // for sells so a position can be closed cleanly.
  const orderShares =
    shares && shares > 0
      ? Math.round(shares * 1_000_000) / 1_000_000
      : Math.round((amountCents / quote.priceCents) * 1_000_000) / 1_000_000;
  if (orderShares <= 0) return jsonError("validation", "Order size too small.");

  const result = await placeOrder(session.id, symbol, side, orderShares, quote.priceCents);
  if (result.ok) await evaluateAchievements(session.id).catch(() => {});
  return respondResult<{ orderId: number; totalCents: number }, InvestOrderResponse>(
    result,
    (r) => ({ orderId: r.orderId, totalCents: r.totalCents }),
  );
}
