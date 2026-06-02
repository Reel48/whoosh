import type { Article } from "@/lib/news/espn";
import type { WhooshEntry } from "@/lib/news/engagement";
import { ArticleCard } from "./ArticleCard";
import { Reveal } from "@/components/ui/Reveal";

/** A WhooshEntry rendered exactly like an ESPN article card. */
function toArticle(e: WhooshEntry): Article {
  return {
    title: e.title,
    description: e.description ?? "",
    link: e.link,
    pubDate: e.pubDate,
    author: e.author,
    guid: e.espnId,
    images: e.imageUrl ? [e.imageUrl] : [],
  };
}

/**
 * The Whoosh Feed: the articles the community has kept. Ordering is by total
 * keeps (handled server-side in getWhooshFeed) but the count and rank stay on
 * the backend — these render as plain article cards, just like the sport feeds.
 */
export function WhooshFeed({ entries }: { entries: WhooshEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 pb-16">
        <div className="rounded-theme border-theme border-ink/10 bg-surface p-10 text-center shadow-theme">
          <p className="font-display text-lg font-bold text-ink">The Whoosh Feed is warming up</p>
          <p className="mt-2 text-sm text-ink/60">
            Head into a sport and swipe right to boost the stories worth reading. The ones the
            community boosts most show up here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-16">
      <div className="grid gap-3">
        {entries.map((e) => (
          <Reveal key={e.espnId} direction="right">
            <ArticleCard article={toArticle(e)} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
