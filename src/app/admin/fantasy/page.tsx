import Image from "next/image";
import { listAllLeagues } from "@/lib/fantasy/leagues";
import { entitlementCountsByLeague } from "@/lib/fantasy/entitlements";
import { getNflState } from "@/lib/sleeper/client";
import {
  addLeagueAction,
  updateLeagueAction,
  toggleLeagueAction,
  removeLeagueAction,
  uploadLeagueLogoAction,
  clearLeagueLogoAction,
  syncFantasyAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminFantasyPage() {
  const [leagues, state, fillCounts] = await Promise.all([
    listAllLeagues(),
    getNflState().catch(() => null),
    entitlementCountsByLeague().catch(() => new Map<string, number>()),
  ]);

  const fmtFee = (cents: number | null): string =>
    cents && cents > 0 ? `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}` : "Free";

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

        {/* Commerce: leave entry fee blank for a free league. Leagues sharing a
            group key are interchangeable and sold as one product. */}
        <label className="text-sm font-medium">
          Entry fee ($)
          <input
            name="entry_fee"
            placeholder="blank = free"
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border-2 border-ink bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium">
          Group key
          <input
            name="group_key"
            placeholder="e.g. ppr (blank = own group)"
            className="mt-1 w-full rounded-lg border-2 border-ink bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium">
          Product name
          <input
            name="product_name"
            placeholder="e.g. Whoosh PPR League"
            className="mt-1 w-full rounded-lg border-2 border-ink bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium">
          Capacity
          <input
            name="capacity"
            type="number"
            defaultValue={10}
            className="mt-1 w-20 rounded-lg border-2 border-ink bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium sm:col-span-4">
          Sleeper invite URL (revealed after payment)
          <input
            name="join_url"
            placeholder="https://sleeper.com/i/…"
            className="mt-1 w-full rounded-lg border-2 border-ink bg-white px-3 py-2"
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
                <div className="flex min-w-0 items-center gap-3">
                  {l.logoUrl ? (
                    <Image
                      src={l.logoUrl}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 shrink-0 rounded-lg border-2 border-ink object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-ink/40 text-[10px] font-bold text-ink/40">
                      No logo
                    </span>
                  )}
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
                    <div className="mt-0.5 text-xs font-semibold text-ink/70">
                      {fmtFee(l.entryFeeCents)}
                      {l.groupKey && l.groupKey !== l.sleeperLeagueId
                        ? ` · group “${l.groupKey}”`
                        : ""}
                      {(l.entryFeeCents ?? 0) > 0
                        ? ` · ${fillCounts.get(l.sleeperLeagueId) ?? 0}/${l.capacity} paid`
                        : ""}
                      {l.joinUrl ? " · invite ✓" : (l.entryFeeCents ?? 0) > 0 ? " · ⚠ no invite" : ""}
                    </div>
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
                <label className="font-medium">
                  Fee ($)
                  <input
                    name="entry_fee"
                    inputMode="decimal"
                    defaultValue={l.entryFeeCents ? (l.entryFeeCents / 100).toString() : ""}
                    placeholder="free"
                    className="mt-1 block w-24 rounded-lg border-2 border-ink bg-white px-3 py-1.5"
                  />
                </label>
                <label className="font-medium">
                  Group
                  <input
                    name="group_key"
                    defaultValue={
                      l.groupKey && l.groupKey !== l.sleeperLeagueId ? l.groupKey : ""
                    }
                    placeholder="own group"
                    className="mt-1 block w-28 rounded-lg border-2 border-ink bg-white px-3 py-1.5"
                  />
                </label>
                <label className="font-medium">
                  Product
                  <input
                    name="product_name"
                    defaultValue={l.productName ?? ""}
                    placeholder="(product name)"
                    className="mt-1 block w-48 rounded-lg border-2 border-ink bg-white px-3 py-1.5"
                  />
                </label>
                <label className="font-medium">
                  Cap
                  <input
                    name="capacity"
                    type="number"
                    defaultValue={l.capacity}
                    className="mt-1 block w-20 rounded-lg border-2 border-ink bg-white px-3 py-1.5"
                  />
                </label>
                <label className="font-medium w-full">
                  Sleeper invite URL
                  <input
                    name="join_url"
                    defaultValue={l.joinUrl ?? ""}
                    placeholder="https://sleeper.com/i/…"
                    className="mt-1 block w-full rounded-lg border-2 border-ink bg-white px-3 py-1.5"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full border-2 border-ink bg-white-smoke px-4 py-1.5 text-xs font-bold hover:bg-ink hover:text-white-smoke"
                >
                  Save
                </button>
              </form>

              {/* Logo upload */}
              <form
                action={uploadLeagueLogoAction}
                className="mt-3 flex flex-wrap items-center gap-2 text-sm"
              >
                <input type="hidden" name="sleeper_league_id" value={l.sleeperLeagueId} />
                <label className="font-medium">
                  Logo
                  <input
                    name="logo"
                    type="file"
                    accept="image/*"
                    required
                    className="ml-2 block max-w-xs text-xs file:mr-2 file:rounded-full file:border-2 file:border-ink file:bg-white-smoke file:px-3 file:py-1 file:text-xs file:font-bold"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full border-2 border-ink bg-blue px-4 py-1.5 text-xs font-bold text-white-smoke hover:opacity-90"
                >
                  Upload logo
                </button>
              </form>
              {l.logoUrl && (
                <form action={clearLeagueLogoAction} className="mt-2">
                  <input type="hidden" name="sleeper_league_id" value={l.sleeperLeagueId} />
                  <button
                    type="submit"
                    className="rounded-full border-2 border-ink px-3 py-1.5 text-xs font-bold hover:bg-ink hover:text-white-smoke"
                  >
                    Remove logo
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
