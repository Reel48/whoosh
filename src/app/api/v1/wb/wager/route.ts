import { NextResponse } from "next/server";
import { ensureWallet } from "@/lib/wb/ledger";
import { placeWager } from "@/lib/wb/bets";
import { evaluateAchievements } from "@/lib/wb/achievements";
import { jsonError, readJson, requireBearerSession, respondResult } from "@/lib/api/json";
import { requireCapability } from "@/lib/api/client";
import type { PlaceWagerRequest, PlaceWagerResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * JSON re-shell of `POST /api/wb/wager`. Same logic (`placeWager`) — bearer auth
 * + JSON in/out instead of cookie session + form POST + redirect. Gated by the
 * `wagering` capability so it can be turned off per client for App Review.
 */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const gate = requireCapability(req, "wagering");
  if (gate) return gate;
  await ensureWallet(session.id, session.username);

  const body = await readJson<Partial<PlaceWagerRequest>>(req);
  if (!body) return jsonError("validation", "Request body must be valid JSON.");

  const eventId = Number(body.eventId);
  const outcomeId = Number(body.outcomeId);
  const stakeCents =
    typeof body.stake === "number" && Number.isFinite(body.stake)
      ? Math.round(body.stake * 100)
      : 0;

  if (!eventId || !outcomeId) {
    return jsonError("validation", "Missing event or outcome.");
  }
  if (stakeCents <= 0) {
    return jsonError("validation", "Enter a positive stake.");
  }

  const result = await placeWager(session.id, eventId, outcomeId, stakeCents);
  // Fire-and-forget on success, exactly as the form route does. respondResult
  // maps the engine's message (insufficient → insufficient_funds, closed/not
  // open → conflict) onto a stable client-switchable code.
  if (result.ok) await evaluateAchievements(session.id).catch(() => {});
  return respondResult<{ wagerId: number }, PlaceWagerResponse>(result, (r) => ({
    wagerId: r.wagerId,
  }));
}
