import type { StandingRow } from "@/lib/fantasy/leagues";
import { TeamAvatar } from "./TeamAvatar";

function fmtPts(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Standings table for a league. Highlights the linked member's roster. */
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
      <table className="tbl">
        <thead>
          <tr>
            <th>#</th>
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
              <tr key={r.rosterId}>
                <td className="num">{i + 1}</td>
                <td>
                  <span className="flex items-center gap-2">
                    <TeamAvatar url={r.avatarUrl} name={r.teamName} size={24} />
                    <span className="font-display font-semibold uppercase tracking-tight">
                      {r.teamName}
                    </span>
                    {mine && <span className="you-chip">You</span>}
                  </span>
                </td>
                <td className="num">
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
