import { NextResponse } from "next/server";
import { getLeagueOverview } from "@/lib/fantasy/leagues";
import { hasLeagueAccess } from "@/lib/fantasy/entitlements";
import { jsonError, jsonOk, requireBearerSession } from "@/lib/api/json";
import type { FantasyLeagueResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A league's standings/overview. Mirrors the per-league paywall in
 * `src/app/fantasy/leagues/[leagueId]/page.tsx`: a priced league (entry fee > 0)
 * requires a paid entitlement seating the viewer — otherwise `not_entitled`.
 * Free/legacy leagues stay open to any signed-in member.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const { leagueId } = await params;
  const overview = await getLeagueOverview(leagueId).catch(() => null);
  if (!overview) return jsonError("not_found", "League not found.");

  const cfg = overview.config;
  const requiresPayment = (cfg.entryFeeCents ?? 0) > 0;
  const access = requiresPayment
    ? await hasLeagueAccess(session.id, leagueId, cfg.season).catch(() => false)
    : true;

  if (!access) {
    return jsonError("not_entitled", "This league requires a paid entry to view.");
  }
  return jsonOk<FantasyLeagueResponse>({ overview, access });
}
