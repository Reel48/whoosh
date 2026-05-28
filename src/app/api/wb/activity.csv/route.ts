import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ensureWallet, queryLedger, type LedgerKind } from "@/lib/wb/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND_GROUPS: Record<string, LedgerKind[]> = {
  Purchases: ["purchase", "premium_match"],
  Interest: ["interest"],
  Transfers: ["transfer_in", "transfer_out"],
  Investing: ["invest_buy", "invest_sell", "invest_dividend"],
  Wagers: ["bet_stake", "bet_payout"],
  Bonuses: ["daily_bonus", "referral_reward"],
  Adjustments: ["adjustment"],
};

function csvEscape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  await ensureWallet(session.id, session.username);

  const group = req.nextUrl.searchParams.get("group");
  const since = req.nextUrl.searchParams.get("since") ?? undefined;
  const until = req.nextUrl.searchParams.get("until") ?? undefined;
  const kinds = group && KIND_GROUPS[group] ? KIND_GROUPS[group] : undefined;

  const entries = await queryLedger(session.id, {
    kinds,
    since,
    until,
    limit: 2000,
  });

  const header = "id,created_at,kind,amount_wb,memo\n";
  const body = entries
    .map((e) =>
      [
        e.id.toString(),
        e.createdAt,
        e.kind,
        (e.amountCents / 100).toFixed(2),
        csvEscape(e.memo ?? ""),
      ].join(","),
    )
    .join("\n");

  return new NextResponse(header + body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="whoosh-activity-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
