import { NextResponse } from "next/server";
import { openRankingsChat } from "@/lib/fantasy/chat";
import { ChatError } from "@/lib/chat/chat";
import { jsonOk, jsonError, requireBearerSession } from "@/lib/api/json";
import { requireCapability } from "@/lib/api/client";
import type { FantasyChatResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Open the cross-league Power Rankings chat (everyone on the leaderboard). */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const gate = requireCapability(req, "chat");
  if (gate) return gate;
  try {
    const channel = await openRankingsChat(session.id);
    return jsonOk<FantasyChatResponse>({ channel });
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not open rankings chat.");
  }
}
