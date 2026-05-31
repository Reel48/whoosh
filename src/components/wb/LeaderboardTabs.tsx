"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import type {
  LeaderboardEntry,
  TraderEntry,
  BiggestWinEntry,
  StreakEntry,
} from "@/lib/wb/leaderboard";

type Props = {
  holders: LeaderboardEntry[];
  traders: TraderEntry[];
  wins: BiggestWinEntry[];
  streaks: StreakEntry[];
  highlightUserId?: string | null;
};

type Tab = "holders" | "traders" | "wins" | "streaks";

const TABS: { id: Tab; label: string; subtitle: string }[] = [
  { id: "holders", label: "Top holders", subtitle: "By total WB equity" },
  { id: "traders", label: "Top traders", subtitle: "Realized P/L · 7 days" },
  { id: "wins", label: "Biggest wins", subtitle: "Largest single payout · 7 days" },
  { id: "streaks", label: "Streaks", subtitle: "Daily check-in streak" },
];

function fmtMoney(cents: number, opts: { signed?: boolean } = {}): string {
  const sign = cents < 0 ? "-" : opts.signed && cents > 0 ? "+" : "";
  const abs = Math.abs(cents) / 100;
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function LeaderboardTabs({
  holders,
  traders,
  wins,
  streaks,
  highlightUserId,
}: Props) {
  const [tab, setTab] = useState<Tab>("holders");
  const subtitle = TABS.find((t) => t.id === tab)!.subtitle;

  return (
    <div className="rounded-theme shadow-theme border-theme border-ink bg-surface p-4 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">Leaderboard</h2>
        <p className="text-xs font-bold uppercase tracking-wider text-ink/60">
          {subtitle}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5" role="tablist">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`chip-tap tap-press cursor-pointer rounded-full border-theme border-ink px-4 text-sm font-bold transition-colors ${
                active
                  ? "bg-ink text-white-smoke"
                  : "bg-surface text-ink hover:bg-ink hover:text-white-smoke"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === "holders" && (
          <RankList
            entries={holders}
            highlightUserId={highlightUserId}
            empty="No one's on the board yet. Buy or earn WB to show up."
            renderRight={(e) => fmtMoney((e as LeaderboardEntry).totalWbCents)}
          />
        )}
        {tab === "traders" && (
          <RankList
            entries={traders}
            highlightUserId={highlightUserId}
            empty="No trades in the last 7 days. Place an order to qualify."
            renderRight={(e) => {
              const t = e as TraderEntry;
              return (
                <span
                  className={
                    t.realizedPlCents > 0
                      ? "text-pigment-green"
                      : t.realizedPlCents < 0
                        ? "text-imperial-red"
                        : ""
                  }
                >
                  {t.realizedPlCents > 0 ? "▲ " : t.realizedPlCents < 0 ? "▼ " : ""}
                  {fmtMoney(t.realizedPlCents, { signed: true })}
                </span>
              );
            }}
            renderSub={(e) => `${(e as TraderEntry).trades} trades`}
          />
        )}
        {tab === "wins" && (
          <RankList
            entries={wins}
            highlightUserId={highlightUserId}
            empty="No big wins yet. Lay a bet in /capital/events to qualify."
            renderRight={(e) => (
              <span className="text-pigment-green">
                ▲ {fmtMoney((e as BiggestWinEntry).payoutCents, { signed: true })}
              </span>
            )}
            renderSub={(e) =>
              new Date((e as BiggestWinEntry).createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
          />
        )}
        {tab === "streaks" && (
          <RankList
            entries={streaks}
            highlightUserId={highlightUserId}
            empty="No active streaks. Open /capital/wallet to claim today's check-in."
            renderRight={(e) => {
              const s = e as StreakEntry;
              return (
                <span>
                  🔥 {s.streakDay} day{s.streakDay === 1 ? "" : "s"}
                </span>
              );
            }}
          />
        )}
      </div>

      <p className="mt-4 text-xs text-ink/60">
        Updates every minute. Some boards exclude users with no qualifying activity.
      </p>
    </div>
  );
}

type Entry = {
  rank: number;
  discordUserId: string;
  discordUsername: string;
};

function RankList<T extends Entry>({
  entries,
  highlightUserId,
  renderRight,
  renderSub,
  empty,
}: {
  entries: T[];
  highlightUserId?: string | null;
  renderRight: (e: T) => React.ReactNode;
  renderSub?: (e: T) => React.ReactNode;
  empty: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-ink/60">{empty}</p>;
  }
  return (
    <ol className="divide-y-2 divide-ink border-y-2 border-ink">
      {entries.map((e) => {
        const isMe = highlightUserId && e.discordUserId === highlightUserId;
        return (
          <li
            key={`${e.rank}-${e.discordUserId}`}
            className={`grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 py-3 sm:grid-cols-[2.5rem_1fr_auto] sm:gap-4 ${
              isMe ? "bg-blue/30 -mx-2 px-2 rounded-xl sm:-mx-3 sm:px-3" : ""
            }`}
          >
            <span className="text-base font-black text-ink/70 tabular-nums sm:text-xl">
              {e.rank}
            </span>
            <div className="flex items-center gap-2 min-w-0 sm:gap-3">
              <Avatar
                username={e.discordUsername}
                size={32}
                className="border-theme border-ink flex-none"
              />
              <div className="min-w-0">
                {/* Badge lives as a sibling of the truncated username — if it
                 *  sat *inside* the .truncate span, its border/padding would
                 *  be clipped by `overflow: hidden`. */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="truncate text-sm font-black text-ink sm:text-base">
                    @{e.discordUsername}
                  </span>
                  {isMe && (
                    <span className="shrink-0 whitespace-nowrap rounded-full border-theme border-ink bg-blue px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink sm:px-2 sm:text-xs">
                      you
                    </span>
                  )}
                </div>
                {renderSub && (
                  <div className="text-xs text-ink/60">{renderSub(e)}</div>
                )}
              </div>
            </div>
            <span className="text-sm font-black tabular-nums sm:text-lg">
              {renderRight(e)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
