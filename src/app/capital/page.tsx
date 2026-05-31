import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { findSubscriptionForUser } from "@/lib/stripe";
import { Disclaimer } from "@/components/Disclaimer";
import { Avatar } from "@/components/Avatar";
import { ReferralCard } from "@/components/capital/ReferralCard";
import { ensureWallet, getRecentLedger, type LedgerKind } from "@/lib/wb/ledger";
import { loadDashboard } from "@/lib/wb/dashboard";
import { hasClaimedToday, getUserStreak } from "@/lib/wb/bonus";
import { listOpenEvents } from "@/lib/wb/bets";
import { groupSyncedByGame } from "@/lib/wb/eventGroups";
import { EventCard } from "@/components/capital/EventCard";
import { getWatchlist } from "@/lib/wb/watchlist";
import { getQuote } from "@/lib/wb/quotes";
import { getBiggestWinsLeaderboard } from "@/lib/wb/leaderboard";
import { getReferralStats } from "@/lib/wb/referrals";
import { listEarned, ACHIEVEMENTS, getAchievementDef } from "@/lib/wb/achievements";
import { formatWb, formatUsd } from "@/lib/wb/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Capital — Whoosh",
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

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}


export default async function CapitalHome() {
  // The section layout already gates on premium; this getSession is just to
  // read the user id for data fetching (and narrows the type for TS).
  const session = await getSession();
  if (!session) redirect("/");

  await ensureWallet(session.id, session.username);

  const [
    dashboard,
    ledger,
    claimedToday,
    streakDays,
    openEvents,
    watchlistRaw,
    biggestWins,
    referral,
    earned,
    sub,
  ] = await Promise.all([
    loadDashboard(session.id),
    getRecentLedger(session.id, 5),
    hasClaimedToday(session.id).catch(() => false),
    getUserStreak(session.id).catch(() => 0),
    listOpenEvents().catch(() => []),
    getWatchlist(session.id).catch(() => []),
    getBiggestWinsLeaderboard(3, 7).catch(() => []),
    getReferralStats(session.id).catch(() => null),
    listEarned(session.id).catch(() => []),
    findSubscriptionForUser(session.id).catch(() => null),
  ]);

  // Legacy members hold the Discord Premium role from the old payment
  // processor but have no Stripe subscription yet — surface a prompt.
  const needsCheckout = !(sub?.status === "active" || sub?.status === "trialing");

  const earnedSet = new Set(earned.map((e) => e.code));
  const watchlist = await Promise.all(
    watchlistRaw.slice(0, 5).map(async (w) => {
      const q = await getQuote(w.symbol).catch(() => null);
      return { ...w, priceCents: q?.priceCents ?? null };
    }),
  );

  const totalEquity = dashboard.allocation.totalEquityCents;
  const totalReturn = dashboard.returns.totalReturnCents;
  const returnPct = dashboard.returns.totalReturnFraction;
  const returnPos = totalReturn >= 0;
  const pctPos = returnPct >= 0;
  const cashCents = dashboard.allocation.cashCents;
  const openGames = groupSyncedByGame(openEvents);

  return (
    <main className="cap-page">
      {/* Welcome */}
      <header className="cap-welcome">
        <Avatar avatarUrl={session.avatarUrl} username={session.username} size={44} />
        <div className="cap-welcome__name">
          <p className="text-eyebrow">Capital · Overview</p>
          <h1 className="text-h2">@{session.username}</h1>
        </div>
        {streakDays > 0 && (
          <span className="badge badge-warning">
            <span className="dot" /> {streakDays}-day streak
          </span>
        )}
      </header>

      {/* Legacy upgrade prompt */}
      {needsCheckout && (
        <div className="alert alert-warning cap-mt">
          <div className="body">
            <strong>Finish setting up Premium.</strong>
            Move your membership onto the new billing to keep your role and earn Whoosh Bucks on every renewal.
            <div className="actions">
              <Link href="/?plans=1#plans" className="btn btn-primary btn-sm">See plans</Link>
            </div>
          </div>
        </div>
      )}

      {/* KPI row */}
      <section className="card-grid cap-mt">
        <Link href="/capital/wallet" className="kpi cap-kpi-link">
          <div className="kpi__label">Total equity</div>
          <div className="kpi__value">{formatWb(totalEquity)}</div>
          <div className={`kpi__delta ${returnPos ? "kpi__delta--positive" : "kpi__delta--negative"}`}>
            {returnPos ? "▲" : "▼"} {formatWb(totalReturn, { signed: true })} · {pctPos ? "+" : ""}
            {(returnPct * 100).toFixed(2)}%
          </div>
        </Link>
        <Link href="/capital/wallet" className="kpi cap-kpi-link">
          <div className="kpi__label">Cash balance</div>
          <div className="kpi__value">{formatWb(cashCents)}</div>
          <div className="kpi__delta">Available to invest or wager</div>
        </Link>
        <Link href="/capital/invest" className="kpi cap-kpi-link">
          <div className="kpi__label">Invested</div>
          <div className="kpi__value">{formatWb(dashboard.allocation.investedValueCents)}</div>
          <div className="kpi__delta">{watchlist.length} on watchlist</div>
        </Link>
      </section>

      {/* Daily check-in */}
      {!claimedToday && (
        <section className="card cap-mt cap-checkin">
          <div>
            <h2 className="text-h3">Daily check-in ready</h2>
            <p className="text-body-sm cap-mt-1">
              {streakDays > 0
                ? `Extend your ${streakDays}-day streak — the reward grows with it.`
                : "Drop in daily for a bonus. Your streak grows the reward."}
            </p>
          </div>
          <form action="/api/wb/bonus" method="POST">
            <button type="submit" className="btn btn-volt">Claim today</button>
          </form>
        </section>
      )}

      {/* Quick actions */}
      <section className="cap-quick cap-mt">
        <QuickAction href="/capital/wallet" label="Wallet" blurb="Balance · interest · transfers" />
        <QuickAction href="/capital/invest" label="Invest" blurb="Stocks · crypto · live P/L" />
        <QuickAction
          href="/capital/events"
          label="Events"
          blurb={openEvents.length > 0 ? `${openEvents.length} open ${openEvents.length === 1 ? "event" : "events"}` : "House-curated wagers"}
        />
        <QuickAction href="/capital/wallet#leaderboard" label="Leaderboard" blurb="See where you rank" />
      </section>

      {/* Open events — collapsible, expand to bet inline */}
      {openGames.length > 0 && (
        <section className="cap-mt-lg">
          <div className="cap-card-head">
            <h2 className="text-h2">Open events</h2>
            <Link href="/capital/events" className="cap-link">See all →</Link>
          </div>
          <div className="cap-stack cap-mt">
            {openGames.slice(0, 3).map((g) => (
              <EventCard key={g.key} game={g} />
            ))}
          </div>
        </section>
      )}

      {/* Today */}
      {(watchlist.length > 0 || biggestWins.length > 0) && (
        <section className="cap-mt-lg">
          <h2 className="text-h2">Today</h2>
          <div className="cap-cols cap-mt">
            {watchlist.length > 0 && (
              <div className="card">
                <div className="cap-card-head">
                  <h3 className="text-h3">Watchlist</h3>
                  <Link href="/capital/invest" className="cap-link">See all →</Link>
                </div>
                <table className="tbl cap-bare">
                  <tbody>
                    {watchlist.map((w) => (
                      <tr key={w.symbol}>
                        <td>{w.symbol}</td>
                        <td className="num">{w.priceCents != null ? formatUsd(w.priceCents) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {biggestWins.length > 0 && (
              <div className="card">
                <div className="cap-card-head">
                  <h3 className="text-h3">Biggest wins</h3>
                  <Link href="/capital/wallet#leaderboard" className="cap-link">Leaderboard →</Link>
                </div>
                <table className="tbl cap-bare">
                  <tbody>
                    {biggestWins.map((w) => (
                      <tr key={`${w.rank}-${w.discordUserId}`}>
                        <td>#{w.rank} · @{w.discordUsername}</td>
                        <td className="num num--positive">▲ {formatWb(w.payoutCents, { signed: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Recent activity */}
      <section className="cap-mt-lg">
        <div className="cap-card-head">
          <h2 className="text-h2">Recent activity</h2>
          <Link href="/capital/wallet/activity" className="cap-link">See all →</Link>
        </div>
        {ledger.length === 0 ? (
          <div className="card cap-mt cap-empty">
            No activity yet. Try a trade, a wager, or claim your daily bonus.
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
                    <td className="text-body-sm">{entry.memo ?? fmtDateTime(entry.createdAt)}</td>
                    <td className={`num ${positive ? "num--positive" : "num--negative"}`}>
                      {positive ? "+" : "−"}
                      {formatWb(Math.abs(entry.amountCents))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Referral */}
      {referral && (
        <div className="cap-mt-lg">
          <ReferralCard stats={referral} />
        </div>
      )}

      {/* Achievements */}
      <section className="card cap-mt-lg">
        <div className="cap-card-head">
          <h2 className="text-h3">Achievements</h2>
          <Link href="/account" className="cap-link">{earned.length} / {ACHIEVEMENTS.length} →</Link>
        </div>
        <ul className="cap-achievements">
          {ACHIEVEMENTS.map((a) => {
            const got = earnedSet.has(a.code);
            const def = getAchievementDef(a.code)!;
            return (
              <li key={a.code} className={`cap-ach ${got ? "is-earned" : ""}`} title={def.description}>
                <span className="cap-ach__icon" aria-hidden="true">{def.icon}</span>
                <span className="cap-ach__label">{def.label}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <Disclaimer />
    </main>
  );
}

function QuickAction({ href, label, blurb }: { href: string; label: string; blurb: string }) {
  return (
    <Link href={href} className="card cap-quick__item">
      <span className="text-h3">{label}</span>
      <span className="text-body-sm">{blurb}</span>
      <span className="cap-quick__cta">Open →</span>
    </Link>
  );
}
