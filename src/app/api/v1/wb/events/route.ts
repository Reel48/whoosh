import { NextResponse } from "next/server";
import { listOpenEvents } from "@/lib/wb/bets";
import { jsonOk, requireBearerSession } from "@/lib/api/json";
import type { EventsResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Open house-wager events with their outcomes. Mirrors `/capital/events`. */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const events = await listOpenEvents();
  return jsonOk<EventsResponse>({ events });
}
