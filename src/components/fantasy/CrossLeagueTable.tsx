import type { CrossLeagueRow } from "@/lib/fantasy/rankings";
import { TeamAvatar } from "./TeamAvatar";

function fmtPts(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * The combined cross-league Power Rankings table. Full mode shows every column;
 * `compact` trims to Rank/Team/League/Points/Power for the Overview preview.
 * Rows owned by the linked member (mineSleeperUserId) are flagged.
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
      <table className="tbl">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>League</th>
            {!compact && <th className="num">Pos</th>}
            {!compact && <th className="num">Record</th>}
            {!compact && <th className="num">Win%</th>}
            <th className="num">PF</th>
            <th className="num">Power</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mine = !!mineSleeperUserId && r.ownerId === mineSleeperUserId;
            return (
              <tr key={`${r.leagueId}-${r.rosterId}`}>
                <td className="num num-display">{r.rank}</td>
                <td>
                  <span className="flex items-center gap-2">
                    <TeamAvatar url={r.avatarUrl} name={r.teamName} size={24} />
                    <span className="font-display font-semibold uppercase tracking-tight">
                      {r.teamName}
                    </span>
                    {mine && <span className="you-chip">You</span>}
                  </span>
                </td>
                <td className="text-body-sm">{r.leagueName}</td>
                {!compact && <td className="num">{r.leaguePosition}</td>}
                {!compact && (
                  <td className="num">
                    {r.wins}-{r.losses}
                    {r.ties > 0 ? `-${r.ties}` : ""}
                  </td>
                )}
                {!compact && <td className="num">{fmtPct(r.winPct)}</td>}
                <td className="num">{fmtPts(r.pointsFor)}</td>
                <td className="num num-display">{r.powerScore.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
