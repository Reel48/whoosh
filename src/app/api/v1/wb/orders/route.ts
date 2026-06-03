import { NextResponse } from "next/server";
import { getRecentOrders } from "@/lib/wb/invest";
import { jsonOk, requireBearerSession } from "@/lib/api/json";
import type { OrdersResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The user's recent investing orders (newest first). */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const orders = await getRecentOrders(session.id);
  return jsonOk<OrdersResponse>({ orders });
}
