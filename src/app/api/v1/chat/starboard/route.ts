import { NextResponse } from "next/server";
import { getChatStarboard } from "@/lib/chat/chat";
import { jsonOk, jsonError, requireBearerSession } from "@/lib/api/json";
import type { ChatStarboardResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Most-starred messages (≥ threshold ⭐). */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  try {
    const messages = await getChatStarboard(session.id);
    return jsonOk<ChatStarboardResponse>({ messages });
  } catch {
    return jsonError("internal", "Could not load starboard.");
  }
}
