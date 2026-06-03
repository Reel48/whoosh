import { NextResponse } from "next/server";
import { searchChatMessages, ChatError } from "@/lib/chat/chat";
import { jsonOk, jsonError, requireBearerSession } from "@/lib/api/json";
import type { ChatSearchResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full-text search over messages the viewer can read. `?q=` (and optional `?channelId=`). */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q") ?? "";
  const channelId = sp.get("channelId") ? Number(sp.get("channelId")) : undefined;
  try {
    const messages = await searchChatMessages(session.id, q, channelId);
    return jsonOk<ChatSearchResponse>({ messages });
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Search failed.");
  }
}
