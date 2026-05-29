import { supabase } from "@/lib/supabase";
import type { SleeperPlayerRaw } from "./types";

/**
 * Sleeper player index cache. The live /players/nfl endpoint returns ~5 MB
 * (every NFL player) and Sleeper asks callers to hit it at most once per day,
 * so we cache a lean projection in the `sleeper_player` table (refreshed by
 * the /api/cron/sleeper-players cron) and read names/positions from there.
 * Mirrors the cache-through shape of src/lib/wb/quotes.ts.
 */

export type PlayerInfo = {
  playerId: string;
  fullName: string;
  position: string | null;
  team: string | null;
};

/** Positions we keep — fantasy-relevant only, to keep the table small. */
const KEEP_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

/**
 * Pull the full player map from Sleeper and upsert the fantasy-relevant subset
 * into `sleeper_player`. Returns the number of rows written. Cron-only.
 */
export async function refreshPlayers(): Promise<number> {
  let res: Response;
  try {
    res = await fetch("https://api.sleeper.app/v1/players/nfl", { cache: "no-store" });
  } catch (e) {
    throw new Error(`players fetch failed: ${e instanceof Error ? e.message : "unknown"}`);
  }
  if (!res.ok) throw new Error(`players fetch: ${res.status}`);
  const map = (await res.json()) as Record<string, SleeperPlayerRaw>;

  const now = new Date().toISOString();
  const rows: {
    player_id: string;
    full_name: string | null;
    position: string | null;
    team: string | null;
    status: string | null;
    updated_at: string;
  }[] = [];

  for (const [id, p] of Object.entries(map)) {
    const position = p.position ?? null;
    if (!position || !KEEP_POSITIONS.has(position)) continue;
    const fullName =
      p.full_name ||
      [p.first_name, p.last_name].filter(Boolean).join(" ") ||
      id;
    rows.push({
      player_id: id,
      full_name: fullName,
      position,
      team: p.team ?? null,
      status: p.status ?? null,
      updated_at: now,
    });
  }

  // Upsert in batches to stay under statement/payload limits.
  const BATCH = 500;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase()
      .from("sleeper_player")
      .upsert(chunk, { onConflict: "player_id" });
    if (error) throw new Error(`players upsert failed: ${error.message}`);
    written += chunk.length;
  }
  return written;
}

/** Look up display info for a set of player ids from the cached table. */
export async function getPlayers(ids: string[]): Promise<Map<string, PlayerInfo>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase()
    .from("sleeper_player")
    .select("player_id, full_name, position, team")
    .in("player_id", unique);
  if (error) throw new Error(`getPlayers failed: ${error.message}`);
  const out = new Map<string, PlayerInfo>();
  for (const r of data ?? []) {
    out.set(r.player_id, {
      playerId: r.player_id,
      fullName: r.full_name ?? r.player_id,
      position: r.position ?? null,
      team: r.team ?? null,
    });
  }
  return out;
}

/** Simple name search over the cached index (for the Players page). */
export async function searchPlayers(query: string, limit = 25): Promise<PlayerInfo[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase()
    .from("sleeper_player")
    .select("player_id, full_name, position, team")
    .ilike("full_name", `%${q}%`)
    .limit(limit);
  if (error) throw new Error(`searchPlayers failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    playerId: r.player_id,
    fullName: r.full_name ?? r.player_id,
    position: r.position ?? null,
    team: r.team ?? null,
  }));
}
