import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { refreshPlayers } from "@/lib/sleeper/players";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The full player map is large; give the refresh room to complete.
export const maxDuration = 60;

/** Cron: refresh the cached Sleeper player index (run at most once/day). */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const written = await refreshPlayers();
    console.log(JSON.stringify({ at: "cron.sleeper_players", written }));
    return NextResponse.json({ ok: true, written });
  } catch (e) {
    const error = e instanceof Error ? e.message : "unknown";
    console.error(JSON.stringify({ at: "cron.sleeper_players", error }));
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
