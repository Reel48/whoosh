import type { Matchup } from "@/lib/fantasy/matchups";
import { TeamLogo } from "./TeamAvatar";

function fmtPts(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * A single weekly matchup (two teams + scores) in the design-system style.
 * The linked member's matchup is outlined; the leading side's score is tinted.
 * An optional `footer` slot attaches a Whoosh Bucks stake form (Matchups page).
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
  const decided = away != null && (home.points > 0 || (away?.points ?? 0) > 0);
  const homeWin = decided && away != null && home.points > away.points;
  const awayWin = decided && away != null && away.points > home.points;

  return (
    <div>
      <div className={`matchup ${mine ? "is-mine" : ""}`}>
        {/* Home */}
        <div
          className={`matchup__side ${homeWin ? "matchup__side--winning" : awayWin ? "matchup__side--losing" : ""}`}
        >
          <div className="matchup__team">
            <TeamLogo url={home.avatarUrl} name={home.teamName} className="matchup__logo" />
            <div className="min-w-0">
              <div className="matchup__name">
                {home.teamName} {home.isMine && <span className="you-chip">You</span>}
              </div>
              {leagueName && <div className="matchup__owner">{leagueName}</div>}
            </div>
          </div>
          <div className="matchup__score">{fmtPts(home.points)}</div>
        </div>

        {/* Divider */}
        <div className="matchup__divider">
          <span className="vs">VS</span>
        </div>

        {/* Away */}
        {away ? (
          <div
            className={`matchup__side matchup__side--right ${awayWin ? "matchup__side--winning" : homeWin ? "matchup__side--losing" : ""}`}
          >
            <div className="matchup__team">
              <TeamLogo url={away.avatarUrl} name={away.teamName} className="matchup__logo" />
              <div className="min-w-0">
                <div className="matchup__name">
                  {away.isMine && <span className="you-chip">You</span>} {away.teamName}
                </div>
                {leagueName && <div className="matchup__owner">&nbsp;</div>}
              </div>
            </div>
            <div className="matchup__score">{fmtPts(away.points)}</div>
          </div>
        ) : (
          <div className="matchup__side matchup__side--right">
            <div className="matchup__divider">Bye week</div>
          </div>
        )}
      </div>
      {footer}
    </div>
  );
}
