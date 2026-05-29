import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { isPremium } from "@/lib/membership";
import { findSubscriptionForDiscordUser } from "@/lib/stripe";
import { Nav } from "@/components/Nav";
import { Disclaimer } from "@/components/Disclaimer";
import { Avatar } from "@/components/Avatar";
import { Bolt } from "@/components/Bolt";
import { ReferralCard } from "@/components/wb/ReferralCard";
import { ensureWallet, getRecentLedger, type LedgerKind } from "@/lib/wb/ledger";
import { loadDashboard } from "@/lib/wb/dashboard";
import { hasClaimedToday, getUserStreak } from "@/lib/wb/bonus";
import { listOpenEvents } from "@/lib/wb/bets";
import { getWatchlist } from "@/lib/wb/watchlist";
import { getQuote } from "@/lib/wb/quotes";
import { getBiggestWinsLeaderboard } from "@/lib/wb/leaderboard";
import { getReferralStats } from "@/lib/wb/referrals";
import { listEarned, ACHIEVEMENTS, getAchievementDef } from "@/lib/wb/achievements";
import { formatWb, formatUsd } from "@/lib/wb/format";

const DISCORD_INVITE = "https://discord.gg/zzP8nFFzQt";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Home — Whoosh",
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

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtClosesAt(iso: string | null): string {
  if (!iso) return "open";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return "closing soon";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `closes in ${Math.max(1, Math.floor(ms / 60_000))}m`;
  if (hours < 24) return `closes in ${hours}h`;
  return `closes in ${Math.floor(hours / 24)}d`;
}

