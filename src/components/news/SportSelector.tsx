"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SPORT_LIST, SPORTS, type SportKey } from "@/lib/news/espn";
import { FeedMenu } from "./FeedMenu";

const ACTIVE = "border-ink bg-ink text-white";
const IDLE = "border-ink/15 bg-surface text-ink hover:bg-ink/5";
const CHIP = "shrink-0 rounded-theme border-theme px-4 py-1.5 font-display text-sm font-bold transition-colors";

export type FeedActive = SportKey | "whoosh" | "mine";

/**
 * Horizontally scrollable row of chips: a hamburger menu (jump to any feed
 * without scrolling), then Whoosh Feed (community) and My Keeps (the viewer's
 * kept articles), then one per sport. Each sport sets `?sport=<key>`; My Keeps
 * is `?view=mine`; Whoosh Feed is bare /news.
 *
 * The active feed is derived from the URL (rather than passed in) so the
 * selector can live in the section layout's sticky reveal bar alongside the
 * score ticker, instead of inside each page.
 */
export function SportSelector() {
  const params = useSearchParams();
  const sport = params.get("sport");
  const active: FeedActive =
    sport && sport in SPORTS
      ? (sport as SportKey)
      : params.get("view") === "mine"
        ? "mine"
        : "whoosh";

  return (
    // The hamburger stays pinned at the far left while the chips scroll. It sits
    // outside the overflow-x-auto row so its dropdown isn't clipped by the
    // scroll container's overflow.
    <div className="mx-auto flex w-full max-w-4xl items-stretch gap-2 px-6 py-3">
      <FeedMenu active={active} />
      <nav
        aria-label="Choose a feed"
        className="flex min-w-0 flex-1 gap-2 overflow-x-auto"
      >
        <Link
          href="/news"
          aria-current={active === "whoosh" ? "page" : undefined}
          className={`${CHIP} ${active === "whoosh" ? ACTIVE : IDLE}`}
        >
          Whoosh Feed
        </Link>
        <Link
          href="/news?view=mine"
          aria-current={active === "mine" ? "page" : undefined}
          className={`${CHIP} ${active === "mine" ? ACTIVE : IDLE}`}
        >
          Boosted
        </Link>
        {SPORT_LIST.map((s) => {
          const isActive = s.key === active;
          return (
            <Link
              key={s.key}
              href={`/news?sport=${s.key}`}
              aria-current={isActive ? "page" : undefined}
              className={`${CHIP} ${isActive ? ACTIVE : IDLE}`}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
