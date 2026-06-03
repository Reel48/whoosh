import { NextResponse } from "next/server";
import { ensureWallet } from "@/lib/wb/ledger";
import { loadDashboard } from "@/lib/wb/dashboard";
import { getCrossLeagueScoreboard } from "@/lib/fantasy/rankings";
import { getLink } from "@/lib/fantasy/link";
import { fetchFeed, DEFAULT_SPORT } from "@/lib/news/espn";
import { SECTIONS } from "@/lib/sections";
import { jsonOk, requireBearerSession } from "@/lib/api/json";
import type { HomeResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One call powering the iOS logged-in landing screen. Composes the same loaders
 * as the web home (`src/app/home/page.tsx`) so the app doesn't orchestrate 4–5
 * round-trips on launch. Omits the web-only Discord online-count.
 */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  await ensureWallet(session.id, session.username);

  const [capital, board, topArticles, fantasyLink] = await Promise.all([
    loadDashboard(session.id),
    getCrossLeagueScoreboard().catch(() => ({ rows: [], leagues: [] })),
    fetchFeed(DEFAULT_SPORT).catch(() => []),
    getLink(session.id).catch(() => null),
  ]);

  return jsonOk<HomeResponse>({
    capital,
    board,
    topArticle: topArticles[0] ?? null,
    fantasyLink,
    sections: Object.values(SECTIONS),
  });
}
