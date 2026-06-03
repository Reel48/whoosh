import { NextResponse } from "next/server";
import { getChatMembers } from "@/lib/chat/chat";
import { jsonOk, jsonError, requireBearerSession } from "@/lib/api/json";
import type { ChatMembersResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** @mention picker: profiles whose username starts with `?q=`. */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const members = await getChatMembers(q);
    return jsonOk<ChatMembersResponse>({ members });
  } catch {
    return jsonError("internal", "Could not search members.");
  }
}
