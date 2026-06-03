import { NextResponse } from "next/server";
import { listUserWagers } from "@/lib/wb/bets";
import { jsonOk, requireBearerSession } from "@/lib/api/json";
import type { BetsResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in user's wagers (newest first). Mirrors `/capital/bets`. */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const wagers = await listUserWagers(session.id);
  return jsonOk<BetsResponse>({ wagers });
}
