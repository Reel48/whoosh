import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ensureWallet, getBalance } from "@/lib/wb/ledger";
import { listOpenEvents, listRecentSettledEvents } from "@/lib/wb/bets";
import { Nav } from "@/components/Nav";
import { Disclaimer } from "@/components/Disclaimer";

export const dynamic = "force-dynamic";

export const metadata = { title: "Events — Whoosh" };

function formatWb(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ wager?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord?next=/events");
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

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-xs font-heading font-bold uppercase tracking-[0.22em] text-ink">
            Whoosh events
          </span>
          <span className="text-sm font-medium text-ink/70">
            Balance: <span className="font-heading font-black">{formatWb(balance)}</span>
          </span>
        </div>

        {banner && (
          <div
            className={`mt-6 rounded-xl border-2 border-ink px-4 py-3 text-sm font-medium ${
              banner.tone === "good"
                ? "bg-pigment-green text-white-smoke"
                : "bg-imperial-red text-white-smoke"
            }`}
          >
            {banner.text}
          </div>
        )}

        {events.length === 0 ? (
          <div className="mt-8 rounded-3xl border-2 border-ink bg-white-smoke p-8 text-center">
            <p className="font-heading text-lg font-bold text-ink">
              No open events right now.
            </p>
            <p className="mt-2 text-sm text-ink/60">
              We post new events around big games, drops, and culture moments.
              Drop into Discord to be the first to know.
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-6">
            {events.map((e) => (
              <li
                key={e.id}
                className="rounded-3xl border-2 border-ink bg-white-smoke p-6 text-ink sm:p-8"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-heading text-2xl font-black tracking-tight">{e.title}</h2>
                  <span
                    className={`rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                      e.status === "open"
                        ? "bg-pigment-green text-white-smoke"
                        : "bg-white-smoke text-ink"
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
                    Closes {new Date(e.closesAt).toLocaleString("en-US")}
                  </p>
                )}

                <ul className="mt-5 space-y-3">
                  {e.outcomes.map((o) => (
                    <li key={o.id}>
                      <form
                        action="/api/wb/wager"
                        method="POST"
                        className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-white-smoke p-3 sm:grid sm:grid-cols-[1fr_auto_120px_auto] sm:items-stretch sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
                      >
                        <input type="hidden" name="event_id" value={e.id} />
                        <input type="hidden" name="outcome_id" value={o.id} />
                        <div className="flex items-baseline justify-between gap-3 sm:block">
                          <div className="font-bold">{o.label}</div>
                          <div className="font-heading text-sm font-bold tabular-nums text-ink/60 sm:hidden">
                            ×{o.oddsDecimal.toFixed(2)}
                          </div>
                          <div className="hidden text-xs text-ink/60 sm:block">
                            Pays {o.oddsDecimal.toFixed(2)}× stake
                          </div>
                        </div>
                        <div className="hidden self-center font-heading text-sm font-bold tabular-nums text-ink/60 sm:block">
                          ×{o.oddsDecimal.toFixed(2)}
                        </div>
                        <div className="flex items-stretch gap-2 sm:contents">
                          <div className="relative flex-1">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-heading font-bold text-ink/60">
                              $
                            </span>
                            <input
                              type="number"
                              name="stake"
                              min="0.01"
                              step="0.01"
                              placeholder="0.00"
                              required={e.status === "open"}
                              disabled={e.status !== "open"}
                              inputMode="decimal"
                              aria-label="Stake"
                              className="w-full rounded-full border-2 border-ink bg-white-smoke px-3 py-2 pl-7 font-heading font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ink disabled:opacity-50"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={e.status !== "open"}
                            className="tap-press chip-tap shrink-0 cursor-pointer rounded-full border-2 border-ink bg-ink px-5 text-sm font-bold text-white-smoke disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Bet
                          </button>
                        </div>
                      </form>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        {recent.length > 0 && (
          <section className="mt-12">
            <h2 className="font-heading text-xl font-bold text-ink">Recently settled</h2>
            <ul className="mt-4 divide-y-2 divide-ink border-y-2 border-ink">
              {recent.map((e) => {
                const winner =
                  e.settledOutcomeId != null
                    ? e.outcomes.find((o) => o.id === e.settledOutcomeId)
                    : null;
                return (
                  <li
                    key={e.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 text-sm"
                  >
                    <div>
                      <div className="font-heading font-bold text-ink">{e.title}</div>
                      <div className="text-xs text-ink/60">
                        {e.status === "cancelled"
                          ? "Cancelled · stakes refunded"
                          : winner
                            ? `Winner: ${winner.label} (×${winner.oddsDecimal.toFixed(2)})`
                            : "Settled"}
                      </div>
                    </div>
                    <span
                      className={`rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                        e.status === "cancelled"
                          ? "bg-white-smoke text-ink"
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
