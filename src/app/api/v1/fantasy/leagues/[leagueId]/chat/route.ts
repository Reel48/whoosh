import { NextResponse } from "next/server";
import { openFantasyChat } from "@/lib/fantasy/chat";
import { ChatError } from "@/lib/chat/chat";
import { jsonOk, jsonError, requireBearerSession } from "@/lib/api/json";
import { requireCapability } from "@/lib/api/client";
import type { FantasyChatResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Open the league's member-gated group chat. Returns it as a channel. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const gate = requireCapability(req, "chat");
  if (gate) return gate;
  const { leagueId } = await params;
  try {
    const channel = await openFantasyChat(session.id, leagueId);
    return jsonOk<FantasyChatResponse>({ channel });
  } catch (e) {
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Could not open league chat.");
  }
}
