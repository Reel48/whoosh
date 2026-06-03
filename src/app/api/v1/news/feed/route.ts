import { NextResponse } from "next/server";
import { fetchFeed, resolveSport, SPORTS } from "@/lib/news/espn";
import { getMyKeptArticles, getUserSwipes, getWhooshFeed } from "@/lib/news/engagement";
import { jsonOk, requireBearerSession } from "@/lib/api/json";
import type { NewsFeedResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * News feed. Mirrors `src/app/news/page.tsx`: no/invalid `sport` → the Whoosh
 * feed (`?view=mine` → the viewer's kept articles; else the community feed); a
 * valid `sport` → that sport's ESPN articles minus everything already swiped.
 */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const url = new URL(req.url);
  const raw = url.searchParams.get("sport") ?? undefined;

  if (raw === undefined || !(raw in SPORTS)) {
    const mine = url.searchParams.get("view") === "mine";
    const entries = mine
      ? await getMyKeptArticles(session.id)
      : await getWhooshFeed();
    return jsonOk<NewsFeedResponse>({ mode: "whoosh", entries });
  }

  const sport = resolveSport(raw);
  const articles = await fetchFeed(sport);
  const swipes = await getUserSwipes(session.id, articles.map((a) => a.guid));
  const visible = articles.filter((a) => !swipes.has(a.guid));
  return jsonOk<NewsFeedResponse>({ mode: "sport", sport, articles: visible });
}
