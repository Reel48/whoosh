import { NextResponse } from "next/server";
import { getChatOverview } from "@/lib/chat/chat";
import { isPremium } from "@/lib/membership";
import { jsonOk, jsonError, requireBearerSession } from "@/lib/api/json";
import { requireCapability } from "@/lib/api/client";
import type { ChatOverviewResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Accessible categories/channels + the viewer's level/roles. Reconciles the
 *  system roles (member/premium/admin) on the way in. */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const gate = requireCapability(req, "chat");
  if (gate) return gate;
  try {
    const premium = await isPremium(session.id).catch(() => false);
    const data = await getChatOverview(session.id, session.isAdmin, premium, session.avatarUrl);
    return jsonOk<ChatOverviewResponse>(data);
  } catch (e) {
    return jsonError("internal", e instanceof Error ? e.message : "Could not load chat.");
  }
}
