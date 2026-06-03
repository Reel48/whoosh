import { NextResponse, type NextRequest } from "next/server";
import { ensureWallet, queryLedger, type LedgerKind } from "@/lib/wb/ledger";
import { jsonOk, requireBearerSession } from "@/lib/api/json";
import type { ActivityResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same grouping the CSV export uses (`/api/wb/activity.csv`), so the JSON and
// CSV views of the ledger filter identically.
const KIND_GROUPS: Record<string, LedgerKind[]> = {
  Purchases: ["purchase", "premium_match"],
  Interest: ["interest"],
  Transfers: ["transfer_in", "transfer_out"],
  Investing: ["invest_buy", "invest_sell", "invest_dividend"],
  Wagers: ["bet_stake", "bet_payout"],
  Bonuses: ["daily_bonus", "referral_reward"],
  Adjustments: ["adjustment"],
};

/** JSON sibling of the CSV activity export. Reuses `queryLedger`. */
export async function GET(req: NextRequest) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  await ensureWallet(session.id, session.username);

  const group = req.nextUrl.searchParams.get("group");
  const since = req.nextUrl.searchParams.get("since") ?? undefined;
  const until = req.nextUrl.searchParams.get("until") ?? undefined;
  const kinds = group && KIND_GROUPS[group] ? KIND_GROUPS[group] : undefined;

  const entries = await queryLedger(session.id, { kinds, since, until, limit: 2000 });
  return jsonOk<ActivityResponse>({ entries });
}
