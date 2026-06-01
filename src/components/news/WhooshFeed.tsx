import { SPORTS } from "@/lib/news/espn";
import type { WhooshEntry } from "@/lib/news/engagement";
import { EspnLogo, formatArticleDate } from "./ArticleCard";

/**
 * The Whoosh Feed: a global, read-only leaderboard of the articles the community
 * has kept (right-swiped), ranked by total keeps. Keeping/trashing happens on
 * the individual sport pages; this is where the winners surface.
 */
export function WhooshFeed({
  entries,
  keptIds,
}: {
  entries: WhooshEntry[];
  keptIds: Set<string>;
}) {
  if (entries.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 pb-16">
        <div className="rounded-theme border-theme border-ink/10 bg-surface p-10 text-center shadow-theme">
          <p className="font-display text-lg font-bold text-ink">The Whoosh Feed is warming up</p>
          <p className="mt-2 text-sm text-ink/60">
            Head into a sport and swipe right on the stories worth keeping. The ones the community
            keeps most show up here, ranked.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-16">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-ink/40">
        Top stories the community kept
      </p>
      <div className="grid gap-3">
        {entries.map((e, i) => {
          const date = formatArticleDate(e.pubDate);
          const byline = [e.author, date].filter(Boolean).join(" · ");
          const mine = keptIds.has(e.espnId);
          return (
            <a
              key={e.espnId}
              href={e.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden rounded-theme border-theme border-ink/10 bg-surface shadow-theme transition-colors hover:border-ink/30"
            >
              <div className="p-5">
                <header className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-black text-white">
                    {i + 1}
                  </span>
                  <EspnLogo />
                  <div className="min-w-0 leading-tight">
                    <p className="font-display text-sm font-bold text-ink">ESPN</p>
                    {byline && <p className="truncate text-xs text-ink/55">{byline}</p>}
                  </div>
                  <span
                    className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-pigment-green px-3 py-1 text-xs font-bold text-white"
                    title={`${e.points} ${e.points === 1 ? "keep" : "keeps"}`}
                  >
                    🔥 {e.points}
                  </span>
                </header>

                <h2 className="mt-3 font-display text-lg font-bold leading-snug text-ink group-hover:underline">
                  {e.title}
                </h2>
                {e.description && <p className="mt-2 text-sm text-ink/70">{e.description}</p>}

                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-full border-theme border-ink/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink/55">
                    {SPORTS[e.sport]?.label ?? e.sport}
                  </span>
                  {mine && (
                    <span className="text-[11px] font-bold uppercase tracking-wide text-pigment-green">
                      ✓ You kept this
                    </span>
                  )}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
