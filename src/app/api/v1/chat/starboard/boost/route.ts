import { NextResponse } from "next/server";
import { recordStarboardBoost, deleteStarboardBoost, ChatError } from "@/lib/chat/chat";
import { jsonOk, jsonError, readJson, requireBearerSession } from "@/lib/api/json";
import { requireCapability } from "@/lib/api/client";
import type { StarboardBoostRequest, StarboardBoostResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Boost/Meh a starboard message (direction 'boost' | 'meh'); a null/empty
 *  direction undoes the swipe. Returns the message's new boost count. */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const gate = requireCapability(req, "chat");
  if (gate) return gate;
  const body = await readJson<StarboardBoostRequest>(req);
  if (!body?.messageId) return jsonError("validation", "messageId required.");
  try {
    const dir = (body.direction ?? "").toLowerCase();
    const boostCount = dir === "boost" || dir === "meh"
      ? await recordStarboardBoost(session.id, body.messageId, dir)
      : await deleteStarboardBoost(session.id, body.messageId);
    return jsonOk<StarboardBoostResponse>({ boostCount });
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not record boost.");
  }
}
