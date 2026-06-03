import { NextResponse } from "next/server";
import { getPoolDetail } from "@/lib/fantasy/pools";
import { hasLeagueAccess } from "@/lib/fantasy/entitlements";
import { jsonError, jsonOk, requireBearerSession } from "@/lib/api/json";
import type { FantasyPoolDetailResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A single pool's detail + whether the signed-in user has joined (paid). Free
 * pools (no entry fee) count as joined for everyone. The app uses `joined` to
 * either deep-link into Sleeper or offer the entry-fee checkout.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const { leagueId } = await params;
  const detail = await getPoolDetail(leagueId).catch(() => null);
  if (!detail) return jsonError("not_found", "Pool not found.");

  const requiresPayment = (detail.config.entryFeeCents ?? 0) > 0;
  const joined = requiresPayment
    ? await hasLeagueAccess(session.id, leagueId, detail.season).catch(() => false)
    : true;

  return jsonOk<FantasyPoolDetailResponse>({ ...detail, joined });
}
