import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runOddsSync } from "@/lib/wb/oddsSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cron: pull odds for enabled sports and upsert them as betting events. */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const results = await runOddsSync();
    console.log(JSON.stringify({ at: "cron.odds_sync", results }));
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const error = e instanceof Error ? e.message : "unknown";
    console.error(JSON.stringify({ at: "cron.odds_sync", error }));
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
