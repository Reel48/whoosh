import type { Matchup } from "@/lib/fantasy/matchups";
import { TeamAvatar } from "./TeamAvatar";

function fmtPts(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * A single weekly matchup (two teams + scores). The linked member's matchup is
 * outlined. An optional `footer` slot lets callers attach a Whoosh Bucks stake
 * form (see the Matchups page).
 */
export function MatchupCard({
  matchup,
  leagueName,
  footer,
}: {
  matchup: Matchup;
  leagueName?: string;
  footer?: React.ReactNode;
}) {
  const { home, away } = matchup;
  const mine = home.isMine || away?.isMine;
  const decided = away != null && (home.points > 0 || away.points > 0);
  const homeWins = decided && away != null && home.points > away.points;
  const awayWins = decided && away != null && (away?.points ?? 0) > home.points;

  return (
    <div className="ftb-stack" style={{ gap: 0 }}>
      <div className={`matchup ${mine ? "is-mine" : ""}`}>
        <div className="matchup__team">
          <TeamAvatar url={home.avatarUrl} name={home.teamName} size={32} />
          <span className="min-w-0">
            <span className={`matchup__name ${homeWins ? "is-winner" : ""}`}>{home.teamName}</span>
            {home.isMine && <span className="you-chip ml-1">You</span>}
          </span>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span className="matchup__score num">
            <span className={homeWins ? "is-winner" : ""}>{fmtPts(home.points)}</span>
            <span className="matchup__vs px-1">–</span>
            <span className={awayWins ? "is-winner" : ""}>{away ? fmtPts(away.points) : "BYE"}</span>
          </span>
          {leagueName && <span className="text-caption">{leagueName}</span>}
        </div>

        {away ? (
          <div className="matchup__team matchup__team--away">
            <span className="min-w-0 text-right">
              {away.isMine && <span className="you-chip mr-1">You</span>}
              <span className={`matchup__name ${awayWins ? "is-winner" : ""}`}>{away.teamName}</span>
            </span>
            <TeamAvatar url={away.avatarUrl} name={away.teamName} size={32} />
          </div>
        ) : (
          <div className="matchup__team matchup__team--away">
            <span className="matchup__vs">Bye week</span>
          </div>
        )}
      </div>
      {footer}
    </div>
  );
}
