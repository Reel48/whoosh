import { NextResponse } from "next/server";
import { ensureWallet } from "@/lib/wb/ledger";
import { placeWager } from "@/lib/wb/bets";
import { evaluateAchievements } from "@/lib/wb/achievements";
import { requireSession } from "@/lib/api/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only allow redirects back into our own app, never an open redirect. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/fantasy/matchups";
}

function back(req: Request, next: string, params: Record<string, string>): NextResponse {
  const url = new URL(next, req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

/**
 * Place a Whoosh Bucks wager on a fantasy matchup. Reuses the shared wager
 * engine (placeWager → bet_stake ledger). Stake is entered in whole Whoosh
 * Bucks (matching the Capital events form, which treats the field as WB).
 */
export async function POST(req: Request) {
  const session = await requireSession(req, "/fantasy/matchups");
  if (session instanceof NextResponse) return session;
  await ensureWallet(session.id, session.username);

  let eventId = 0;
  let outcomeId = 0;
  let stakeCents = 0;
  let next = "/fantasy/matchups";
  try {
    const form = await req.formData();
    eventId = Number(form.get("event_id"));
    outcomeId = Number(form.get("outcome_id"));
    next = safeNext(String(form.get("next") ?? "/fantasy/matchups"));
    const raw = form.get("stake");
    stakeCents =
      typeof raw === "string" && raw.trim() !== "" ? Math.round(Number(raw) * 100) : 0;
  } catch {
    return back(req, "/fantasy/matchups", { fwager: "error", fmsg: "Could not read the form." });
  }

  if (!eventId || !outcomeId) return back(req, next, { fwager: "error", fmsg: "Missing matchup or pick." });
  if (!Number.isFinite(stakeCents) || stakeCents <= 0) {
    return back(req, next, { fwager: "error", fmsg: "Enter a positive stake." });
  }

  const result = await placeWager(session.id, eventId, outcomeId, stakeCents);
  if (!result.ok) return back(req, next, { fwager: "error", fmsg: result.error });

  await evaluateAchievements(session.id).catch(() => {});
  return back(req, next, { fwager: "ok" });
}
