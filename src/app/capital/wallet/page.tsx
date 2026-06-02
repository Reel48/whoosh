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
import { Ticker } from "@/components/ui/Ticker";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Wallet — Whoosh",
};

const KIND_LABEL: Record<LedgerKind, string> = {
  purchase: "Purchase",
  premium_match: "Premium match",
  fantasy_match: "Fantasy match",
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
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
    redirect("/login?next=/capital/wallet");
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
    getRecentLedger(session.id, 5),
    getCurrentRate().catch(() => null),
    getLeaderboard(10).catch(() => []),
    getTradersLeaderboard(10, 7).catch(() => []),
    getBiggestWinsLeaderboard(10, 7).catch(() => []),
    getStreaksLeaderboard(10).catch(() => []),
    hasClaimedToday(session.id).catch(() => false),
    getUserStreak(session.id).catch(() => 0),
  ]);

  const { allocation, returns, positions } = dashboard;
  // Day-over-day market move on holdings (null until quotes carry a prev close).
  const dayChange = dashboard.dayChangeCents;
  const dayPos = (dayChange ?? 0) >= 0;

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
                text: `Daily bonus claimed — ${formatWb(Number(sp.amount ?? 0))} added (${sp.streak}-day streak).`,
              }
            : sp.bonus === "already"
              ? { tone: "warn", text: "You've already claimed today's bonus." }
              : sp.error
                ? { tone: "warn", text: sp.error }
                : null;

  const apyHint = rate ? `${(rate.apyBps / 100).toFixed(2)}% APY` : undefined;

  const lifetime: { label: string; cents: number; signed?: boolean }[] = [
    { label: "Money in (purchases)", cents: returns.realDollarsInCents },
    { label: "Premium match", cents: returns.premiumMatchCents, signed: true },
    { label: "Interest earned", cents: returns.interestEarnedCents, signed: true },
    { label: "Wager P/L", cents: returns.wagerPlCents, signed: true },
    { label: "Investing P/L", cents: returns.investingPlCents, signed: true },
    { label: "Dividends received", cents: returns.dividendsCents, signed: true },
    { label: "Net transfers", cents: returns.netTransfersCents, signed: true },
  ];

  return (
    <main className="cap-page">
      <p className="text-eyebrow">Capital · Wallet</p>
      <h1 className="text-h1 cap-mt-1">Your portfolio</h1>

      {banner && (
        <div className={`alert ${banner.tone === "good" ? "alert-positive" : "alert-warning"} cap-mt`}>
          <div className="body">{banner.text}</div>
        </div>
      )}

      {/* KPI strip — three compact columns in one card so it stays a single
          row (even on a phone) instead of three tall stacked cards. */}
      <section className="card cap-stat-row cap-mt">
        <div className="cap-stat">
          <span className="cap-stat__label">Total equity</span>
          <span className="cap-stat__value">
            <Ticker valueCents={allocation.totalEquityCents} />
          </span>
          {dayChange != null ? (
            <span className={`cap-stat__delta ${dayPos ? "cap-stat__delta--pos" : "cap-stat__delta--neg"}`}>
              {dayPos ? "▲" : "▼"} {formatMoney(dayChange, { signed: true })} today
            </span>
          ) : (
            <span className="cap-stat__delta">—</span>
          )}
        </div>
        <div className="cap-stat">
          <span className="cap-stat__label">Cash</span>
          <span className="cap-stat__value">
            <Ticker valueCents={allocation.cashCents} />
          </span>
          <span className="cap-stat__delta">{apyHint ?? "—"}</span>
        </div>
        <div className="cap-stat">
          <span className="cap-stat__label">Invested</span>
          <span className="cap-stat__value">
            <Ticker valueCents={allocation.investedValueCents} />
          </span>
          <span className="cap-stat__delta">
            {positions.length > 0 ? `${positions.length} ${positions.length === 1 ? "position" : "positions"}` : "no positions"}
          </span>
        </div>
      </section>

      {/* Daily check-in */}
      <section className="card cap-mt cap-checkin">
        <div>
          <h2 className="text-h3">
            Daily check-in{streakDays > 0 ? ` · ${streakDays}-day streak` : ""}
          </h2>
          <p className="text-body-sm cap-mt-1">
            {claimedToday
              ? "Already claimed today. Come back tomorrow to extend your streak."
              : "Drop in daily to claim your bonus. Your streak grows the reward."}
          </p>
        </div>
        <form action="/api/wb/bonus" method="POST">
          <button type="submit" disabled={claimedToday} className="btn btn-volt">
            {claimedToday ? "Claimed ✓" : "Claim bonus"}
          </button>
        </form>
      </section>

      {/* Allocation */}
      <section className="card cap-mt-lg">
        <h2 className="text-h3">Where your WB lives</h2>
        <p className="text-body-sm cap-mt-1">
          Cash earns the SPAXX-tied yield; investing and open bets each lock up part of your equity.
        </p>
        <div className="cap-mt">
          <AllocationBar
            slices={[
              { label: "Earning yield", cents: allocation.cashCents, tone: "positive", hint: apyHint },
              {
                label: "Invested",
                cents: allocation.investedValueCents,
                tone: "primary",
                hint: positions.length > 0 ? `${positions.length} ${positions.length === 1 ? "position" : "positions"}` : "no positions",
              },
              {
                label: "Locked in wagers",
                cents: allocation.openWagersCents,
                tone: "negative",
                hint: allocation.openWagersCents > 0 ? "settling soon" : "no open bets",
              },
            ]}
          />
        </div>
      </section>

      {/* Lifetime returns */}
      <section className="card cap-mt-lg">
        <h2 className="text-h3">Lifetime returns</h2>
        <p className="text-body-sm cap-mt-1">
          What&rsquo;s contributed to (or taken from) your stack since you joined.
        </p>
        <table className="tbl cap-bare">
          <tbody>
            {lifetime.map((r) => {
              const cls = !r.signed ? "" : r.cents > 0 ? "num--positive" : r.cents < 0 ? "num--negative" : "";
              return (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className={`num ${cls}`}>
                    {r.signed
                      ? `${r.cents > 0 ? "+" : r.cents < 0 ? "−" : ""}${formatMoney(Math.abs(r.cents))}`
                      : formatMoney(r.cents)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Leaderboard */}
      <section className="cap-mt-lg" id="leaderboard">
        <LeaderboardTabs
          variant="capital"
          holders={holders}
          traders={traders}
          wins={wins}
          streaks={streaks}
          highlightUserId={session.id}
        />
      </section>

      {/* Balance chart */}
      <section className="chart-card cap-mt-lg">
        <div className="chart-card__head">
          <div>
            <h2 className="text-h3">Cash balance</h2>
            <p className="text-body-sm">End-of-day cash · last 90 days</p>
          </div>
        </div>
        <BalanceChart data={dashboard.balanceSeries} />
      </section>

      {/* Positions */}
      {positions.length > 0 && (
        <section className="cap-mt-lg">
          <h2 className="text-h2 cap-section-title">Open positions</h2>
          <div className="cap-tbl-scroll">
          <table className="tbl cap-tbl--tight">
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="num">Shares</th>
                <th className="num">Market value</th>
                <th className="num">P/L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const u = p.unrealizedCents;
                const cls = u == null ? "" : u > 0 ? "num--positive" : u < 0 ? "num--negative" : "";
                return (
                  <tr key={p.symbol}>
                    <td>{p.symbol}</td>
                    <td className="num">{formatShares(p.shares)}</td>
                    <td className="num">{p.marketValueCents !== null ? formatMoney(p.marketValueCents) : "—"}</td>
                    <td className={`num ${cls}`}>
                      {u == null ? "—" : `${u > 0 ? "▲ " : u < 0 ? "▼ " : ""}${formatMoney(u, { signed: true })}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <p className="text-body-sm cap-mt-1">
            Live quotes via Yahoo (delayed ~15 min). Go to{" "}
            <a href="/capital/invest" className="cap-link">Invest</a> to buy or sell.
          </p>
        </section>
      )}

      {/* Buy WB */}
      <section className="card cap-mt-lg">
        <h2 className="text-h3">Buy Whoosh Bucks</h2>
        <p className="text-body-sm cap-mt-1">
          Every $1 paid via Stripe = $10 of Whoosh Bucks. Bucks appear here when the charge clears.
        </p>
        <BuyWbForm />
      </section>

      {/* Send WB */}
      <section className="card cap-mt-lg">
        <h2 className="text-h3">Send Whoosh Bucks</h2>
        <p className="text-body-sm cap-mt-1">
          Send to any Whoosh user by their Discord username. They must have signed in at least once.
        </p>
        <form action="/api/wb/transfer" method="POST" className="cap-send cap-mt">
          <div className="field">
            <label htmlFor="recipient">Recipient</label>
            <div className="input-group">
              <span className="addon">@</span>
              <input id="recipient" className="input" type="text" name="recipient" placeholder="username" required autoComplete="off" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="send-amount">Amount</label>
            <div className="input-group">
              <span className="addon">$</span>
              <input id="send-amount" className="input input-num" type="number" name="amount" min="0.01" step="0.01" placeholder="0.00" required inputMode="decimal" />
            </div>
          </div>
          <div className="field cap-send__memo">
            <label htmlFor="memo">Memo (optional)</label>
            <input id="memo" className="input" type="text" name="memo" placeholder="What's it for?" />
          </div>
          <button type="submit" className="btn btn-primary cap-send__submit">Send</button>
        </form>
      </section>

      {/* Activity */}
      <section className="cap-mt-lg">
        <div className="cap-card-head">
          <h2 className="text-h2">Recent activity</h2>
          {ledger.length > 0 && (
            <a href="/capital/wallet/activity" className="cap-link">See all →</a>
          )}
        </div>
        {ledger.length === 0 ? (
          <div className="card cap-mt cap-empty">
            No activity yet. Buy some Whoosh Bucks above to get started — every $1 = $10 WB.
          </div>
        ) : (
          <table className="tbl cap-mt">
            <thead>
              <tr>
                <th>Type</th>
                <th>When</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => {
                const positive = entry.amountCents >= 0;
                return (
                  <tr key={entry.id}>
                    <td>{KIND_LABEL[entry.kind] ?? entry.kind}</td>
                    <td className="text-body-sm">{entry.memo ?? formatDateTime(entry.createdAt)}</td>
                    <td className={`num ${positive ? "num--positive" : "num--negative"}`}>
                      {positive ? "+" : "−"}
                      {formatMoney(Math.abs(entry.amountCents))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <Disclaimer />
    </main>
  );
}
