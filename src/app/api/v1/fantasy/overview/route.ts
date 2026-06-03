import { NextResponse } from "next/server";
import { getNflState } from "@/lib/sleeper/client";
import { listActiveLeagues, getLeagueOverview, type LeagueOverview } from "@/lib/fantasy/leagues";
import { getCrossLeagueScoreboard } from "@/lib/fantasy/rankings";
import { listPoolSummaries } from "@/lib/fantasy/pools";
import { getLink } from "@/lib/fantasy/link";
import { jsonOk, requireBearerSession } from "@/lib/api/json";
import type { FantasyOverviewResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fantasy home data. Mirrors the loaders in `src/app/fantasy/page.tsx`. */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const [state, leagueConfigs, link, board, pools] = await Promise.all([
    getNflState().catch(() => null),
    listActiveLeagues(),
    getLink(session.id).catch(() => null),
    getCrossLeagueScoreboard().catch(() => ({ rows: [], leagues: [] })),
    listPoolSummaries().catch(() => []),
  ]);

  // H2H ("standard") leagues drive standings/rankings; pools render separately.
  const leagues = (
    await Promise.all(
      leagueConfigs
        .filter((c) => c.kind === "standard")
        .map((c) => getLeagueOverview(c.sleeperLeagueId).catch(() => null)),
    )
  ).filter((o): o is LeagueOverview => o !== null);

  return jsonOk<FantasyOverviewResponse>({ state, link, board, pools, leagues });
}
