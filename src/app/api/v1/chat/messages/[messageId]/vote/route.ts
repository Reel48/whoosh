import { NextResponse } from "next/server";
import { voteChatPoll, ChatError } from "@/lib/chat/chat";
import { jsonOk, jsonError, readJson, requireBearerSession } from "@/lib/api/json";
import { requireCapability } from "@/lib/api/client";
import type { ChatPollVoteRequest, ChatPollVoteResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Toggle the viewer's vote on a poll option; returns updated counts + the
 * viewer's current selections. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const gate = requireCapability(req, "chat");
  if (gate) return gate;
  const { messageId } = await params;
  const body = await readJson<ChatPollVoteRequest>(req);
  if (!body?.optionId) return jsonError("validation", "optionId required.");
  try {
    const result = await voteChatPoll(session.id, Number(messageId), body.optionId, body.on !== false);
    return jsonOk<ChatPollVoteResponse>(result);
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not vote.");
  }
}
