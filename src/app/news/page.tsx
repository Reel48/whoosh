import { fetchFeed, resolveSport } from "@/lib/news/espn";
import { SportSelector } from "@/components/news/SportSelector";
import { NewsFeed } from "@/components/news/NewsFeed";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sports News — Whoosh" };

/**
 * Sports News home. Reads the chosen sport from `?sport=` (defaults to NFL),
 * fetches that ESPN feed server-side (revalidated, cached per URL), and renders
 * the selector + headlines.
 */
export default async function NewsHome({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>;
}) {
  const { sport: raw } = await searchParams;
  const sport = resolveSport(raw);
  const articles = await fetchFeed(sport);

  return (
    <main className="flex flex-1 flex-col py-2">
      <SportSelector active={sport} />
      <NewsFeed sport={sport} articles={articles} />
    </main>
  );
}
