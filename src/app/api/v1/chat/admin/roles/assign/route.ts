import { NextResponse } from "next/server";
import { assignChatRole, removeChatRole, ChatError } from "@/lib/chat/chat";
import { jsonOk, jsonError, readJson, requireBearerSession } from "@/lib/api/json";
import type { ChatRoleAssignRequest } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Assign (`on` omitted/true) or remove (`on:false`) a role for a user. Admin only. */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  if (!session.isAdmin) return jsonError("forbidden", "Admins only.");
  const body = await readJson<ChatRoleAssignRequest & { on?: boolean }>(req);
  if (!body?.userId || !body?.roleId) return jsonError("validation", "userId and roleId required.");
  try {
    if (body.on === false) await removeChatRole(session.id, body.userId, body.roleId);
    else await assignChatRole(session.id, body.userId, body.roleId);
    return jsonOk({ ok: true });
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not update role.");
  }
}
