import { NextResponse } from "next/server";
import { getCrossLeagueScoreboard } from "@/lib/fantasy/rankings";
import { jsonOk, requireBearerSession } from "@/lib/api/json";
import type { FantasyRankingsResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cross-league power-ranking scoreboard. */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const board = await getCrossLeagueScoreboard();
  return jsonOk<FantasyRankingsResponse>(board);
}
