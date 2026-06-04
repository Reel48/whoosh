import { supabase } from "@/lib/supabase";
import { NEWS_MAX_AGE_HOURS, type Article, type SportKey } from "@/lib/news/espn";

/** Personal keeps live longer than the 72h news window — two weeks, then purged. */
const MY_KEEPS_MAX_AGE_HOURS = 14 * 24;

/** ISO timestamp `hours` in the past — the freshness cutoff for a query. */
function cutoffIso(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

/**
 * Server-only data access for the news swipe feature. Mirrors the watchlist lib
 * (src/lib/wb/watchlist.ts): service-role client, throw on error. Writes go
 * through the record_news_swipe / delete_news_swipe RPCs so the article upsert,
 * the swipe, and the points recompute happen in one transaction.
 */

export type SwipeDirection = "left" | "right";

/**
 * This user's swipe state for the given article guids, as a Map<guid, direction>.
 * Used to filter out trashed ('left') articles and mark kept ('right') ones.
 */
export async function getUserSwipes(
  userId: string,
  espnIds: string[],
): Promise<Map<string, SwipeDirection>> {
  if (espnIds.length === 0) return new Map();
  const { data, error } = await supabase()
    .from("news_swipe")
    .select("espn_id, direction")
    .eq("user_id", userId)
    .in("espn_id", espnIds);
  if (error) throw new Error(`getUserSwipes failed: ${error.message}`);
  const map = new Map<string, SwipeDirection>();
  for (const r of data ?? []) map.set(r.espn_id, r.direction as SwipeDirection);
  return map;
}

/** Build the jsonb payload record_news_swipe expects from an Article. */
function articlePayload(sport: SportKey, article: Article) {
  return {
    espn_id: article.guid,
    sport,
    title: article.title,
    description: article.description || null,
    link: article.link,
    author: article.author,
    image_url: article.images[0] ?? null,
    pub_date: article.pubDate,
  };
}

/** Record a swipe; returns the article's new global points total. */
export async function recordSwipe(
  userId: string,
  sport: SportKey,
  article: Article,
  direction: SwipeDirection,
): Promise<number> {
  const { data, error } = await supabase().rpc("record_news_swipe", {
    p_user: userId,
    p_article: articlePayload(sport, article),
    p_direction: direction,
  });
  if (error) throw new Error(`recordSwipe failed: ${error.message}`);
  return data ?? 0;
}

/** Undo a swipe (remove the row); returns the article's new points total. */
export async function undoSwipe(userId: string, espnId: string): Promise<number> {
  const { data, error } = await supabase().rpc("delete_news_swipe", {
    p_user: userId,
    p_espn_id: espnId,
  });
  if (error) throw new Error(`undoSwipe failed: ${error.message}`);
  return data ?? 0;
}

export type WhooshEntry = {
  espnId: string;
  sport: SportKey;
  title: string;
  description: string | null;
  link: string;
  author: string | null;
  imageUrl: string | null;
  pubDate: string | null;
  points: number;
};

/** Global community leaderboard: kept articles ranked by total keeps (points). */
export async function getWhooshFeed(limit = 50): Promise<WhooshEntry[]> {
  const { data, error } = await supabase()
    .from("news_article")
    .select("espn_id, sport, title, description, link, author, image_url, pub_date, points")
    .gt("points", 0)
    .gte("pub_date", cutoffIso(NEWS_MAX_AGE_HOURS))
    .order("points", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getWhooshFeed failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    espnId: r.espn_id,
    sport: r.sport as SportKey,
    title: r.title,
    description: r.description,
    link: r.link,
    author: r.author,
    imageUrl: r.image_url,
    pubDate: r.pub_date,
    points: r.points,
  }));
}

/** The signed-in user's kept (right-swiped) articles, newest kept first. */
export async function getMyKeptArticles(userId: string, limit = 50): Promise<WhooshEntry[]> {
  const { data, error } = await supabase()
    .from("news_swipe")
    .select(
      "espn_id, updated_at, news_article!inner(espn_id, sport, title, description, link, author, image_url, pub_date, points)",
    )
    .eq("user_id", userId)
    .eq("direction", "right")
    .gte("updated_at", cutoffIso(MY_KEEPS_MAX_AGE_HOURS))
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getMyKeptArticles failed: ${error.message}`);
  return (data ?? []).map((r) => {
    const a = r.news_article;
    return {
      espnId: a.espn_id,
      sport: a.sport as SportKey,
      title: a.title,
      description: a.description,
      link: a.link,
      author: a.author,
      imageUrl: a.image_url,
      pubDate: a.pub_date,
      points: a.points,
    };
  });
}
