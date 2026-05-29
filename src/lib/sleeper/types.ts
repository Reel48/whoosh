/**
 * Sleeper API response shapes (the subset we consume).
 * Sleeper is read-only and unauthenticated. See https://docs.sleeper.app/.
 * Only fields we actually use are typed; the API returns much more.
 */

export type NflState = {
  week: number;
  season: string;
  /** "pre" | "regular" | "post" | "off" */
  season_type: string;
  /** Week to display in UI (can differ from scoring week in off/pre season). */
  display_week?: number;
  leg?: number;
};

export type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  /** "pre_draft" | "drafting" | "in_season" | "complete" */
  status: string;
  avatar: string | null;
  total_rosters: number;
  roster_positions: string[];
  settings: Record<string, number>;
  scoring_settings: Record<string, number>;
};

export type RosterSettings = {
  wins: number;
  losses: number;
  ties: number;
  fpts: number;
  fpts_decimal?: number;
  fpts_against?: number;
  fpts_against_decimal?: number;
};

export type SleeperRoster = {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  settings: RosterSettings;
};

export type SleeperLeagueUser = {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: { team_name?: string } | null;
};

export type SleeperMatchup = {
  roster_id: number;
  matchup_id: number | null;
  points: number;
  starters: string[] | null;
  starters_points: number[] | null;
  players: string[] | null;
  players_points: Record<string, number> | null;
};

export type SleeperUser = {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
};
