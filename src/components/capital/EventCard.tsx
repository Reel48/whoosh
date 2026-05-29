import { LocalTime } from "@/components/LocalTime";
import { MARKET_LABELS } from "@/lib/wb/odds";
import type { BetEvent, BetOutcome } from "@/lib/wb/bets";
import type { Game } from "@/lib/wb/eventGroups";

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** One bettable outcome (label + odds + stake + Bet). Posts to /api/wb/wager. */
function OutcomeForm({ event, outcome }: { event: BetEvent; outcome: BetOutcome }) {
  const disabled = event.status !== "open";
  return (
    <form action="/api/wb/wager" method="POST" className="cap-outcome">
      <input type="hidden" name="event_id" value={event.id} />
      <input type="hidden" name="outcome_id" value={outcome.id} />
      <div className="cap-outcome__info">
        <div className="cap-outcome__label">{outcome.label}</div>
        <div className="text-caption">Pays {outcome.oddsDecimal.toFixed(2)}× stake</div>
      </div>
      <div className="input-group cap-outcome__stake">
        <span className="addon">$</span>
        <input
          className="input input-num"
          type="number"
          name="stake"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          required={!disabled}
          disabled={disabled}
          inputMode="decimal"
          aria-label="Stake"
        />
      </div>
      <button type="submit" disabled={disabled} className="btn btn-primary">Bet</button>
    </form>
  );
}

/**
 * Collapsible card for one game (matchup + its markets). Collapsed by default —
 * the summary shows matchup + start/close time + a chevron; expanding reveals
 * the markets (moneyline / spread / totals) with inline betting. Native
 * <details> so it works without client JS. Used on the events tab and the
 * /capital overview.
 */
export function EventCard({ game, defaultOpen = false }: { game: Game; defaultOpen?: boolean }) {
  const m0 = game.markets[0];
  const timeIso = game.commenceTime ?? m0?.closesAt ?? null;
  const timePrefix = game.commenceTime ? undefined : "Closes ";
  const description = m0?.description ?? null;
  const multiMarket = game.markets.length > 1;

  return (
    <details className="card cap-event" open={defaultOpen}>
      <summary className="cap-event__summary">
        <div className="cap-event__head">
          <span className="cap-event__title">{game.matchup}</span>
          {timeIso && (
            <span className="text-caption">
              <LocalTime iso={timeIso} prefix={timePrefix} />
            </span>
          )}
        </div>
        <ChevronIcon className="cap-event__chevron" />
      </summary>

      <div className="cap-event__body">
        {description && <p className="text-body-sm">{description}</p>}
        {game.markets.map((mkt) => (
          <div key={mkt.id} className="cap-event__market">
            {multiMarket && (
              <div className="text-caption">{mkt.market ? MARKET_LABELS[mkt.market] : "Bet"}</div>
            )}
            <div className="cap-outcomes">
              {mkt.outcomes.map((o) => (
                <OutcomeForm key={o.id} event={mkt} outcome={o} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
