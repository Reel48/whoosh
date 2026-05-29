import { listAllEvents } from "@/lib/wb/bets";
import { MARKET_LABELS, getEnabledSports } from "@/lib/wb/odds";
import { LocalTime } from "@/components/LocalTime";
import {
  createEventAction,
  lockEventAction,
  reopenEventAction,
  settleEventAction,
  cancelEventAction,
  syncOddsAction,
  settleOddsAction,
} from "./actions";

export const dynamic = "force-dynamic";

const OUTCOME_SLOTS = 4;

const SPORT_LABELS: Record<string, string> = {
  americanfootball_nfl: "NFL",
  americanfootball_ncaaf: "College Football",
  basketball_nba: "NBA",
  baseball_mlb: "MLB",
  soccer_epl: "Premier League",
  soccer_uefa_champs_league: "Champions League",
};

function sportLabel(key: string): string {
  return SPORT_LABELS[key] ?? key;
}

/** In-season leagues by month (0=Jan). Drives the rotation reminder so we keep
 *  ODDS_SPORTS to ~3 concurrent leagues and stay under the free-tier budget. */
function recommendedSports(month: number): string[] {
  const nflNcaaf = ["americanfootball_nfl", "americanfootball_ncaaf"];
  const nba = "basketball_nba";
  const mlb = "baseball_mlb";
  const soccer = ["soccer_epl", "soccer_uefa_champs_league"];
  switch (month) {
    case 0: // Jan — NFL playoffs, NBA, soccer
    case 1: // Feb
      return [...nflNcaaf.slice(0, 1), nba, soccer[0]];
    case 2: // Mar — NBA, soccer (UCL knockouts)
    case 3: // Apr — NBA playoffs, MLB opens, UCL
      return [nba, mlb, soccer[1]];
    case 4: // May — NBA playoffs, MLB, UCL final
      return [nba, mlb, soccer[1]];
    case 5: // Jun — NBA finals, MLB
      return [nba, mlb];
    case 6: // Jul — MLB only
    case 7: // Aug — MLB, EPL opens
      return [mlb, soccer[0]];
    case 8: // Sep — NFL/NCAAF kick off, MLB stretch
    case 9: // Oct — NFL, NCAAF, MLB playoffs, NBA opens
      return [...nflNcaaf, mlb];
    case 10: // Nov — NFL, NCAAF, NBA
    case 11: // Dec — NFL, NCAAF, NBA
      return [...nflNcaaf, nba];
    default:
      return [nba, mlb, soccer[0]];
  }
}

function getSeasonalReminder(): { monthName: string; recommended: string[] } {
  const now = new Date();
  return {
    monthName: now.toLocaleString("en-US", { month: "long" }),
    recommended: recommendedSports(now.getMonth()),
  };
}

export default async function AdminEventsPage() {
  const events = await listAllEvents();
  const enabledSports = getEnabledSports();
  const { monthName, recommended } = getSeasonalReminder();
  const enabledSet = new Set(enabledSports);
  const recommendedSet = new Set(recommended);
  const needsRotation =
    enabledSports.length !== recommended.length ||
    recommended.some((s) => !enabledSet.has(s));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
      <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
        Betting events
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        Create events, lock them when betting closes, then settle by picking the
        winning outcome. Cancelling refunds all open wagers.
      </p>

      {/* Sports lines (The Odds API) */}
      <section className="mt-8 rounded-2xl border-2 border-ink bg-white-smoke p-6">
        <h2 className="font-heading text-xl font-bold">Sports lines</h2>
        <p className="mt-1 text-sm text-ink/60">
          Synced from The Odds API. Lines refresh on a cron; run manually below.
          Finished games auto-settle from final scores.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={syncOddsAction}>
            <button className="tap-press cursor-pointer rounded-full border-2 border-ink bg-ink px-4 py-2 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90">
              Sync lines now
            </button>
          </form>
          <form action={settleOddsAction}>
            <button className="tap-press cursor-pointer rounded-full border-2 border-ink bg-white-smoke px-4 py-2 text-sm font-bold transition-colors hover:bg-ink hover:text-white-smoke">
              Settle finished games
            </button>
          </form>
        </div>

        {/* Seasonal rotation reminder — keep ODDS_SPORTS to ~3 in-season leagues */}
        <div
          className={`mt-5 rounded-2xl border-2 border-ink p-4 ${
            needsRotation ? "bg-mango" : "bg-white-smoke"
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-heading text-sm font-black uppercase tracking-wider">
              {needsRotation
                ? `Time to rotate sports for ${monthName}?`
                : `Sports look right for ${monthName}`}
            </h3>
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink/60">
              Free tier · ~3 leagues max
            </span>
          </div>
          <p className="mt-1 text-xs text-ink/70">
            Each active league costs ~5 credits/day (sync + settle). Keep{" "}
            <code className="font-bold">ODDS_SPORTS</code> trimmed to in-season
            leagues to stay under the 500/mo budget. Edit the env var in Vercel,
            then redeploy.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink/60">
                Enabled now
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {enabledSports.length === 0 ? (
                  <span className="text-xs text-ink/60">None set</span>
                ) : (
                  enabledSports.map((s) => (
                    <span
                      key={s}
                      className={`rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-bold ${
                        recommendedSet.has(s)
                          ? "bg-pigment-green text-ink"
                          : "bg-white-smoke text-ink"
                      }`}
                    >
                      {sportLabel(s)}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink/60">
                Recommended for {monthName}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {recommended.map((s) => (
                  <span
                    key={s}
                    className={`rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-bold ${
                      enabledSet.has(s)
                        ? "bg-pigment-green text-ink"
                        : "bg-blue text-ink"
                    }`}
                  >
                    {sportLabel(s)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

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
            Betting closes at (your time zone)
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
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-heading text-lg font-black">{e.title}</h3>
                    {e.source === "odds_api" && (
                      <span className="rounded-full border-2 border-ink bg-mango px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        {e.sportKey ?? "synced"}
                        {e.market ? ` · ${MARKET_LABELS[e.market]}` : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink/60">
                    Created <LocalTime iso={e.createdAt} />
                    {e.closesAt && (
                      <>
                        {" · closes "}
                        <LocalTime iso={e.closesAt} />
                      </>
                    )}
                  </p>
                </div>
                <span
                  className={`rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                    e.status === "open"
                      ? "bg-pigment-green text-ink"
                      : e.status === "settled"
                        ? "bg-blue text-ink"
                        : e.status === "cancelled"
                          ? "bg-ink text-white-smoke"
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
                    <button className="cursor-pointer rounded-full border-2 border-ink bg-ink px-3 py-1 text-xs font-bold text-white-smoke transition-opacity hover:opacity-90">
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
