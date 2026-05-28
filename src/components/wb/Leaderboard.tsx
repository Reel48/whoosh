import { Avatar } from "@/components/Avatar";
import type { LeaderboardEntry } from "@/lib/wb/leaderboard";

type Props = {
  entries: LeaderboardEntry[];
  /** Discord user id of the viewer — when one of the rows matches, we highlight it. */
  highlightUserId?: string | null;
  /** Optional subtitle line under the heading. */
  subtitle?: string;
};

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Top N WB holders. Renders as a single card containing a ranked list:
 * rank, avatar, @username, total WB. The viewer's own row gets a subtle
 * "(you)" tag + ink-tinted background so they can find themselves at a
 * glance.
 *
 * Empty state shows when no one has earned any WB yet — fine to ship from
 * day one without conditional rendering at the call site.
 */
export function Leaderboard({ entries, highlightUserId, subtitle }: Props) {
  return (
    <div className="rounded-3xl border-2 border-ink bg-white-smoke p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl font-bold text-ink">
          Top {Math.max(entries.length, 10)} Whoosh Bucks holders
        </h2>
        {subtitle && (
          <p className="text-xs font-bold uppercase tracking-wider text-ink/60">
            {subtitle}
          </p>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="mt-6 text-sm text-ink/60">
          No one&rsquo;s on the board yet. Be the first to earn or buy WB and
          you&rsquo;ll show up here.
        </p>
      ) : (
        <ol className="mt-5 divide-y-2 divide-ink border-y-2 border-ink">
          {entries.map((e) => {
            const isMe = highlightUserId && e.discordUserId === highlightUserId;
            return (
              <li
                key={e.discordUserId}
                className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 py-3 ${
                  isMe ? "bg-blue/30 -mx-3 px-3 rounded-xl" : ""
                }`}
              >
                <span className="font-heading text-xl font-black text-ink/70 tabular-nums">
                  {e.rank}
                </span>
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    id={e.discordUserId}
                    hash={null}
                    username={e.discordUsername}
                    size={32}
                    className="border-2 border-ink flex-none"
                  />
                  <span className="truncate font-heading font-black text-ink">
                    @{e.discordUsername}
                    {isMe && (
                      <span className="ml-2 rounded-full border-2 border-ink bg-blue px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-ink">
                        you
                      </span>
                    )}
                  </span>
                </div>
                <span className="font-heading text-lg font-black tabular-nums">
                  {fmtMoney(e.totalWbCents)}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-4 text-xs text-ink/60">
        Total = cash balance + cost basis of stock positions + open wager stakes.
        Updates every minute.
      </p>
    </div>
  );
}
