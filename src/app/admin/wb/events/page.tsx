import { listAllEvents } from "@/lib/wb/bets";
import {
  createEventAction,
  lockEventAction,
  reopenEventAction,
  settleEventAction,
  cancelEventAction,
} from "./actions";

export const dynamic = "force-dynamic";

const OUTCOME_SLOTS = 4;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminEventsPage() {
  const events = await listAllEvents();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
      <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
        Betting events
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        Create events, lock them when betting closes, then settle by picking the
        winning outcome. Cancelling refunds all open wagers.
      </p>

      {/* Create */}
      <section className="mt-8 rounded-2xl border-2 border-ink bg-white-smoke p-6">
        <h2 className="font-heading text-xl font-bold">Create event</h2>
        <form action={createEventAction} className="mt-4 grid gap-3">
          <input
            type="text"
            name="title"
            placeholder="Event title (e.g. Lakers vs Celtics Game 7)"
            required
            className="rounded-full border-2 border-ink bg-white-smoke px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <textarea
            name="description"
            placeholder="Description (optional)"
            rows={2}
            className="rounded-2xl border-2 border-ink bg-white-smoke px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <label className="text-xs font-bold uppercase tracking-wider text-ink/60">
            Betting closes at (UTC)
          </label>
          <input
            type="datetime-local"
            name="closes_at"
            className="rounded-full border-2 border-ink bg-white-smoke px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <div className="text-xs font-bold uppercase tracking-wider text-ink/60">
            Outcomes (label + decimal odds; odds &gt; 1.00, e.g. 1.85 means
            $1.85 payout per $1 staked)
          </div>
          <div className="grid gap-2">
            {Array.from({ length: OUTCOME_SLOTS }).map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px] gap-2">
                <input
                  type="text"
                  name={`label_${i}`}
                  placeholder={`Outcome ${i + 1} label`}
                  className="rounded-full border-2 border-ink bg-white-smoke px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-ink"
                />
                <input
                  type="number"
                  name={`odds_${i}`}
                  step="0.01"
                  min="1.01"
                  placeholder="1.85"
                  className="rounded-full border-2 border-ink bg-white-smoke px-3 py-2 text-right font-heading font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ink"
                />
              </div>
            ))}
          </div>
          <button
            type="submit"
            className="self-start tap-press cursor-pointer rounded-full border-2 border-ink bg-ink px-5 py-2 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
          >
            Create event
          </button>
        </form>
      </section>

      <h2 className="mt-12 font-heading text-xl font-bold">All events</h2>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">No events yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {events.map((e) => (
            <li
              key={e.id}
              className="rounded-2xl border-2 border-ink bg-white-smoke p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="font-heading text-lg font-black">{e.title}</h3>
                  <p className="text-xs text-ink/60">
                    Created {formatDate(e.createdAt)}
                    {e.closesAt ? ` · closes ${formatDate(e.closesAt)}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                    e.status === "open"
                      ? "bg-pigment-green text-white-smoke"
                      : e.status === "settled"
                        ? "bg-blue text-ink"
                        : e.status === "cancelled"
                          ? "bg-imperial-red text-white-smoke"
                          : "bg-white-smoke text-ink"
                  }`}
                >
                  {e.status}
                </span>
              </div>

              <ul className="mt-3 grid gap-1 text-sm">
                {e.outcomes.map((o) => (
                  <li key={o.id} className="flex items-center justify-between">
                    <span className="font-medium">
                      {o.label}
                      {e.settledOutcomeId === o.id && (
                        <span className="ml-2 rounded-full border-2 border-ink bg-blue px-2 py-0.5 text-xs font-bold uppercase">
                          winner
                        </span>
                      )}
                    </span>
                    <span className="font-heading font-bold tabular-nums">
                      ×{o.oddsDecimal.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>

              {(e.status === "open" || e.status === "locked") && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {e.status === "open" ? (
                    <form action={lockEventAction}>
                      <input type="hidden" name="event_id" value={e.id} />
                      <button className="cursor-pointer rounded-full border-2 border-ink bg-white-smoke px-3 py-1 text-xs font-bold transition-colors hover:bg-ink hover:text-white-smoke">
                        Lock
                      </button>
                    </form>
                  ) : (
                    <form action={reopenEventAction}>
                      <input type="hidden" name="event_id" value={e.id} />
                      <button className="cursor-pointer rounded-full border-2 border-ink bg-white-smoke px-3 py-1 text-xs font-bold transition-colors hover:bg-ink hover:text-white-smoke">
                        Reopen
                      </button>
                    </form>
                  )}
                  <form action={cancelEventAction}>
                    <input type="hidden" name="event_id" value={e.id} />
                    <button className="cursor-pointer rounded-full border-2 border-ink bg-imperial-red px-3 py-1 text-xs font-bold text-white-smoke transition-opacity hover:opacity-90">
                      Cancel + refund
                    </button>
                  </form>
                  <form
                    action={settleEventAction}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="event_id" value={e.id} />
                    <select
                      name="winning_outcome_id"
                      required
                      className="rounded-full border-2 border-ink bg-white-smoke px-3 py-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-ink"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Settle as…
                      </option>
                      {e.outcomes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button className="tap-press cursor-pointer rounded-full border-2 border-ink bg-ink px-3 py-1 text-xs font-bold text-white-smoke transition-opacity hover:opacity-90">
                      Settle
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
