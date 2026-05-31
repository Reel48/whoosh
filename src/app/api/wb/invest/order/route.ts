import { NextResponse } from "next/server";
import { ensureWallet } from "@/lib/wb/ledger";
import { getQuote } from "@/lib/wb/quotes";
import { placeOrder } from "@/lib/wb/invest";
import { evaluateAchievements } from "@/lib/wb/achievements";
import { redirectError, redirectOk, requireSession } from "@/lib/api/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEST = "/capital/invest";

export async function POST(req: Request) {
  const session = await requireSession(req, DEST);
  if (session instanceof NextResponse) return session;
  await ensureWallet(session.id, session.username);

  let symbol = "";
  let side: "buy" | "sell" = "buy";
  let amountCents = 0;
  let shares: number | null = null;
  try {
    const form = await req.formData();
    symbol = String(form.get("symbol") ?? "").toUpperCase().trim();
    const rawSide = String(form.get("side") ?? "");
    side = rawSide === "sell" ? "sell" : "buy";
    const amt = form.get("amount");
    if (typeof amt === "string" && amt.trim() !== "") {
      amountCents = Math.round(Number(amt) * 100);
    }
    const sh = form.get("shares");
    if (typeof sh === "string" && sh.trim() !== "") {
      shares = Number(sh);
    }
  } catch {
    return redirectError(req, DEST, "Could not parse request.");
  }

  if (!symbol) return redirectError(req, DEST, "Symbol is required.");
  if ((amountCents <= 0 || !Number.isFinite(amountCents)) && (!shares || !Number.isFinite(shares))) {
    return redirectError(req, DEST, "Enter either a USD amount or a share count.");
  }

  const quote = await getQuote(symbol);
  if (!quote) return redirectError(req, DEST, `No quote available for ${symbol}.`);

  // Convert dollar amount → fractional shares (6 dp). For sells, prefer share
  // count if provided so the user can close out a position cleanly.
  let orderShares: number;
  if (shares && shares > 0) {
    orderShares = Math.round(shares * 1_000_000) / 1_000_000;
  } else {
    orderShares = Math.round((amountCents / quote.priceCents) * 1_000_000) / 1_000_000;
  }
  if (orderShares <= 0) return redirectError(req, DEST, "Order size too small.");

  const result = await placeOrder(session.id, symbol, side, orderShares, quote.priceCents);
  if (!result.ok) return redirectError(req, DEST, result.error);

  await evaluateAchievements(session.id).catch(() => {});

  return redirectOk(req, DEST, "order=ok");
}
