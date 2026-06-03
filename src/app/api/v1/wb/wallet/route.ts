import { NextResponse } from "next/server";
import { ensureWallet } from "@/lib/wb/ledger";
import { loadDashboard } from "@/lib/wb/dashboard";
import { jsonOk, requireBearerSession } from "@/lib/api/json";
import type { WalletResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * JSON read endpoint backing the Capital/WB dashboard. Returns the same
 * `DashboardData` the cookie-bound Server Component at `/capital/wallet`
 * renders, so web and the future iOS client share one source of truth.
 */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  await ensureWallet(session.id, session.username);

  const data = await loadDashboard(session.id);
  return jsonOk<WalletResponse>(data);
}
