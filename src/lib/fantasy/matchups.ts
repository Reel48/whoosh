import { getLeagueUsers, getMatchups, getRosters } from "@/lib/sleeper/client";
import { teamNameFor, usersById } from "./leagues";
import { resolveOwnerAvatars } from "./avatars";
import type { SleeperMatchup, SleeperRoster } from "@/lib/sleeper/types";

export type MatchupTeam = {
  rosterId: number;
  ownerId: string | null;
  teamName: string;
  avatarUrl: string | null;
  points: number;
  isMine: boolean;
};

export type Matchup = {
  /** Sleeper matchup_id grouping the two teams; null = bye / no opponent. */
  matchupId: number | null;
  home: MatchupTeam;
  away: MatchupTeam | null;
};

/**
 * The current/given week's matchups for a league, paired by matchup_id, with
 * team names resolved and the linked member's team flagged (`isMine`).
 */
export async function getWeekMatchups(
  sleeperLeagueId: string,
  week: number,
  mineSleeperUserId?: string | null,
): Promise<Matchup[]> {
  const [raw, rosters, users] = await Promise.all([
    getMatchups(sleeperLeagueId, week).catch(() => []),
    getRosters(sleeperLeagueId).catch(() => []),
    getLeagueUsers(sleeperLeagueId).catch(() => []),
  ]);
  if (raw.length === 0) return [];

  const byUser = usersById(users);
  const rosterById = new Map<number, SleeperRoster>(rosters.map((r) => [r.roster_id, r]));
  // Team avatars use the linked member's Discord PFP (monogram fallback).
  const ownerAvatars = await resolveOwnerAvatars(rosters.map((r) => r.owner_id)).catch(() => new Map());

  const team = (rosterId: number, points: number): MatchupTeam => {
    const roster = rosterById.get(rosterId);
    const user = roster?.owner_id ? byUser.get(roster.owner_id) : undefined;
    return {
      rosterId,
      ownerId: roster?.owner_id ?? null,
      teamName: teamNameFor(user, rosterId),
      avatarUrl: roster?.owner_id ? ownerAvatars.get(roster.owner_id) ?? null : null,
      points: Math.round(points * 100) / 100,
      isMine: !!mineSleeperUserId && roster?.owner_id === mineSleeperUserId,
    };
  };

  // Group rows by matchup_id (two rows share an id = opponents).
  const groups = new Map<number, SleeperMatchup[]>();
  const byes: SleeperMatchup[] = [];
  for (const row of raw) {
    if (row.matchup_id == null) {
      byes.push(row);
      continue;
    }
    const list = groups.get(row.matchup_id) ?? [];
    list.push(row);
    groups.set(row.matchup_id, list);
  }

  const matchups: Matchup[] = [];
  for (const [matchupId, rows] of groups) {
    const sorted = [...rows].sort((a, b) => a.roster_id - b.roster_id);
    const home = team(sorted[0].roster_id, sorted[0].points ?? 0);
    const away = sorted[1] ? team(sorted[1].roster_id, sorted[1].points ?? 0) : null;
    matchups.push({ matchupId, home, away });
  }
  for (const row of byes) {
    matchups.push({ matchupId: null, home: team(row.roster_id, row.points ?? 0), away: null });
  }

  // Surface the member's own matchup first, then by matchup id.
  matchups.sort((a, b) => {
    const aMine = a.home.isMine || a.away?.isMine ? 0 : 1;
    const bMine = b.home.isMine || b.away?.isMine ? 0 : 1;
    return aMine - bMine || (a.matchupId ?? 1e9) - (b.matchupId ?? 1e9);
  });
  return matchups;
}
