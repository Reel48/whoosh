import Link from "next/link";
import { SPORT_LIST, type SportKey } from "@/lib/news/espn";

const ACTIVE = "border-ink bg-ink text-white";
const IDLE = "border-ink/15 bg-surface text-ink hover:bg-ink/5";

/**
 * Horizontally scrollable row of chips. The first chip is the Whoosh Feed (the
 * community leaderboard at bare /news); the rest each set `?sport=<key>` and
 * open that sport's swipeable feed. `active` is null on the Whoosh Feed.
 */
export function SportSelector({ active }: { active: SportKey | null }) {
  return (
    <nav
      aria-label="Choose a feed"
      className="mx-auto flex w-full max-w-4xl gap-2 overflow-x-auto px-6 py-3"
    >
      <Link
        href="/news"
        aria-current={active === null ? "page" : undefined}
        className={`shrink-0 rounded-theme border-theme px-4 py-1.5 font-display text-sm font-bold transition-colors ${
          active === null ? ACTIVE : IDLE
        }`}
      >
        Whoosh Feed
      </Link>
      {SPORT_LIST.map((s) => {
        const isActive = s.key === active;
        return (
          <Link
            key={s.key}
            href={`/news?sport=${s.key}`}
            aria-current={isActive ? "page" : undefined}
            className={`shrink-0 rounded-theme border-theme px-4 py-1.5 font-display text-sm font-bold transition-colors ${
              isActive ? ACTIVE : IDLE
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
