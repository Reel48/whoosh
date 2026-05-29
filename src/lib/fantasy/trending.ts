import { getTrending } from "@/lib/sleeper/client";
import { getPlayers } from "@/lib/sleeper/players";
import type { TrendingRow } from "@/components/fantasy/TrendingPlayers";

/** Trending adds/drops with player names resolved from the cached index. */
export async function getTrendingWithNames(
  type: "add" | "drop",
  limit = 12,
): Promise<TrendingRow[]> {
  const raw = await getTrending(type, limit).catch(() => []);
  if (raw.length === 0) return [];
  const players = await getPlayers(raw.map((r) => r.player_id));
  return raw.map((r) => ({
    count: r.count,
    player:
      players.get(r.player_id) ?? {
        playerId: r.player_id,
        fullName: r.player_id,
        position: null,
        team: null,
      },
  }));
}
