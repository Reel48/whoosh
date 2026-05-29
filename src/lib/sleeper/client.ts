import type {
  NflState,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperMatchup,
  SleeperRoster,
  SleeperTrending,
  SleeperUser,
} from "./types";

/**
 * Thin typed wrapper over the Sleeper HTTP API (read-only, no auth, no key).
 * https://docs.sleeper.app/ — budget is ~1000 req/min; we lean on Next's
 * per-fetch data cache (revalidate) so repeated reads of the same league/week
 * within the window are served from cache. Mirrors the fetch-revalidate
 * pattern already used in src/app/api/wb/search/route.ts.
 */

const BASE = "https://api.sleeper.app/v1";

/** Revalidation windows (seconds) per data volatility. */
export const SLEEPER_TTL = {
  state: 300,
  league: 300,
  rosters: 300,
  users: 300,
  matchups: 90,
  trending: 600,
  user: 3600,
} as const;

async function sleeperFetch<T>(
  path: string,
  revalidate: number,
): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { next: { revalidate } });
  } catch (e) {
    console.error(`Sleeper fetch failed for ${path}:`, e);
    return null;
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`Sleeper ${path}: ${res.status}`);
    return null;
  }
  try {
    return (await res.json()) as T;
  } catch (e) {
    console.error(`Sleeper ${path} parse failed:`, e);
    return null;
  }
}

export function getNflState(): Promise<NflState | null> {
  return sleeperFetch<NflState>("/state/nfl", SLEEPER_TTL.state);
}

export function getLeague(leagueId: string): Promise<SleeperLeague | null> {
  return sleeperFetch<SleeperLeague>(`/league/${leagueId}`, SLEEPER_TTL.league);
}

export async function getRosters(leagueId: string): Promise<SleeperRoster[]> {
  return (await sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`, SLEEPER_TTL.rosters)) ?? [];
}

export async function getLeagueUsers(leagueId: string): Promise<SleeperLeagueUser[]> {
  return (await sleeperFetch<SleeperLeagueUser[]>(`/league/${leagueId}/users`, SLEEPER_TTL.users)) ?? [];
}

export async function getMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  return (await sleeperFetch<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`, SLEEPER_TTL.matchups)) ?? [];
}

export async function getTrending(
  type: "add" | "drop",
  limit = 15,
): Promise<SleeperTrending[]> {
  return (
    (await sleeperFetch<SleeperTrending[]>(
      `/players/nfl/trending/${type}?lookback_hours=24&limit=${limit}`,
      SLEEPER_TTL.trending,
    )) ?? []
  );
}

/** Resolve a Sleeper username (or user_id) to the user object. */
export function getUserByName(username: string): Promise<SleeperUser | null> {
  return sleeperFetch<SleeperUser>(`/user/${encodeURIComponent(username)}`, SLEEPER_TTL.user);
}

/** Avatar thumbnail URL for a Sleeper avatar id (league/user avatars). */
export function avatarThumbUrl(avatarId: string | null): string | null {
  return avatarId ? `https://sleeper.app/avatars/thumbs/${avatarId}` : null;
}
