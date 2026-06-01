import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { resolveSport, type Article } from "@/lib/news/espn";
import { recordSwipe, undoSwipe } from "@/lib/news/engagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records a news swipe for the signed-in user. JSON in / JSON out (called by the
 * SwipeFeed client component via fetch, like the notifications bell):
 *
 *   { action: "swipe", sport, direction: "left"|"right", article: {...} }  -> { ok, points }
 *   { action: "undo",  guid }                                              -> { ok, points }
 *
 * `right` keeps the article and adds the user's one point; `left` trashes it for
 * the user. Points are recomputed server-side, so the response `points` is the
 * authoritative global total.
 */
type SwipeBody = {
  action?: "swipe" | "undo";
  sport?: string;
  direction?: string;
  guid?: string;
  article?: {
    guid?: string;
    title?: string;
    description?: string;
    link?: string;
    author?: string | null;
    image?: string | null;
    pubDate?: string | null;
  };
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: SwipeBody;
  try {
    body = (await req.json()) as SwipeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  try {
    if (body.action === "undo") {
      const guid = (body.guid ?? "").trim();
      if (!guid) return NextResponse.json({ ok: false, error: "guid required" }, { status: 400 });
      const points = await undoSwipe(session.id, guid);
      return NextResponse.json({ ok: true, points });
    }

    const direction = body.direction === "left" ? "left" : body.direction === "right" ? "right" : null;
    if (!direction) {
      return NextResponse.json({ ok: false, error: "bad direction" }, { status: 400 });
    }
    const sport = resolveSport(body.sport);
    const a = body.article ?? {};
    const guid = (a.guid ?? "").trim();
    if (!guid || !a.link) {
      return NextResponse.json({ ok: false, error: "article required" }, { status: 400 });
    }

    // Reconstruct the Article shape recordSwipe expects.
    const article: Article = {
      title: a.title ?? "",
      description: a.description ?? "",
      link: a.link,
      pubDate: a.pubDate ?? null,
      author: a.author ?? null,
      guid,
      images: a.image ? [a.image] : [],
    };

    const points = await recordSwipe(session.id, sport, article, direction);
    return NextResponse.json({ ok: true, points });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "swipe failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
