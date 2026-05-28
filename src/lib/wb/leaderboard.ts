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

const loadLeaderboardCached = unstable_cache(
  loadLeaderboardFresh,
  ["wb:leaderboard"],
  { revalidate: 60 },
);

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  return loadLeaderboardCached(limit);
}

export type TraderEntry = {
  rank: number;
  discordUserId: string;
  discordUsername: string;
  realizedPlCents: number;
  trades: number;
};

async function loadTradersFresh(args: { limit: number; days: number }): Promise<TraderEntry[]> {
  const { data, error } = await supabase().rpc("fn_wb_leaderboard_traders", {
    p_limit: args.limit,
    p_days: args.days,
  });
  if (error) throw new Error(`traders query failed: ${error.message}`);
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    rank: Number(r.rank),
    discordUserId: String(r.discord_user_id),
    discordUsername: String(r.discord_username),
    realizedPlCents: Number(r.realized_pl_cents),
    trades: Number(r.trades),
  }));
}

const loadTradersCached = unstable_cache(
  loadTradersFresh,
  ["wb:leaderboard-traders"],
  { revalidate: 60 },
);

export async function getTradersLeaderboard(limit = 10, days = 7): Promise<TraderEntry[]> {
  return loadTradersCached({ limit, days });
}

export type BiggestWinEntry = {
  rank: number;
  discordUserId: string;
  discordUsername: string;
  payoutCents: number;
  createdAt: string;
  memo: string | null;
};

async function loadBiggestWinsFresh(args: { limit: number; days: number }): Promise<BiggestWinEntry[]> {
  const { data, error } = await supabase().rpc("fn_wb_leaderboard_biggest_wins", {
    p_limit: args.limit,
    p_days: args.days,
  });
  if (error) throw new Error(`biggest wins query failed: ${error.message}`);
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    rank: Number(r.rank),
    discordUserId: String(r.discord_user_id),
    discordUsername: String(r.discord_username),
    payoutCents: Number(r.payout_cents),
    createdAt: String(r.created_at),
    memo: (r.memo as string | null) ?? null,
  }));
}

const loadBiggestWinsCached = unstable_cache(
  loadBiggestWinsFresh,
  ["wb:leaderboard-wins"],
  { revalidate: 60 },
);

export async function getBiggestWinsLeaderboard(limit = 10, days = 7): Promise<BiggestWinEntry[]> {
  return loadBiggestWinsCached({ limit, days });
}

export type StreakEntry = {
  rank: number;
  discordUserId: string;
  discordUsername: string;
  streakDay: number;
};

async function loadStreaksFresh(limit: number): Promise<StreakEntry[]> {
  const { data, error } = await supabase().rpc("fn_wb_leaderboard_streaks", { p_limit: limit });
  if (error) throw new Error(`streaks query failed: ${error.message}`);
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    rank: Number(r.rank),
    discordUserId: String(r.discord_user_id),
    discordUsername: String(r.discord_username),
    streakDay: Number(r.streak_day),
  }));
}

const loadStreaksCached = unstable_cache(
  loadStreaksFresh,
  ["wb:leaderboard-streaks"],
  { revalidate: 60 },
);

export async function getStreaksLeaderboard(limit = 10): Promise<StreakEntry[]> {
  return loadStreaksCached(limit);
}
