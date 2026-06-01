import { NextResponse } from "next/server";
import { getLiveScores } from "@/lib/news/scores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live scores for the news ticker. Public ESPN data, no auth needed — but the
 * news section is signed-in anyway. The ScoreTicker polls this every ~45s.
 */
export async function GET() {
  try {
    const games = await getLiveScores();
    return NextResponse.json({ games });
  } catch {
    return NextResponse.json({ games: [] }, { status: 200 });
  }
}
