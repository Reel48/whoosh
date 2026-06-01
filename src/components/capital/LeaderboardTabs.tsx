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
 * Capital design-system version of the leaderboard. Forked from
 * components/wb/LeaderboardTabs so the marketing version stays untouched.
 */
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
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const POS = { color: "var(--positive-text)" };
const NEG = { color: "var(--negative-text)" };

export function LeaderboardTabs({ holders, traders, wins, streaks, highlightUserId }: Props) {
  const [tab, setTab] = useState<Tab>("holders");
  const subtitle = TABS.find((t) => t.id === tab)!.subtitle;

  return (
    <div className="card">
      <div className="cap-card-head">
        <h2 className="text-h3">Leaderboard</h2>
        <p className="text-caption">{subtitle}</p>
      </div>

      <div className="cap-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={t.id === tab}
            onClick={() => setTab(t.id)}
            className={`cap-tab ${t.id === tab ? "is-active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

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
            const style = t.realizedPlCents > 0 ? POS : t.realizedPlCents < 0 ? NEG : undefined;
            return (
              <span style={style}>
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
          empty="No big wins yet. Lay a bet in Events to qualify."
          renderRight={(e) => (
            <span style={POS}>▲ {fmtMoney((e as BiggestWinEntry).payoutCents, { signed: true })}</span>
          )}
          renderSub={(e) =>
            new Date((e as BiggestWinEntry).createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })
          }
        />
      )}
      {tab === "streaks" && (
        <RankList
          entries={streaks}
          highlightUserId={highlightUserId}
          empty="No active streaks. Claim today's check-in in Wallet."
          renderRight={(e) => {
            const s = e as StreakEntry;
            return <span>🔥 {s.streakDay} day{s.streakDay === 1 ? "" : "s"}</span>;
          }}
        />
      )}

      <p className="text-caption" style={{ marginTop: "var(--space-4)" }}>
        Updates every minute. Some boards exclude users with no qualifying activity.
      </p>
    </div>
  );
}

type Entry = { rank: number; discordUserId: string; discordUsername: string };

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
    return <p className="text-body-sm" style={{ marginTop: "var(--space-5)" }}>{empty}</p>;
  }
  return (
    <ol className="cap-rank">
      {entries.map((e) => {
        const isMe = highlightUserId && e.discordUserId === highlightUserId;
        return (
          <li key={`${e.rank}-${e.discordUserId}`} className={`cap-rank__row ${isMe ? "is-me" : ""}`}>
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
