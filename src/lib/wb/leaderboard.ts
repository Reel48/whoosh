import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";

export type LeaderboardEntry = {
  rank: number;
  discordUserId: string;
  discordUsername: string;
  cashCents: number;
  investedCostBasisCents: number;
  openWagerStakesCents: number;
  totalWbCents: number;
};

async function loadLeaderboardFresh(limit: number): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase().rpc("fn_wb_leaderboard", { p_limit: limit });
  if (error) throw new Error(`leaderboard query failed: ${error.message}`);
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    rank: Number(r.rank),
    discordUserId: String(r.discord_user_id),
    discordUsername: String(r.discord_username),
    cashCents: Number(r.cash_cents),
    investedCostBasisCents: Number(r.invested_cost_basis_cents),
    openWagerStakesCents: Number(r.open_wager_stakes_cents),
    totalWbCents: Number(r.total_wb_cents),
  }));
}

/**
 * Top N WB holders. Cached 60s across requests — leaderboards don't need to be
 * real-time, and this lets the home page render without hitting Postgres on
 * every visit.
 */
const loadLeaderboardCached = unstable_cache(
  loadLeaderboardFresh,
  ["wb:leaderboard"],
  { revalidate: 60 },
);

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  return loadLeaderboardCached(limit);
}
