import { supabase } from "@/lib/supabase";
import type { Article, SportKey } from "@/lib/news/espn";

/**
 * News → chat bridge. When enough distinct users *keep* the same article, it
 * auto-posts into the matching sport's chat channel (authored by the "WhooshNews"
 * system bot). The threshold scales with the user base, and the post is made
 * idempotent by the `post_news_article` RPC's dedup table — so this fires at most
 * once per article no matter how many keeps follow.
 */

/** News sport key → chat channel slug (channels confirmed in the chat seed). */
const SPORT_CHANNEL_SLUG: Record<SportKey, string> = {
  nfl: "nfl-football",
  ncf: "college-football",
  nba: "basketball",
  ncb: "basketball",
  mlb: "baseball",
  nhl: "general",
  soccer: "soccer",
  golf: "golf",
  tennis: "tennis",
  mma: "fights",
  boxing: "fights",
  racing: "general",
};

/**
 * Keeps required to auto-post, scaled to the registered-user count `n`:
 * `max(2, round(n^0.7 / 5))`. Hits the requested 2 / 3 / 5 / 8 at 20 / 49 / 100 /
 * 200 users, and grows gently from there.
 */
export function keepThreshold(n: number): number {
  return Math.max(2, Math.round(Math.pow(Math.max(n, 0), 0.7) / 5));
}

/** Registered-user count, cached for a minute (the threshold moves slowly). */
let userCountCache: { value: number; at: number } | null = null;
const USER_COUNT_TTL_MS = 60_000;

export async function getUserCount(): Promise<number> {
  const now = Date.now();
  if (userCountCache && now - userCountCache.at < USER_COUNT_TTL_MS) {
    return userCountCache.value;
  }
  const { count, error } = await supabase()
    .from("profile")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`getUserCount failed: ${error.message}`);
  const value = count ?? 0;
  userCountCache = { value, at: now };
  return value;
}

/**
 * If `points` (distinct keepers) has reached the user-scaled threshold, post the
 * article into its sport's chat channel. Idempotent via the RPC's dedup table, so
 * it's safe to call on every keep. Best-effort: never throws into the caller.
 */
export async function maybePostKeptArticle(
  sport: SportKey,
  article: Article,
  points: number,
): Promise<void> {
  try {
    const threshold = keepThreshold(await getUserCount());
    if (points < threshold) return;

    const slug = SPORT_CHANNEL_SLUG[sport];
    if (!slug) return;

    const body = `📰 ${article.title}\n${article.link}`.trim();
    const imageUrl = article.images[0] ?? null;

    const { error } = await supabase().rpc("post_news_article", {
      p_espn_id: article.guid,
      p_channel_slug: slug,
      p_body: body,
      p_image_url: imageUrl,
    });
    if (error) console.error(`maybePostKeptArticle RPC failed: ${error.message}`);
  } catch (e) {
    // The bridge is a side effect of a keep — a failure here must never fail the
    // swipe itself.
    console.error("maybePostKeptArticle failed:", e);
  }
}
