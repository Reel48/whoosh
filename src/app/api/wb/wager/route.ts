import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ensureWallet } from "@/lib/wb/ledger";
import { placeWager } from "@/lib/wb/bets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      new URL("/api/auth/discord?next=/events", req.url),
      303,
    );
  }
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
    return back(req, "Could not parse request.");
  }

  if (!eventId || !outcomeId) return back(req, "Missing event or outcome.");
  if (!Number.isFinite(stakeCents) || stakeCents <= 0) {
    return back(req, "Enter a positive stake.");
  }

  const result = await placeWager(session.id, eventId, outcomeId, stakeCents);
  if (!result.ok) return back(req, result.error);

  return NextResponse.redirect(new URL("/events?wager=ok", req.url), 303);
}

function back(req: Request, msg: string) {
  return NextResponse.redirect(
    new URL(`/events?error=${encodeURIComponent(msg)}`, req.url),
    303,
  );
}
