import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ensureWallet, getBalance } from "@/lib/wb/ledger";
import { listOpenEvents, listRecentSettledEvents } from "@/lib/wb/bets";
import { MARKET_LABELS } from "@/lib/wb/odds";
import { groupSyncedByGame, sportTitle, type Game } from "@/lib/wb/eventGroups";
import { EventCard } from "@/components/capital/EventCard";
import { Reveal } from "@/components/ui/Reveal";
import { Disclaimer } from "@/components/Disclaimer";

export const dynamic = "force-dynamic";

export const metadata = { title: "Events — Whoosh" };

function formatWb(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ wager?: string; error?: string; sport?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/capital/events");
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
  const manualGames = groupSyncedByGame(manual);

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
        <Reveal direction="right" className="cap-mt-lg">
        <div className="card cap-empty">
          No open events right now. We post new events around big games, drops, and culture moments.
        </div>
        </Reveal>
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
                  <Reveal key={game.key} direction="right">
                    <EventCard game={game} />
                  </Reveal>
                ))}
              </div>
            </section>
          ))}

          {showManual && (
            <section>
              {sports.length > 0 && <h2 className="text-h2 cap-section-title">More events</h2>}
              <div className="cap-stack">
                {manualGames.map((game) => (
                  <Reveal key={game.key} direction="right">
                    <EventCard game={game} />
                  </Reveal>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {recent.length > 0 && (
        <Reveal direction="right" className="cap-mt-lg">
        <section>
          <h2 className="text-h2 cap-section-title">Recently settled</h2>
          <div className="cap-tbl-scroll">
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
          </div>
        </section>
        </Reveal>
      )}

      <Disclaimer />
    </main>
  );
}
