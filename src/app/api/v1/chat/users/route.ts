import { NextResponse } from "next/server";
import { getEnrichedUsers } from "@/lib/chat/chat";
import { jsonOk, jsonError, requireBearerSession } from "@/lib/api/json";
import type { ChatUsersResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Enrich a set of user ids (`?ids=a,b,c`) for the realtime author cache. */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const users = await getEnrichedUsers(ids.slice(0, 100));
    return jsonOk<ChatUsersResponse>({ users });
  } catch {
    return jsonError("internal", "Could not load users.");
  }
}
