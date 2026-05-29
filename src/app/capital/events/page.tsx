import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ensureWallet, getBalance } from "@/lib/wb/ledger";
import {
  listOpenEvents,
  listRecentSettledEvents,
  type BetEvent,
  type BetOutcome,
  type BetMarket,
} from "@/lib/wb/bets";
import { MARKET_LABELS } from "@/lib/wb/odds";
import { LocalTime } from "@/components/LocalTime";
import { Disclaimer } from "@/components/Disclaimer";

export const dynamic = "force-dynamic";

export const metadata = { title: "Events — Whoosh" };

const SPORT_TITLES: Record<string, string> = {
  americanfootball_nfl: "NFL",
  americanfootball_ncaaf: "College Football",
  basketball_nba: "NBA",
  baseball_mlb: "MLB",
  soccer_epl: "Premier League",
  soccer_uefa_champs_league: "Champions League",
};

const MARKET_ORDER: BetMarket[] = ["h2h", "spreads", "totals"];

function sportTitle(sportKey: string | null): string {
  if (!sportKey) return "Sports";
  return SPORT_TITLES[sportKey] ?? sportKey;
}

function formatWb(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Game = {
  key: string;
  sportKey: string | null;
  matchup: string;
  commenceTime: string | null;
  markets: BetEvent[];
};

function groupSyncedByGame(events: BetEvent[]): Game[] {
  const byGame = new Map<string, Game>();
  for (const e of events) {
    const key = e.externalEventId ?? String(e.id);
    const g = byGame.get(key) ?? {
      key,
      sportKey: e.sportKey,
      matchup: e.title,
      commenceTime: e.commenceTime,
      markets: [],
    };
    g.markets.push(e);
    byGame.set(key, g);
  }
  for (const g of byGame.values()) {
    g.markets.sort((a, b) => MARKET_ORDER.indexOf(a.market ?? "h2h") - MARKET_ORDER.indexOf(b.market ?? "h2h"));
  }
  return [...byGame.values()].sort((a, b) => {
    const ta = a.commenceTime ? new Date(a.commenceTime).getTime() : Infinity;
    const tb = b.commenceTime ? new Date(b.commenceTime).getTime() : Infinity;
    return ta - tb;
  });
}

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

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ wager?: string; error?: string; sport?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord?next=/capital/events");
  await ensureWallet(session.id, session.username);

  const [events, balance, recent] = await Promise.all([
    listOpenEvents(),
    getBalance(session.id),
    listRecentSettledEvents(5).catch(() => []),
  ]);
  const sp = await searchParams;
  const banner =
    sp.wager === "ok" ? { tone: "good", text: "Wager placed." } : sp.error ? { tone: "warn", text: sp.error } : null;

  const synced = events.filter((e) => e.source === "odds_api");
  const manual = events.filter((e) => e.source !== "odds_api");
  const games = groupSyncedByGame(synced);

  const sports: { sportKey: string | null; games: Game[] }[] = [];
  for (const g of games) {
    let section = sports.find((s) => s.sportKey === g.sportKey);
    if (!section) {
      section = { sportKey: g.sportKey, games: [] };
      sports.push(section);
    }
    section.games.push(g);
  }

  const selectedSport = sp.sport ?? "all";
  const filterOptions: { key: string; label: string }[] = [
    { key: "all", label: "All" },
    ...sports.map((s) => ({ key: s.sportKey ?? "sports", label: sportTitle(s.sportKey) })),
  ];
  if (manual.length > 0) filterOptions.push({ key: "more", label: "More" });

  const visibleSports =
    selectedSport === "all"
      ? sports
      : selectedSport === "more"
        ? []
        : sports.filter((s) => (s.sportKey ?? "sports") === selectedSport);
  const showManual = manual.length > 0 && (selectedSport === "all" || selectedSport === "more");

  return (
    <main className="cap-page">
      <div className="cap-card-head">
        <div>
          <p className="text-eyebrow">Capital · Events</p>
          <h1 className="text-h1 cap-mt-1">House wagers</h1>
        </div>
        <div className="cap-actions">
          <Link href="/capital/bets" className="cap-link">My bets →</Link>
          <span className="badge badge-neutral">Balance {formatWb(balance)}</span>
        </div>
      </div>

      {banner && (
        <div className={`alert ${banner.tone === "good" ? "alert-positive" : "alert-warning"} cap-mt`}>
          <div className="body">{banner.text}</div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="card cap-mt-lg cap-empty">
          No open events right now. We post new events around big games, drops, and culture moments.
        </div>
      ) : (
        <div className="cap-mt-lg cap-stack">
          {filterOptions.length > 2 && (
            <div className="cap-tabs" style={{ marginTop: 0 }}>
              {filterOptions.map((opt) => (
                <Link
                  key={opt.key}
                  href={opt.key === "all" ? "/capital/events" : `/capital/events?sport=${opt.key}`}
                  className={`cap-tab ${selectedSport === opt.key ? "is-active" : ""}`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>
          )}

          {visibleSports.map((section) => (
            <section key={section.sportKey ?? "sports"}>
              <h2 className="text-h2 cap-section-title">{sportTitle(section.sportKey)}</h2>
              <div className="cap-stack">
                {section.games.map((game) => (
                  <div key={game.key} className="card">
                    <div className="cap-card-head">
                      <h3 className="text-h3">{game.matchup}</h3>
                      {game.commenceTime && (
                        <span className="text-caption"><LocalTime iso={game.commenceTime} /></span>
                      )}
                    </div>
                    <div className="cap-stack cap-mt">
                      {game.markets.map((mkt) => (
                        <div key={mkt.id}>
                          <div className="text-caption">{mkt.market ? MARKET_LABELS[mkt.market] : "Bet"}</div>
                          <div className="cap-outcomes">
                            {mkt.outcomes.map((o) => (
                              <OutcomeForm key={o.id} event={mkt} outcome={o} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {showManual && (
            <section>
              {sports.length > 0 && <h2 className="text-h2 cap-section-title">More events</h2>}
              <div className="cap-stack">
                {manual.map((e) => (
                  <div key={e.id} className="card">
                    <div className="cap-card-head">
                      <h3 className="text-h3">{e.title}</h3>
                      <span className={`badge ${e.status === "open" ? "badge-positive" : "badge-neutral"}`}>
                        <span className="dot" /> {e.status}
                      </span>
                    </div>
                    {e.description && <p className="text-body-sm cap-mt-1">{e.description}</p>}
                    {e.closesAt && (
                      <p className="text-caption cap-mt-1"><LocalTime iso={e.closesAt} prefix="Closes " /></p>
                    )}
                    <div className="cap-outcomes cap-mt">
                      {e.outcomes.map((o) => (
                        <OutcomeForm key={o.id} event={e} outcome={o} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {recent.length > 0 && (
        <section className="cap-mt-lg">
          <h2 className="text-h2 cap-section-title">Recently settled</h2>
          <table className="tbl">
            <thead>
              <tr><th>Event</th><th>Result</th><th className="num">Status</th></tr>
            </thead>
            <tbody>
              {recent.map((e) => {
                const winner = e.settledOutcomeId != null ? e.outcomes.find((o) => o.id === e.settledOutcomeId) : null;
                const marketSuffix = e.market ? ` · ${MARKET_LABELS[e.market]}` : "";
                return (
                  <tr key={e.id}>
                    <td>{e.title}{marketSuffix}</td>
                    <td className="text-body-sm">
                      {e.status === "cancelled"
                        ? "Cancelled · stakes refunded"
                        : winner
                          ? `Winner: ${winner.label} (×${winner.oddsDecimal.toFixed(2)})`
                          : "Settled"}
                    </td>
                    <td className="num">
                      <span className={`badge ${e.status === "cancelled" ? "badge-neutral" : "badge-info"}`}>{e.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <Disclaimer />
    </main>
  );
}
