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
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type Game = {
  key: string;
  sportKey: string | null;
  matchup: string;
  commenceTime: string | null;
  markets: BetEvent[]; // one event per market
};

/** Group synced events by game (externalEventId), markets ordered ML/Spread/Total. */
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
    g.markets.sort(
      (a, b) =>
        MARKET_ORDER.indexOf(a.market ?? "h2h") - MARKET_ORDER.indexOf(b.market ?? "h2h"),
    );
  }
  return [...byGame.values()].sort((a, b) => {
    const ta = a.commenceTime ? new Date(a.commenceTime).getTime() : Infinity;
    const tb = b.commenceTime ? new Date(b.commenceTime).getTime() : Infinity;
    return ta - tb;
  });
}

function OutcomeForm({ event, outcome }: { event: BetEvent; outcome: BetOutcome }) {
  return (
    <form
      action="/api/wb/wager"
      method="POST"
      className="flex flex-col gap-3 rounded-2xl border-theme border-ink bg-surface p-3 sm:grid sm:grid-cols-[1fr_auto_120px_auto] sm:items-stretch sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
    >
      <input type="hidden" name="event_id" value={event.id} />
      <input type="hidden" name="outcome_id" value={outcome.id} />
      <div className="flex items-baseline justify-between gap-3 sm:block">
        <div className="font-bold">{outcome.label}</div>
        <div className="font-display text-sm font-bold tabular-nums text-ink/60 sm:hidden">
          ×{outcome.oddsDecimal.toFixed(2)}
        </div>
        <div className="hidden text-xs text-ink/60 sm:block">
          Pays {outcome.oddsDecimal.toFixed(2)}× stake
        </div>
      </div>
      <div className="hidden self-center font-display text-sm font-bold tabular-nums text-ink/60 sm:block">
        ×{outcome.oddsDecimal.toFixed(2)}
      </div>
      <div className="flex items-stretch gap-2 sm:contents">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-display font-bold text-ink/60">
            $
          </span>
          <input
            type="number"
            name="stake"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            required={event.status === "open"}
            disabled={event.status !== "open"}
            inputMode="decimal"
            aria-label="Stake"
            className="w-full rounded-full border-theme border-ink bg-surface px-3 py-2 pl-7 font-display font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ink disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={event.status !== "open"}
          className="tap-press chip-tap shrink-0 cursor-pointer rounded-full border-theme border-ink bg-ink px-5 text-sm font-bold text-white-smoke disabled:cursor-not-allowed disabled:opacity-50"
        >
          Bet
        </button>
      </div>
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
    sp.wager === "ok"
      ? { tone: "good", text: "Wager placed." }
      : sp.error
        ? { tone: "warn", text: sp.error }
        : null;

  const synced = events.filter((e) => e.source === "odds_api");
  const manual = events.filter((e) => e.source !== "odds_api");
  const games = groupSyncedByGame(synced);

  // Section games by sport, preserving the time-sorted order within each sport.
  const sports: { sportKey: string | null; games: Game[] }[] = [];
  for (const g of games) {
    let section = sports.find((s) => s.sportKey === g.sportKey);
    if (!section) {
      section = { sportKey: g.sportKey, games: [] };
      sports.push(section);
    }
    section.games.push(g);
  }

  // Sport filter (URL-driven so it stays a server component).
  const selectedSport = sp.sport ?? "all";
  const filterOptions: { key: string; label: string }[] = [
    { key: "all", label: "All" },
    ...sports.map((s) => ({
      key: s.sportKey ?? "sports",
      label: sportTitle(s.sportKey),
    })),
  ];
  if (manual.length > 0) filterOptions.push({ key: "more", label: "More" });

  const visibleSports =
    selectedSport === "all"
      ? sports
      : selectedSport === "more"
        ? []
        : sports.filter((s) => (s.sportKey ?? "sports") === selectedSport);
  const showManual =
    manual.length > 0 && (selectedSport === "all" || selectedSport === "more");

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-xs font-display font-bold uppercase tracking-[0.22em] text-ink">
            Whoosh events
          </span>
          <div className="flex items-baseline gap-4">
            <Link
              href="/capital/bets"
              className="text-sm font-bold text-ink underline-offset-4 hover:underline"
            >
              My bets
            </Link>
            <span className="text-sm font-medium text-ink/70">
              Balance: <span className="font-display font-black">{formatWb(balance)}</span>
            </span>
          </div>
        </div>

        {banner && (
          <div
            className={`mt-6 rounded-xl border-theme border-ink px-4 py-3 text-sm font-medium ${
              banner.tone === "good"
                ? "bg-pigment-green text-white-smoke"
                : "bg-imperial-red text-white-smoke"
            }`}
          >
            {banner.text}
          </div>
        )}

        {events.length === 0 ? (
          <div className="mt-8 rounded-theme shadow-theme border-theme border-ink bg-surface p-8 text-center">
            <p className="font-display text-lg font-bold text-ink">
              No open events right now.
            </p>
            <p className="mt-2 text-sm text-ink/60">
              We post new events around big games, drops, and culture moments.
              Drop into Discord to be the first to know.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-12">
            {filterOptions.length > 2 && (
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((opt) => {
                  const active = selectedSport === opt.key;
                  const href =
                    opt.key === "all" ? "/capital/events" : `/capital/events?sport=${opt.key}`;
                  return (
                    <Link
                      key={opt.key}
                      href={href}
                      className={`tap-press rounded-full border-theme border-ink px-4 py-1.5 text-sm font-bold transition-colors ${
                        active
                          ? "bg-ink text-white-smoke"
                          : "bg-surface text-ink hover:bg-ink hover:text-white-smoke"
                      }`}
                    >
                      {opt.label}
                    </Link>
                  );
                })}
              </div>
            )}
            {visibleSports.map((section) => (
              <section key={section.sportKey ?? "sports"}>
                <h2 className="font-display text-xl font-black tracking-tight text-ink">
                  {sportTitle(section.sportKey)}
                </h2>
                <ul className="mt-4 space-y-6">
                  {section.games.map((game) => (
                    <li
                      key={game.key}
                      className="rounded-theme shadow-theme border-theme border-ink bg-surface p-6 text-ink sm:p-8"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-display text-xl font-black tracking-tight">
                          {game.matchup}
                        </h3>
                        {game.commenceTime && (
                          <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
                            <LocalTime iso={game.commenceTime} />
                          </span>
                        )}
                      </div>

                      <div className="mt-5 space-y-6">
                        {game.markets.map((mkt) => (
                          <div key={mkt.id}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
                                {mkt.market ? MARKET_LABELS[mkt.market] : "Bet"}
                              </span>
                            </div>
                            <ul className="mt-2 space-y-3">
                              {mkt.outcomes.map((o) => (
                                <li key={o.id}>
                                  <OutcomeForm event={mkt} outcome={o} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {showManual && (
              <section>
                {sports.length > 0 && (
                  <h2 className="font-display text-xl font-black tracking-tight text-ink">
                    More events
                  </h2>
                )}
                <ul className="mt-4 space-y-6">
                  {manual.map((e) => (
                    <li
                      key={e.id}
                      className="rounded-theme shadow-theme border-theme border-ink bg-surface p-6 text-ink sm:p-8"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-display text-2xl font-black tracking-tight">
                          {e.title}
                        </h3>
                        <span
                          className={`rounded-full border-theme border-ink px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                            e.status === "open"
                              ? "bg-pigment-green text-white-smoke"
                              : "bg-surface text-ink"
                          }`}
                        >
                          {e.status}
                        </span>
                      </div>
                      {e.description && (
                        <p className="mt-2 text-sm font-medium text-ink/80">{e.description}</p>
                      )}
                      {e.closesAt && (
                        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-ink/60">
                          <LocalTime iso={e.closesAt} prefix="Closes " />
                        </p>
                      )}
                      <ul className="mt-5 space-y-3">
                        {e.outcomes.map((o) => (
                          <li key={o.id}>
                            <OutcomeForm event={e} outcome={o} />
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {recent.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-bold text-ink">Recently settled</h2>
            <ul className="mt-4 divide-y-2 divide-ink border-y-2 border-ink">
              {recent.map((e) => {
                const winner =
                  e.settledOutcomeId != null
                    ? e.outcomes.find((o) => o.id === e.settledOutcomeId)
                    : null;
                const marketSuffix = e.market ? ` · ${MARKET_LABELS[e.market]}` : "";
                return (
                  <li
                    key={e.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 text-sm"
                  >
                    <div>
                      <div className="font-display font-bold text-ink">
                        {e.title}
                        {marketSuffix}
                      </div>
                      <div className="text-xs text-ink/60">
                        {e.status === "cancelled"
                          ? "Cancelled · stakes refunded"
                          : winner
                            ? `Winner: ${winner.label} (×${winner.oddsDecimal.toFixed(2)})`
                            : "Settled"}
                      </div>
                    </div>
                    <span
                      className={`rounded-full border-theme border-ink px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                        e.status === "cancelled"
                          ? "bg-surface text-ink"
                          : "bg-ink text-white-smoke"
                      }`}
                    >
                      {e.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <Disclaimer />
      </main>
    </>
  );
}
