import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { getNflState } from "@/lib/sleeper/client";
import { listActiveLeagues } from "@/lib/fantasy/leagues";
import { currentScoringWeek } from "@/lib/fantasy/format";
import { ensureMatchupEvents, settleFinishedWeeks } from "@/lib/fantasy/wagers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron: keep fantasy WB wagers in sync. For each active league at the current
 * NFL week, create even-money matchup events (idempotent) and settle any
 * completed prior weeks from final Sleeper scores.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const state = await getNflState();
    const week = currentScoringWeek(state);
    const leagues = await listActiveLeagues();

    const results = [];
    for (const league of leagues) {
      const season = state?.season ?? league.season;
      const [created, settled] = await Promise.all([
        ensureMatchupEvents(league.sleeperLeagueId, season, week).catch((e) => {
          console.error(`ensureMatchupEvents ${league.sleeperLeagueId}:`, e);
          return 0;
        }),
        settleFinishedWeeks(league.sleeperLeagueId, season, week).catch((e) => {
          console.error(`settleFinishedWeeks ${league.sleeperLeagueId}:`, e);
          return 0;
        }),
      ]);
      results.push({ league: league.sleeperLeagueId, created, settled });
    }

    console.log(JSON.stringify({ at: "cron.fantasy_sync", week, results }));
    return NextResponse.json({ ok: true, week, results });
  } catch (e) {
    const error = e instanceof Error ? e.message : "unknown";
    console.error(JSON.stringify({ at: "cron.fantasy_sync", error }));
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
