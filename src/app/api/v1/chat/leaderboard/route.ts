import { NextResponse } from "next/server";
import { getChatLeaderboard } from "@/lib/chat/chat";
import { jsonOk, jsonError, requireBearerSession } from "@/lib/api/json";
import { requireCapability } from "@/lib/api/client";
import type { ChatLeaderboardResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** XP leaderboard (top by xp). */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const gate = requireCapability(req, "chat");
  if (gate) return gate;
  try {
    const rows = await getChatLeaderboard(session.id);
    return jsonOk<ChatLeaderboardResponse>({ rows });
  } catch {
    return jsonError("internal", "Could not load leaderboard.");
  }
}
