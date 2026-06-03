import { NextResponse } from "next/server";
import { ensureWallet } from "@/lib/wb/ledger";
import { claimDailyBonus, getUserStreak, hasClaimedToday } from "@/lib/wb/bonus";
import { evaluateAchievements } from "@/lib/wb/achievements";
import { jsonError, jsonOk, requireBearerSession } from "@/lib/api/json";
import type { BonusStatusResponse, ClaimBonusResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Whether today's daily bonus is still claimable + the current streak. Lets the
 * client surface the bonus prominently when unclaimed.
 */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const [claimed, streak] = await Promise.all([
    hasClaimedToday(session.id),
    getUserStreak(session.id),
  ]);
  return jsonOk<BonusStatusResponse>({ available: !claimed, streak });
}

/**
 * JSON re-shell of `POST /api/wb/bonus`. `claimDailyBonus` is idempotent per day
 * — `claimed:false` means "already claimed today", not an error.
 */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  await ensureWallet(session.id, session.username);

  try {
    const result = await claimDailyBonus(session.id);
    await evaluateAchievements(session.id).catch(() => {});
    return jsonOk<ClaimBonusResponse>(result);
  } catch (e) {
    return jsonError("internal", e instanceof Error ? e.message : "Could not claim bonus.");
  }
}
