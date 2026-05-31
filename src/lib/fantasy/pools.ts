import { getLeague, getRosters, getLeagueUsers, avatarThumbUrl } from "@/lib/sleeper/client";
import {
  teamNameFor,
  usersById,
  listActiveLeagues,
  getLeagueConfig,
  type LeagueKind,
  type FantasyLeagueConfig,
} from "./leagues";
import { resolveOwnerAvatars } from "./avatars";

/**
 * Sleeper "pick'em" pools (Pick 'Em + Survivor). Unlike the H2H leagues these
 * have no rosters/points/records/matchups, and Sleeper's public API doesn't
 * expose pick standings — so we surface what it does give (participants, and
 * for Survivor each entry's alive/eliminated status) plus a link out to
 * Sleeper for the full picks experience.
 */

export type PoolEntry = {
  rosterId: number;
  name: string;
  ownerName: string;
  avatarUrl: string | null;
  /** Survivor: true once knocked out. null for Pick 'Em (not applicable). */
  eliminated: boolean | null;
};

export type PoolSummary = {
  config: FantasyLeagueConfig;
  kind: LeagueKind;
  displayName: string;
  /** Custom uploaded logo (falls back to the Sleeper avatar, then a monogram). */
  logoUrl: string | null;
  totalEntries: number;
  /** Survivor only — how many are still alive. */
  aliveCount: number | null;
  sleeperUrl: string;
};

export type PoolDetail = PoolSummary & {
  season: string;
  status: string | null;
  entries: PoolEntry[];
};

function sleeperUrl(leagueId: string): string {
  return `https://sleeper.com/leagues/${leagueId}`;
}

function sortEntries(entries: PoolEntry[]): PoolEntry[] {
  // Survivor: alive first, then by name. Pick 'Em: by name.
  return [...entries].sort(
    (a, b) => Number(!!a.eliminated) - Number(!!b.eliminated) || a.name.localeCompare(b.name),
  );
}

/** Lightweight summaries for every active pool (Pick 'Em / Survivor). */
export async function listPoolSummaries(): Promise<PoolSummary[]> {
  const configs = (await listActiveLeagues()).filter((c) => c.kind !== "standard");
  return Promise.all(
    configs.map(async (c): Promise<PoolSummary> => {
      const [league, rosters] = await Promise.all([
        getLeague(c.sleeperLeagueId).catch(() => null),
        getRosters(c.sleeperLeagueId).catch(() => []),
      ]);
      // Sleeper keeps every roster *slot* from prior seasons even after members
      // are removed, so rosters.length over-counts. Only rosters with an
      // owner_id are actually claimed — that's the real number signed up.
      const claimed = rosters.filter((r) => r.owner_id);
      const aliveCount =
        c.kind === "survivor"
          ? claimed.filter((r) => r.metadata?.is_eliminated !== "true").length
          : null;
      return {
        config: c,
        kind: c.kind,
        displayName: c.name?.trim() || league?.name || "Pool",
        logoUrl: c.logoUrl ?? avatarThumbUrl(league?.avatar ?? null),
        totalEntries: claimed.length,
        aliveCount,
        sleeperUrl: sleeperUrl(c.sleeperLeagueId),
      };
    }),
  );
}

/** Full detail for one pool: participants (+ alive/eliminated for Survivor). */
export async function getPoolDetail(sleeperLeagueId: string): Promise<PoolDetail | null> {
  const config = await getLeagueConfig(sleeperLeagueId);
  if (!config || config.kind === "standard") return null;

  const [league, rosters, users] = await Promise.all([
    getLeague(sleeperLeagueId).catch(() => null),
    getRosters(sleeperLeagueId).catch(() => []),
    getLeagueUsers(sleeperLeagueId).catch(() => []),
  ]);

  // config.kind is "pickem" | "survivor" here (standard returned above).
  const kind = config.kind;
  const byUser = usersById(users);
  // Only claimed rosters are real participants — Sleeper retains empty slots
  // from prior seasons (see listPoolSummaries).
  const claimed = rosters.filter((r) => r.owner_id);
  // Same as the H2H leagues: linked member's Discord PFP → Sleeper avatar → monogram.
  const ownerAvatars = await resolveOwnerAvatars(claimed.map((r) => r.owner_id)).catch(
    () => new Map<string, string>(),
  );

  const entries: PoolEntry[] = claimed.map((r) => {
    const user = r.owner_id ? byUser.get(r.owner_id) : undefined;
    return {
      rosterId: r.roster_id,
      name: teamNameFor(user, r.roster_id),
      ownerName: user?.display_name ?? "—",
      avatarUrl:
        (r.owner_id ? ownerAvatars.get(r.owner_id) : undefined) ??
        avatarThumbUrl(user?.avatar ?? null),
      eliminated: kind === "survivor" ? r.metadata?.is_eliminated === "true" : null,
    };
  });

  const aliveCount = kind === "survivor" ? entries.filter((e) => !e.eliminated).length : null;

  return {
    config,
    kind,
    displayName: config.name?.trim() || league?.name || "Pool",
    logoUrl: config.logoUrl ?? avatarThumbUrl(league?.avatar ?? null),
    season: league?.season ?? config.season,
    status: league?.status ?? null,
    totalEntries: entries.length,
    aliveCount,
    entries: sortEntries(entries),
    sleeperUrl: sleeperUrl(sleeperLeagueId),
  };
}
