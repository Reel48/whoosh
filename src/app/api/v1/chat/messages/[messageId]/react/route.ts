import { NextResponse } from "next/server";
import { toggleChatReaction, ChatError } from "@/lib/chat/chat";
import { jsonOk, jsonError, readJson, requireBearerSession } from "@/lib/api/json";
import { requireCapability } from "@/lib/api/client";
import type { ChatReactRequest, ChatReactResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Toggle a reaction on a message; returns the emoji's new count. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const gate = requireCapability(req, "chat");
  if (gate) return gate;
  const { messageId } = await params;
  const body = await readJson<ChatReactRequest>(req);
  if (!body?.emoji) return jsonError("validation", "emoji required.");
  try {
    const count = await toggleChatReaction(session.id, Number(messageId), body.emoji, body.on !== false);
    return jsonOk<ChatReactResponse>({ count });
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not react.");
  }
}
