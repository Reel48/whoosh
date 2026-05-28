import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ensureWallet } from "@/lib/wb/ledger";
import { claimDailyBonus } from "@/lib/wb/bonus";
import { evaluateAchievements } from "@/lib/wb/achievements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      new URL("/api/auth/discord?next=/wallet", req.url),
      303,
    );
  }
  await ensureWallet(session.id, session.username);
  try {
    const result = await claimDailyBonus(session.id);
    await evaluateAchievements(session.id).catch(() => {});
    const dest = result.claimed
      ? `/wallet?bonus=ok&streak=${result.streak}&amount=${result.amountCents}`
      : "/wallet?bonus=already";
    return NextResponse.redirect(new URL(dest, req.url), 303);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not claim bonus.";
    return NextResponse.redirect(
      new URL(`/wallet?error=${encodeURIComponent(msg)}`, req.url),
      303,
    );
  }
}
