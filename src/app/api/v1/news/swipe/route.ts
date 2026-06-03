import { NextResponse } from "next/server";
import { resolveSport, type Article } from "@/lib/news/espn";
import { recordSwipe, undoSwipe } from "@/lib/news/engagement";
import { jsonError, jsonOk, readJson, requireBearerSession } from "@/lib/api/json";
import type { SwipeRequest, SwipeResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * JSON re-shell of `POST /api/news/swipe`. `right` keeps the article (+1 point),
 * `left` trashes it; `points` is the authoritative global total recomputed
 * server-side. Reuses `recordSwipe`/`undoSwipe`.
 */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const body = await readJson<SwipeRequest>(req);
  if (!body) return jsonError("validation", "Request body must be valid JSON.");

  try {
    if (body.action === "undo") {
      const guid = (body.guid ?? "").trim();
      if (!guid) return jsonError("validation", "guid required.");
      const points = await undoSwipe(session.id, guid);
      return jsonOk<SwipeResponse>({ points });
    }

    const direction =
      body.direction === "left" ? "left" : body.direction === "right" ? "right" : null;
    if (!direction) return jsonError("validation", "direction must be 'left' or 'right'.");

    const a = body.article ?? {};
    const guid = (a.guid ?? "").trim();
    if (!guid || !a.link) return jsonError("validation", "article (guid + link) required.");

    const article: Article = {
      title: a.title ?? "",
      description: a.description ?? "",
      link: a.link,
      pubDate: a.pubDate ?? null,
      author: a.author ?? null,
      guid,
      images: a.image ? [a.image] : [],
    };

    const points = await recordSwipe(session.id, resolveSport(body.sport), article, direction);
    return jsonOk<SwipeResponse>({ points });
  } catch (e) {
    return jsonError("internal", e instanceof Error ? e.message : "Swipe failed.");
  }
}
