import { supabase } from "@/lib/supabase";
import {
  getLeague,
  getLeagueUsers,
  getRosters,
  avatarThumbUrl,
} from "@/lib/sleeper/client";
import type { SleeperLeague, SleeperLeagueUser, SleeperRoster, RosterSettings } from "@/lib/sleeper/types";
import { resolveOwnerAvatars } from "./avatars";

/** Game type of a curated league. Standard = H2H fantasy; the rest are Sleeper
 *  pick'em pools that don't have rosters/points/records/matchups. */
export type LeagueKind = "standard" | "pickem" | "survivor";

/** Derive a league's kind from the Sleeper league object (sport + pickem_type). */
export function detectLeagueKind(league: SleeperLeague | null): LeagueKind {
  if (league?.sport === "pickem:nfl") {
    return league.settings?.pickem_type === 1 ? "survivor" : "pickem";
  }
  return "standard";
}

/** A curated Whoosh league row from `fantasy_league`. */
export type FantasyLeagueConfig = {
  sleeperLeagueId: string;
  season: string;
  /** Display override; null falls back to the Sleeper league name. */
  name: string | null;
  sort: number;
  active: boolean;
  /** Custom uploaded logo; null falls back to the Sleeper league avatar. */
  logoUrl: string | null;
  /** Game type — standard H2H, or a pick'em / survivor pool. */
  kind: LeagueKind;
  /** One-time entry fee in USD cents. null/0 = not purchasable (free/legacy). */
  entryFeeCents: number | null;
  /** Sleeper invite link, revealed only after a paid entitlement. */
  joinUrl: string | null;
  /** Interchangeable leagues share one product/payment. Falls back to the
   *  league id (each league is then its own group). */
  groupKey: string;
  /** Max paid entries per league — used to balance auto-assignment. */
  capacity: number;
  /** Display name for the shared product (e.g. "Whoosh PPR League"). */
  productName: string | null;
};

export type StandingRow = {
  rosterId: number;
  ownerId: string | null;
  teamName: string;
  ownerName: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
};

export type LeagueOverview = {
  config: FantasyLeagueConfig;
  displayName: string;
  season: string;
  status: string | null;
  avatarUrl: string | null;
  totalRosters: number;
  standings: StandingRow[];
};

/** Sleeper stores points split as integer + hundredths (fpts + fpts_decimal). */
function combinePoints(whole: number | undefined, decimal: number | undefined): number {
  return (whole ?? 0) + (decimal ?? 0) / 100;
}

/** Team display name preference: explicit team_name → display name → "Team N". */
export function teamNameFor(user: SleeperLeagueUser | undefined, rosterId: number): string {
  return user?.metadata?.team_name?.trim() || user?.display_name || `Team ${rosterId}`;
}

export async function listActiveLeagues(): Promise<FantasyLeagueConfig[]> {
  const { data, error } = await supabase()
    .from("fantasy_league")
    .select("sleeper_league_id, season, name, sort, active, logo_url, kind, entry_fee_cents, join_url, group_key, capacity, product_name")
    .eq("active", true)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listActiveLeagues failed: ${error.message}`);
  return (data ?? []).map(shapeConfig);
}

export async function listAllLeagues(): Promise<FantasyLeagueConfig[]> {
  const { data, error } = await supabase()
    .from("fantasy_league")
    .select("sleeper_league_id, season, name, sort, active, logo_url, kind, entry_fee_cents, join_url, group_key, capacity, product_name")
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listAllLeagues failed: ${error.message}`);
  return (data ?? []).map(shapeConfig);
}

export async function getLeagueConfig(sleeperLeagueId: string): Promise<FantasyLeagueConfig | null> {
  const { data, error } = await supabase()
    .from("fantasy_league")
    .select("sleeper_league_id, season, name, sort, active, logo_url, kind, entry_fee_cents, join_url, group_key, capacity, product_name")
    .eq("sleeper_league_id", sleeperLeagueId)
    .maybeSingle();
  if (error) throw new Error(`getLeagueConfig failed: ${error.message}`);
  return data ? shapeConfig(data) : null;
}

function shapeConfig(r: Record<string, unknown>): FantasyLeagueConfig {
  return {
    sleeperLeagueId: String(r.sleeper_league_id),
    season: String(r.season),
    name: (r.name as string | null) ?? null,
    sort: Number(r.sort ?? 0),
    active: Boolean(r.active),
    logoUrl: (r.logo_url as string | null) ?? null,
    kind: ((r.kind as string) ?? "standard") as LeagueKind,
    entryFeeCents: (r.entry_fee_cents as number | null) ?? null,
    joinUrl: (r.join_url as string | null) ?? null,
    // Falls back to the league id so an ungrouped league is its own product.
    groupKey: (r.group_key as string | null)?.trim() || String(r.sleeper_league_id),
    capacity: Number(r.capacity ?? 10),
    productName: (r.product_name as string | null) ?? null,
  };
}

/** Build a usersById map keyed by user_id from a league's users list. */
export function usersById(users: SleeperLeagueUser[]): Map<string, SleeperLeagueUser> {
  return new Map(users.map((u) => [u.user_id, u]));
}

function buildStandings(
  rosters: SleeperRoster[],
  byUser: Map<string, SleeperLeagueUser>,
): StandingRow[] {
  const rows: StandingRow[] = rosters.map((r) => {
    const user = r.owner_id ? byUser.get(r.owner_id) : undefined;
    const s: Partial<RosterSettings> = r.settings ?? {};
    return {
      rosterId: r.roster_id,
      ownerId: r.owner_id,
      teamName: teamNameFor(user, r.roster_id),
      ownerName: user?.display_name ?? "—",
      avatarUrl: avatarThumbUrl(user?.avatar ?? null),
      wins: s.wins ?? 0,
      losses: s.losses ?? 0,
      ties: s.ties ?? 0,
      pointsFor: combinePoints(s.fpts, s.fpts_decimal),
      pointsAgainst: combinePoints(s.fpts_against, s.fpts_against_decimal),
    };
  });
  // Standard standings sort: wins desc, then points-for desc.
  rows.sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);
  return rows;
}

/**
 * Merge a curated league's Sleeper league + rosters + users into standings.
 * Returns null if the league config is missing; tolerates Sleeper being down
 * (returns empty standings with whatever metadata we have).
 */
export async function getLeagueOverview(sleeperLeagueId: string): Promise<LeagueOverview | null> {
  const config = await getLeagueConfig(sleeperLeagueId);
  if (!config) return null;

  const [league, rosters, users] = await Promise.all([
    getLeague(sleeperLeagueId).catch(() => null),
    getRosters(sleeperLeagueId).catch(() => []),
    getLeagueUsers(sleeperLeagueId).catch(() => []),
  ]);

  const byUser = usersById(users);
  // Team avatars: linked member's Discord PFP → Sleeper avatar → monogram.
  const ownerAvatars = await resolveOwnerAvatars(rosters.map((r) => r.owner_id)).catch(() => new Map());
  const standings = buildStandings(rosters, byUser).map((s) => ({
    ...s,
    avatarUrl: (s.ownerId ? ownerAvatars.get(s.ownerId) : undefined) ?? s.avatarUrl,
  }));

  return {
    config,
    displayName: config.name?.trim() || league?.name || "League",
    season: league?.season ?? config.season,
    status: league?.status ?? null,
    // Custom uploaded logo wins; otherwise fall back to the Sleeper avatar.
    avatarUrl: config.logoUrl ?? avatarThumbUrl(league?.avatar ?? null),
    totalRosters: league?.total_rosters ?? rosters.length,
    standings,
  };
}
