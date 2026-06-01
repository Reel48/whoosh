import Link from "next/link";
import { SPORT_LIST, type SportKey } from "@/lib/news/espn";

/**
 * Horizontally scrollable row of sport chips. Each chip is a plain link that
 * sets `?sport=<key>`, so the page stays a server component and Next caches
 * each feed by URL. The active sport is highlighted (mirrors the chip styling
 * in MobileRouteStrip).
 */
export function SportSelector({ active }: { active: SportKey }) {
  return (
    <nav
      aria-label="Choose a sport"
      className="mx-auto flex w-full max-w-4xl gap-2 overflow-x-auto px-6 py-3"
    >
      {SPORT_LIST.map((s) => {
        const isActive = s.key === active;
        return (
          <Link
            key={s.key}
            href={`/news?sport=${s.key}`}
            aria-current={isActive ? "page" : undefined}
            className={`shrink-0 rounded-theme border-theme px-4 py-1.5 font-display text-sm font-bold transition-colors ${
              isActive
                ? "border-ink bg-ink text-white"
                : "border-ink/15 bg-surface text-ink hover:bg-ink/5"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
