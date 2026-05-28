import { supabase } from "@/lib/supabase";

export type WatchEntry = {
  symbol: string;
  addedAt: string;
};

export async function getWatchlist(userId: string): Promise<WatchEntry[]> {
  const { data, error } = await supabase()
    .from("user_watchlist")
    .select("symbol, added_at")
    .eq("discord_user_id", userId)
    .order("added_at", { ascending: false });
  if (error) throw new Error(`getWatchlist failed: ${error.message}`);
  return (data ?? []).map((r) => ({ symbol: r.symbol, addedAt: r.added_at }));
}

export async function addToWatchlist(userId: string, symbol: string): Promise<void> {
  const s = symbol.trim().toUpperCase();
  if (!s) return;
  const { error } = await supabase()
    .from("user_watchlist")
    .upsert(
      { discord_user_id: userId, symbol: s },
      { onConflict: "discord_user_id,symbol", ignoreDuplicates: true },
    );
  if (error) throw new Error(`addToWatchlist failed: ${error.message}`);
}

export async function removeFromWatchlist(userId: string, symbol: string): Promise<void> {
  const { error } = await supabase()
    .from("user_watchlist")
    .delete()
    .eq("discord_user_id", userId)
    .eq("symbol", symbol.toUpperCase());
  if (error) throw new Error(`removeFromWatchlist failed: ${error.message}`);
}

export async function isWatching(userId: string, symbol: string): Promise<boolean> {
  const { data, error } = await supabase()
    .from("user_watchlist")
    .select("symbol")
    .eq("discord_user_id", userId)
    .eq("symbol", symbol.toUpperCase())
    .maybeSingle();
  if (error) throw new Error(`isWatching failed: ${error.message}`);
  return !!data;
}
