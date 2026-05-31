import { NextResponse } from "next/server";
import { ensureWallet } from "@/lib/wb/ledger";
import { claimDailyBonus } from "@/lib/wb/bonus";
import { evaluateAchievements } from "@/lib/wb/achievements";
import { redirectError, redirectOk, requireSession } from "@/lib/api/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEST = "/capital/wallet";

export async function POST(req: Request) {
  const session = await requireSession(req, DEST);
  if (session instanceof NextResponse) return session;
  await ensureWallet(session.id, session.username);
  try {
    const result = await claimDailyBonus(session.id);
    await evaluateAchievements(session.id).catch(() => {});
    return result.claimed
      ? redirectOk(req, DEST, `bonus=ok&streak=${result.streak}&amount=${result.amountCents}`)
      : redirectOk(req, DEST, "bonus=already");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not claim bonus.";
    return redirectError(req, DEST, msg);
  }
}
