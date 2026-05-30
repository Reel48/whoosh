import type { CrossLeagueRow } from "@/lib/fantasy/rankings";
import { TeamLogo } from "./TeamAvatar";

function fmtPts(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
function medal(rank: number): string {
  return rank === 1 ? "rank--medal-1" : rank === 2 ? "rank--medal-2" : rank === 3 ? "rank--medal-3" : "";
}

/**
 * The combined cross-league Power Rankings table. Full mode shows every column;
 * `compact` trims to Rank/Team/League/PF/Power for the Overview preview.
 * Rows owned by the linked member are highlighted.
 */
export function CrossLeagueTable({
  rows,
  mineSleeperUserId,
  compact = false,
}: {
  rows: CrossLeagueRow[];
  mineSleeperUserId?: string | null;
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return <div className="ftb-empty">No teams to rank yet. Add leagues in the admin panel.</div>;
  }
  return (
    <div className="ftb-tbl-scroll">
      <table className="standings">
        <thead>
          <tr>
            <th className="rank">#</th>
            <th>Team</th>
            <th>League</th>
            {!compact && <th className="num hide-sm">Pos</th>}
            {!compact && <th className="num hide-sm">Record</th>}
            {!compact && <th className="num hide-sm">Win%</th>}
            <th className="num hide-sm">PF</th>
            <th className="num">Power</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mine = !!mineSleeperUserId && r.ownerId === mineSleeperUserId;
            return (
              <tr key={`${r.leagueId}-${r.rosterId}`} className={mine ? "is-mine" : undefined}>
                <td className={`rank ${medal(r.rank)}`}>{r.rank}</td>
                <td>
                  <span className="team-cell">
                    <TeamLogo url={r.avatarUrl} name={r.teamName} className="logo" />
                    <span className="min-w-0">
                      <span className="name">
                        {r.teamName} {mine && <span className="you-chip">You</span>}
                      </span>
                      <span className="owner">@{r.ownerName}</span>
                    </span>
                  </span>
                </td>
                <td className="text-body-sm">{r.leagueName}</td>
                {!compact && <td className="num hide-sm">{r.leaguePosition}</td>}
                {!compact && (
                  <td className="num record hide-sm">
                    {r.wins}-{r.losses}
                    {r.ties > 0 ? `-${r.ties}` : ""}
                  </td>
                )}
                {!compact && <td className="num hide-sm">{fmtPct(r.winPct)}</td>}
                <td className="num hide-sm">{fmtPts(r.pointsFor)}</td>
                <td className="num num-display">{r.powerScore.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
