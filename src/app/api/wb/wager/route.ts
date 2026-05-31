import { NextResponse } from "next/server";
import { ensureWallet } from "@/lib/wb/ledger";
import { placeWager } from "@/lib/wb/bets";
import { evaluateAchievements } from "@/lib/wb/achievements";
import { redirectError, redirectOk, requireSession } from "@/lib/api/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEST = "/capital/events";

export async function POST(req: Request) {
  const session = await requireSession(req, DEST);
  if (session instanceof NextResponse) return session;
  await ensureWallet(session.id, session.username);

  let eventId = 0;
  let outcomeId = 0;
  let stakeCents = 0;
  try {
    const form = await req.formData();
    eventId = Number(form.get("event_id"));
    outcomeId = Number(form.get("outcome_id"));
    const raw = form.get("stake");
    stakeCents =
      typeof raw === "string" && raw.trim() !== "" ? Math.round(Number(raw) * 100) : 0;
  } catch {
    return redirectError(req, DEST, "Could not parse request.");
  }

  if (!eventId || !outcomeId) return redirectError(req, DEST, "Missing event or outcome.");
  if (!Number.isFinite(stakeCents) || stakeCents <= 0) {
    return redirectError(req, DEST, "Enter a positive stake.");
  }

  const result = await placeWager(session.id, eventId, outcomeId, stakeCents);
  if (!result.ok) return redirectError(req, DEST, result.error);

  await evaluateAchievements(session.id).catch(() => {});

  return redirectOk(req, DEST, "wager=ok");
}
