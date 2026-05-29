import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { ensureWallet } from "@/lib/wb/ledger";
import { listUserWagers, type UserWager, type WagerStatus } from "@/lib/wb/bets";
import { MARKET_LABELS } from "@/lib/wb/odds";
import { LocalTime } from "@/components/LocalTime";
import { Disclaimer } from "@/components/Disclaimer";
import { formatWb } from "@/lib/wb/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "My bets — Whoosh" };

const FILTERS: { key: string; label: string; match: (s: WagerStatus) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "open", label: "Open", match: (s) => s === "open" },
  { key: "won", label: "Won", match: (s) => s === "won" },
  { key: "lost", label: "Lost", match: (s) => s === "lost" },
  { key: "refunded", label: "Pushes", match: (s) => s === "refunded" },
];

export default async function MyBetsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord?next=/capital/bets");
  await ensureWallet(session.id, session.username);

  const wagers = await listUserWagers(session.id);
  const sp = await searchParams;

  const open = wagers.filter((w) => w.status === "open");
  const won = wagers.filter((w) => w.status === "won");
  const lost = wagers.filter((w) => w.status === "lost");
  const settled = wagers.filter((w) => w.status !== "open");
  const atStake = open.reduce((a, w) => a + w.stakeCents, 0);
  const netCents = settled.reduce((a, w) => a + (w.payoutCents - w.stakeCents), 0);

  const activeFilter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0];
  const visible = wagers.filter((w) => activeFilter.match(w.status));

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
        <Link
          href="/capital/events"
          className="text-xs font-bold text-ink/60 underline-offset-2 hover:underline"
        >
          ← Back to events
        </Link>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight sm:text-5xl">
          My bets
        </h1>
        <p className="mt-2 text-sm text-ink/70">
          Your open wagers and your full win/loss history.
        </p>

        {/* Summary */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Tile
            label="Open"
            value={open.length.toString()}
            sub={open.length > 0 ? `${formatWb(atStake)} at stake` : "Nothing live"}
          />
          <Tile label="Record" value={`${won.length}–${lost.length}`} sub="Won–Lost" />
          <Tile
            label="Net profit/loss"
            value={formatWb(netCents, { signed: true })}
            tone={netCents > 0 ? "good" : netCents < 0 ? "bad" : "neutral"}
            sub="Settled bets"
          />
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              href={f.key === "all" ? "/capital/bets" : `/capital/bets?status=${f.key}`}
              label={f.label}
              active={activeFilter.key === f.key}
            />
          ))}
        </div>

        {/* List */}
        {visible.length === 0 ? (
          <div className="mt-10 rounded-theme shadow-theme border-theme border-ink bg-surface p-8 text-center">
            <p className="font-display text-lg font-bold text-ink">
              {wagers.length === 0 ? "No bets yet." : "Nothing here."}
            </p>
            <p className="mt-2 text-sm text-ink/60">
              {wagers.length === 0 ? (
                <>
                  Head to{" "}
                  <Link href="/capital/events" className="font-bold underline">
                    Events
                  </Link>{" "}
                  to place your first wager.
                </>
              ) : (
                "Try a different filter."
              )}
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {visible.map((w) => (
              <WagerRow key={w.id} wager={w} />
            ))}
          </ul>
        )}

        <Disclaimer />
      </main>
    </>
  );
}

function WagerRow({ wager: w }: { wager: UserWager }) {
  const marketLabel = w.event.market ? MARKET_LABELS[w.event.market] : null;
  const profitCents = w.payoutCents - w.stakeCents;

  return (
    <li className="rounded-2xl border-theme border-ink bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-black text-ink">{w.event.title}</span>
            {marketLabel && (
              <span className="rounded-full border-theme border-ink bg-mango px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                {marketLabel}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-ink/80">
            {w.outcomeLabel}{" "}
            <span className="font-display tabular-nums text-ink/60">
              ×{w.oddsFrozen.toFixed(2)}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink/55">
            <LocalTime iso={w.createdAt} options={{ year: "numeric" }} />
          </p>
        </div>
        <StatusBadge status={w.status} />
      </div>

      <div className="mt-3 flex items-end justify-between border-t-2 border-ink/10 pt-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink/55">
            Stake
          </div>
          <div className="font-display text-lg font-black tabular-nums">
            {formatWb(w.stakeCents)}
          </div>
        </div>
        <div className="text-right">
          {w.status === "open" ? (
            <>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink/55">
                To return
              </div>
              <div className="font-display text-lg font-black tabular-nums text-ink">
                {formatWb(w.potentialCents)}
              </div>
            </>
          ) : w.status === "won" ? (
            <>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink/55">
                Payout
              </div>
              <div className="font-display text-lg font-black tabular-nums text-pigment-green">
                {formatWb(w.payoutCents)}{" "}
                <span className="text-xs">({formatWb(profitCents, { signed: true })})</span>
              </div>
            </>
          ) : w.status === "lost" ? (
            <>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink/55">
                Result
              </div>
              <div className="font-display text-lg font-black tabular-nums text-imperial-red">
                {formatWb(-w.stakeCents, { signed: true })}
              </div>
            </>
          ) : (
            <>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink/55">
                Refunded
              </div>
              <div className="font-display text-lg font-black tabular-nums text-ink">
                {formatWb(w.payoutCents)}
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: WagerStatus }) {
  const styles: Record<WagerStatus, string> = {
    open: "bg-blue text-ink",
    won: "bg-pigment-green text-white-smoke",
    lost: "bg-imperial-red text-white-smoke",
    refunded: "bg-surface text-ink",
  };
  const labels: Record<WagerStatus, string> = {
    open: "Open",
    won: "Won",
    lost: "Lost",
    refunded: "Push",
  };
  return (
    <span
      className={`shrink-0 rounded-full border-theme border-ink px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`chip-tap tap-press rounded-full border-theme border-ink px-4 py-1.5 text-sm font-bold transition-colors ${
        active
          ? "bg-ink text-white-smoke"
          : "bg-surface text-ink hover:bg-ink hover:text-white-smoke"
      }`}
    >
      {label}
    </Link>
  );
}

function Tile({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const valueColor =
    tone === "good"
      ? "text-pigment-green"
      : tone === "bad"
        ? "text-imperial-red"
        : "text-ink";
  return (
    <div className="rounded-2xl border-theme border-ink bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-ink/60">{label}</p>
      <p className={`mt-2 font-display text-2xl font-black tabular-nums ${valueColor}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink/55">{sub}</p>}
    </div>
  );
}
