import Link from "next/link";
import type { LeagueOverview } from "@/lib/fantasy/leagues";
import { TeamAvatar } from "./TeamAvatar";

/**
 * League summary card for the Overview / Leagues grid. Shows the league name,
 * team count, and the linked member's standing line if they're in it.
 */
export function LeagueCard({
  overview,
  mineRosterId,
}: {
  overview: LeagueOverview;
  mineRosterId?: number | null;
}) {
  const mine =
    mineRosterId != null ? overview.standings.find((s) => s.rosterId === mineRosterId) : undefined;
  const mineRank =
    mine != null ? overview.standings.findIndex((s) => s.rosterId === mine.rosterId) + 1 : null;

  return (
    <Link href={`/fantasy/leagues/${overview.config.sleeperLeagueId}`} className="ftb-card-link">
      <div className="card">
        <div className="flex items-center gap-3">
          <TeamAvatar url={overview.avatarUrl} name={overview.displayName} size={40} />
          <div className="min-w-0">
            <h3 className="text-h3 truncate">{overview.displayName}</h3>
            <p className="text-caption">
              {overview.season} · {overview.totalRosters} teams
            </p>
          </div>
        </div>

        {mine && mineRank ? (
          <div className="ftb-mt-sm flex items-center justify-between">
            <span className="you-chip">Your team</span>
            <span className="text-body-sm">
              #{mineRank} · {mine.wins}-{mine.losses}
              {mine.ties > 0 ? `-${mine.ties}` : ""}
            </span>
          </div>
        ) : (
          <p className="text-body-sm ftb-mt-sm">
            {overview.standings[0]
              ? `Leader: ${overview.standings[0].teamName}`
              : "Season hasn't started."}
          </p>
        )}

        <span className="ftb-link ftb-mt-sm inline-block">View league →</span>
      </div>
    </Link>
  );
}
