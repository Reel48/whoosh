import Link from "next/link";
import type { LeagueOverview } from "@/lib/fantasy/leagues";
import { TeamAvatar } from "./TeamAvatar";

function fmtPts(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * League summary card for the Overview / Leagues grid. Leads with who's winning
 * (leader team, record, points) and adds the linked member's standing line when
 * they're in the league.
 */
export function LeagueCard({
  overview,
  mineRosterId,
}: {
  overview: LeagueOverview;
  mineRosterId?: number | null;
}) {
  const leader = overview.standings[0];
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

        {leader ? (
          <div className="ftb-mt-sm">
            <p className="text-eyebrow">Leader</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <TeamAvatar url={leader.avatarUrl} name={leader.teamName} size={24} />
                <span className="truncate font-semibold tracking-tight">
                  {leader.teamName}
                </span>
              </span>
              <span className="num text-body-sm shrink-0">
                {leader.wins}-{leader.losses}
                {leader.ties > 0 ? `-${leader.ties}` : ""} · {fmtPts(leader.pointsFor)} PF
              </span>
            </div>
          </div>
        ) : (
          <p className="text-body-sm ftb-mt-sm">Season hasn&apos;t started.</p>
        )}

        {mine && mineRank && (
          <div className="ftb-mt-sm flex items-center justify-between">
            <span className="you-chip">Your team</span>
            <span className="num text-body-sm">
              #{mineRank} · {mine.wins}-{mine.losses}
              {mine.ties > 0 ? `-${mine.ties}` : ""} · {fmtPts(mine.pointsFor)} PF
            </span>
          </div>
        )}

        <span className="ftb-link ftb-mt-sm inline-block">View league →</span>
      </div>
    </Link>
  );
}
