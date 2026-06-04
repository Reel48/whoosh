import { NextResponse } from "next/server";
import { getStarboardLeaderboard, ChatError } from "@/lib/chat/chat";
import { jsonOk, jsonError, requireBearerSession } from "@/lib/api/json";
import { requireCapability } from "@/lib/api/client";
import type { StarboardLeaderboardResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** All-time top messages by boosts. */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const gate = requireCapability(req, "chat");
  if (gate) return gate;
  try {
    const messages = await getStarboardLeaderboard(session.id);
    return jsonOk<StarboardLeaderboardResponse>({ messages });
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not load the starboard leaderboard.");
  }
}
