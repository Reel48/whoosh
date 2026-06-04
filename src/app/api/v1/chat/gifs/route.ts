import { NextResponse } from "next/server";
import { searchGifs } from "@/lib/chat/giphy";
import { jsonOk, jsonError, requireBearerSession } from "@/lib/api/json";
import { requireCapability } from "@/lib/api/client";
import type { ChatGifsResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-proxied Giphy search (or trending when `q` is empty). Keeps the key
 *  off the client; returns chat-appropriate GIFs for the picker grid. */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const gate = requireCapability(req, "chat");
  if (gate) return gate;
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q") ?? "";
  const limit = Number(sp.get("limit") ?? "24");
  try {
    const gifs = await searchGifs(q, Number.isFinite(limit) ? limit : 24);
    return jsonOk<ChatGifsResponse>({ gifs });
  } catch {
    return jsonError("internal", "Could not load GIFs.");
  }
}
