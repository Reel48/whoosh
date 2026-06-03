import { NextResponse } from "next/server";
import { listNotifications, markAllRead, countUnread } from "@/lib/wb/notifications";
import { jsonOk, requireBearerSession } from "@/lib/api/json";
import type { MarkReadResponse, NotificationsResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — recent notifications + unread count. */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const [items, unread] = await Promise.all([
    listNotifications(session.id, 15).catch(() => []),
    countUnread(session.id).catch(() => 0),
  ]);
  return jsonOk<NotificationsResponse>({ items, unread });
}

/** POST — mark all notifications read. */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  await markAllRead(session.id).catch(() => {});
  return jsonOk<MarkReadResponse>({ unread: 0 });
}
