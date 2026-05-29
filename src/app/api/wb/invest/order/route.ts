import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ensureWallet } from "@/lib/wb/ledger";
import { getQuote } from "@/lib/wb/quotes";
import { placeOrder } from "@/lib/wb/invest";
import { evaluateAchievements } from "@/lib/wb/achievements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      new URL("/api/auth/discord?next=/capital/invest", req.url),
      303,
    );
  }
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
    return back(req, "Could not parse request.");
  }

  if (!symbol) return back(req, "Symbol is required.");
  if ((amountCents <= 0 || !Number.isFinite(amountCents)) && (!shares || !Number.isFinite(shares))) {
    return back(req, "Enter either a USD amount or a share count.");
  }

  const quote = await getQuote(symbol);
  if (!quote) return back(req, `No quote available for ${symbol}.`);

  // Convert dollar amount → fractional shares (6 dp). For sells, prefer share
  // count if provided so the user can close out a position cleanly.
  let orderShares: number;
  if (shares && shares > 0) {
    orderShares = Math.round(shares * 1_000_000) / 1_000_000;
  } else {
    orderShares = Math.round((amountCents / quote.priceCents) * 1_000_000) / 1_000_000;
  }
  if (orderShares <= 0) return back(req, "Order size too small.");

  const result = await placeOrder(session.id, symbol, side, orderShares, quote.priceCents);
  if (!result.ok) return back(req, result.error);

  await evaluateAchievements(session.id).catch(() => {});

  return NextResponse.redirect(new URL("/capital/invest?order=ok", req.url), 303);
}

function back(req: Request, msg: string) {
  return NextResponse.redirect(
    new URL(`/capital/invest?error=${encodeURIComponent(msg)}`, req.url),
    303,
  );
}
