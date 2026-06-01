import { requireSession } from "@/lib/membership";
import { fetchFeed, resolveSport, SPORTS } from "@/lib/news/espn";
import { getUserSwipes, getWhooshFeed, getMyKeptArticles } from "@/lib/news/engagement";
import { SwipeFeed } from "@/components/news/SwipeFeed";
import { WhooshFeed } from "@/components/news/WhooshFeed";
import { KeptList } from "@/components/news/KeptList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sports News — Whoosh" };

/**
 * Sports News home. Bare /news is the Whoosh Feed (Community = global kept
 * articles; My Keeps = the viewer's own). /news?sport=<key> is that sport's
 * swipeable feed — ESPN articles minus everything this user has already swiped
 * (kept or trashed).
 */
export default async function NewsHome({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; view?: string }>;
}) {
  const session = await requireSession("/news");
  const { sport: raw, view } = await searchParams;

  // Bare /news (no valid sport) → Whoosh Feed (Community or My Keeps).
  if (raw === undefined || !(raw in SPORTS)) {
    const mine = view === "mine";
    return (
      <main className="flex flex-1 flex-col py-2">
        {mine ? (
          <KeptList entries={await getMyKeptArticles(session.id)} />
        ) : (
          <WhooshFeed entries={await getWhooshFeed()} />
        )}
      </main>
    );
  }

  const sport = resolveSport(raw);
  const articles = await fetchFeed(sport);
  const swipes = await getUserSwipes(session.id, articles.map((a) => a.guid));

  // Drop anything already decided — kept or trashed — from the sport feed.
  const visible = articles.filter((a) => !swipes.has(a.guid));

  return (
    <main className="flex flex-1 flex-col py-2">
      <SwipeFeed sport={sport} articles={visible} />
    </main>
  );
}
