import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ensureWallet, getRecentLedger, type LedgerKind } from "@/lib/wb/ledger";
import { loadDashboard } from "@/lib/wb/dashboard";
import { getCurrentRate } from "@/lib/wb/interest";
import {
  getLeaderboard,
  getTradersLeaderboard,
  getBiggestWinsLeaderboard,
  getStreaksLeaderboard,
} from "@/lib/wb/leaderboard";
import { BalanceChart } from "@/components/wb/BalanceChart";
import { AllocationBar } from "@/components/wb/AllocationBar";
import { LeaderboardTabs } from "@/components/wb/LeaderboardTabs";
import { Disclaimer } from "@/components/Disclaimer";
import { BuyWbForm } from "@/components/wb/BuyWbForm";
import { hasClaimedToday, getUserStreak } from "@/lib/wb/bonus";
import { formatWb } from "@/lib/wb/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Wallet — Whoosh",
};

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

const formatMoney = formatWb;

function formatPct(fraction: number): string {
  const sign = fraction >= 0 ? "+" : "";
  return `${sign}${(fraction * 100).toFixed(2)}%`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShares(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{
    purchase?: string;
    transfer?: string;
    bonus?: string;
    streak?: string;
    amount?: string;
    error?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/api/auth/discord?next=/capital/wallet");
  }
  await ensureWallet(session.id, session.username);

  const [
    dashboard,
    ledger,
    rate,
    holders,
    traders,
    wins,
    streaks,
    claimedToday,
    streakDays,
  ] = await Promise.all([
    loadDashboard(session.id),
    getRecentLedger(session.id, 25),
    getCurrentRate().catch(() => null),
    getLeaderboard(10).catch(() => []),
    getTradersLeaderboard(10, 7).catch(() => []),
    getBiggestWinsLeaderboard(10, 7).catch(() => []),
    getStreaksLeaderboard(10).catch(() => []),
    hasClaimedToday(session.id).catch(() => false),
    getUserStreak(session.id).catch(() => 0),
  ]);

  const { allocation, returns, positions } = dashboard;

  const sp = await searchParams;
  const banner =
    sp.purchase === "ok"
      ? { tone: "good", text: "Purchase successful — your WB will appear here in a few seconds." }
      : sp.purchase === "cancelled"
        ? { tone: "warn", text: "Purchase cancelled." }
        : sp.transfer === "ok"
          ? { tone: "good", text: "Transfer sent." }
          : sp.bonus === "ok"
            ? {
                tone: "good",
                text: `Daily bonus claimed — ${formatWb(Number(sp.amount ?? 0))} added (${sp.streak}-day streak 🔥).`,
              }
            : sp.bonus === "already"
              ? { tone: "warn", text: "You've already claimed today's bonus." }
              : sp.error
                ? { tone: "warn", text: sp.error }
                : null;

  const apyHint = rate
    ? `Earning ${(rate.apyBps / 100).toFixed(2)}% APY · ${rate.source.startsWith("fred") ? "SPAXX-tied" : rate.source}`
    : undefined;

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
        <span className="text-xs font-display font-bold uppercase tracking-[0.22em] text-ink">
          Your portfolio
        </span>

        {/* Hero: total equity */}
        <div className="mt-6 rounded-theme shadow-theme border-theme border-ink bg-surface p-6 text-ink sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-ink/70">
            Total equity
          </p>
          <p className="mt-2 font-display text-5xl font-black tracking-tight sm:text-6xl tabular-nums">
            {formatMoney(allocation.totalEquityCents)}
          </p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm font-medium">
            <span className="text-ink/80">
              <span className="font-display font-black">
                {formatMoney(returns.totalReturnCents, { signed: true })}
              </span>{" "}
              <span className="text-ink/60">total return</span>
            </span>
            <span className="text-ink/80">
              <span className="font-display font-black text-ink">
                {formatPct(returns.totalReturnFraction)}
              </span>{" "}
              <span className="text-ink/60">vs. money in</span>
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

        {/* Daily check-in */}
        <section className="mt-8 rounded-theme shadow-theme border-theme border-ink bg-mango p-6 text-ink sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold">
                Daily check-in
                {streakDays > 0 && (
                  <span className="ml-2 text-base font-medium text-ink/70">
                    🔥 {streakDays}-day streak
                  </span>
                )}
              </h2>
              <p className="mt-1 text-sm font-medium text-ink/70">
                {claimedToday
                  ? "Already claimed today. Come back tomorrow to extend your streak."
                  : "Drop in daily to claim your bonus. Streak grows the reward."}
              </p>
            </div>
            <form action="/api/wb/bonus" method="POST">
              <button
                type="submit"
                disabled={claimedToday}
                className="tap-press cursor-pointer rounded-full border-theme border-ink bg-ink px-6 py-3 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {claimedToday ? "Claimed ✓" : "Claim today's bonus"}
              </button>
            </form>
          </div>
        </section>

        {/* Allocation */}
        <section className="mt-8 rounded-theme shadow-theme border-theme border-ink bg-surface p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-ink">Where your WB lives</h2>
          <p className="mt-1 text-sm text-ink/60">
            Cash sits in your Whoosh wallet earning the SPAXX-tied yield.
            Investing and open bets each lock up part of your equity.
          </p>
          <div className="mt-5">
            <AllocationBar
              slices={[
                {
                  label: "Earning yield",
                  cents: allocation.cashCents,
                  className: "bg-pigment-green",
                  hint: apyHint,
                },
                {
                  label: "Invested",
                  cents: allocation.investedValueCents,
                  className: "bg-surface",
                  hint:
                    positions.length > 0
                      ? `${positions.length} ${positions.length === 1 ? "position" : "positions"}`
                      : "no positions",
                },
                {
                  label: "Locked in wagers",
                  cents: allocation.openWagersCents,
                  className: "bg-imperial-red",
                  hint:
                    allocation.openWagersCents > 0
                      ? "settling soon"
                      : "no open bets",
                },
              ]}
            />
          </div>
        </section>

        {/* Lifetime breakdown */}
        <section className="mt-8 rounded-theme shadow-theme border-theme border-ink bg-surface p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-ink">Lifetime returns</h2>
          <p className="mt-1 text-sm text-ink/60">
            What&rsquo;s contributed to (or taken from) your stack since you joined.
          </p>
          <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Stat label="Money in (purchases)" value={formatMoney(returns.realDollarsInCents)} />
            <Stat
              label="Premium match"
              value={formatMoney(returns.premiumMatchCents, { signed: true })}
              tone={returns.premiumMatchCents > 0 ? "good" : "neutral"}
            />
            <Stat
              label="Interest earned"
              value={formatMoney(returns.interestEarnedCents, { signed: true })}
              tone={returns.interestEarnedCents > 0 ? "good" : "neutral"}
            />
            <Stat
              label="Wager P/L"
              value={formatMoney(returns.wagerPlCents, { signed: true })}
              tone={returns.wagerPlCents > 0 ? "good" : returns.wagerPlCents < 0 ? "warn" : "neutral"}
            />
            <Stat
              label="Investing P/L (realized + unrealized)"
              value={formatMoney(returns.investingPlCents, { signed: true })}
              tone={returns.investingPlCents > 0 ? "good" : returns.investingPlCents < 0 ? "warn" : "neutral"}
            />
            <Stat
              label="Dividends received"
              value={formatMoney(returns.dividendsCents, { signed: true })}
              tone={returns.dividendsCents > 0 ? "good" : "neutral"}
            />
            <Stat
              label="Net transfers"
              value={formatMoney(returns.netTransfersCents, { signed: true })}
              tone="neutral"
            />
          </dl>
        </section>

        {/* Leaderboard */}
        <section className="mt-8">
          <LeaderboardTabs
            holders={holders}
            traders={traders}
            wins={wins}
            streaks={streaks}
            highlightUserId={session.id}
          />
        </section>

        {/* Balance chart */}
        <section className="mt-8 rounded-theme shadow-theme border-theme border-ink bg-surface p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-ink">Cash balance · last 90 days</h2>
          <p className="mt-1 text-sm text-ink/60">
            End-of-day cash balance — not including the value of open positions
            or open wagers.
          </p>
          <div className="mt-5">
            <BalanceChart data={dashboard.balanceSeries} />
          </div>
        </section>

        {/* Positions detail (only if there are any) */}
        {positions.length > 0 && (
          <section className="mt-8 rounded-theme shadow-theme border-theme border-ink bg-surface p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold text-ink">Open positions</h2>
            <ul className="mt-5 divide-y-2 divide-ink border-y-2 border-ink">
              {positions.map((p) => (
                <li
                  key={p.symbol}
                  className="flex flex-col gap-2 py-3 text-sm sm:grid sm:grid-cols-[1fr_1fr_1fr] sm:items-center sm:gap-4"
                >
                  <div className="flex items-baseline justify-between gap-3 sm:block">
                    <div className="font-display text-lg font-black sm:text-base">{p.symbol}</div>
                    <div className="text-xs text-ink/60">{formatShares(p.shares)} shares</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:contents">
                    <div className="text-left sm:text-right">
                      <div className="text-xs font-bold uppercase tracking-wider text-ink/60">
                        Market
                      </div>
                      <div className="font-display font-bold tabular-nums">
                        {p.marketValueCents !== null ? formatMoney(p.marketValueCents) : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold uppercase tracking-wider text-ink/60">
                        P/L
                      </div>
                      <div
                        className={`font-display font-black tabular-nums ${
                          p.unrealizedCents === null
                            ? "text-ink/60"
                            : p.unrealizedCents > 0
                              ? "text-pigment-green"
                              : p.unrealizedCents < 0
                                ? "text-imperial-red"
                                : "text-ink"
                        }`}
                        aria-label={
                          p.unrealizedCents == null
                            ? "P/L unavailable"
                            : `${p.unrealizedCents > 0 ? "up" : p.unrealizedCents < 0 ? "down" : "flat"} ${formatMoney(p.unrealizedCents, { signed: true })}`
                        }
                      >
                        {p.unrealizedCents == null
                          ? "—"
                          : `${p.unrealizedCents > 0 ? "▲ " : p.unrealizedCents < 0 ? "▼ " : ""}${formatMoney(p.unrealizedCents, { signed: true })}`}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink/60">
              Live quotes via Yahoo (delayed ~15 min). See <a href="/capital/invest" className="font-bold underline">/invest</a> to buy or sell.
            </p>
          </section>
        )}

        {/* Buy WB */}
        <section className="mt-8 rounded-theme shadow-theme border-theme border-ink bg-surface p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-ink">Buy Whoosh Bucks</h2>
          <p className="mt-2 text-sm font-medium text-ink/70">
            Every $1 paid via Stripe = $10 of Whoosh Bucks. Bucks appear here
            when the charge clears.
          </p>
          <BuyWbForm />
        </section>

        {/* Send WB */}
        <section className="mt-8 rounded-theme shadow-theme border-theme border-ink bg-surface p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-ink">Send Whoosh Bucks</h2>
          <p className="mt-2 text-sm font-medium text-ink/70">
            Send to any Whoosh user by their Discord username. They must have
            signed in to the site at least once.
          </p>
          <form
            action="/api/wb/transfer"
            method="POST"
            className="mt-5 grid gap-3 sm:grid-cols-[1fr_140px_auto]"
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-ink/60">
                @
              </span>
              <input
                type="text"
                name="recipient"
                placeholder="username"
                required
                autoComplete="off"
                aria-label="Recipient username"
                className="w-full rounded-full border-theme border-ink bg-surface px-4 py-3 pl-8 font-medium focus:outline-none focus:ring-2 focus:ring-ink"
              />
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display font-bold text-ink/60">
                $
              </span>
              <input
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                required
                inputMode="decimal"
                aria-label="USD amount"
                className="w-full rounded-full border-theme border-ink bg-surface px-4 py-3 pl-8 font-display text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ink"
              />
            </div>
            <button
              type="submit"
              className="tap-press cursor-pointer rounded-full border-theme border-ink bg-ink px-6 py-3 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
            >
              Send
            </button>
            <input
              type="text"
              name="memo"
              placeholder="Memo (optional)"
              aria-label="Memo (optional)"
              className="sm:col-span-3 rounded-full border-theme border-ink bg-surface px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-ink"
            />
          </form>
        </section>

        {/* Activity ledger */}
        <div className="mt-12 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-ink">Activity</h2>
          {ledger.length > 0 && (
            <a
              href="/capital/wallet/activity"
              className="text-sm font-bold text-ink/70 underline-offset-2 hover:underline"
            >
              See all →
            </a>
          )}
        </div>
        {ledger.length === 0 ? (
          <div className="mt-4 rounded-theme shadow-theme border-theme border-ink bg-surface p-8 text-center">
            <p className="font-display text-lg font-bold text-ink">
              No activity yet.
            </p>
            <p className="mt-2 text-sm text-ink/60">
              Buy some Whoosh Bucks above to get started. Every $1 = $10 WB.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y-2 divide-ink border-y-2 border-ink">
            {ledger.map((entry) => {
              const positive = entry.amountCents >= 0;
              return (
                <li
                  key={entry.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-bold">{KIND_LABEL[entry.kind] ?? entry.kind}</div>
                    <div className="truncate text-xs text-ink/60">
                      {entry.memo ?? formatDateTime(entry.createdAt)}
                    </div>
                  </div>
                  <div
                    className={`font-display text-lg font-black tabular-nums ${
                      positive ? "text-pigment-green" : "text-imperial-red"
                    }`}
                  >
                    {formatMoney(entry.amountCents, { signed: true })}
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

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "neutral";
}) {
  const cls =
    tone === "good"
      ? "text-pigment-green"
      : tone === "warn"
        ? "text-imperial-red"
        : "text-ink";
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-ink/60">{label}</dt>
      <dd className={`mt-1 font-display text-2xl font-black tabular-nums ${cls}`}>{value}</dd>
    </div>
  );
}
