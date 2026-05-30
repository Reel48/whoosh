import type { StandingRow } from "@/lib/fantasy/leagues";
import { TeamLogo } from "./TeamAvatar";

function fmtPts(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function medal(i: number): string {
  return i === 0 ? "rank--medal-1" : i === 1 ? "rank--medal-2" : i === 2 ? "rank--medal-3" : "";
}

/** Standings table for a single league. Highlights the linked member's roster. */
export function StandingsTable({
  rows,
  mineRosterId,
}: {
  rows: StandingRow[];
  mineRosterId?: number | null;
}) {
  if (rows.length === 0) {
    return <div className="ftb-empty">No standings yet for this league.</div>;
  }
  return (
    <div className="ftb-tbl-scroll">
      <table className="standings">
        <thead>
          <tr>
            <th className="rank">#</th>
            <th>Team</th>
            <th className="num">W-L-T</th>
            <th className="num">PF</th>
            <th className="num">PA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const mine = mineRosterId != null && r.rosterId === mineRosterId;
            return (
              <tr key={r.rosterId} className={mine ? "is-mine" : undefined}>
                <td className={`rank ${medal(i)}`}>{i + 1}</td>
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
                <td className="num record">
                  {r.wins}-{r.losses}
                  {r.ties > 0 ? `-${r.ties}` : ""}
                </td>
                <td className="num">{fmtPts(r.pointsFor)}</td>
                <td className="num">{fmtPts(r.pointsAgainst)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
