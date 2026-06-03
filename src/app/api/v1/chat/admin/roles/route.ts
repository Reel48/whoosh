import { NextResponse } from "next/server";
import { listChatRoles, createChatRole, ChatError } from "@/lib/chat/chat";
import { jsonOk, jsonError, readJson, requireBearerSession } from "@/lib/api/json";
import type { ChatRolesResponse, CreateChatRoleRequest } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** All roles (for the admin role manager + name colors). */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  if (!session.isAdmin) return jsonError("forbidden", "Admins only.");
  try {
    return jsonOk<ChatRolesResponse>({ roles: await listChatRoles() });
  } catch {
    return jsonError("internal", "Could not load roles.");
  }
}

/** Create a custom assignable role. */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  if (!session.isAdmin) return jsonError("forbidden", "Admins only.");
  const body = await readJson<CreateChatRoleRequest>(req);
  if (!body?.key?.trim() || !body?.name?.trim() || !body?.color?.trim()) {
    return jsonError("validation", "key, name, and color are required.");
  }
  try {
    const role = await createChatRole(true, body);
    return jsonOk({ role });
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not create role.");
  }
}
