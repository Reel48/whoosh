import { NextResponse } from "next/server";
import { ensureWallet } from "@/lib/wb/ledger";
import { addToWatchlist, getWatchlist, removeFromWatchlist } from "@/lib/wb/watchlist";
import { jsonError, jsonOk, readJson, requireBearerSession } from "@/lib/api/json";
import type {
  WatchlistMutateRequest,
  WatchlistMutateResponse,
  WatchlistResponse,
} from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — the signed-in user's watched symbols. */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const items = await getWatchlist(session.id);
  return jsonOk<WatchlistResponse>({ items });
}

/** POST — add/remove a symbol. JSON re-shell of `POST /api/wb/watchlist`. */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  await ensureWallet(session.id, session.username);

  const body = await readJson<WatchlistMutateRequest>(req);
  if (!body) return jsonError("validation", "Request body must be valid JSON.");

  const symbol = String(body.symbol ?? "").toUpperCase().trim();
  const action: "add" | "remove" = body.action === "remove" ? "remove" : "add";
  if (!symbol) return jsonError("validation", "Symbol required.");

  try {
    if (action === "remove") await removeFromWatchlist(session.id, symbol);
    else await addToWatchlist(session.id, symbol);
  } catch (e) {
    return jsonError("internal", e instanceof Error ? e.message : "Watchlist failed.");
  }

  return jsonOk<WatchlistMutateResponse>({ symbol, watching: action === "add" });
}
