import { requireSession } from "@/lib/membership";
import { fetchFeed, resolveSport, SPORTS } from "@/lib/news/espn";
import { getUserSwipes, getWhooshFeed } from "@/lib/news/engagement";
import { SportSelector } from "@/components/news/SportSelector";
import { SwipeFeed } from "@/components/news/SwipeFeed";
import { WhooshFeed } from "@/components/news/WhooshFeed";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sports News — Whoosh" };

/**
 * Sports News home. Bare /news shows the Whoosh Feed (global community
 * leaderboard of kept articles). /news?sport=<key> shows that sport's swipeable
 * feed: ESPN articles minus the ones this user has trashed, with already-kept
 * ones rendered green.
 */
export default async function NewsHome({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>;
}) {
  const session = await requireSession("/news");
  const { sport: raw } = await searchParams;

  // Bare /news (no sport) → Whoosh Feed.
  if (raw === undefined || !(raw in SPORTS)) {
    const entries = await getWhooshFeed();
    const swipes = await getUserSwipes(session.id, entries.map((e) => e.espnId));
    const keptIds = new Set(
      [...swipes.entries()].filter(([, d]) => d === "right").map(([id]) => id),
    );
    return (
      <main className="flex flex-1 flex-col py-2">
        <SportSelector active={null} />
        <WhooshFeed entries={entries} keptIds={keptIds} />
      </main>
    );
  }

  const sport = resolveSport(raw);
  const articles = await fetchFeed(sport);
  const swipes = await getUserSwipes(session.id, articles.map((a) => a.guid));

  // Drop trashed articles; mark kept ones for the green state.
  const visible = articles.filter((a) => swipes.get(a.guid) !== "left");
  const initialKept: Record<string, boolean> = {};
  for (const a of visible) if (swipes.get(a.guid) === "right") initialKept[a.guid] = true;

  return (
    <main className="flex flex-1 flex-col py-2">
      <SportSelector active={sport} />
      <SwipeFeed sport={sport} articles={visible} initialKept={initialKept} />
    </main>
  );
}
