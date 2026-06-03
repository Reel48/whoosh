import { getLiveScores } from "@/lib/news/scores";
import { jsonOk } from "@/lib/api/json";
import type { ScoresResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public live scores. Mirrors `/api/news/scores`. */
export async function GET() {
  try {
    const games = await getLiveScores();
    return jsonOk<ScoresResponse>({ games });
  } catch {
    return jsonOk<ScoresResponse>({ games: [] });
  }
}
