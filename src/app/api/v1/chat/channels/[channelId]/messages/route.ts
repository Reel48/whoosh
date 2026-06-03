import { NextResponse } from "next/server";
import { getChatMessages, sendChatMessage, ChatError } from "@/lib/chat/chat";
import { jsonOk, jsonError, readJson, requireBearerSession } from "@/lib/api/json";
import type {
  ChatMessagesResponse, SendChatMessageRequest, SendChatMessageResponse,
} from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Paginated history for a channel (oldest→newest), enriched with author/role/level. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const { channelId } = await params;
  const before = Number(new URL(req.url).searchParams.get("before") ?? "0");
  try {
    const messages = await getChatMessages(session.id, Number(channelId), before);
    return jsonOk<ChatMessagesResponse>({ messages });
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not load messages.");
  }
}

/** Post a message (also grants XP/level inside the RPC). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const { channelId } = await params;
  const body = await readJson<SendChatMessageRequest>(req);
  if (!body) return jsonError("validation", "Invalid body.");
  try {
    const result = await sendChatMessage(session.id, Number(channelId), body);
    return jsonOk<SendChatMessageResponse>(result);
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not send message.");
  }
}
