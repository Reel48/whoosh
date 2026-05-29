import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { ensureWallet, queryLedger, type LedgerKind } from "@/lib/wb/ledger";
import { Nav } from "@/components/Nav";
import { Disclaimer } from "@/components/Disclaimer";
import { formatWb } from "@/lib/wb/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity — Whoosh" };

const KIND_GROUPS: { label: string; kinds: LedgerKind[] }[] = [
  { label: "Purchases", kinds: ["purchase", "premium_match"] },
  { label: "Interest", kinds: ["interest"] },
  { label: "Transfers", kinds: ["transfer_in", "transfer_out"] },
  { label: "Investing", kinds: ["invest_buy", "invest_sell", "invest_dividend"] },
  { label: "Wagers", kinds: ["bet_stake", "bet_payout"] },
  { label: "Bonuses", kinds: ["daily_bonus", "referral_reward"] },
  { label: "Adjustments", kinds: ["adjustment"] },
];

const ALL_KINDS = KIND_GROUPS.flatMap((g) => g.kinds);

const KIND_LABEL: Record<LedgerKind, string> = {
  purchase: "Purchase",
  premium_match: "Premium match",
  interest: "Interest",
  transfer_in: "Received",
  transfer_out: "Sent",
  bet_stake: "Bet placed",
  bet_payout: "Bet payout",
  invest_buy: "Buy",
  invest_sell: "Sell",
  invest_dividend: "Dividend",
  daily_bonus: "Daily check-in",
  referral_reward: "Referral reward",
  adjustment: "Adjustment",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; since?: string; until?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord?next=/wallet/activity");
  await ensureWallet(session.id, session.username);
  const sp = await searchParams;

  const activeGroupLabel = sp.group ?? "All";
  const group = KIND_GROUPS.find((g) => g.label === sp.group);
  const filterKinds = group ? group.kinds : ALL_KINDS;

  const entries = await queryLedger(session.id, {
    kinds: group ? filterKinds : undefined,
    since: sp.since || undefined,
    until: sp.until || undefined,
    limit: 500,
  });

  const totalCents = entries.reduce((acc, e) => acc + e.amountCents, 0);

  const csvHref = `/api/wb/activity.csv?${new URLSearchParams({
    ...(group ? { group: group.label } : {}),
    ...(sp.since ? { since: sp.since } : {}),
    ...(sp.until ? { until: sp.until } : {}),
  }).toString()}`;

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-4xl px-6 py-16 sm:py-24">
        <Link href="/wallet" className="text-xs font-bold text-ink/60 underline-offset-2 hover:underline">
          ← Back to wallet
        </Link>
        <h1 className="mt-2 font-heading text-4xl font-black tracking-tight sm:text-5xl">
          Activity
        </h1>
        <p className="mt-2 text-sm text-ink/70">
          Every ledger entry on your account. Filter, sort by date, export.
        </p>

        {/* Filter chips */}
        <div className="mt-6 flex flex-wrap gap-1.5">
          <FilterChip href="/wallet/activity" label="All" active={!group} />
          {KIND_GROUPS.map((g) => {
            const params = new URLSearchParams();
            params.set("group", g.label);
            if (sp.since) params.set("since", sp.since);
            if (sp.until) params.set("until", sp.until);
            return (
              <FilterChip
                key={g.label}
                href={`/wallet/activity?${params.toString()}`}
                label={g.label}
                active={activeGroupLabel === g.label}
              />
            );
          })}
        </div>

        {/* Date range */}
        <form
          action="/wallet/activity"
          method="GET"
          className="mt-4 grid gap-3 sm:flex sm:flex-wrap sm:items-end"
        >
          {group && <input type="hidden" name="group" value={group.label} />}
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-ink/60 sm:flex-row sm:items-center sm:gap-2">
            From
            <input
              type="date"
              name="since"
              defaultValue={sp.since ?? ""}
              className="w-full rounded-full border-2 border-ink bg-white-smoke px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-ink sm:w-auto"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-ink/60 sm:flex-row sm:items-center sm:gap-2">
            To
            <input
              type="date"
              name="until"
              defaultValue={sp.until ?? ""}
              className="w-full rounded-full border-2 border-ink bg-white-smoke px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-ink sm:w-auto"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <button
              type="submit"
              className="tap-press chip-tap cursor-pointer rounded-full border-2 border-ink bg-ink px-4 text-sm font-bold text-white-smoke"
            >
              Apply
            </button>
            <a
              href={csvHref}
              className="chip-tap tap-press text-center cursor-pointer rounded-full border-2 border-ink bg-white-smoke px-4 text-sm font-bold text-ink transition-colors hover:bg-ink hover:text-white-smoke"
            >
              Export CSV
            </a>
          </div>
        </form>

        {/* Summary */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Tile label="Entries" value={entries.length.toString()} />
          <Tile label="Net" value={formatWb(totalCents, { signed: true })} />
          <Tile
            label="Window"
            value={
              sp.since && sp.until
                ? `${sp.since} → ${sp.until}`
                : sp.since
                  ? `from ${sp.since}`
                  : sp.until
                    ? `until ${sp.until}`
                    : "All time"
            }
          />
        </div>

        {/* Table */}
        {entries.length === 0 ? (
          <p className="mt-10 rounded-3xl border-2 border-ink bg-white-smoke p-8 text-center text-sm text-ink/70">
            No entries match this filter.
          </p>
        ) : (
          <ul className="mt-8 divide-y-2 divide-ink border-y-2 border-ink">
            {entries.map((e) => {
              const positive = e.amountCents > 0;
              const negative = e.amountCents < 0;
              return (
                <li
                  key={e.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-heading font-bold text-ink">
                        {KIND_LABEL[e.kind] ?? e.kind}
                      </span>
                      <span className="text-xs text-ink/60">{fmtDate(e.createdAt)}</span>
                    </div>
                    {e.memo && (
                      <p className="mt-0.5 truncate text-xs text-ink/70">{e.memo}</p>
                    )}
                  </div>
                  <div
                    className={`font-heading text-lg font-black tabular-nums ${
                      positive
                        ? "text-pigment-green"
                        : negative
                          ? "text-imperial-red"
                          : "text-ink"
                    }`}
                  >
                    {positive ? "▲ " : negative ? "▼ " : ""}
                    {formatWb(e.amountCents, { signed: true })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Disclaimer />
      </main>
    </>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`chip-tap tap-press rounded-full border-2 border-ink px-4 text-sm font-bold transition-colors ${
        active ? "bg-ink text-white-smoke" : "bg-white-smoke text-ink hover:bg-ink hover:text-white-smoke"
      }`}
    >
      {label}
    </Link>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-white-smoke p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-ink/60">{label}</p>
      <p className="mt-2 font-heading text-2xl font-black tabular-nums">{value}</p>
    </div>
  );
}
