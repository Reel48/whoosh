import { NextResponse } from "next/server";
import { getNflState, getLeague } from "@/lib/sleeper/client";
import { listActiveLeagues } from "@/lib/fantasy/leagues";
import { getWeekMatchups } from "@/lib/fantasy/matchups";
import { getLink } from "@/lib/fantasy/link";
import { currentScoringWeek } from "@/lib/fantasy/format";
import { jsonOk, requireBearerSession } from "@/lib/api/json";
import type { FantasyMatchupsResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Current scoring week's matchups across H2H leagues. Mirrors the loaders in
 * `src/app/fantasy/matchups/page.tsx` (pools have no matchups, so they're
 * skipped). Wager info is placed via the unified `POST /api/v1/wb/wager`, so it
 * is not bundled here.
 */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const [configs, link, state] = await Promise.all([
    listActiveLeagues(),
    getLink(session.id).catch(() => null),
    getNflState().catch(() => null),
  ]);
  const week = currentScoringWeek(state);

  const blocks = (
    await Promise.all(
      configs
        .filter((c) => c.kind === "standard")
        .map(async (c) => {
          const season = state?.season ?? c.season;
          const [league, matchups] = await Promise.all([
            getLeague(c.sleeperLeagueId).catch(() => null),
            getWeekMatchups(c.sleeperLeagueId, week, link?.sleeperUserId).catch(() => []),
          ]);
          return {
            leagueId: c.sleeperLeagueId,
            leagueName: c.name?.trim() || league?.name || "League",
            season,
            matchups,
          };
        }),
    )
  ).filter((b) => b.matchups.length > 0);

  return jsonOk<FantasyMatchupsResponse>({ week, blocks });
}
