import { supabase } from "@/lib/supabase";

export type Position = {
  symbol: string;
  shares: number;
  costBasisCents: number;
};

export type Order = {
  id: number;
  symbol: string;
  side: "buy" | "sell";
  shares: number;
  priceCents: number;
  totalCents: number;
  createdAt: string;
};

export type OrderResult =
  | { ok: true; orderId: number; totalCents: number }
  | { ok: false; error: string };

export async function getPositions(userId: string): Promise<Position[]> {
  const { data, error } = await supabase()
    .from("invest_position")
    .select("symbol, shares, cost_basis_cents")
    .eq("discord_user_id", userId)
    .order("symbol", { ascending: true });
  if (error) throw new Error(`getPositions failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    symbol: r.symbol,
    shares: Number(r.shares),
    costBasisCents: Number(r.cost_basis_cents),
  }));
}

export async function getRecentOrders(userId: string, limit = 20): Promise<Order[]> {
  const { data, error } = await supabase()
    .from("invest_order")
    .select("id, symbol, side, shares, price_cents, total_cents, created_at")
    .eq("discord_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getRecentOrders failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: Number(r.id),
    symbol: r.symbol,
    side: r.side as "buy" | "sell",
    shares: Number(r.shares),
    priceCents: Number(r.price_cents),
    totalCents: Number(r.total_cents),
    createdAt: r.created_at,
  }));
}

/**
 * Place a buy or sell order at the current market quote. Atomic via the
 * Postgres function: WB debit/credit, position upsert/decrement, and order
 * row are committed together or not at all.
 */
export async function placeOrder(
  userId: string,
  symbol: string,
  side: "buy" | "sell",
  shares: number,
  priceCents: number,
): Promise<OrderResult> {
  if (!Number.isFinite(shares) || shares <= 0) {
    return { ok: false, error: "Shares must be a positive number." };
  }
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    return { ok: false, error: "Price unavailable." };
  }
  const fn = side === "buy" ? "fn_invest_buy" : "fn_invest_sell";
  const { data, error } = await supabase().rpc(fn, {
    p_user_id: userId,
    p_symbol: symbol,
    p_shares: shares,
    p_price_cents: priceCents,
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("insufficient funds")) return { ok: false, error: "Insufficient funds." };
    if (msg.includes("position too small"))
      return { ok: false, error: "You don't own enough shares to sell that." };
    return { ok: false, error: `Order failed: ${msg}` };
  }
  const totalCents =
    side === "buy"
      ? Math.ceil(shares * priceCents)
      : Math.floor(shares * priceCents);
  return { ok: true, orderId: Number(data), totalCents };
}
