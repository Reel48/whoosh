import { NextResponse } from "next/server";
import { listChatDms, openChatDm, ChatError } from "@/lib/chat/chat";
import { jsonOk, jsonError, readJson, requireBearerSession } from "@/lib/api/json";
import { requireCapability } from "@/lib/api/client";
import type { ChatDmsResponse, ChatDmOpenRequest, ChatDmOpenResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The viewer's DM conversations (most recent first). */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const gate = requireCapability(req, "chat");
  if (gate) return gate;
  try {
    const conversations = await listChatDms(session.id);
    return jsonOk<ChatDmsResponse>({ conversations });
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not load DMs.");
  }
}

/** Open (or create) the 1:1 DM with another user. */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const gate = requireCapability(req, "chat");
  if (gate) return gate;
  const body = await readJson<ChatDmOpenRequest>(req);
  if (!body?.userId) return jsonError("validation", "userId required.");
  try {
    const channel = await openChatDm(session.id, body.userId);
    return jsonOk<ChatDmOpenResponse>({ channel });
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not open DM.");
  }
}
