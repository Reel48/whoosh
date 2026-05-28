import { supabase } from "@/lib/supabase";
import { WB_PER_USD } from "@/lib/wb/purchase";

export type DividendRecord = {
  id: number;
  symbol: string;
  exDate: string;
  wbCentsPerShare: number;
  source: string;
  usersCredited: number;
  createdAt: string;
};

/**
 * Post a dividend for everyone holding the symbol on ex-date.
 *
 * `usdPerShare` is the cash dividend in real US dollars per share (e.g. 0.27
 * for Apple's recent quarterly). We convert to WB cents at the 1 USD = 10 WB
 * rate before calling the SQL function.
 *
 * Idempotent on (symbol, ex_date) via the wb_dividend unique constraint and
 * per-user via fn_post_dividend's (ref_kind, ref_id) check — re-running the
 * same dividend is a no-op.
 */
export async function postDividend(input: {
  symbol: string;
  exDate: string;            // "YYYY-MM-DD"
  usdPerShare: number;
  source: "admin_manual" | "twelve_data";
  postedBy?: string | null;  // admin discord user id
}): Promise<{ usersCredited: number; alreadyPosted: boolean }> {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) throw new Error("symbol required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.exDate)) {
    throw new Error("exDate must be YYYY-MM-DD");
  }
  if (!Number.isFinite(input.usdPerShare) || input.usdPerShare <= 0) {
    throw new Error("usdPerShare must be a positive number");
  }
  // $0.27/share × 10 WB/USD × 100 cents/WB = 270 WB cents/share
  const wbCentsPerShare = Math.round(input.usdPerShare * WB_PER_USD * 100);
  if (wbCentsPerShare <= 0) throw new Error("dividend rounds to zero");

  const sb = supabase();

  // Idempotency: skip if this (symbol, exDate) was already processed.
  const { data: existing } = await sb
    .from("wb_dividend")
    .select("id, users_credited")
    .eq("symbol", symbol)
    .eq("ex_date", input.exDate)
    .maybeSingle();
  if (existing) {
    return { usersCredited: Number(existing.users_credited), alreadyPosted: true };
  }

  // Credit all holders.
  const { data, error } = await sb.rpc("fn_post_dividend", {
    p_symbol: symbol,
    p_ex_date: input.exDate,
    p_wb_cents_per_share: wbCentsPerShare,
  });
  if (error) throw new Error(`fn_post_dividend failed: ${error.message}`);
  const usersCredited = Number(data ?? 0);

  // Log it.
  const { error: logErr } = await sb.from("wb_dividend").insert({
    symbol,
    ex_date: input.exDate,
    wb_cents_per_share: wbCentsPerShare,
    source: input.source,
    posted_by: input.postedBy ?? null,
    users_credited: usersCredited,
  });
  if (logErr) console.warn("wb_dividend log insert failed (non-fatal):", logErr.message);

  return { usersCredited, alreadyPosted: false };
}

export async function listRecentDividends(limit = 25): Promise<DividendRecord[]> {
  const { data, error } = await supabase()
    .from("wb_dividend")
    .select("id, symbol, ex_date, wb_cents_per_share, source, users_credited, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listRecentDividends failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: Number(r.id),
    symbol: r.symbol,
    exDate: r.ex_date,
    wbCentsPerShare: Number(r.wb_cents_per_share),
    source: r.source,
    usersCredited: Number(r.users_credited),
    createdAt: r.created_at,
  }));
}

/** All distinct symbols currently held across all users — input for the
 *  daily Twelve Data dividend poll. */
export async function listHeldSymbols(): Promise<string[]> {
  const { data, error } = await supabase()
    .from("invest_position")
    .select("symbol")
    .gt("shares", 0);
  if (error) throw new Error(`listHeldSymbols failed: ${error.message}`);
  const set = new Set<string>();
  for (const r of data ?? []) set.add(r.symbol);
  return Array.from(set);
}
