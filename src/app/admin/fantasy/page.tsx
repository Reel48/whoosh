import { listAllLeagues } from "@/lib/fantasy/leagues";
import { getNflState } from "@/lib/sleeper/client";
import {
  addLeagueAction,
  updateLeagueAction,
  toggleLeagueAction,
  removeLeagueAction,
  syncFantasyAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminFantasyPage() {
  const [leagues, state] = await Promise.all([
    listAllLeagues(),
    getNflState().catch(() => null),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
      <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
        Fantasy leagues
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        Curate the Whoosh-run Sleeper leagues shown to members. Add a league by
        its Sleeper league ID. Toggle active to show/hide it.{" "}
        {state ? `Current: ${state.season} · week ${state.display_week ?? state.week}.` : ""}
      </p>

      {/* Maintenance actions */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={syncFantasyAction}>
          <button
            type="submit"
            className="rounded-full border-2 border-ink bg-white-smoke px-4 py-2 text-sm font-bold hover:bg-ink hover:text-white-smoke"
          >
            Run WB matchup sync
          </button>
        </form>
      </div>

      {/* Add league */}
      <h2 className="mt-12 font-heading text-xl font-bold">Add a league</h2>
      <form
        action={addLeagueAction}
        className="mt-4 grid gap-3 rounded-2xl border-2 border-ink bg-white-smoke p-5 sm:grid-cols-[2fr_1fr_2fr_auto]"
      >
        <label className="text-sm font-medium">
          Sleeper league ID
          <input
            name="sleeper_league_id"
            required
            placeholder="e.g. 1048291...876"
            className="mt-1 w-full rounded-lg border-2 border-ink bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium">
          Season
          <input
            name="season"
            placeholder="auto"
            className="mt-1 w-full rounded-lg border-2 border-ink bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium">
          Name override (optional)
          <input
            name="name"
            placeholder="defaults to Sleeper name"
            className="mt-1 w-full rounded-lg border-2 border-ink bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium">
          Sort
          <input
            name="sort"
            type="number"
            defaultValue={0}
            className="mt-1 w-20 rounded-lg border-2 border-ink bg-white px-3 py-2"
          />
        </label>
        <div className="sm:col-span-4">
          <button
            type="submit"
            className="rounded-full border-2 border-ink bg-pigment-green px-5 py-2 text-sm font-bold text-white-smoke hover:opacity-90"
          >
            Add league
          </button>
        </div>
      </form>

      {/* Existing leagues */}
      <h2 className="mt-12 font-heading text-xl font-bold">Leagues</h2>
      {leagues.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">No leagues yet.</p>
      ) : (
        <ul className="mt-4 divide-y-2 divide-ink border-y-2 border-ink">
          {leagues.map((l) => (
            <li key={l.sleeperLeagueId} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-heading font-bold">
                    {l.name || "(Sleeper name)"}{" "}
                    {!l.active && (
                      <span className="ml-1 rounded-full border-2 border-ink bg-white-smoke px-2 py-0.5 text-xs font-bold uppercase">
                        Hidden
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-ink/60">
                    {l.sleeperLeagueId} · {l.season} · sort {l.sort}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <form action={toggleLeagueAction}>
                    <input type="hidden" name="sleeper_league_id" value={l.sleeperLeagueId} />
                    <input type="hidden" name="active" value={(!l.active).toString()} />
                    <button
                      type="submit"
                      className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold hover:bg-ink hover:text-white-smoke"
                    >
                      {l.active ? "Hide" : "Show"}
                    </button>
                  </form>
                  <form action={removeLeagueAction}>
                    <input type="hidden" name="sleeper_league_id" value={l.sleeperLeagueId} />
                    <button
                      type="submit"
                      className="rounded-full border-2 border-ink bg-imperial-red px-3 py-1 text-xs font-bold text-white-smoke hover:opacity-90"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </div>

              {/* Inline edit */}
              <form
                action={updateLeagueAction}
                className="mt-3 flex flex-wrap items-end gap-2 text-sm"
              >
                <input type="hidden" name="sleeper_league_id" value={l.sleeperLeagueId} />
                <label className="font-medium">
                  Name
                  <input
                    name="name"
                    defaultValue={l.name ?? ""}
                    placeholder="(Sleeper name)"
                    className="mt-1 block w-64 rounded-lg border-2 border-ink bg-white px-3 py-1.5"
                  />
                </label>
                <label className="font-medium">
                  Sort
                  <input
                    name="sort"
                    type="number"
                    defaultValue={l.sort}
                    className="mt-1 block w-20 rounded-lg border-2 border-ink bg-white px-3 py-1.5"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full border-2 border-ink bg-white-smoke px-4 py-1.5 text-xs font-bold hover:bg-ink hover:text-white-smoke"
                >
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
