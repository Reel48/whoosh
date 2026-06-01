import { SPORTS, type Article, type SportKey } from "@/lib/news/espn";
import { ArticleCard } from "./ArticleCard";

/**
 * Renders the chosen sport's headlines, or a themed empty state when the feed
 * came back with nothing (ESPN hiccup or an off-season lull). Article fetching
 * happens in the page; this is presentation only.
 */
export function NewsFeed({
  sport,
  articles,
}: {
  sport: SportKey;
  articles: Article[];
}) {
  const label = SPORTS[sport].label;

  if (articles.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 pb-16">
        <div className="rounded-theme border-theme border-ink/10 bg-surface p-10 text-center shadow-theme">
          <p className="font-display text-lg font-bold text-ink">No {label} headlines right now</p>
          <p className="mt-2 text-sm text-ink/60">
            ESPN&apos;s feed came back empty. Check back in a bit or pick another sport.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 pb-16">
      <div className="grid gap-3">
        {articles.map((a) => (
          <ArticleCard key={a.guid} article={a} />
        ))}
      </div>
    </div>
  );
}
