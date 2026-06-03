import { NextResponse } from "next/server";
import { editChatMessage, deleteChatMessage, ChatError } from "@/lib/chat/chat";
import { jsonOk, jsonError, readJson, requireBearerSession } from "@/lib/api/json";
import type { ChatEditRequest } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Edit own message. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const { messageId } = await params;
  const body = await readJson<ChatEditRequest>(req);
  if (!body?.body?.trim()) return jsonError("validation", "Body required.");
  try {
    await editChatMessage(session.id, Number(messageId), body.body);
    return jsonOk({ ok: true });
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not edit message.");
  }
}

/** Delete own message (admins can delete any). */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const { messageId } = await params;
  try {
    await deleteChatMessage(session.id, Number(messageId));
    return jsonOk({ ok: true });
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not delete message.");
  }
}
