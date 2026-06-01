"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import type {
  LeaderboardEntry,
  TraderEntry,
  BiggestWinEntry,
  StreakEntry,
} from "@/lib/wb/leaderboard";

/**
 * Shared leaderboard, rendered in two skins:
 *   - "marketing" (default): the public landing + account pages — Tailwind
 *     utilities on the shared theme tokens (bg-surface, border-ink, …).
 *   - "capital": the signed-in Capital section — the vendored design-system
 *     component classes (.card, .cap-tab, .cap-rank, …) from
 *     src/styles/capital. Pass variant="capital" from inside [data-theme="capital"].
 * The logic (tab state, formatting, ranking rows) lives once; only the
 * presentational class names and a couple of copy strings differ by variant.
 */
type Variant = "marketing" | "capital";

type Props = {
  holders: LeaderboardEntry[];
  traders: TraderEntry[];
  wins: BiggestWinEntry[];
  streaks: StreakEntry[];
  highlightUserId?: string | null;
  variant?: Variant;
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

/** Per-variant presentation. Keeps both skins pixel-identical to their forks. */
type Skin = {
  root: string;
  head: string;
  title: string;
  subtitle: string;
  tabsWrap: string;
  tab: (active: boolean) => string;
  footnote: string;
  footnoteStyle?: React.CSSProperties;
  /** Color props for a signed/positive/negative number. */
  tone: (n: number) => { className?: string; style?: React.CSSProperties };
  winsEmpty: string;
  streaksEmpty: string;
};

const SKINS: Record<Variant, Skin> = {
  marketing: {
    root: "rounded-theme shadow-theme border-theme border-ink bg-surface p-4 sm:p-8",
    head: "flex flex-wrap items-baseline justify-between gap-3",
    title: "font-display text-xl font-bold text-ink",
    subtitle: "text-xs font-bold uppercase tracking-wider text-ink/60",
    tabsWrap: "mt-4 flex flex-wrap gap-1.5",
    tab: (active) =>
      `chip-tap tap-press cursor-pointer rounded-full border-theme border-ink px-4 text-sm font-bold transition-colors ${
        active
          ? "bg-ink text-white-smoke"
          : "bg-surface text-ink hover:bg-ink hover:text-white-smoke"
      }`,
    footnote: "mt-4 text-xs text-ink/60",
    tone: (n) =>
      n > 0 ? { className: "text-pigment-green" } : n < 0 ? { className: "text-imperial-red" } : {},
    winsEmpty: "No big wins yet. Lay a bet in /capital/events to qualify.",
    streaksEmpty: "No active streaks. Open /capital/wallet to claim today's check-in.",
  },
  capital: {
    root: "card",
    head: "cap-card-head",
    title: "text-h3",
    subtitle: "text-caption",
    tabsWrap: "cap-tabs",
    tab: (active) => `cap-tab ${active ? "is-active" : ""}`,
    footnote: "text-caption",
    footnoteStyle: { marginTop: "var(--space-4)" },
    tone: (n) =>
      n > 0
        ? { style: { color: "var(--positive-text)" } }
        : n < 0
          ? { style: { color: "var(--negative-text)" } }
          : {},
    winsEmpty: "No big wins yet. Lay a bet in Events to qualify.",
    streaksEmpty: "No active streaks. Claim today's check-in in Wallet.",
  },
};

export function LeaderboardTabs({
  holders,
  traders,
  wins,
  streaks,
  highlightUserId,
  variant = "marketing",
}: Props) {
  const [tab, setTab] = useState<Tab>("holders");
  const subtitle = TABS.find((t) => t.id === tab)!.subtitle;
  const skin = SKINS[variant];

  return (
    <div className={skin.root}>
      <div className={skin.head}>
        <h2 className={skin.title}>Leaderboard</h2>
        <p className={skin.subtitle}>{subtitle}</p>
      </div>

      <div className={skin.tabsWrap} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={t.id === tab}
            onClick={() => setTab(t.id)}
            className={skin.tab(t.id === tab)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={variant === "marketing" ? "mt-5" : undefined}>
        {tab === "holders" && (
          <RankList
            variant={variant}
            entries={holders}
            highlightUserId={highlightUserId}
            empty="No one's on the board yet. Buy or earn WB to show up."
            renderRight={(e) => fmtMoney((e as LeaderboardEntry).totalWbCents)}
          />
        )}
        {tab === "traders" && (
          <RankList
            variant={variant}
            entries={traders}
            highlightUserId={highlightUserId}
            empty="No trades in the last 7 days. Place an order to qualify."
            renderRight={(e) => {
              const t = e as TraderEntry;
              return (
                <span {...skin.tone(t.realizedPlCents)}>
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
            variant={variant}
            entries={wins}
            highlightUserId={highlightUserId}
            empty={skin.winsEmpty}
            renderRight={(e) => (
              <span {...skin.tone(1)}>
                ▲ {fmtMoney((e as BiggestWinEntry).payoutCents, { signed: true })}
              </span>
            )}
            renderSub={(e) =>
              new Date((e as BiggestWinEntry).createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                timeZone: "America/Chicago",
              })
            }
          />
        )}
        {tab === "streaks" && (
          <RankList
            variant={variant}
            entries={streaks}
            highlightUserId={highlightUserId}
            empty={skin.streaksEmpty}
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

      <p className={skin.footnote} style={skin.footnoteStyle}>
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
  variant,
  entries,
  highlightUserId,
  renderRight,
  renderSub,
  empty,
}: {
  variant: Variant;
  entries: T[];
  highlightUserId?: string | null;
  renderRight: (e: T) => React.ReactNode;
  renderSub?: (e: T) => React.ReactNode;
  empty: string;
}) {
  if (entries.length === 0) {
    return variant === "capital" ? (
      <p className="text-body-sm" style={{ marginTop: "var(--space-5)" }}>
        {empty}
      </p>
    ) : (
      <p className="text-sm text-ink/60">{empty}</p>
    );
  }

  if (variant === "capital") {
    return (
      <ol className="cap-rank">
        {entries.map((e) => {
          const isMe = highlightUserId && e.discordUserId === highlightUserId;
          return (
            <li
              key={`${e.rank}-${e.discordUserId}`}
              className={`cap-rank__row ${isMe ? "is-me" : ""}`}
            >
              <span className="cap-rank__n">{e.rank}</span>
              <Avatar username={e.discordUsername} size={32} />
              <div className="cap-rank__who">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <span className="cap-rank__name">@{e.discordUsername}</span>
                  {isMe && <span className="badge badge-info badge-sm">you</span>}
                </div>
                {renderSub && <div className="text-caption">{renderSub(e)}</div>}
              </div>
              <span className="cap-rank__val">{renderRight(e)}</span>
            </li>
          );
        })}
      </ol>
    );
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
