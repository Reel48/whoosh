import { NextResponse } from "next/server";
import { getPoolDetail } from "@/lib/fantasy/pools";
import { jsonError, jsonOk, requireBearerSession } from "@/lib/api/json";
import type { FantasyPoolDetailResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A single pool's detail. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const { leagueId } = await params;
  const detail = await getPoolDetail(leagueId).catch(() => null);
  if (!detail) return jsonError("not_found", "Pool not found.");
  return jsonOk<FantasyPoolDetailResponse>(detail);
}
