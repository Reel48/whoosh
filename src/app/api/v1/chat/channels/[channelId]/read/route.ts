import { NextResponse } from "next/server";
import { markChatRead, ChatError } from "@/lib/chat/chat";
import { jsonOk, jsonError, readJson, requireBearerSession } from "@/lib/api/json";
import type { ChatReadRequest, ChatOkResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Advance the viewer's last-read mark for a channel. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const { channelId } = await params;
  const body = await readJson<ChatReadRequest>(req);
  if (!body || typeof body.messageId !== "number") return jsonError("validation", "messageId required.");
  try {
    await markChatRead(session.id, Number(channelId), body.messageId);
    return jsonOk<ChatOkResponse>({ ok: true });
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not update read state.");
  }
}
