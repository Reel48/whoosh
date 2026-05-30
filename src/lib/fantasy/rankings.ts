import { listActiveLeagues, getLeagueOverview, type LeagueOverview } from "./leagues";

/**
 * Cross-league "Power Rankings" — pools every team across all active Whoosh
 * leagues into one ordered scoreboard. Each team is its own row (no per-manager
 * aggregation). The leagues use identical scoring, so raw Points For are
 * directly comparable; we still min-max scale PF across the whole field so it
 * sits on the same 0–100 axis as win% in the blend.
 *
 * This is the live precursor to season-end relegation/promotion between the
 * leagues — it's the single ordered table those rules will read from.
 */

/** Blend weights for the Power Score. Tunable; could move to admin config. */
export const POWER_WEIGHTS = { record: 0.5, points: 0.5 } as const;

export type CrossLeagueRow = {
  rank: number;
  rosterId: number;
  ownerId: string | null;
  teamName: string;
  ownerName: string;
  avatarUrl: string | null;
  leagueId: string;
  leagueName: string;
  /** 1-based finish within that team's own league. */
  leaguePosition: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
  powerScore: number;
};

export type CrossLeagueScoreboard = {
  rows: CrossLeagueRow[];
  leagues: { id: string; name: string }[];
};

function winPct(wins: number, losses: number, ties: number): number {
  const games = wins + losses + ties;
  return games > 0 ? (wins + 0.5 * ties) / games : 0;
}

/**
 * Build the combined scoreboard from each league's standings. Reuses
 * getLeagueOverview (no extra Sleeper calls beyond the per-league fetches).
 */
export async function getCrossLeagueScoreboard(): Promise<CrossLeagueScoreboard> {
  // H2H leagues only — pick'em / survivor pools have no points or records.
  const configs = (await listActiveLeagues()).filter((c) => c.kind === "standard");
  const overviews = (
    await Promise.all(configs.map((c) => getLeagueOverview(c.sleeperLeagueId).catch(() => null)))
  ).filter((o): o is LeagueOverview => o !== null);

  // Flatten every team; sorted-standings index → league position.
  type Entry = Omit<CrossLeagueRow, "rank" | "powerScore">;
  const entries: Entry[] = overviews.flatMap((o) =>
    o.standings.map((s, i) => ({
      rosterId: s.rosterId,
      ownerId: s.ownerId,
      teamName: s.teamName,
      ownerName: s.ownerName,
      avatarUrl: s.avatarUrl,
      leagueId: o.config.sleeperLeagueId,
      leagueName: o.displayName,
      leaguePosition: i + 1,
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      winPct: winPct(s.wins, s.losses, s.ties),
      pointsFor: s.pointsFor,
    })),
  );

  // Min-max scale PF across the whole field to 0–100 (equal/empty → 50).
  const pfValues = entries.map((e) => e.pointsFor);
  const minPf = Math.min(...pfValues, 0);
  const maxPf = Math.max(...pfValues, 0);
  const span = maxPf - minPf;
  const pfNorm = (pf: number): number => (span > 0 ? ((pf - minPf) / span) * 100 : 50);

  const scored: CrossLeagueRow[] = entries
    .map((e) => ({
      ...e,
      rank: 0,
      powerScore:
        POWER_WEIGHTS.record * (e.winPct * 100) + POWER_WEIGHTS.points * pfNorm(e.pointsFor),
    }))
    // powerScore desc → better (lower) league position → more PF → name.
    .sort(
      (a, b) =>
        b.powerScore - a.powerScore ||
        a.leaguePosition - b.leaguePosition ||
        b.pointsFor - a.pointsFor ||
        a.teamName.localeCompare(b.teamName),
    )
    .map((row, i) => ({ ...row, rank: i + 1 }));

  return {
    rows: scored,
    leagues: overviews.map((o) => ({ id: o.config.sleeperLeagueId, name: o.displayName })),
  };
}
