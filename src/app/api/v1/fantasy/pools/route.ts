import { NextResponse } from "next/server";
import { listPoolSummaries } from "@/lib/fantasy/pools";
import { jsonOk, requireBearerSession } from "@/lib/api/json";
import type { FantasyPoolsResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pick'em / survivor pool summaries. */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const pools = await listPoolSummaries();
  return jsonOk<FantasyPoolsResponse>({ pools });
}
