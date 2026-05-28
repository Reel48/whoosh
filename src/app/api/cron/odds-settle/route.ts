import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runOddsSettle } from "@/lib/wb/oddsSettle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cron: settle finished games for enabled sports from their final scores. */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const results = await runOddsSettle();
    console.log(JSON.stringify({ at: "cron.odds_settle", results }));
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const error = e instanceof Error ? e.message : "unknown";
    console.error(JSON.stringify({ at: "cron.odds_settle", error }));
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