export default async function MemberHome() {
  const session = await getSession();
  if (!session) redirect("/");
  if (!(await isPremium(session.id))) redirect("/");

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
    findSubscriptionForDiscordUser(session.id).catch(() => null),
  ]);

  // Legacy members hold the Discord Premium role from the old payment
  // processor but have no Stripe subscription yet. They reach /home via the
  // role, but nothing here points them at checkout — surface a prompt.
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

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-6 py-8 sm:py-12">
        {/* 1. Welcome strip */}
        <div className="flex items-center gap-3">
          <Avatar
            id={session.id}
            hash={session.avatar}
            username={session.username}
            size={44}
            className="border-2 border-ink"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-heading font-bold uppercase tracking-[0.22em] text-ink/60">
              Welcome back
            </p>
            <p className="truncate font-heading text-xl font-black tracking-tight text-ink">
              @{session.username}
            </p>
          </div>
          {streakDays > 0 && (
            <span className="chip-tap rounded-full border-2 border-ink bg-mango px-3 text-sm font-bold text-ink">
              🔥 {streakDays}d
            </span>
          )}
        </div>

        {/* Legacy-member upgrade prompt — only when there's no active Stripe sub */}
        {needsCheckout && (
          <Link
            href="/?plans=1#plans"
            className="tap-press mt-6 flex items-center justify-between gap-4 rounded-3xl border-2 border-ink bg-safety-orange p-5 text-ink sm:p-6"
          >
            <div className="min-w-0">
              <p className="font-heading text-lg font-bold">Finish setting up Premium</p>
              <p className="mt-1 text-sm font-medium text-ink/70">
                Move your membership onto the new billing to keep your role and
                start earning Whoosh Bucks on every renewal.
              </p>
            </div>
            <span className="shrink-0 rounded-full border-2 border-ink bg-ink px-4 py-2 text-sm font-bold text-white-smoke">
              See plans →
            </span>
          </Link>
        )}

        {/* 2. Total equity hero */}
        <Link
          href="/wallet"
          className="tap-press mt-6 block rounded-3xl border-2 border-ink bg-blue p-6 text-ink sm:p-7"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-ink/70">
            Total equity
          </p>
          <p className="mt-2 font-heading text-5xl font-black tracking-tight tabular-nums sm:text-6xl">
            {formatWb(totalEquity)}
          </p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm font-medium">
            <span>
              <span className="font-heading font-black">
                {formatWb(totalReturn, { signed: true })}
              </span>{" "}
              <span className="text-ink/60">total return</span>
            </span>
            <span>
              <span className="font-heading font-black">
                {`${returnPct >= 0 ? "+" : ""}${(returnPct * 100).toFixed(2)}%`}
              </span>{" "}
              <span className="text-ink/60">vs. money in</span>
            </span>
          </div>
        </Link>

        {/* 3. Daily check-in (only if unclaimed) */}
        {!claimedToday && (
          <section className="mt-6 rounded-3xl border-2 border-ink bg-mango p-6 text-ink sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-heading text-xl font-bold">
                  Daily check-in ready
                </h2>
                <p className="mt-1 text-sm font-medium text-ink/70">
                  {streakDays > 0
                    ? `Extend your ${streakDays}-day streak. Reward grows with the streak.`
                    : "Drop in daily for a bonus. Streak grows the reward."}
                </p>
              </div>
              <form action="/api/wb/bonus" method="POST">
                <button
                  type="submit"
                  className="tap-press cursor-pointer rounded-full border-2 border-ink bg-ink px-6 py-3 text-sm font-bold text-white-smoke"
                >
                  Claim today
                </button>
              </form>
            </div>
          </section>
        )}

        {/* 4. Quick-action grid */}
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <QuickAction
            href="/wallet"
            label="Wallet"
            blurb="Balance · interest · transfers"
            tone="white"
          />
          <QuickAction
            href="/invest"
            label="Invest"
            blurb="Stocks · crypto · live P/L"
            tone="white"
          />
          <QuickAction
            href="/events"
            label="Events"
            blurb={
              openEvents.length > 0
                ? `${openEvents.length} open ${openEvents.length === 1 ? "event" : "events"}`
                : "House-curated wagers"
            }
            tone="white"
          />
          <QuickAction
            href="/wallet#leaderboard"
            label="Leaderboard"
            blurb="See where you rank"
            tone="white"
          />
        </section>

        {/* 5. Today's highlights */}
        <section className="mt-10">
          <h2 className="font-heading text-xl font-bold text-ink">Today</h2>

          {/* Open events */}
          {openEvents.length > 0 && (
            <div className="mt-4 rounded-3xl border-2 border-ink bg-white-smoke p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-heading text-base font-bold text-ink">Open events</p>
                <Link
                  href="/events"
                  className="text-xs font-bold text-ink/70 underline-offset-2 hover:underline"
                >
                  See all →
                </Link>
              </div>
              <ul className="mt-3 divide-y-2 divide-ink/10">
                {openEvents.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <Link
                      href="/events"
                      className="tap-press flex items-center justify-between gap-3 py-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-heading font-bold text-ink">
                          {e.title}
                        </p>
                        <p className="text-xs text-ink/60">{fmtClosesAt(e.closesAt)}</p>
                      </div>
                      <span aria-hidden="true" className="text-ink/40">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Watchlist */}
          {watchlist.length > 0 && (
            <div className="mt-4 rounded-3xl border-2 border-ink bg-white-smoke p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-heading text-base font-bold text-ink">Watchlist</p>
                <Link
                  href="/invest"
                  className="text-xs font-bold text-ink/70 underline-offset-2 hover:underline"
                >
                  See all →
                </Link>
              </div>
              <ul className="mt-3 divide-y-2 divide-ink/10">
                {watchlist.map((w) => (
                  <li key={w.symbol}>
                    <Link
                      href={`/invest?symbol=${encodeURIComponent(w.symbol)}`}
                      className="tap-press flex items-center justify-between gap-3 py-3 text-sm"
                    >
                      <span className="font-heading text-base font-black text-ink">
                        {w.symbol}
                      </span>
                      <span className="font-heading font-bold tabular-nums text-ink/80">
                        {w.priceCents != null ? formatUsd(w.priceCents) : "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Biggest wins */}
          {biggestWins.length > 0 && (
            <div className="mt-4 rounded-3xl border-2 border-ink bg-white-smoke p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-heading text-base font-bold text-ink">
                  Biggest wins this week
                </p>
                <Link
                  href="/wallet#leaderboard"
                  className="text-xs font-bold text-ink/70 underline-offset-2 hover:underline"
                >
                  See leaderboard →
                </Link>
              </div>
              <ul className="mt-3 divide-y-2 divide-ink/10">
                {biggestWins.map((w) => (
                  <li
                    key={`${w.rank}-${w.discordUserId}`}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-heading text-sm font-black text-ink/60 tabular-nums">
                        #{w.rank}
                      </span>
                      <span className="truncate font-heading font-bold text-ink">
                        @{w.discordUsername}
                      </span>
                    </div>
                    <span className="font-heading font-black tabular-nums text-ink">
                      ▲ {formatWb(w.payoutCents, { signed: true })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 6. Recent activity */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-xl font-bold text-ink">Recent activity</h2>
            <Link
              href="/wallet/activity"
              className="text-xs font-bold text-ink/70 underline-offset-2 hover:underline"
            >
              See all →
            </Link>
          </div>
          {ledger.length === 0 ? (
            <p className="mt-4 rounded-3xl border-2 border-ink bg-white-smoke p-6 text-center text-sm text-ink/60">
              No activity yet. Try a trade, a wager, or claim your daily bonus.
            </p>
          ) : (
            <ul className="mt-4 divide-y-2 divide-ink border-y-2 border-ink">
              {ledger.map((entry) => {
                return (
                  <li
                    key={entry.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-bold">
                        {KIND_LABEL[entry.kind] ?? entry.kind}
                      </div>
                      <div className="truncate text-xs text-ink/60">
                        {entry.memo ?? fmtDateTime(entry.createdAt)}
                      </div>
                    </div>
                    <div className="font-heading text-lg font-black tabular-nums text-ink">
                      {formatWb(entry.amountCents, { signed: true })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 7. Refer + earn */}
        {referral && <ReferralCard stats={referral} />}

        {/* 8. Achievements */}
        <section className="mt-10 rounded-3xl border-2 border-ink bg-white-smoke p-6 text-ink sm:p-7">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-xl font-bold">Achievements</h2>
            <Link
              href="/account"
              className="text-xs font-bold text-ink/70 underline-offset-2 hover:underline"
            >
              {earned.length} / {ACHIEVEMENTS.length} →
            </Link>
          </div>
          <ul className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {ACHIEVEMENTS.map((a) => {
              const got = earnedSet.has(a.code);
              const def = getAchievementDef(a.code)!;
              return (
                <li
                  key={a.code}
                  className={`flex w-24 shrink-0 flex-col items-center gap-1 rounded-2xl border-2 border-ink p-3 text-center text-xs ${
                    got ? "bg-mango text-ink" : "bg-white-smoke text-ink/50"
                  }`}
                  title={def.description}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {def.icon}
                  </span>
                  <span className="line-clamp-2 font-heading font-bold leading-tight">
                    {def.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 9. Open Discord */}
        <section className="mt-10">
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="tap-press flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-ink px-7 py-4 text-base font-bold text-white-smoke"
          >
            <Bolt className="h-5 w-5" /> Open Discord
          </a>
          <p className="mt-2 text-center text-xs text-ink/60">
            The chat is still the main thing. WB is the side quest.
          </p>
        </section>

        <Disclaimer />
      </main>
    </>
  );
}

function QuickAction({
  href,
  label,
  blurb,
}: {
  href: string;
  label: string;
  blurb: string;
  tone?: "white";
}) {
  return (
    <Link
      href={href}
      className="tap-press flex flex-col gap-1 rounded-3xl border-2 border-ink bg-white-smoke p-5 text-ink"
    >
      <span className="font-heading text-2xl font-black tracking-tight">
        {label}
      </span>
      <span className="text-sm font-medium text-ink/60">{blurb}</span>
      <span className="mt-2 text-xs font-bold uppercase tracking-wider text-ink/70">
        Open →
      </span>
    </Link>
  );
}
