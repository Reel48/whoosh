import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ensureWallet, getBalance } from "@/lib/wb/ledger";
import { listOpenEvents } from "@/lib/wb/bets";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export const metadata = { title: "Events — Whoosh" };

function formatWb(cents: number): string {
  return `${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} WB`;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ wager?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord?next=/events");
  await ensureWallet(session.id, session.username);

  const [events, balance] = await Promise.all([
    listOpenEvents(),
    getBalance(session.id),
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
          <p className="mt-8 rounded-3xl border-2 border-ink bg-white-smoke p-8 text-center text-sm text-ink/70">
            No open events right now. Check back soon.
          </p>
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
                        className="grid grid-cols-[1fr_auto_120px_auto] items-stretch gap-3"
                      >
                        <input type="hidden" name="event_id" value={e.id} />
                        <input type="hidden" name="outcome_id" value={o.id} />
                        <div className="flex flex-col justify-center">
                          <div className="font-bold">{o.label}</div>
                          <div className="text-xs text-ink/60">
                            Pays {o.oddsDecimal.toFixed(2)}× stake
                          </div>
                        </div>
                        <div className="self-center font-heading text-sm font-bold tabular-nums text-ink/60">
                          ×{o.oddsDecimal.toFixed(2)}
                        </div>
                        <div className="relative">
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
                          className="cursor-pointer rounded-full border-2 border-ink bg-ink px-4 py-2 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Bet
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
