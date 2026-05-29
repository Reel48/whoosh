import type { MatchupWagerInfo } from "@/lib/fantasy/wagers";

/**
 * Whoosh Bucks stake controls for a matchup, rendered under a MatchupCard.
 * Even money (2×). The stake field is entered in whole Whoosh Bucks, matching
 * the Capital events form. Two submit buttons post the picked outcome_id.
 * Posts to /api/fantasy/wager (progressive-enhancement, no JS required).
 */
export function MatchupWager({
  info,
  homeTeam,
  awayTeam,
  next,
}: {
  info: MatchupWagerInfo;
  homeTeam: string;
  awayTeam: string;
  next: string;
}) {
  if (info.status !== "open") {
    const label =
      info.status === "settled"
        ? "Final · wagers paid out"
        : info.status === "cancelled"
          ? "Refunded"
          : "Betting closed";
    return (
      <p className="text-caption" style={{ padding: "8px 4px 0" }}>
        {label}
      </p>
    );
  }

  return (
    <form action="/api/fantasy/wager" method="POST" className="ftb-wager" style={{ paddingTop: 8 }}>
      <input type="hidden" name="event_id" value={info.eventId} />
      <input type="hidden" name="next" value={next} />
      <span className="text-caption" style={{ whiteSpace: "nowrap" }}>
        Even money · stake WB:
      </span>
      <input
        className="input input-num"
        type="number"
        name="stake"
        min="1"
        step="1"
        inputMode="decimal"
        placeholder="WB"
        aria-label="Stake in Whoosh Bucks"
        style={{ flex: "0 1 90px" }}
        required
      />
      <button type="submit" name="outcome_id" value={info.homeOutcomeId} className="btn btn-sm btn-secondary">
        Back {homeTeam}
      </button>
      <button type="submit" name="outcome_id" value={info.awayOutcomeId} className="btn btn-sm btn-secondary">
        Back {awayTeam}
      </button>
    </form>
  );
}
